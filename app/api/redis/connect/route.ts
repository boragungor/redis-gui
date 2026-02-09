import { NextResponse } from "next/server"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

export async function POST(request: Request) {
  try {
    const config: RedisConnectionConfig = await request.json()

    const result = await withRedis(config, async (client) => {
      const pong = await client.ping()
      const info = await client.info()
      return { pong, info }
    })

    // Parse INFO output
    const infoLines = result.info.split("\r\n")
    const infoMap: Record<string, string> = {}
    for (const line of infoLines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":")
        infoMap[key] = value
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        connectedClients: parseInt(infoMap.connected_clients || "0"),
        usedMemory: infoMap.used_memory_human || "0B",
        usedMemoryPeak: infoMap.used_memory_peak_human || "0B",
        totalKeys: parseInt(infoMap.db0?.split(",")[0]?.split("=")[1] || "0") || 0,
        expiredKeys: parseInt(infoMap.expired_keys || "0"),
        evictedKeys: parseInt(infoMap.evicted_keys || "0"),
        hitRate:
          parseInt(infoMap.keyspace_hits || "0") + parseInt(infoMap.keyspace_misses || "0") > 0
            ? parseFloat(
                (
                  (parseInt(infoMap.keyspace_hits || "0") /
                    (parseInt(infoMap.keyspace_hits || "0") +
                      parseInt(infoMap.keyspace_misses || "0"))) *
                  100
                ).toFixed(1)
              )
            : 0,
        opsPerSec: parseInt(infoMap.instantaneous_ops_per_sec || "0"),
        uptimeDays: Math.floor(parseInt(infoMap.uptime_in_seconds || "0") / 86400),
        redisVersion: infoMap.redis_version || "unknown",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to Redis"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
