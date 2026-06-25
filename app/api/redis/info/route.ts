import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const config = getServerRedisConfig()

      const result = await withRedis(config, async (client) => {
        const info = await client.info()
        const dbsize = await client.dbsize()

        const infoMap: Record<string, string> = {}
        for (const line of info.split("\r\n")) {
          if (line.includes(":")) {
            const [key, value] = line.split(":")
            infoMap[key] = value
          }
        }

        const hits = parseInt(infoMap.keyspace_hits || "0")
        const misses = parseInt(infoMap.keyspace_misses || "0")
        const hitRate = hits + misses > 0 ? parseFloat(((hits / (hits + misses)) * 100).toFixed(1)) : 0

        return {
          connectedClients: parseInt(infoMap.connected_clients || "0"),
          usedMemory: infoMap.used_memory_human || "0B",
          usedMemoryPeak: infoMap.used_memory_peak_human || "0B",
          totalKeys: dbsize,
          expiredKeys: parseInt(infoMap.expired_keys || "0"),
          evictedKeys: parseInt(infoMap.evicted_keys || "0"),
          hitRate,
          opsPerSec: parseInt(infoMap.instantaneous_ops_per_sec || "0"),
          uptimeDays: Math.floor(parseInt(infoMap.uptime_in_seconds || "0") / 86400),
          redisVersion: infoMap.redis_version || "unknown",
        }
      })

      return NextResponse.json({ success: true, stats: result })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to get info" },
        { status: 500 },
      )
    }
  })
}
