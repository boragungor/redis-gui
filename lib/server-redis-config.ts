/**
 * Server-side Redis connection config.
 *
 * The connection target (host/port/password) is read from server-only
 * environment variables — it is NEVER taken from the client request body.
 * This prevents the SSRF class of attack where a caller could point the
 * server at an arbitrary internal host.
 *
 * Do not expose these as NEXT_PUBLIC_* — they must not reach the browser.
 */

import type { RedisConnectionConfig } from "./redis-client"

export function getServerRedisConfig(): RedisConnectionConfig {
  const host = process.env.REDIS_HOST || "localhost"
  const port = parseInt(process.env.REDIS_PORT || "6379", 10)
  const database = parseInt(process.env.REDIS_DATABASE || "0", 10)
  const password = process.env.REDIS_PASSWORD || ""
  const username = process.env.REDIS_USERNAME || ""
  const useTLS = process.env.REDIS_USE_TLS === "true"

  return {
    host,
    port,
    database,
    useAuth: Boolean(password),
    username,
    password,
    useTLS,
  }
}
