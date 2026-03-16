/**
 * Example: Update Redis API routes to use authentication
 * This file shows how to integrate auth with existing Redis operations
 */

import { NextRequest, NextResponse } from "next/server"
import { getTokenFromRequest, verifyAzureToken, getUserIdFromToken } from "@/lib/api-auth"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

/**
 * Helper to check authentication (optional based on config)
 * Returns user info if token is present and valid, null otherwise
 */
async function getAuthenticatedUser(request: NextRequest) {
  const token = getTokenFromRequest(request)
  
  if (!token) {
    return null
  }
  
  return await verifyAzureToken(token)
}

/**
 * Example: Protected Redis Keys endpoint
 * Only returns keys if user is authenticated (when Azure AD is configured)
 * 
 * POST /api/redis/keys-protected
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication if Azure AD is configured
    const user = await getAuthenticatedUser(request)
    
    // If Azure AD is configured but no valid token, reject
    if (process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID && !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    const { config, cursor = "0", count = 100 } = await request.json()

    const result = await withRedis(config as RedisConnectionConfig, async (client) => {
      const [newCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        "*",
        "COUNT",
        count
      )

      // Get type and TTL for each key
      const keysWithMetadata = await Promise.all(
        keys.map(async (key) => {
          const [type, ttl] = await Promise.all([
            client.type(key),
            client.ttl(key),
          ])
          return {
            name: key,
            type,
            ttl: ttl === -1 ? null : ttl,
            size: 0,
          }
        })
      )

      return { cursor: newCursor, keys: keysWithMetadata }
    })

    // Log user action if authenticated
    if (user) {
      console.log(`User ${user.name} (${getUserIdFromToken(user)}) fetched Redis keys`)
    }

    return NextResponse.json({
      success: true,
      ...result,
      user: user ? { id: getUserIdFromToken(user), name: user.name } : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
