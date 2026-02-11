"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface JsonViewerProps {
    data: unknown
    name?: string
    depth?: number
    isLast?: boolean
}

export function JsonViewer({ data, name, depth = 0, isLast = true }: JsonViewerProps) {
    const [isExpanded, setIsExpanded] = useState(depth < 2) // Default expand first 2 levels
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        const textToCopy = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const renderValue = (value: unknown) => {
        if (value === null) return <span className="text-rose-500">null</span>
        if (value === true) return <span className="text-blue-500">true</span>
        if (value === false) return <span className="text-blue-500">false</span>
        if (typeof value === "number") return <span className="text-emerald-500">{value}</span>
        if (typeof value === "string") {
            // Check for quote wrapping
            return <span className="text-amber-600 dark:text-amber-400 break-all whitespace-pre-wrap">"{value}"</span>
        }
        return null
    }

    // Handle Objects and Arrays
    if (typeof data === "object" && data !== null) {
        const isArray = Array.isArray(data)
        const isEmpty = isArray ? (data as unknown[]).length === 0 : Object.keys(data).length === 0
        const keys = Object.keys(data)

        if (isEmpty) {
            return (
                <div className="font-mono text-sm leading-6 flex items-start group">
                    <div style={{ paddingLeft: depth * 16 }} className="flex items-center">
                        {name && <span className="text-purple-600 dark:text-purple-400 mr-1">"{name}":</span>}
                        <span className="text-muted-foreground">{isArray ? "[]" : "{}"}</span>
                        {!isLast && <span className="text-muted-foreground">,</span>}
                    </div>
                </div>
            )
        }

        return (
            <div className="font-mono text-sm leading-6">
                <div
                    className={cn(
                        "flex items-start group rounded-sm hover:bg-muted/50 cursor-pointer -ml-1",
                        depth > 0 && "pl-1"
                    )}
                    style={{ paddingLeft: Math.max(0, depth * 16 - 4) }}
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsExpanded(!isExpanded)
                    }}
                >
                    <div className="w-4 h-6 flex items-center justify-center shrink-0 mr-1 text-muted-foreground/70">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </div>

                    <div className="flex items-center flex-1 min-w-0">
                        {name && <span className="text-purple-600 dark:text-purple-400 mr-2">"{name}":</span>}
                        <span className="text-muted-foreground">{isArray ? "[" : "{"}</span>

                        {!isExpanded && (
                            <span className="text-muted-foreground/60 text-xs mx-2">
                                {isArray ? `Array(${keys.length})` : `Object{...}`}
                            </span>
                        )}

                        {!isExpanded && <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>}
                        {!isExpanded && !isLast && <span className="text-muted-foreground">,</span>}

                        {/* Copy button that appears on hover */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleCopy}
                        >
                            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            <span className="sr-only">Copy</span>
                        </Button>
                    </div>
                </div>

                {isExpanded && (
                    <div>
                        {keys.map((key, index) => (
                            <JsonViewer
                                key={key}
                                data={(data as Record<string, unknown>)[key]}
                                name={isArray ? undefined : key}
                                depth={depth + 1}
                                isLast={index === keys.length - 1}
                            />
                        ))}
                        <div style={{ paddingLeft: (depth + 1) * 16 }} className="flex items-center">
                            <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
                            {!isLast && <span className="text-muted-foreground">,</span>}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Handle Primitives
    return (
        <div className="font-mono text-sm leading-6 flex items-start group hover:bg-muted/50 rounded-sm -ml-1 pl-1">
            <div style={{ paddingLeft: depth * 16 }} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline">
                    {name && <span className="text-purple-600 dark:text-purple-400 mr-2 shrink-0">"{name}":</span>}
                    {renderValue(data)}
                    {!isLast && <span className="text-muted-foreground mr-2">,</span>}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={handleCopy}
                >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    <span className="sr-only">Copy</span>
                </Button>
            </div>
        </div>
    )
}
