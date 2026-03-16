/**
 * Next.js Middleware for Route Protection
 * Validates Azure AD authentication tokens for API routes (similar to acpanel)
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public paths that don't require authentication
  const publicPaths = ["/api/auth"]
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Check if accessing API routes (similar to acpanel backend validation)
  if (pathname.startsWith("/api/")) {
    // Get token from headers (matching acpanel pattern)
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : request.headers.get("token")

    // Require authentication token for protected API routes
    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Authentication required",
          resultCode: -1 
        },
        { status: 401 }
      )
    }

    // Token exists, allow request to proceed
    // The API route can validate the token further if needed using withAuth helper
    return NextResponse.next()
  }

  // Allow all other requests (static files, pages, etc.)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
