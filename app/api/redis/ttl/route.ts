import { NextResponse } from "next/server"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

export async function POST(request: Request) {
  try {
    const { config, key, action, ttl } = (await request.json()) as {
      config: RedisConnectionConfig
      key: string
      action: "get" | "set" | "remove"
      ttl?: number
    }

    const result = await withRedis(config, async (client) => {
      switch (action) {
        case "get": {
          const currentTTL = await client.ttl(key)
          return { ttl: currentTTL === -1 ? null : currentTTL }
        }
        case "set": {
          if (ttl && ttl > 0) {
            await client.expire(key, ttl)
            return { ttl }
          }
          return { ttl: null }
        }
        case "remove": {
          await client.persist(key)
          return { ttl: null }
        }
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update TTL"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
