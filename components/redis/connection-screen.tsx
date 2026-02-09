"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Database,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  ShieldOff,
  Server,
  Bookmark,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react"

export interface ConnectionConfig {
  name: string
  host: string
  port: string
  database: string
  useAuth: boolean
  username: string
  password: string
  useTLS: boolean
}

interface ConnectionScreenProps {
  onConnect: (config: ConnectionConfig) => void
}

const DEFAULT_CONFIG: ConnectionConfig = {
  name: "Local Redis",
  host: "127.0.0.1",
  port: "6379",
  database: "0",
  useAuth: false,
  username: "",
  password: "",
  useTLS: false,
}

const PRESET_CONNECTIONS: { label: string; config: Partial<ConnectionConfig> }[] = [
  {
    label: "Local Default",
    config: { name: "Local Redis", host: "127.0.0.1", port: "6379", database: "0", useAuth: false, useTLS: false },
  },
  {
    label: "Docker Default",
    config: { name: "Docker Redis", host: "172.17.0.1", port: "6379", database: "0", useAuth: false, useTLS: false },
  },
  {
    label: "Upstash (Template)",
    config: { name: "Upstash Redis", host: "your-endpoint.upstash.io", port: "6379", database: "0", useAuth: true, username: "default", useTLS: true },
  },
]

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONFIG)
  const [showPassword, setShowPassword] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([])
  const [showSaved, setShowSaved] = useState(false)

  const update = (partial: Partial<ConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    setError(null)
  }

  const applyPreset = (preset: Partial<ConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...preset }))
    setError(null)
  }

  const handleConnect = async () => {
    if (!config.host.trim()) {
      setError("Host is required")
      return
    }
    const portNum = Number.parseInt(config.port, 10)
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port must be a number between 1 and 65535")
      return
    }
    if (config.useAuth && !config.password.trim()) {
      setError("Password is required when authentication is enabled")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const res = await fetch("/api/redis/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.host,
          port: portNum,
          database: parseInt(config.database),
          useAuth: config.useAuth,
          username: config.username,
          password: config.password,
          useTLS: config.useTLS,
        }),
      })

      // Safely parse JSON - the server may return non-JSON on crash
      let data: { success?: boolean; error?: string }
      try {
        data = await res.json()
      } catch {
        setError(
          "Could not connect. If running in the v0 preview, download the project and run locally with 'npm run dev' to connect to a real Redis instance."
        )
        setIsConnecting(false)
        return
      }

      if (!data.success) {
        setError(data.error || "Failed to connect to Redis")
        setIsConnecting(false)
        return
      }
      setIsConnecting(false)
      onConnect(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
      setIsConnecting(false)
    }
  }

  const saveConnection = () => {
    if (!config.name.trim()) return
    setSavedConnections((prev) => {
      const exists = prev.findIndex((c) => c.name === config.name)
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = config
        return updated
      }
      return [...prev, config]
    })
  }

  const removeSaved = (name: string) => {
    setSavedConnections((prev) => prev.filter((c) => c.name !== name))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Logo and heading */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <Database className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Redis UI</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect to your Redis instance to get started
            </p>
          </div>
        </div>

        <Card className="border border-border/60 shadow-lg">
          <CardContent className="p-6">
            {/* Quick presets */}
            <div className="mb-5">
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick Connect
              </Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_CONNECTIONS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.config)}
                    className="rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved connections */}
            {savedConnections.length > 0 && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setShowSaved(!showSaved)}
                  className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  <Bookmark className="h-3 w-3" />
                  Saved Connections ({savedConnections.length})
                  <ChevronDown className={`h-3 w-3 transition-transform ${showSaved ? "rotate-180" : ""}`} />
                </button>
                {showSaved && (
                  <div className="flex flex-col gap-1.5">
                    {savedConnections.map((conn) => (
                      <div
                        key={conn.name}
                        className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => setConfig(conn)}
                          className="flex flex-col items-start text-left"
                        >
                          <span className="text-sm font-medium text-foreground">{conn.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {conn.host}:{conn.port}/{conn.database}
                            {conn.useAuth && " (auth)"}
                            {conn.useTLS && " (TLS)"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSaved(conn.name)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mb-5 h-px bg-border/60" />

            {/* Connection name */}
            <div className="mb-4">
              <Label htmlFor="conn-name" className="mb-1.5 block text-sm font-medium text-foreground">
                Connection Name
              </Label>
              <Input
                id="conn-name"
                value={config.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="My Redis Server"
                className="bg-background"
              />
            </div>

            {/* Host and Port row */}
            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <Label htmlFor="host" className="mb-1.5 block text-sm font-medium text-foreground">
                  Host
                </Label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="host"
                    value={config.host}
                    onChange={(e) => update({ host: e.target.value })}
                    placeholder="127.0.0.1"
                    className="bg-background pl-9"
                  />
                </div>
              </div>
              <div className="w-28">
                <Label htmlFor="port" className="mb-1.5 block text-sm font-medium text-foreground">
                  Port
                </Label>
                <Input
                  id="port"
                  value={config.port}
                  onChange={(e) => update({ port: e.target.value })}
                  placeholder="6379"
                  className="bg-background"
                  type="number"
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            {/* Database select */}
            <div className="mb-5">
              <Label htmlFor="database" className="mb-1.5 block text-sm font-medium text-foreground">
                Database
              </Label>
              <Select value={config.database} onValueChange={(val) => update({ database: val })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      db{i} {i === 0 && "(default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-5 h-px bg-border/60" />

            {/* Auth toggle */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {config.useAuth ? (
                  <Shield className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="use-auth" className="text-sm font-medium text-foreground">
                    Authentication
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {config.useAuth ? "Credentials required" : "No credentials needed"}
                  </p>
                </div>
              </div>
              <Switch
                id="use-auth"
                checked={config.useAuth}
                onCheckedChange={(checked) => update({ useAuth: checked })}
              />
            </div>

            {/* Auth fields - animated reveal */}
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                config.useAuth ? "mb-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-3 pt-1">
                  <div>
                    <Label htmlFor="username" className="mb-1.5 block text-sm font-medium text-foreground">
                      Username
                    </Label>
                    <Input
                      id="username"
                      value={config.username}
                      onChange={(e) => update({ username: e.target.value })}
                      placeholder="default"
                      className="bg-background"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={config.password}
                        onChange={(e) => update({ password: e.target.value })}
                        placeholder="Enter password"
                        className="bg-background pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TLS toggle */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Label htmlFor="use-tls" className="text-sm font-medium text-foreground">
                  TLS / SSL
                </Label>
                <p className="text-xs text-muted-foreground">
                  Encrypt connection
                </p>
              </div>
              <Switch
                id="use-tls"
                checked={config.useTLS}
                onCheckedChange={(checked) => update({ useTLS: checked })}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveConnection}
                className="gap-1.5 bg-transparent"
                disabled={!config.name.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>

            {/* Connection string preview */}
            <div className="mt-4 rounded-md bg-muted/50 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Connection String</p>
              <code className="break-all font-mono text-xs text-foreground/80">
                redis{config.useTLS ? "s" : ""}://
                {config.useAuth && config.username ? `${config.username}:` : ""}
                {config.useAuth && config.password ? `${"*".repeat(Math.min(config.password.length, 8))}@` : ""}
                {config.host || "127.0.0.1"}:{config.port || "6379"}/{config.database || "0"}
              </code>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your credentials are never stored on any server.
        </p>
      </div>
    </div>
  )
}
