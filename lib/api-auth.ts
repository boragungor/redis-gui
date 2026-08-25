/**
 * API Authentication Helper
 * Validates Azure AD tokens in API routes
 */

import { NextRequest } from "next/server"
import { jwtVerify, createRemoteJWKSet, SignJWT } from "jose"

interface TokenPayload {
  oid: string // Object ID (user ID)
  name?: string
  preferred_username?: string
  email?: string
  roles?: string[]
  groups?: string[]
  authType?: "azure" | "mongodb"
}

/**
 * Secret used to sign and verify MongoDB session JWTs.
 * Must be set in production; throwing here prevents silently issuing
 * unverifiable tokens.
 */
const MIN_JWT_SECRET_LENGTH = 32

function getMongoJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is not configured")
  }
  // A short secret is brute-forceable offline from a single captured token, and
  // a forged MongoDB-session JWT would then pass withAuth on every route. Fail
  // closed rather than sign with a weak key.
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `AUTH_JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
        `(got ${secret.length}). Generate one with: openssl rand -base64 48`,
    )
  }
  return new TextEncoder().encode(secret)
}

/**
 * Issue a signed JWT for a MongoDB-authenticated user.
 * Replaces the previous opaque random token that the server could not verify.
 */
export async function signMongoToken(payload: {
  userId: string | number
  username: string
  name?: string
  email?: string
  expiresInSeconds: number
}): Promise<string> {
  return new SignJWT({
    oid: String(payload.userId),
    name: payload.name,
    email: payload.email,
    preferred_username: payload.username,
    authType: "mongodb",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + payload.expiresInSeconds)
    .sign(getMongoJwtSecret())
}

/**
 * Verify a MongoDB session JWT signed by signMongoToken.
 */
async function verifyMongoToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getMongoJwtSecret())
    if (payload.authType !== "mongodb") return null
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

/**
 * Extract token from request headers
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  // Fallback to custom token header (matching acpanel pattern)
  return request.headers.get("token")
}

/**
 * Verify Azure AD token
 * This validates the token signature and claims
 */
export async function verifyAzureToken(token: string): Promise<TokenPayload | null> {
  try {
    const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID
    if (!tenantId) {
      console.error("Azure AD Tenant ID not configured")
      return null
    }

    // Azure AD JWKS endpoint
    const JWKS = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    )

    // Verify the token
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      audience: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID,
    })

    return payload as unknown as TokenPayload
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}

/**
 * Get user ID from token
 */
export function getUserIdFromToken(payload: TokenPayload): string {
  return payload.oid
}

/**
 * Get username from token
 */
export function getUsernameFromToken(payload: TokenPayload): string {
  return payload.name || payload.preferred_username || payload.email || "Unknown User"
}

/**
 * Check if user has specific role
 */
export function hasRole(payload: TokenPayload, role: string): boolean {
  return payload.roles?.includes(role) || payload.groups?.includes(role) || false
}

/**
 * Middleware helper for protected API routes
 * Usage in API route:
 * 
 * ```typescript
 * import { withAuth } from "@/lib/api-auth"
 * 
 * export async function POST(request: Request) {
 *   return withAuth(request, async (user) => {
 *     // Your protected API logic here
 *     return NextResponse.json({ success: true, user })
 *   })
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: (user: TokenPayload) => Promise<Response>
): Promise<Response> {
  const token = getTokenFromRequest(request)

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  // Accept either an Azure AD token or a MongoDB-session JWT.
  const user = (await verifyMongoToken(token)) ?? (await verifyAzureToken(token))

  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  return handler(user)
}
