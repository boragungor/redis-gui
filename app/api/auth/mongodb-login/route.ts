/**
 * MongoDB Authentication API Route
 * Authenticates users against MongoDB AdminUsers collection (like acpanel)
 */

import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import crypto from "crypto";

interface LoginRequest {
  username: string;
  password: string;
}

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

// Generate random session token
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;

  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 },
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

    // Build MongoDB connection string
    const connectionString = `mongodb://${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@${mongoHost}:${mongoPort}/?authSource=${mongoAuthSource}&readPreference=secondaryPreferred&ssl=true&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true&directConnection=true`;

    // Connect to MongoDB
    client = new MongoClient(connectionString);
    await client.connect();

    const db = client.db(mongoDatabase);
    const collection = db.collection<AdminUser>(mongoCollection);

    // Query for user by username
    const user = await collection.findOne({ Username: username });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Check if user is active (Status = 1)
    if (user.Status !== 1) {
      return NextResponse.json(
        { success: false, error: "User account is inactive" },
        { status: 401 },
      );
    }

    // Hash input password and compare with stored hash
    const hashedPassword = hashPassword(password);
    if (hashedPassword !== user.UserPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Generate session token (valid for 15 minutes like Azure AD)
    const token = generateToken();
    const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

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
