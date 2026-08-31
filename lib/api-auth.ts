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
  /**
   * For Azure tokens: the app-role / group names Azure put in the token.
   * For MongoDB tokens: the AdminUsers.UserRoleID values we embedded at login.
   * The two namespaces are unrelated and are never compared against each other.
   */
  roles?: string[]
  groups?: string[]
  authType?: "azure" | "mongodb"
}

/**
 * Which verifier accepted the token. Derived from the verification that
 * succeeded, never from a claim inside the token, so it cannot be influenced by
 * whoever minted it.
 */
export type AuthSource = "azure" | "mongodb"

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
  /** AdminUsers.UserRoleID — carried so authorization needs no per-request DB hit. */
  roles?: string[]
  expiresInSeconds: number
}): Promise<string> {
  return new SignJWT({
    oid: String(payload.userId),
    name: payload.name,
    email: payload.email,
    preferred_username: payload.username,
    roles: payload.roles ?? [],
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
 * Authorization.
 *
 * The two login methods are independent and carry unrelated role namespaces:
 *   - Azure AD  -> AUTH_REQUIRED_AZURE_ROLES     (group names, e.g. APP-VF-...)
 *   - MongoDB   -> AUTH_REQUIRED_MONGO_ROLE_IDS  (AdminUsers.UserRoleID UUIDs)
 *
 * They are checked separately and never cross-compared: a value in one
 * namespace can never satisfy a requirement in the other.
 *
 * An empty list means "any authenticated user of that method", which preserves
 * the behaviour from before authorization existed. That is deliberately
 * permissive, so it is announced once per process rather than failing silently.
 */
function parseRoleList(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const announcedOpenAccess = new Set<AuthSource>()

function announceOpenAccessOnce(source: AuthSource, envVar: string) {
  if (announcedOpenAccess.has(source)) return
  announcedOpenAccess.add(source)
  console.warn(
    `[authz] ${envVar} is not set — every successfully authenticated ${source} ` +
      `user may use this application. Set ${envVar} to restrict access.`,
  )
}

/** Whether this verified user satisfies the requirement for their login method. */
export function isAuthorized(source: AuthSource, payload: TokenPayload): boolean {
  if (source === "mongodb") {
    const required = parseRoleList(process.env.AUTH_REQUIRED_MONGO_ROLE_IDS)
    if (required.length === 0) {
      announceOpenAccessOnce(source, "AUTH_REQUIRED_MONGO_ROLE_IDS")
      return true
    }
    // Only `roles`, which we populated from UserRoleID in a token we signed.
    const held = payload.roles ?? []
    return held.some((role) => required.includes(role))
  }

  const required = parseRoleList(process.env.AUTH_REQUIRED_AZURE_ROLES)
  if (required.length === 0) {
    announceOpenAccessOnce(source, "AUTH_REQUIRED_AZURE_ROLES")
    return true
  }
  // Azure may deliver app roles as `roles` or group names as `groups`.
  const held = [...(payload.roles ?? []), ...(payload.groups ?? [])]
  return held.some((role) => required.includes(role))
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

  // Accept either a MongoDB-session JWT or an Azure AD token. The source is
  // taken from whichever verifier succeeded — never from a claim in the token —
  // so the role namespace applied cannot be chosen by the token's issuer.
  let user = await verifyMongoToken(token)
  let source: AuthSource | null = user ? "mongodb" : null

  if (!user) {
    user = await verifyAzureToken(token)
    source = user ? "azure" : null
  }

  if (!user || !source) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  // Authenticated but not permitted: 403, so the client does not treat this as
  // a bad token and retry the login loop.
  if (!isAuthorized(source, user)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Your account is not authorized to use this application.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }

  return handler(user)
}
