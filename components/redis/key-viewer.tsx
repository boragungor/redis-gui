"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type RedisKey,
  typeColors,
  defaultTypeColor,
  formatTTL,
  formatBytes,
} from "@/lib/redis-mock-data"
import {
  Copy,
  Edit,
  Clock,
  Save,
  X,
  Trash2,
  Plus,
  Key,
} from "lucide-react"
import { JsonViewer } from "@/components/redis/json-viewer"

interface KeyViewerProps {
  keyData: RedisKey | null
  onUpdateKey: (key: RedisKey) => void
  onDeleteKey: (key: string) => void
  onUpdateTTL?: (key: string, action: "set" | "remove", ttl?: number) => void
}

export function KeyViewer({ keyData, onUpdateKey, onDeleteKey, onUpdateTTL }: KeyViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [newTTL, setNewTTL] = useState("")
  const [rawWrap, setRawWrap] = useState(true)

  const [currentTTL, setCurrentTTL] = useState<number | null>(null)

  useEffect(() => {
    setCurrentTTL(keyData?.ttl ?? null)
  }, [keyData])

  useEffect(() => {
    if (currentTTL === null || currentTTL <= 0) return

    const interval = setInterval(() => {
      setCurrentTTL((prev) => {
        if (prev === null || prev <= 0) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTTL])

  if (!keyData) {
    return (
      <Card className="flex h-full flex-col items-center justify-center border-border/50">
        <div className="text-center text-muted-foreground">
          <Key className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">Select a key to view its contents</p>
        </div>
      </Card>
    )
  }

  // Helper to recursively parse JSON strings
  const tryParseAndClean = (value: any): { parsed: any; isJson: boolean } => {
    if (typeof value !== "string") return { parsed: value, isJson: false }

    // Clean common prefixes (Java serialization, etc)
    let cleaned = value
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        cleaned = JSON.parse(value)
      } catch {
        // Keep original if parse fails
      }
    } else {
      // Look for JSON start if not already a quoted string
      const jsonStartIndex = value.search(/[{[]/)
      if (jsonStartIndex > 0) {
        cleaned = value.substring(jsonStartIndex)
      }
    }

    // Try parsing as JSON
    try {
      const parsed = JSON.parse(cleaned)
      // If it parsed into a string, recurse (handle double encoding)
      if (typeof parsed === "string") {
        return tryParseAndClean(parsed)
      }
      // If it parsed into an object/array, it's valid JSON
      if (typeof parsed === "object" && parsed !== null) {
        return { parsed, isJson: true }
      }
      return { parsed: cleaned, isJson: false }
    } catch {
      return { parsed: cleaned, isJson: false }
    }
  }

  const colors = typeColors[keyData.type] || defaultTypeColor

  // Parse value for display (both raw and formatted)
  const { parsed: parsedValue, isJson } = tryParseAndClean(keyData.value)

  const handleCopy = () => {
    navigator.clipboard.writeText(
      typeof keyData.value === "string"
        ? keyData.value
        : JSON.stringify(keyData.value, null, 2)
    )
  }

  const handleEdit = () => {
    setEditValue(
      typeof keyData.value === "string"
        ? keyData.value
        : JSON.stringify(keyData.value, null, 2)
    )
    setIsEditing(true)
  }

  const handleSave = () => {
    try {
      const newValue =
        keyData.type === "string" ? editValue : JSON.parse(editValue)
      onUpdateKey({ ...keyData, value: newValue })
      setIsEditing(false)
    } catch {
      // Handle JSON parse error
    }
  }

  const renderValue = () => {
    switch (keyData.type) {
      case "string":
        return (
          <div className="space-y-2">
            {isEditing ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            ) : (
              <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm overflow-x-auto">
                {isJson ? (
                  <JsonViewer data={parsedValue} />
                ) : (
                  <pre className="whitespace-pre-wrap break-all">
                    {typeof keyData.value === 'string' ? keyData.value : JSON.stringify(keyData.value, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )

      case "hash":
        const hashValue = keyData.value as Record<string, string>
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Field</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(hashValue).map(([field, value]) => (
                <TableRow key={field}>
                  <TableCell className="font-mono text-sm font-medium">
                    {field}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )

      case "list":
        const listValue = keyData.value as string[]
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Index</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listValue.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {index}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )

      case "set":
        const setValue = keyData.value as string[]
        return (
          <div className="flex flex-wrap gap-2">
            {setValue.map((item) => (
              <Badge key={item} variant="secondary" className="font-mono">
                {item}
              </Badge>
            ))}
          </div>
        )

      case "zset":
        const zsetValue = keyData.value as Array<{ member: string; score: number }>
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="w-24 text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zsetValue.map((item, index) => (
                <TableRow key={item.member}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    #{index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.member}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {item.score.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )

      case "stream":
        const streamValue = keyData.value as Array<{
          id: string
          data: Record<string, unknown>
        }>
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">ID</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streamValue.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">
                    {entry.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {JSON.stringify(entry.data)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )

      default:
        return (
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm">
            {JSON.stringify(keyData.value, null, 2)}
          </pre>
        )
    }
  }

  return (
    <Card className="flex h-full flex-col border-border/50">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="truncate font-mono">{keyData.key}</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className={`${colors.bg} ${colors.text} border-0 text-xs font-medium uppercase`}
              >
                {keyData.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatBytes(keyData.size)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTTL(currentTTL)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="default" size="icon" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteKey(keyData.key)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="value" className="flex h-full flex-col">
          <div className="border-b px-4">
            <TabsList className="h-10 w-full justify-start gap-4 bg-transparent p-0">
              <TabsTrigger
                value="value"
                className="h-10 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                Value
              </TabsTrigger>
              <TabsTrigger
                value="ttl"
                className="h-10 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                TTL
              </TabsTrigger>
              <TabsTrigger
                value="raw"
                className="h-10 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                Raw Text
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="value" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderValue()}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="ttl" className="mt-0 flex-1 p-4">
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-sm text-muted-foreground">
                  Current TTL
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {currentTTL === null ? "No expiry" : `${currentTTL}s`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTTL(currentTTL)}
                </p>
                {currentTTL !== null && (
                  <p className="mt-4 text-xs text-muted-foreground border-t pt-2">
                    Expires at: <span className="font-medium text-foreground">
                      {(() => {
                        const date = new Date(Date.now() + currentTTL * 1000)
                        const day = date.getDate().toString().padStart(2, '0')
                        const month = date.toLocaleString('en-GB', { month: 'short' })
                        const year = date.getFullYear()
                        const time = date.toLocaleTimeString('en-GB', { hour12: false })
                        return `${day}-${month}-${year} ${time}`
                      })()}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttl">Set new TTL (seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    id="ttl"
                    type="number"
                    placeholder="Enter seconds..."
                    value={newTTL}
                    onChange={(e) => setNewTTL(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (newTTL) {
                        if (onUpdateTTL) {
                          onUpdateTTL(keyData.key, "set", parseInt(newTTL))
                        } else {
                          onUpdateKey({ ...keyData, ttl: parseInt(newTTL) })
                        }
                        setNewTTL("")
                      }
                    }}
                  >
                    Set TTL
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (onUpdateTTL) {
                      onUpdateTTL(keyData.key, "remove")
                    } else {
                      onUpdateKey({ ...keyData, ttl: null })
                    }
                  }}
                >
                  Remove TTL
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="raw" className="mt-0 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-end px-4 py-2 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Label htmlFor="wrap-toggle" className="text-xs text-muted-foreground cursor-pointer">
                  Wrap Text
                </Label>
                <Button
                  id="wrap-toggle"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 w-10 p-0 rounded-full border-2 transition-colors",
                    rawWrap ? "border-primary bg-primary" : "border-muted bg-transparent"
                  )}
                  onClick={() => setRawWrap(!rawWrap)}
                >
                  <span className={cn(
                    "block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
                    rawWrap ? "translate-x-4" : "translate-x-0"
                  )} />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <ScrollArea key={rawWrap ? "wrap" : "scroll"} className="h-full">
                <pre
                  className={cn(
                    "p-4 font-mono text-sm min-w-full pb-10",
                    rawWrap ? "whitespace-pre-wrap break-all w-0" : "whitespace-pre"
                  )}
                >
                  {typeof keyData.value === 'string' ? keyData.value : JSON.stringify(keyData.value, null, 2)}
                </pre>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent >
    </Card >
  )
}
