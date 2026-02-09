export interface RedisConnectionConfig {
  host: string
  port: number
  database: number
  useAuth: boolean
  username: string
  password: string
  useTLS: boolean
}

export async function withRedis<T>(
  config: RedisConnectionConfig,
  fn: (client: import("ioredis").default) => Promise<T>
): Promise<T> {
  // Dynamic import to avoid crashing in environments without TCP support
  let Redis: typeof import("ioredis").default
  try {
    const mod = await import("ioredis")
    Redis = mod.default
  } catch {
    throw new Error(
      "Redis client (ioredis) is not available in this environment. " +
      "Download the project and run it locally with 'npm run dev' to connect to Redis."
    )
  }

  const options: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    db: config.database,
    connectTimeout: 5000,
    commandTimeout: 10000,
    lazyConnect: true,
    retryStrategy: () => null, // Don't retry, fail fast
    maxRetriesPerRequest: 1,
  }

  if (config.useAuth && config.password) {
    options.password = config.password
    if (config.username) {
      options.username = config.username
    }
  }

  if (config.useTLS) {
    options.tls = {}
  }

  const client = new Redis(options as ConstructorParameters<typeof Redis>[0])

  try {
    await client.connect()
    return await fn(client)
  } finally {
    try {
      client.disconnect()
    } catch {
      // ignore disconnect errors
    }
  }
}
