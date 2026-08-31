"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/hooks/use-auth-fetch";
import { isAuthenticationRequired } from "@/lib/auth-config";
import { LoginPage } from "@/components/auth/login-page";
import { Header } from "@/components/redis/header";
import { StatsCards } from "@/components/redis/stats-cards";
import { KeyList } from "@/components/redis/key-list";
import { KeyViewer } from "@/components/redis/key-viewer";
import { AddKeyDialog } from "@/components/redis/add-key-dialog";
import type { ConnectionConfig } from "@/components/redis/connection-screen";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RedisKey, RedisStats } from "@/lib/redis-mock-data";
import { ChevronDown, ChevronUp } from "lucide-react";

// Get default Redis connection from environment variables
function getDefaultConnection(): ConnectionConfig {
  return {
    host: process.env.NEXT_PUBLIC_REDIS_HOST || "localhost",
    port: process.env.NEXT_PUBLIC_REDIS_PORT || "6379",
    database: process.env.NEXT_PUBLIC_REDIS_DATABASE || "0",
    useAuth: false,
    username: "",
    password: "",
    useTLS: false,
  };
}

function buildApiConfig(conn: ConnectionConfig) {
  return {
    host: conn.host,
    port: parseInt(conn.port),
    database: parseInt(conn.database),
    useAuth: conn.useAuth,
    username: conn.username,
    password: conn.password,
    useTLS: conn.useTLS,
  };
}

const defaultStats: RedisStats = {
  connectedClients: 0,
  usedMemory: "0B",
  usedMemoryPeak: "0B",
  totalKeys: 0,
  expiredKeys: 0,
  evictedKeys: 0,
  hitRate: 0,
  opsPerSec: 0,
  uptimeDays: 0,
};

