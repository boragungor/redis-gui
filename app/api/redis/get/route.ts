import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"
import {
  decodeJavaValue,
  looksLikeBase64Java,
  looksLikeJavaSerialized,
} from "@/lib/java-value"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { key } = (await request.json()) as { key: string }
      const config = getServerRedisConfig()

      const result = await withRedis(config, async (client) => {
        const type = await client.type(key)
        const ttl = await client.ttl(key)
        let size = 0
        try {
          size = ((await client.call("MEMORY", "USAGE", key)) as number) || 0
        } catch {
          // MEMORY USAGE not available on all versions
        }

        let value: unknown = null
        // Set when the stored bytes were Java-serialized, so the client can
        // render the decoded form and mark the value read-only.
        let encoding: "java" | undefined
        let decodeError: string | undefined

        switch (type) {
          case "string": {
            // Read raw bytes, not a UTF-8 string: Java-serialized values are
            // binary and client.get() would decode them lossily (invalid
            // sequences become U+FFFD), destroying the data before we can
            // parse it. For plain values this is byte-identical to get().
            const raw = await client.getBuffer(key)

            if (raw === null) {
              value = null
              break
            }

            if (looksLikeJavaSerialized(raw)) {
              const decoded = await decodeJavaValue(raw)
              encoding = "java"
              if (decoded.ok) {
                value = decoded.value
              } else {
                // Surface the failure in the viewer instead of raw binary.
                value = null
                decodeError = decoded.error
              }
              break
            }

            const text = raw.toString("utf8")

            // Some producers store the Java stream base64-encoded.
            if (looksLikeBase64Java(text)) {
              const decoded = await decodeJavaValue(Buffer.from(text, "base64"))
              if (decoded.ok) {
                value = decoded.value
                encoding = "java"
                break
              }
              // Not actually Java after all — fall through to the plain string.
            }

            value = text
            break
          }
          case "hash":
            value = await client.hgetall(key)
            break
          case "list": {
            const len = await client.llen(key)
            value = await client.lrange(key, 0, Math.min(len - 1, 999))
            break
          }
          case "set":
            value = await client.smembers(key)
            break
          case "zset": {
            const members = await client.zrange(key, 0, -1, "WITHSCORES")
            const zsetValue: Array<{ member: string; score: number }> = []
            for (let i = 0; i < members.length; i += 2) {
              zsetValue.push({
                member: members[i],
                score: parseFloat(members[i + 1]),
              })
            }
            // Sort descending by score
            zsetValue.sort((a, b) => b.score - a.score)
            value = zsetValue
            break
          }
          case "stream": {
            try {
              const entries = await client.xrange(key, "-", "+", "COUNT", 100)
              value = entries.map(([id, fields]) => {
                const data: Record<string, string> = {}
                for (let i = 0; i < fields.length; i += 2) {
                  data[fields[i]] = fields[i + 1]
                }
                return { id, data }
              })
            } catch {
              value = []
            }
            break
          }
          default:
            value = null
        }

        return {
          key,
          type,
          ttl: ttl === -1 ? null : ttl,
          size,
          value,
          encoding,
          decodeError,
        }
      })

      return NextResponse.json({ success: true, data: result })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to get key" },
        { status: 500 },
      )
    }
  })
}
