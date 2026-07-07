import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"
import { isCommandAllowed } from "@/lib/redis-command-allowlist"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { command } = (await request.json()) as { command: string }
      const config = getServerRedisConfig()

      // Parse the command string into parts respecting quoted strings
      const parts: string[] = []
      let current = ""
      let inQuotes = false
      let quoteChar = ""

      for (const char of command) {
        if (inQuotes) {
          if (char === quoteChar) {
            inQuotes = false
          } else {
            current += char
          }
        } else if (char === '"' || char === "'") {
          inQuotes = true
          quoteChar = char
        } else if (char === " " || char === "\t") {
          if (current) {
            parts.push(current)
            current = ""
          }
        } else {
          current += char
        }
      }
      if (current) parts.push(current)

      if (parts.length === 0) {
        return NextResponse.json({ success: true, result: "" })
      }

      const cmd = parts[0].toUpperCase()
      const args = parts.slice(1)

      // Allowlist: only known-safe commands may run. Anything not listed
      // (FLUSHALL, KEYS, EVAL, CONFIG SET, SHUTDOWN, ...) is rejected.
      // CONFIG GET is the one read-only exception we permit.
      const isConfigGet = cmd === "CONFIG" && args[0]?.toUpperCase() === "GET"
      if (!isCommandAllowed(cmd) && !isConfigGet) {
        return NextResponse.json({
          success: true,
          result: `(error) Command '${cmd}' is not permitted`,
        })
      }

      const result = await withRedis(config, async (client) => {
        const rawResult = await client.call(cmd, ...args)
        return formatRedisResult(rawResult)
      })

      return NextResponse.json({ success: true, result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Command execution failed"
      return NextResponse.json({
        success: true,
        result: `(error) ${message}`,
      })
    }
  })
}

function formatRedisResult(result: unknown): string {
  if (result === null || result === undefined) {
    return "(nil)"
  }
  if (typeof result === "number") {
    return `(integer) ${result}`
  }
  if (typeof result === "string") {
    return `"${result}"`
  }
  if (Array.isArray(result)) {
    if (result.length === 0) return "(empty array)"
    return result
      .map((item, i) => `${i + 1}) ${formatRedisResult(item)}`)
      .join("\n")
  }
  return String(result)
}
