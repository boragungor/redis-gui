import { type NextRequest, NextResponse } from "next/server"
import { withRedis } from "@/lib/redis-client"
import { withAuth } from "@/lib/api-auth"
import { getServerRedisConfig } from "@/lib/server-redis-config"

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { keys } = (await request.json()) as { keys: string[] }
      const config = getServerRedisConfig()

      const result = await withRedis(config, async (client) => {
        const deleted = await client.del(...keys)
        return { deleted }
      })

      return NextResponse.json({ success: true, ...result })
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to delete key" },
        { status: 500 },
      )
    }
  })
}
