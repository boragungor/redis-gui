/**
 * Azure AD Authentication Configuration
 * Based on MSAL.js 3.x for React/Next.js
 */

import { Configuration, PopupRequest } from "@azure/msal-browser"

// Azure AD Configuration from environment variables
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || "http://localhost:3000",
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || "http://localhost:3000",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage", // Store tokens in localStorage
    storeAuthStateInCookie: false, // Set to true for IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }
        switch (level) {
          case 0: // Error
            console.error(message)
            return
          case 1: // Warning
            console.warn(message)
            return
          case 2: // Info
            console.info(message)
            return
          case 3: // Verbose
            console.debug(message)
            return
        }
      },
    },
  },
}

// Partner tenant configuration (for multi-tenant scenarios)
export const partnerMsalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_PARTNER_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_PARTNER_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || "http://localhost:3000",
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || "http://localhost:3000",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
}

// Scopes for authentication requests
export const loginRequest: PopupRequest = {
  scopes: (process.env.NEXT_PUBLIC_AZURE_AD_SCOPES || "User.Read openid profile email").split(" "),
}

// Scopes for Microsoft Graph API token
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphGroupsEndpoint: "https://graph.microsoft.com/v1.0/me/memberOf",
}

// Check if Azure AD is properly configured
export function isAzureAdConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID &&
    process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID
  )
}

// Check if local login is enabled
export function isLocalLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN === "true"
}
