"use client"

/**
 * Authentication Context Provider
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useMsal, useIsAuthenticated } from "@azure/msal-react"
import { AccountInfo } from "@azure/msal-browser"
import { loginRequest } from "./auth-config"

interface AuthContextType {
  isAuthenticated: boolean
  user: AccountInfo | null
  login: () => Promise<void>
  loginPartner: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children, useMsal: shouldUseMsal = true }: { children: ReactNode; useMsal?: boolean }) {
  // Only use MSAL hooks if Azure AD is configured
  let msalData = { instance: null as any, accounts: [] as any[], isAuthenticated: false }
  
  try {
    if (shouldUseMsal) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { instance, accounts } = useMsal()
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const isAuthenticated = useIsAuthenticated()
      msalData = { instance, accounts, isAuthenticated }
    }
  } catch (error) {
    // MSAL not available, use fallback
    console.warn("MSAL not available, using fallback auth provider")
  }

  const { instance, accounts, isAuthenticated: msalAuthenticated } = msalData
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<AccountInfo | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (shouldUseMsal && accounts && accounts.length > 0) {
      setUser(accounts[0])
      setIsAuthenticated(true)
    } else {
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [accounts, shouldUseMsal])

  const login = async () => {
    if (!shouldUseMsal || !instance) {
      console.warn("Azure AD not configured")
      return
    }
    setIsLoading(true)
    try {
      // Use redirect instead of popup (same window login like acpanel)
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error("Login failed:", error)
      setIsLoading(false)
      throw error
    }
  }

  const loginPartner = async () => {
    if (!shouldUseMsal || !instance) {
      console.warn("Azure AD not configured")
      return
    }
    setIsLoading(true)
    try {
      // Mark as partner login
      localStorage.setItem("azure-partner", "true")
      // Use redirect instead of popup (same window login like acpanel)
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error("Partner login failed:", error)
      setIsLoading(false)
      throw error
    }
  }

  const logout = async () => {
    if (!shouldUseMsal || !instance) {
      console.warn("Azure AD not configured")
      return
    }
    setIsLoading(true)
    try {
      // Clear partner flag
      localStorage.removeItem("azure-partner")
      // Clear Redis connection
      localStorage.removeItem("redis-ui-connection")
      
      // Use redirect for logout (same window like acpanel)
      await instance.logoutRedirect({
        postLogoutRedirectUri: "/",
      })
    } catch (error) {
      console.error("Logout failed:", error)
      setIsLoading(false)
    }
  }

  const getAccessToken = async (): Promise<string | null> => {
    if (!shouldUseMsal || !instance || !accounts || accounts.length === 0) {
      return null
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      })
      return response.accessToken
    } catch (error) {
      console.error("Token acquisition failed:", error)
      
      // If silent acquisition fails, try interactive
      try {
        const response = await instance.acquireTokenPopup(loginRequest)
        return response.accessToken
      } catch (popupError) {
        console.error("Interactive token acquisition failed:", popupError)
        return null
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: shouldUseMsal ? msalAuthenticated : isAuthenticated,
        user,
        login,
        loginPartner,
        logout,
        getAccessToken,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
