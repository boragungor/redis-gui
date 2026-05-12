/**
 * API Authentication Helper
 * Validates Azure AD tokens in API routes
 */

import { NextRequest } from "next/server"
import { jwtVerify, createRemoteJWKSet } from "jose"

interface TokenPayload {
  oid: string // Object ID (user ID)
  name?: string
  preferred_username?: string
  email?: string
  roles?: string[]
  groups?: string[]
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

  const user = await verifyAzureToken(token)

  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  return handler(user)
}