export default function RedisUI() {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const requiresAuth = isAuthenticationRequired();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [stats, setStats] = useState<RedisStats>(defaultStats);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  // Set when the API rejects us as authenticated-but-not-permitted (403), so
  // that lack of access is visible instead of looking like an empty database.
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);

  useEffect(() => {
    const savedTheme = localStorage.getItem("redis-ui-theme") as
      | "light"
      | "dark"
      | null;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");

    // Initialize connection (use saved or default)
    const savedConnection = localStorage.getItem("redis-ui-connection");
    if (savedConnection) {
      try {
        setConnection(JSON.parse(savedConnection));
      } catch (e) {
        console.error("Failed to parse saved connection", e);
        // Use default on error
        const defaultConn = getDefaultConnection();
        setConnection(defaultConn);
        localStorage.setItem(
          "redis-ui-connection",
          JSON.stringify(defaultConn),
        );
      }
    } else {
      // No saved connection, use default from environment
      const defaultConn = getDefaultConnection();
      setConnection(defaultConn);
      localStorage.setItem("redis-ui-connection", JSON.stringify(defaultConn));
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("redis-ui-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Fetch keys from Redis
  const fetchKeys = useCallback(
    async (conn: ConnectionConfig) => {
      console.log("fetchKeys called with connection:", conn);
      setIsLoadingKeys(true);
      try {
        const config = buildApiConfig(conn);
        console.log("API config:", config);
        // Scan in a loop to get all keys (up to a reasonable limit)
        let allKeys: RedisKey[] = [];
        let cursor = "0";
        let iterations = 0;
        const maxIterations = 20; // Safety limit

        do {
          // Use authenticated fetch (includes Azure AD token like acpanel)
          const response = await authFetch("/api/redis/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config, cursor, count: 500 }),
          });

          const data = await response.json();
          console.log("Keys API response:", data);
          if (!data.success) {
            console.error("Keys fetch failed:", data);
            if (response.status === 403) {
              setAccessError(
                data.error || "Your account is not authorized to use this application.",
              );
            }
            break;
          }
          setAccessError(null);

          allKeys = [...allKeys, ...data.keys];
          cursor = data.cursor;
          iterations++;
        } while (cursor !== "0" && iterations < maxIterations);

        console.log("Total keys fetched:", allKeys.length);

        // Dedupe by key name (scan can return duplicates)
        const seen = new Set<string>();
        const deduped = allKeys.filter((k) => {
          if (seen.has(k.key)) return false;
          seen.add(k.key);
          return true;
        });

        deduped.sort((a, b) => a.key.localeCompare(b.key));
        console.log("Final deduped keys:", deduped.length);
        setKeys(deduped);
      } catch (error) {
        console.error("fetchKeys error:", error);
        // Connection error - keys stay empty
      } finally {
        setIsLoadingKeys(false);
      }
    },
    [authFetch],
  );

  // Fetch stats from Redis
  const fetchStats = useCallback(
    async (conn: ConnectionConfig) => {
      setIsLoadingStats(true);
      try {
        const config = buildApiConfig(conn);
        // Use authenticated fetch (includes Azure AD token like acpanel)
        const response = await authFetch("/api/redis/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        });

        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch {
        // Stats stay default
      } finally {
        setIsLoadingStats(false);
      }
    },
    [authFetch],
  );

  // Load data when connection is established
  useEffect(() => {
    console.log("Connection changed, current connection:", connection);
    console.log(
      "Is authenticated:",
      isAuthenticated,
      "Requires auth:",
      requiresAuth,
    );

    // Only fetch data if:
    // 1. Connection exists AND
    // 2. Either auth is not required OR user is authenticated
    if (connection && (!requiresAuth || isAuthenticated)) {
      console.log("Calling fetchKeys and fetchStats");
      fetchKeys(connection);
      fetchStats(connection);
    }
  }, [connection, fetchKeys, fetchStats, isAuthenticated, requiresAuth]);

  // Select a key and fetch its full value
  const handleSelectKey = useCallback(
    async (keyStub: RedisKey) => {
      if (!connection) return;
      // Show the key immediately with stub data, then fetch full value
      setSelectedKey({ ...keyStub, value: keyStub.value ?? "Loading..." });

      try {
        const config = buildApiConfig(connection);
        const response = await authFetch("/api/redis/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, key: keyStub.key }),
        });
        const data = await response.json();
        if (data.success) {
          const fullKey: RedisKey = {
            key: data.data.key,
            type: data.data.type,
            ttl: data.data.ttl,
            size: data.data.size,
            value: data.data.value,
            encoding: data.data.encoding,
            javaShape: data.data.javaShape,
            decodeError: data.data.decodeError,
          };
          setSelectedKey(fullKey);
          // Also update the key in the list with latest metadata
          setKeys((prev) =>
            prev.map((k) =>
              k.key === fullKey.key
                ? {
                    ...k,
                    ttl: fullKey.ttl,
                    size: fullKey.size,
                    type: fullKey.type as RedisKey["type"],
                  }
                : k,
            ),
          );
        }
      } catch {
        // Keep stub data
      }
    },
    [connection, authFetch],
  );

  // Add a new key
  const handleAddKey = useCallback(
    async (newKey: RedisKey) => {
      if (!connection) return;
      try {
        const config = buildApiConfig(connection);
        await authFetch("/api/redis/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config,
            key: newKey.key,
            type: newKey.type,
            value: newKey.value,
            ttl: newKey.ttl,
          }),
        });
        // Refresh keys and stats
        await fetchKeys(connection);
        await fetchStats(connection);
        // Select the new key
        handleSelectKey(newKey);
      } catch {
        // Error adding key
      }
    },
    [connection, fetchKeys, fetchStats, handleSelectKey, authFetch],
  );

  // Update a key's value
  const handleUpdateKey = useCallback(
    async (updatedKey: RedisKey) => {
      if (!connection) return { ok: false, error: "Not connected" };
      try {
        const config = buildApiConfig(connection);
        const response = await authFetch("/api/redis/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config,
            key: updatedKey.key,
            type: updatedKey.type,
            value: updatedKey.value,
            ttl: updatedKey.ttl,
            // Values stored as a Java String are written back in that same
            // format, so the Java services keep reading them.
            javaEncode:
              updatedKey.encoding === "java" &&
              updatedKey.javaShape === "string",
          }),
        });
        const data = await response.json();
        if (!data.success) {
          // Don't update local state — the stored value did not change.
          return { ok: false, error: data.error || "Failed to save" };
        }
        setSelectedKey(updatedKey);
        setKeys((prev) =>
          prev.map((k) => (k.key === updatedKey.key ? updatedKey : k)),
        );
        return { ok: true };
      } catch {
        return { ok: false, error: "Failed to save" };
      }
    },
    [connection, authFetch],
  );

  // Update TTL
  const handleUpdateTTL = useCallback(
    async (key: string, action: "set" | "remove", ttl?: number) => {
      if (!connection) return;
      try {
        const config = buildApiConfig(connection);
        const response = await authFetch("/api/redis/ttl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, key, action, ttl }),
        });
        const data = await response.json();
        if (data.success) {
          const newTTL = data.ttl;
          setSelectedKey((prev) =>
            prev && prev.key === key ? { ...prev, ttl: newTTL } : prev,
          );
          setKeys((prev) =>
            prev.map((k) => (k.key === key ? { ...k, ttl: newTTL } : k)),
          );
        }
      } catch {
        // Error updating TTL
      }
    },
    [connection, authFetch],
  );

  // Delete a key
  const handleDeleteKey = useCallback(
    async (keyName: string) => {
      if (!connection) return;
      try {
        const config = buildApiConfig(connection);
        await authFetch("/api/redis/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, keys: [keyName] }),
        });
        setKeys((prev) => prev.filter((k) => k.key !== keyName));
        if (selectedKey?.key === keyName) {
          setSelectedKey(null);
        }
        fetchStats(connection);
      } catch {
        // Error deleting
      }
    },
    [connection, selectedKey, fetchStats, authFetch],
  );

  // Refresh all data
  const handleRefresh = useCallback(() => {
    if (connection) {
      fetchKeys(connection);
      fetchStats(connection);
    }
  }, [connection, fetchKeys, fetchStats]);

  // Handle refresh interval change
  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(Math.max(10, interval));
  }, []);

  // Handle add key dialog
  const handleOpenAddDialog = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  // Handle manual refresh
  const handleManualRefresh = useCallback(() => {
    if (connection) {
      fetchKeys(connection);
    }
  }, [connection, fetchKeys]);

  // Handle auto-refresh toggle
  const handleToggleAutoRefresh = useCallback((enabled: boolean) => {
    setIsAutoRefresh(enabled);
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (!isAutoRefresh || !connection) return;

    const interval = setInterval(() => {
      fetchKeys(connection);
      fetchStats(connection);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, connection, fetchKeys, fetchStats, refreshInterval]);

  // Show login page if authentication is required and user is not authenticated
  if (requiresAuth && !isAuthenticated) {
    return <LoginPage />;
  }

  // Connection is auto-initialized from environment variables
  if (!connection) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        connection={connection}
      />
      <main className="flex flex-1 flex-col overflow-hidden p-4 lg:p-6 gap-4">
        {accessError && (
          <div className="flex-shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">Access denied</p>
            <p className="mt-1 text-sm text-muted-foreground">{accessError}</p>
          </div>
        )}
        {/* System Status - Top Level */}
        <section className="flex-shrink-0">
          <div
            className="mb-4 flex cursor-pointer items-center gap-2"
            onClick={() => setShowStats(!showStats)}
          >
            <h2 className="text-lg font-semibold tracking-tight">
              System Status
            </h2>
            {showStats ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {showStats && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
              <StatsCards stats={stats} isLoading={isLoadingStats} />
            </div>
          )}
        </section>

        {/* Main Content Area - Key List + Viewer */}
        <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
          {/* Data Explorer Section (Keys + Viewer) */}
          <section className="flex flex-1 flex-col min-w-0 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight flex-shrink-0">
              Data Explorer
            </h2>
            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
              {/* Column 1: Key List */}
              <div className="w-96 flex-shrink-0 flex flex-col">
                <KeyList
                  keys={keys}
                  selectedKey={selectedKey}
                  onSelectKey={handleSelectKey}
                  onAddKey={handleOpenAddDialog}
                  onDeleteKey={handleDeleteKey}
                  onRefresh={handleManualRefresh}
                  isLoading={isLoadingKeys}
                  isAutoRefresh={isAutoRefresh}
                  onToggleAutoRefresh={handleToggleAutoRefresh}
                  refreshInterval={refreshInterval}
                  onRefreshIntervalChange={handleRefreshIntervalChange}
                />
              </div>

              {/* Column 2: Data Viewer */}
              <div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
                <KeyViewer
                  keyData={selectedKey}
                  onUpdateKey={handleUpdateKey}
                  onDeleteKey={handleDeleteKey}
                  onUpdateTTL={handleUpdateTTL}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <AddKeyDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddKey={handleAddKey}
      />
    </div>
  );
}
