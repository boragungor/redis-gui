import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"
import { encodeJavaString, looksLikeJavaSerialized } from "@/lib/java-value"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { key, type, value, ttl, overwriteJava, javaEncode } =
        (await request.json()) as {
          key: string
          type: string
          value: unknown
          ttl?: number | null
          overwriteJava?: boolean
          /** Re-serialize the text as a Java String before writing. */
          javaEncode?: boolean
        }
      const config = getServerRedisConfig()

      const blocked = await withRedis(config, async (client) => {
        // Values written by Java services are shown decoded. Writing the
        // displayed text back verbatim would replace the serialized bytes and
        // break those services, so a plain write over Java data is refused.
        // Editing is still possible: String-shaped values are re-encoded into
        // the Java format below (javaEncode), which is exactly reversible.
        if (!overwriteJava && !javaEncode) {
          const existing = await client.getBuffer(key)
          if (existing !== null && looksLikeJavaSerialized(existing)) {
            return true
          }
        }

        // Delete key first to allow type change
        await client.del(key)

        if (javaEncode) {
          await client.set(key, encodeJavaString(String(value)))
          if (ttl && ttl > 0) await client.expire(key, ttl)
          return false
        }

        switch (type) {
          case "string":
            await client.set(key, value as string)
            break
          case "hash": {
            const hashVal = value as Record<string, string>
            if (Object.keys(hashVal).length > 0) {
              await client.hmset(key, hashVal)
            }
            break
          }
          case "list": {
            const listVal = value as string[]
            if (listVal.length > 0) {
              await client.rpush(key, ...listVal)
            }
            break
          }
          case "set": {
            const setVal = value as string[]
            if (setVal.length > 0) {
              await client.sadd(key, ...setVal)
            }
            break
          }
          case "zset": {
            const zsetVal = value as Array<{ member: string; score: number }>
            if (zsetVal.length > 0) {
              const args: (string | number)[] = []
              for (const item of zsetVal) {
                args.push(item.score, item.member)
              }
              await client.zadd(key, ...args.map(String))
            }
            break
          }
          case "stream": {
            const streamVal = value as Array<{ id?: string; data: Record<string, string> }>
            for (const entry of streamVal) {
              const fields: string[] = []
              for (const [k, v] of Object.entries(entry.data)) {
                fields.push(k, v)
              }
              await client.xadd(key, entry.id || "*", ...fields)
            }
            break
          }
        }

        // Set TTL if provided
        if (ttl && ttl > 0) {
          await client.expire(key, ttl)
        }

        return false
      })

      if (blocked) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This key holds a Java-serialized value and is read-only. " +
              "Saving JSON here would corrupt it for the Java services that read it.",
          },
          { status: 409 },
        )
      }

      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to set key" },
        { status: 500 },
      )
    }
  })
}
