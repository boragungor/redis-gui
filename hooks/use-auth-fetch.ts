/**
 * Custom hook for making authenticated API calls
 * Automatically attaches Azure AD access token to requests
 */

import { useAuth } from "@/lib/auth-context"
import { useCallback } from "react"

export function useAuthenticatedFetch() {
  const { getAccessToken, isAuthenticated } = useAuth()

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!isAuthenticated) {
        throw new Error("User not authenticated")
      }

      // Get access token
      const token = await getAccessToken()
      
      if (!token) {
        throw new Error("Failed to get access token")
      }

      // Add token to headers
      const headers = new Headers(options.headers || {})
      headers.set("Authorization", `Bearer ${token}`)
      headers.set("token", token) // Also set custom token header for compatibility

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers,
      })

      return response
    },
    [getAccessToken, isAuthenticated]
  )

  return { authFetch, isAuthenticated }
}
