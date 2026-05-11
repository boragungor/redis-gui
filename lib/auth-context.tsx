"use client";

/**
 * Authentication Context Provider
 * Provides authentication state and methods throughout the app
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "./auth-config";

interface AuthContextType {
  isAuthenticated: boolean;
  user: AccountInfo | null;
  authType: "azure" | "mongodb" | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  renewToken: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  useMsal: shouldUseMsal = true,
}: {
  children: ReactNode;
  useMsal?: boolean;
}) {
  // Only use MSAL hooks if Azure AD is configured
  let msalData = {
    instance: null as any,
    accounts: [] as any[],
    isAuthenticated: false,
  };

  try {
    if (shouldUseMsal) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { instance, accounts } = useMsal();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const isAuthenticated = useIsAuthenticated();
      msalData = { instance, accounts, isAuthenticated };
    }
  } catch (error) {
    // MSAL not available, use fallback
    console.warn("MSAL not available, using fallback auth provider");
  }

  const { instance, accounts, isAuthenticated: msalAuthenticated } = msalData;
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authType, setAuthType] = useState<"azure" | "mongodb" | null>(null);

  useEffect(() => {
    // Check for MongoDB session first
    const mongoSession = localStorage.getItem("mongodb-session");
    console.log("Auth context checking MongoDB session:", mongoSession);

    if (mongoSession) {
      try {
        const session = JSON.parse(mongoSession);
        // Check if token is still valid
        const tokenExpiry = new Date(session.tokenExpiry);
        console.log(
          "MongoDB session token expiry:",
          tokenExpiry,
          "Current time:",
          new Date(),
        );

        if (tokenExpiry > new Date()) {
          // Create a fake AccountInfo object for MongoDB user
          const mongoUser = {
            homeAccountId: String(session.userId),
            environment: "mongodb",
            tenantId: "mongodb",
            username: session.username,
            localAccountId: String(session.userId),
            name:
              `${session.firstname || ""} ${session.lastname || ""}`.trim() ||
              session.username,
          } as AccountInfo;

          console.log("Setting MongoDB user:", mongoUser);
          setUser(mongoUser);
          setIsAuthenticated(true);
          setAuthType("mongodb");
          return; // Important: stop here, don't check Azure AD
        } else {
          // Token expired, clear session
          console.log("MongoDB token expired, clearing session");
          localStorage.removeItem("mongodb-session");
          localStorage.removeItem("azure-session-start");
        }
      } catch (error) {
        console.error("Invalid MongoDB session:", error);
        localStorage.removeItem("mongodb-session");
        localStorage.removeItem("azure-session-start");
      }
    }

    // Fall back to Azure AD authentication ONLY if no MongoDB session
    console.log("Checking Azure AD authentication, accounts:", accounts);
    if (shouldUseMsal && accounts && accounts.length > 0) {
      setUser(accounts[0]);
      setIsAuthenticated(true);
      setAuthType("azure");
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setAuthType(null);
    }
  }, [shouldUseMsal, accounts?.length, accounts?.[0]?.homeAccountId]);

  const login = useCallback(async () => {
    // Clear any MongoDB session before Azure AD login
    localStorage.removeItem("mongodb-session");
    localStorage.removeItem("azure-session-start");

    if (!shouldUseMsal || !instance) {
      console.warn("Azure AD not configured");
      return;
    }
    setIsLoading(true);
    try {
      // Use redirect instead of popup (same window login like acpanel)
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
      throw error;
    }
  }, [shouldUseMsal, instance]);

  const logout = useCallback(async () => {
    console.log("Logout called, authType:", authType);

    // Check if this is a MongoDB session
    const mongoSession = localStorage.getItem("mongodb-session");
    if (mongoSession || authType === "mongodb") {
      console.log("Logging out MongoDB session");
      // Clear MongoDB session
      localStorage.removeItem("mongodb-session");
      localStorage.removeItem("azure-session-start");
      localStorage.removeItem("redis-ui-connection");
      setUser(null);
      setIsAuthenticated(false);
      setAuthType(null);
      window.location.href = "/";
      return;
    }

    // Handle Azure AD logout
    if (authType === "azure" && shouldUseMsal && instance) {
      console.log("Logging out Azure AD session");
      setIsLoading(true);
      try {
        // Clear Redis connection
        localStorage.removeItem("redis-ui-connection");
        localStorage.removeItem("azure-session-start");

        // Use redirect for logout (same window like acpanel)
        await instance.logoutRedirect({
          postLogoutRedirectUri: "/",
        });
      } catch (error) {
        console.error("Logout failed:", error);
        setIsLoading(false);
      }
    } else {
      console.warn("No active session to logout");
    }
  }, [authType, shouldUseMsal, instance]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Check for MongoDB token first
    const mongoSession = localStorage.getItem("mongodb-session");
    if (mongoSession) {
      try {
        const session = JSON.parse(mongoSession);
        const tokenExpiry = new Date(session.tokenExpiry);
        if (tokenExpiry > new Date()) {
          return session.token;
        } else {
          // Token expired
          localStorage.removeItem("mongodb-session");
          return null;
        }
      } catch (error) {
        console.error("Invalid MongoDB session:", error);
        return null;
      }
    }

    // Fall back to Azure AD token
    if (authType !== "azure" || !shouldUseMsal || !instance || !user) {
      return null;
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: user,
      });
      return response.accessToken;
    } catch (error) {
      console.error("Token acquisition failed:", error);

      // If silent acquisition fails, try interactive
      try {
        const response = await instance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      } catch (popupError) {
        console.error("Interactive token acquisition failed:", popupError);
        return null;
      }
    }
  }, [authType, shouldUseMsal, instance, user]);

  const renewToken = useCallback(async (): Promise<void> => {
    // MongoDB tokens cannot be automatically renewed
    const mongoSession = localStorage.getItem("mongodb-session");
    if (mongoSession) {
      console.warn(
        "MongoDB tokens cannot be automatically renewed. Please re-login.",
      );
      return;
    }

    // Handle Azure AD token renewal
    if (authType !== "azure" || !shouldUseMsal || !instance || !user) {
      console.warn("Cannot renew token: not authenticated");
      return;
    }

    try {
      // Force token renewal by using forceRefresh
      await instance.acquireTokenSilent({
        ...loginRequest,
        account: user,
        forceRefresh: true,
      });
      console.log("Token renewed successfully");
    } catch (error) {
      console.error("Token renewal failed:", error);
      throw error;
    }
  }, [authType, shouldUseMsal, instance, user]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated, // Use the stable internal state
        user,
        authType,
        login,
        logout,
        getAccessToken,
        renewToken,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
