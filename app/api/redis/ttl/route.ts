import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { key, action, ttl } = (await request.json()) as {
        key: string
        action: "get" | "set" | "remove"
        ttl?: number
      }
      const config = getServerRedisConfig()

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
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to update TTL" },
        { status: 500 },
      )
    }
  })
}
