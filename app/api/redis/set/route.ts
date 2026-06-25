import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { key, type, value, ttl } = (await request.json()) as {
        key: string
        type: string
        value: unknown
        ttl?: number | null
      }
      const config = getServerRedisConfig()

      await withRedis(config, async (client) => {
        // Delete key first to allow type change
        await client.del(key)

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
      })

      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to set key" },
        { status: 500 },
      )
    }
  })
}
