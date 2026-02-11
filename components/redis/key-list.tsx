"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type RedisKey,
  type RedisDataType,
  typeColors,
  defaultTypeColor,
  formatTTL,
  formatBytes,
} from "@/lib/redis-mock-data"
import {
  Search,
  Plus,
  RefreshCw,
  Clock,
  Database,
  Trash2,
} from "lucide-react"

interface KeyListProps {
  keys: RedisKey[]
  selectedKey: RedisKey | null
  onSelectKey: (key: RedisKey) => void
  onAddKey: () => void
  onDeleteKey: (key: string) => void
  onRefresh?: () => void
  isLoading?: boolean
}

export function KeyList({
  keys,
  selectedKey,
  onSelectKey,
  onAddKey,
  onDeleteKey,
  onRefresh,
  isLoading,
}: KeyListProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const filteredKeys = keys.filter((key) => {
    const matchesSearch = key.key.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === "all" || key.type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <Card className="flex h-full flex-col border-border/50">
      <CardHeader className="flex-shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Keys
            <Badge variant="secondary" className="ml-1 font-mono text-xs">
              {filteredKeys.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8"
              onClick={onAddKey}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search keys..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[100px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="set">Set</SelectItem>
              <SelectItem value="hash">Hash</SelectItem>
              <SelectItem value="zset">ZSet</SelectItem>
              <SelectItem value="stream">Stream</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="space-y-1 p-3 pt-0 min-w-max">
            {filteredKeys.map((item) => {
              const colors = typeColors[item.type] || defaultTypeColor
              const isSelected = selectedKey?.key === item.key
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectKey(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelectKey(item)
                    }
                  }}
                  className={`group flex w-full min-w-fit cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${isSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent hover:bg-muted/50"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-medium whitespace-nowrap">
                      {item.key}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteKey(item.key)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`${colors.bg} ${colors.text} border-0 text-xs font-medium uppercase`}
                    >
                      {item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatBytes(item.size)}
                    </span>
                    {item.ttl !== null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {formatTTL(item.ttl)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredKeys.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No keys found
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
