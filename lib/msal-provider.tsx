"use client"

/**
 * MSAL Provider Wrapper
 * Initializes MSAL and provides authentication context
 */

import React, { ReactNode } from "react"
import { MsalProvider } from "@azure/msal-react"
import { PublicClientApplication, EventType, EventMessage, AuthenticationResult } from "@azure/msal-browser"
import { msalConfig, isAzureAdConfigured } from "./auth-config"
import { AuthProvider } from "./auth-context"

// Initialize MSAL instance
let msalInstance: PublicClientApplication | null = null

if (typeof window !== "undefined" && isAzureAdConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig)

  // Optional - Handle redirect promises
  msalInstance
    .initialize()
    .then(() => {
      // Account selection logic is app dependent. Adjust as needed for your use case.
      const accounts = msalInstance!.getAllAccounts()
      if (accounts.length > 0) {
        msalInstance!.setActiveAccount(accounts[0])
      }

      msalInstance!.addEventCallback((event: EventMessage) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
          const payload = event.payload as AuthenticationResult
          const account = payload.account
          msalInstance!.setActiveAccount(account)
        }
      })

      return msalInstance!.handleRedirectPromise()
    })
    .catch((error) => {
      console.error("MSAL initialization error:", error)
    })
}

interface MSALProviderWrapperProps {
  children: ReactNode
}

export function MSALProviderWrapper({ children }: MSALProviderWrapperProps) {
  // If Azure AD is configured, use MSAL provider
  if (msalInstance && isAzureAdConfigured()) {
    return (
      <MsalProvider instance={msalInstance}>
        <AuthProvider useMsal={true}>{children}</AuthProvider>
      </MsalProvider>
    )
  }

  // If Azure AD is not configured, use AuthProvider without MSAL
  console.warn("Azure AD not configured. Running without authentication.")
  return <AuthProvider useMsal={false}>{children}</AuthProvider>
}
