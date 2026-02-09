import { NextResponse } from "next/server"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

export async function POST(request: Request) {
  try {
    const { config, key } = (await request.json()) as {
      config: RedisConnectionConfig
      key: string
    }

    const result = await withRedis(config, async (client) => {
      const type = await client.type(key)
      const ttl = await client.ttl(key)
      let size = 0
      try {
        size = (await client.call("MEMORY", "USAGE", key)) as number || 0
      } catch {
        // MEMORY USAGE not available on all versions
      }

      let value: unknown = null

      switch (type) {
        case "string":
          value = await client.get(key)
          break
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

      return { key, type, ttl: ttl === -1 ? null : ttl, size, value }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get key"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
