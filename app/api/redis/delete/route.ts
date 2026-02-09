import { NextResponse } from "next/server"
import { type RedisConnectionConfig, withRedis } from "@/lib/redis-client"

export async function POST(request: Request) {
  try {
    const { config, keys } = (await request.json()) as {
      config: RedisConnectionConfig
      keys: string[]
    }

    const result = await withRedis(config, async (client) => {
      const deleted = await client.del(...keys)
      return { deleted }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete key"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
