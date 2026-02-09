import { NextResponse } from "next/server"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

export async function POST(request: Request) {
  try {
    const { config, pattern = "*", cursor = "0", count = 200 } = (await request.json()) as {
      config: RedisConnectionConfig
      pattern?: string
      cursor?: string
      count?: number
    }

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan keys"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
