"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/redis/header"
import { StatsCards } from "@/components/redis/stats-cards"
import { KeyList } from "@/components/redis/key-list"
import { KeyViewer } from "@/components/redis/key-viewer"
import { AddKeyDialog } from "@/components/redis/add-key-dialog"
import { CLITerminal } from "@/components/redis/cli-terminal"
import { ConnectionScreen, type ConnectionConfig } from "@/components/redis/connection-screen"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { safeFetch } from "@/lib/safe-fetch"
import type { RedisKey, RedisStats } from "@/lib/redis-mock-data"
import { ChevronDown, ChevronUp } from "lucide-react"

function buildApiConfig(conn: ConnectionConfig) {
  return {
    host: conn.host,
    port: parseInt(conn.port),
    database: parseInt(conn.database),
    useAuth: conn.useAuth,
    username: conn.username,
    password: conn.password,
    useTLS: conn.useTLS,
  }
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
}

export default function RedisUI() {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [keys, setKeys] = useState<RedisKey[]>([])
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCLI, setShowCLI] = useState(false)
  const [stats, setStats] = useState<RedisStats>(defaultStats)
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [showStats, setShowStats] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem("redis-ui-theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("redis-ui-theme", newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  // Fetch keys from Redis
  const fetchKeys = useCallback(async (conn: ConnectionConfig) => {
    setIsLoadingKeys(true)
    try {
      const config = buildApiConfig(conn)
      // Scan in a loop to get all keys (up to a reasonable limit)
      let allKeys: RedisKey[] = []
      let cursor = "0"
      let iterations = 0
      const maxIterations = 20 // Safety limit

      do {
        const data = await safeFetch<{ keys: RedisKey[]; cursor: string }>("/api/redis/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, cursor, count: 500 }),
        })
        if (!data.success) break

        allKeys = [...allKeys, ...data.keys]
        cursor = data.cursor
        iterations++
      } while (cursor !== "0" && iterations < maxIterations)

      // Dedupe by key name (scan can return duplicates)
      const seen = new Set<string>()
      const deduped = allKeys.filter((k) => {
        if (seen.has(k.key)) return false
        seen.add(k.key)
        return true
      })

      deduped.sort((a, b) => a.key.localeCompare(b.key))
      setKeys(deduped)
    } catch {
      // Connection error - keys stay empty
    } finally {
      setIsLoadingKeys(false)
    }
  }, [])

  // Fetch stats from Redis
  const fetchStats = useCallback(async (conn: ConnectionConfig) => {
    setIsLoadingStats(true)
    try {
      const config = buildApiConfig(conn)
      const data = await safeFetch<{ stats: RedisStats }>("/api/redis/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      })
      if (data.success) {
        setStats(data.stats)
      }
    } catch {
      // Stats stay default
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  // Load data when connection is established
  useEffect(() => {
    if (connection) {
      fetchKeys(connection)
      fetchStats(connection)
    }
  }, [connection, fetchKeys, fetchStats])

  // Select a key and fetch its full value
  const handleSelectKey = useCallback(
    async (keyStub: RedisKey) => {
      if (!connection) return
      // Show the key immediately with stub data, then fetch full value
      setSelectedKey({ ...keyStub, value: keyStub.value ?? "Loading..." })

      try {
        const config = buildApiConfig(connection)
        const data = await safeFetch<{ data: RedisKey }>("/api/redis/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, key: keyStub.key }),
        })
        if (data.success) {
          const fullKey: RedisKey = {
            key: data.data.key,
            type: data.data.type,
            ttl: data.data.ttl,
            size: data.data.size,
            value: data.data.value,
          }
          setSelectedKey(fullKey)
          // Also update the key in the list with latest metadata
          setKeys((prev) =>
            prev.map((k) => (k.key === fullKey.key ? { ...k, ttl: fullKey.ttl, size: fullKey.size, type: fullKey.type as RedisKey["type"] } : k))
          )
        }
      } catch {
        // Keep stub data
      }
    },
    [connection]
  )

  // Add a new key
  const handleAddKey = useCallback(
    async (newKey: RedisKey) => {
      if (!connection) return
      try {
        const config = buildApiConfig(connection)
        await safeFetch("/api/redis/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config,
            key: newKey.key,
            type: newKey.type,
            value: newKey.value,
            ttl: newKey.ttl,
          }),
        })
        // Refresh keys and stats
        await fetchKeys(connection)
        await fetchStats(connection)
        // Select the new key
        handleSelectKey(newKey)
      } catch {
        // Error adding key
      }
    },
    [connection, fetchKeys, fetchStats, handleSelectKey]
  )

  // Update a key's value
  const handleUpdateKey = useCallback(
    async (updatedKey: RedisKey) => {
      if (!connection) return
      try {
        const config = buildApiConfig(connection)
        await safeFetch("/api/redis/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config,
            key: updatedKey.key,
            type: updatedKey.type,
            value: updatedKey.value,
            ttl: updatedKey.ttl,
          }),
        })
        setSelectedKey(updatedKey)
        setKeys((prev) =>
          prev.map((k) => (k.key === updatedKey.key ? updatedKey : k))
        )
      } catch {
        // Error updating
      }
    },
    [connection]
  )

  // Update TTL
  const handleUpdateTTL = useCallback(
    async (key: string, action: "set" | "remove", ttl?: number) => {
      if (!connection) return
      try {
        const config = buildApiConfig(connection)
        const data = await safeFetch<{ ttl: number }>("/api/redis/ttl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, key, action, ttl }),
        })
        if (data.success) {
          const newTTL = data.ttl
          setSelectedKey((prev) => (prev && prev.key === key ? { ...prev, ttl: newTTL } : prev))
          setKeys((prev) => prev.map((k) => (k.key === key ? { ...k, ttl: newTTL } : k)))
        }
      } catch {
        // Error updating TTL
      }
    },
    [connection]
  )

  // Delete a key
  const handleDeleteKey = useCallback(
    async (keyName: string) => {
      if (!connection) return
      try {
        const config = buildApiConfig(connection)
        await safeFetch("/api/redis/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, keys: [keyName] }),
        })
        setKeys((prev) => prev.filter((k) => k.key !== keyName))
        if (selectedKey?.key === keyName) {
          setSelectedKey(null)
        }
        fetchStats(connection)
      } catch {
        // Error deleting
      }
    },
    [connection, selectedKey, fetchStats]
  )

  // CLI command execution
  const handleCLICommand = useCallback(
    async (command: string): Promise<string> => {
      if (!connection) return "(error) Not connected"
      try {
        const config = buildApiConfig(connection)
        const data = await safeFetch<{ result: string }>("/api/redis/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, command }),
        })

        // After certain commands, refresh keys and stats
        const cmd = command.trim().split(/\s+/)[0]?.toUpperCase()
        if (["SET", "DEL", "FLUSHDB", "FLUSHALL", "RENAME", "EXPIRE", "PERSIST", "HSET", "LPUSH", "RPUSH", "SADD", "ZADD", "XADD", "MSET"].includes(cmd || "")) {
          fetchKeys(connection)
          fetchStats(connection)
        }

        return data.result || ""
      } catch (err) {
        return `(error) ${err instanceof Error ? err.message : "Command failed"}`
      }
    },
    [connection, fetchKeys, fetchStats]
  )

  // Refresh all data
  const handleRefresh = useCallback(() => {
    if (connection) {
      fetchKeys(connection)
      fetchStats(connection)
    }
  }, [connection, fetchKeys, fetchStats])

  if (!connection) {
    return <ConnectionScreen onConnect={setConnection} />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleCLI={() => setShowCLI(!showCLI)}
        showCLI={showCLI}
        connection={connection}
        onDisconnect={() => {
          setConnection(null)
          setKeys([])
          setSelectedKey(null)
          setStats(defaultStats)
        }}
      />
      <main className="flex flex-1 flex-col overflow-hidden p-4 lg:p-6">
        {/* System Status - Top Level */}
        <section className="mb-4 flex-shrink-0">
          <div
            className="mb-4 flex cursor-pointer items-center gap-2"
            onClick={() => setShowStats(!showStats)}
          >
            <h2 className="text-lg font-semibold tracking-tight">System Status</h2>
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

        {/* Resizable Content Area */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full p-2">
                <KeyList
                  keys={keys}
                  selectedKey={selectedKey}
                  onSelectKey={handleSelectKey}
                  onAddKey={() => setShowAddDialog(true)}
                  onDeleteKey={handleDeleteKey}
                  onRefresh={() => connection && fetchKeys(connection)}
                  isLoading={isLoadingKeys}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={75}>
              <div className="h-full overflow-y-auto p-4">
                <div className="mx-auto max-w-6xl space-y-6">
                  {/* Data Explorer */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold tracking-tight">Data Explorer</h2>
                    <div className="h-[600px] overflow-hidden rounded-xl border bg-card shadow-sm">
                      <KeyViewer
                        keyData={selectedKey}
                        onUpdateKey={handleUpdateKey}
                        onDeleteKey={handleDeleteKey}
                        onUpdateTTL={handleUpdateTTL}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {showCLI && (
          <div className="hidden w-96 shrink-0 overflow-hidden lg:block border-l bg-muted/10">
            <CLITerminal onCommand={handleCLICommand} />
          </div>
        )}
      </main>

      <AddKeyDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddKey={handleAddKey}
      />
    </div>
  )
}
