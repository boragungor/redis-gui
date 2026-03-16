/**
 * Example Protected API Route
 * Demonstrates how to use Azure AD authentication in API routes
 */

import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"

/**
 * GET /api/auth/me
 * Returns current user information from Azure AD token
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    return NextResponse.json({
      success: true,
      user: {
        id: user.oid,
        name: user.name,
        email: user.email,
        username: user.preferred_username,
        roles: user.roles || [],
        groups: user.groups || [],
      },
    })
  })
}

/**
 * POST /api/auth/me
 * Example of a protected POST endpoint
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    const body = await request.json()
    
    // Your protected logic here
    // Access user information from the verified token
    console.log(`User ${user.name} (${user.oid}) made a request`)
    
    return NextResponse.json({
      success: true,
      message: "Protected endpoint accessed successfully",
      user: {
        id: user.oid,
        name: user.name,
      },
      receivedData: body,
    })
  })
}
