"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Terminal, X, Minus, Maximize2 } from "lucide-react"

interface CommandHistory {
  command: string
  result: string
  timestamp: Date
}

interface CLITerminalProps {
  onCommand: (command: string) => string | Promise<string>
}

export function CLITerminal({ onCommand }: CLITerminalProps) {
  const [history, setHistory] = useState<CommandHistory[]>([
    {
      command: "PING",
      result: "PONG",
      timestamp: new Date(),
    },
  ])
  const [currentCommand, setCurrentCommand] = useState("")
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const [isExecuting, setIsExecuting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCommand.trim() || isExecuting) return

    const cmd = currentCommand.trim()
    setCurrentCommand("")
    setHistoryIndex(-1)
    setIsExecuting(true)

    // Add command to history immediately with "Executing..." result
    setHistory((prev) => [
      ...prev,
      {
        command: cmd,
        result: "Executing...",
        timestamp: new Date(),
      },
    ])

    try {
      const result = await Promise.resolve(onCommand(cmd))
      // Update the last history entry with the actual result
      setHistory((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          result,
        }
        return updated
      })
    } catch (err) {
      setHistory((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          result: `(error) ${err instanceof Error ? err.message : "Command failed"}`,
        }
        return updated
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCurrentCommand(history[history.length - 1 - newIndex]?.command || "")
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentCommand(history[history.length - 1 - newIndex]?.command || "")
      } else {
        setHistoryIndex(-1)
        setCurrentCommand("")
      }
    }
  }

  const clearHistory = () => {
    setHistory([])
  }

  return (
    <Card className="flex h-full flex-col border-border/50">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            CLI
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-card p-3 font-mono text-sm"
        >
          {history.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex items-center gap-2">
                <span className="text-primary">redis&gt;</span>
                <span className="text-foreground">{item.command}</span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {item.result}
              </pre>
            </div>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t bg-muted/30 p-3"
        >
          <span className="font-mono text-sm text-primary">redis&gt;</span>
          <Input
            ref={inputRef}
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isExecuting ? "Executing..." : "Enter command..."}
            disabled={isExecuting}
            className="h-8 flex-1 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
          />
        </form>
      </CardContent>
    </Card>
  )
}
