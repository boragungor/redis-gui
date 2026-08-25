/**
 * MongoDB Authentication API Route
 * Authenticates users against MongoDB AdminUsers collection (like acpanel)
 */

import { NextRequest, NextResponse } from "next/server";
import { MongoClient, type MongoClientOptions } from "mongodb";
import crypto from "crypto";
import { signMongoToken } from "@/lib/api-auth";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginRateLimit,
} from "@/lib/login-rate-limit";

/** Placeholder used when the client address cannot be established safely. */
const UNATTRIBUTED_IP = "unattributed";

/**
 * Resolve the client address for rate limiting.
 *
 * X-Forwarded-For is set by the client unless something in front of the app
 * overwrites it, so trusting it blindly lets an attacker land every request in
 * a fresh bucket and defeat rate limiting entirely. It is therefore only read
 * when TRUSTED_PROXY_COUNT says how many proxies sit in front of us: with N
 * trusted hops the client address is the Nth entry from the right of the chain.
 *
 * With no trusted proxy configured (the default) the header is ignored and all
 * requests share a placeholder address — the per-username limit still applies,
 * so brute force stays bounded.
 */
function getClientIp(request: NextRequest): string {
  const trustedProxies = Number.parseInt(
    process.env.TRUSTED_PROXY_COUNT || "0",
    10,
  );
  if (!Number.isFinite(trustedProxies) || trustedProxies <= 0) {
    return UNATTRIBUTED_IP;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return UNATTRIBUTED_IP;

  const chain = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const index = chain.length - trustedProxies;
  return index >= 0 && chain[index] ? chain[index] : UNATTRIBUTED_IP;
}

interface LoginRequest {
  username: string;
  password: string;
}

const SESSION_TTL_SECONDS = 15 * 60; // 15 minutes

interface AdminUser {
  AdminUserID: number;
  Username: string;
  UserPassword: string;
  Status: number;
  Firstname?: string;
  Lastname?: string;
  EmailAddress?: string;
  UserRoleID?: string[];
}

// SHA1 hash function (matching acpanel's password hashing)
function hashPassword(password: string): string {
  return crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
}

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;

  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // Require strings — rejects NoSQL operator injection like {"$ne": null}.
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username ||
      !password
    ) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 },
      );
    }

    // Rate limit brute-force attempts. The per-username limit applies even when
    // the client address cannot be trusted, so this cannot be spoofed away.
    const clientIp = getClientIp(request);
    const rl = checkLoginRateLimit(clientIp, username);
    if (rl.limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many failed attempts. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        },
      );
    }

    // MongoDB connection configuration from environment
    const mongoHost = process.env.MONGODB_HOST || "localhost";
    const mongoPort = process.env.MONGODB_PORT || "27017";
    const mongoUsername = process.env.MONGODB_USERNAME;
    const mongoPassword = process.env.MONGODB_PASSWORD;
    const mongoDatabase = process.env.MONGODB_DATABASE || "marketplace_preprod";
    const mongoCollection = process.env.MONGODB_COLLECTION || "AdminUsers";
    const mongoAuthSource = process.env.MONGODB_AUTH_SOURCE || "admin";

    if (!mongoUsername || !mongoPassword) {
      return NextResponse.json(
        { success: false, error: "MongoDB credentials not configured" },
        { status: 500 },
      );
    }

    // Build MongoDB connection string (TLS options set via the options object
    // below rather than the query string, so validation stays on by default).
    const connectionString = `mongodb://${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@${mongoHost}:${mongoPort}/?authSource=${mongoAuthSource}&readPreference=secondaryPreferred&directConnection=true`;

    // TLS is on by default with full certificate + hostname validation.
    // For a private CA, point MONGODB_TLS_CA_FILE at the CA bundle.
    // MONGODB_TLS_INSECURE=true disables validation — dev only, and logs a warning.
    const useTLS = (process.env.MONGODB_TLS ?? "true") !== "false";
    const options: MongoClientOptions = { tls: useTLS };
    if (useTLS) {
      if (process.env.MONGODB_TLS_CA_FILE) {
        options.tlsCAFile = process.env.MONGODB_TLS_CA_FILE;
      }
      if (process.env.MONGODB_TLS_INSECURE === "true") {
        options.tlsAllowInvalidCertificates = true;
        options.tlsAllowInvalidHostnames = true;
        console.warn(
          "MONGODB_TLS_INSECURE=true — MongoDB TLS certificate validation is DISABLED. Do not use in production.",
        );
      }
    }

    // Connect to MongoDB
    client = new MongoClient(connectionString, options);
    await client.connect();

    const db = client.db(mongoDatabase);
    const collection = db.collection<AdminUser>(mongoCollection);

    // Query for user by username
    const user = await collection.findOne({ Username: username });

    if (!user) {
      recordLoginFailure(clientIp, username);
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Check if user is active (Status = 1)
    if (user.Status !== 1) {
      recordLoginFailure(clientIp, username);
      return NextResponse.json(
        { success: false, error: "User account is inactive" },
        { status: 401 },
      );
    }

    // Hash input password and compare with stored hash
    const hashedPassword = hashPassword(password);
    if (hashedPassword !== user.UserPassword) {
      recordLoginFailure(clientIp, username);
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Successful auth — clear the failure counter for this key.
    clearLoginRateLimit(clientIp, username);

    // Issue a signed JWT (valid 15 minutes) the server can verify on each
    // request. Replaces the previous opaque random token.
    const token = await signMongoToken({
      userId: user.AdminUserID,
      username: user.Username,
      name: `${user.Firstname || ""} ${user.Lastname || ""}`.trim() || user.Username,
      email: user.EmailAddress,
      expiresInSeconds: SESSION_TTL_SECONDS,
    });
    const sessionExpiry = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // Return user info and token
    return NextResponse.json({
      success: true,
      data: {
        userId: user.AdminUserID,
        username: user.Username,
        firstname: user.Firstname,
        lastname: user.Lastname,
        email: user.EmailAddress,
        userRoleId: user.UserRoleID || [],
        token,
        tokenExpiry: sessionExpiry.toISOString(),
        authType: "mongodb",
      },
    });
  } catch (error) {
    console.error("MongoDB authentication error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 500 },
    );
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
    }
  }
}
