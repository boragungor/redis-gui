"use client";

/**
 * MSAL Provider Wrapper
 * Initializes MSAL and provides authentication context
 */

import React, { ReactNode, useState, useEffect } from "react";
import { MsalProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  EventType,
  EventMessage,
  AuthenticationResult,
} from "@azure/msal-browser";
import { msalConfig, isAzureAdConfigured } from "./auth-config";
import { AuthProvider } from "./auth-context";

// Initialize MSAL instance
let msalInstance: PublicClientApplication | null = null;

if (typeof window !== "undefined" && isAzureAdConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig);

  // Optional - Handle redirect promises
  msalInstance
    .initialize()
    .then(() => {
      // Account selection logic is app dependent. Adjust as needed for your use case.
      const accounts = msalInstance!.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance!.setActiveAccount(accounts[0]);
      }

      msalInstance!.addEventCallback((event: EventMessage) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
          const payload = event.payload as AuthenticationResult;
          const account = payload.account;
          msalInstance!.setActiveAccount(account);
        }
      });

      return msalInstance!.handleRedirectPromise();
    })
    .catch((error) => {
      console.error("MSAL initialization error:", error);
    });
}

interface MSALProviderWrapperProps {
  children: ReactNode;
}

export function MSALProviderWrapper({ children }: MSALProviderWrapperProps) {
  const [hasMongoSession, setHasMongoSession] = useState(false);

  useEffect(() => {
    // Check for MongoDB session on mount
    const checkMongoSession = () => {
      const mongoSession = localStorage.getItem("mongodb-session");
      setHasMongoSession(!!mongoSession);
    };

    checkMongoSession();

    // Listen for storage changes (in case of logout/login in another tab)
    window.addEventListener("storage", checkMongoSession);
    return () => window.removeEventListener("storage", checkMongoSession);
  }, []);

  // If MongoDB session exists, skip MSAL entirely
  if (hasMongoSession) {
    console.log("MongoDB session detected, using AuthProvider without MSAL");
    return <AuthProvider useMsal={false}>{children}</AuthProvider>;
  }

  // If Azure AD is configured and no MongoDB session, use MSAL provider
  if (msalInstance && isAzureAdConfigured()) {
    return (
      <MsalProvider instance={msalInstance}>
        <AuthProvider useMsal={true}>{children}</AuthProvider>
      </MsalProvider>
    );
  }

  // If Azure AD is not configured, use AuthProvider without MSAL
  console.warn("Azure AD not configured. Running without authentication.");
  return <AuthProvider useMsal={false}>{children}</AuthProvider>;
}
