"use client"

import React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type RedisKey, type RedisDataType } from "@/lib/redis-mock-data"

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddKey: (key: RedisKey) => void
}

export function AddKeyDialog({ open, onOpenChange, onAddKey }: AddKeyDialogProps) {
  const [keyName, setKeyName] = useState("")
  const [keyType, setKeyType] = useState<RedisDataType>("string")
  const [keyValue, setKeyValue] = useState("")
  const [ttl, setTTL] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!keyName || !keyValue) return

    let parsedValue: unknown = keyValue

    try {
      if (keyType !== "string") {
        parsedValue = JSON.parse(keyValue)
      }
    } catch {
      return
    }

    const newKey: RedisKey = {
      key: keyName,
      type: keyType,
      ttl: ttl ? parseInt(ttl) : null,
      size: new Blob([keyValue]).size,
      value: parsedValue,
    }

    onAddKey(newKey)
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setKeyName("")
    setKeyType("string")
    setKeyValue("")
    setTTL("")
  }

  const getPlaceholder = () => {
    switch (keyType) {
      case "string":
        return "Enter string value..."
      case "hash":
        return '{"field1": "value1", "field2": "value2"}'
      case "list":
        return '["item1", "item2", "item3"]'
      case "set":
        return '["member1", "member2", "member3"]'
      case "zset":
        return '[{"member": "player1", "score": 100}]'
      case "stream":
        return '[{"id": "1234-0", "data": {"field": "value"}}]'
      default:
        return "Enter value..."
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Key</DialogTitle>
          <DialogDescription>
            Create a new Redis key with the specified type and value.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              placeholder="e.g., user:1234 or cache:products"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="key-type">Type</Label>
              <Select
                value={keyType}
                onValueChange={(value) => setKeyType(value as RedisDataType)}
              >
                <SelectTrigger id="key-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="hash">Hash</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                  <SelectItem value="zset">Sorted Set</SelectItem>
                  <SelectItem value="stream">Stream</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-ttl">TTL (seconds)</Label>
              <Input
                id="key-ttl"
                type="number"
                placeholder="Optional"
                value={ttl}
                onChange={(e) => setTTL(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-value">Value</Label>
            <Textarea
              id="key-value"
              placeholder={getPlaceholder()}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            {keyType !== "string" && (
              <p className="text-xs text-muted-foreground">
                Enter valid JSON for {keyType} type
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!keyName || !keyValue}>
              Add Key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
