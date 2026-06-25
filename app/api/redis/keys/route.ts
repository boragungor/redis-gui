import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { pattern = "*", cursor = "0", count = 200 } = (await request.json()) as {
        pattern?: string
        cursor?: string
        count?: number
      }
      const config = getServerRedisConfig()

      const result = await withRedis(config, async (client) => {
        // Use SCAN for safe iteration
        const [newCursor, foundKeys] = await client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          count
        )

        // For each key, get type, TTL, and memory usage
        const pipeline = client.pipeline()
        for (const key of foundKeys) {
          pipeline.type(key)
          pipeline.ttl(key)
          pipeline.call("MEMORY", "USAGE", key)
        }

        let pipelineResults: Array<[Error | null, unknown]> = []
        try {
          pipelineResults = (await pipeline.exec()) || []
        } catch {
          // MEMORY USAGE may not be available, fallback
        }

        const keys = foundKeys.map((key, i) => {
          const typeResult = pipelineResults[i * 3]
          const ttlResult = pipelineResults[i * 3 + 1]
          const memResult = pipelineResults[i * 3 + 2]

          const type = (typeResult?.[1] as string) || "string"
          const ttl = (ttlResult?.[1] as number) ?? -1
          const size = (memResult?.[1] as number) || 0

          return {
            key,
            type,
            ttl: ttl === -1 ? null : ttl,
            size,
            value: null, // Value fetched on demand
          }
        })

        // Sort keys alphabetically
        keys.sort((a, b) => a.key.localeCompare(b.key))

        // Get total key count
        const dbsize = await client.dbsize()

        return { keys, cursor: newCursor, dbsize }
      })

      return NextResponse.json({ success: true, ...result })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to scan keys" },
        { status: 500 },
      )
    }
  })
}
