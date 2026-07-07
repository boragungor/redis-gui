/**
 * Allowlist of Redis commands the GUI's CLI terminal may execute.
 *
 * This replaces the previous denylist approach. A denylist is fragile — it has
 * to enumerate every dangerous command and inevitably misses some (FLUSHALL,
 * KEYS, EVAL, ACL, ... all slipped through the old list). An allowlist fails
 * closed: anything not explicitly listed is rejected.
 *
 * The set below covers the common data-access and key-management commands an
 * operator needs. Deliberately excluded:
 *   - Mass-destruction / blocking:  FLUSHALL, FLUSHDB, KEYS, SWAPDB
 *   - Scripting / modules:          EVAL, EVALSHA, SCRIPT, FUNCTION, MODULE
 *   - Server / admin / config:      CONFIG, ACL, SHUTDOWN, DEBUG, SAVE, BGSAVE,
 *                                   SLAVEOF, REPLICAOF, FAILOVER, CLUSTER, CLIENT,
 *                                   MONITOR, RESET, LATENCY
 *   - Data movement:                MIGRATE, RESTORE, DUMP
 *   - Pub/sub & blocking reads:     SUBSCRIBE, PSUBSCRIBE, BLPOP, BRPOP, WAIT
 */
export const ALLOWED_REDIS_COMMANDS: ReadonlySet<string> = new Set([
  // Connection / meta (read-only)
  "PING", "ECHO", "TYPE", "TTL", "PTTL", "EXISTS", "DBSIZE", "INFO", "SCAN",
  "RANDOMKEY", "MEMORY", "OBJECT", "TIME",
  // Strings
  "GET", "SET", "GETSET", "SETNX", "SETEX", "PSETEX", "APPEND", "STRLEN",
  "INCR", "DECR", "INCRBY", "DECRBY", "INCRBYFLOAT", "MGET", "MSET", "MSETNX",
  "GETRANGE", "SETRANGE", "GETDEL",
  // Generic keys
  "DEL", "UNLINK", "EXPIRE", "PEXPIRE", "EXPIREAT", "PEXPIREAT", "PERSIST",
  "RENAME", "RENAMENX", "COPY", "TOUCH", "EXPIRETIME", "PEXPIRETIME",
  // Hashes
  "HGET", "HSET", "HMGET", "HMSET", "HGETALL", "HDEL", "HEXISTS", "HKEYS",
  "HVALS", "HLEN", "HINCRBY", "HINCRBYFLOAT", "HSETNX", "HSCAN", "HSTRLEN",
  "HRANDFIELD",
  // Lists
  "LPUSH", "RPUSH", "LPUSHX", "RPUSHX", "LPOP", "RPOP", "LRANGE", "LLEN",
  "LINDEX", "LSET", "LREM", "LTRIM", "LINSERT", "RPOPLPUSH", "LMOVE", "LPOS",
  // Sets
  "SADD", "SREM", "SMEMBERS", "SISMEMBER", "SMISMEMBER", "SCARD", "SPOP",
  "SRANDMEMBER", "SSCAN", "SDIFF", "SINTER", "SUNION", "SMOVE",
  // Sorted sets
  "ZADD", "ZREM", "ZRANGE", "ZREVRANGE", "ZRANGEBYSCORE", "ZREVRANGEBYSCORE",
  "ZRANGEBYLEX", "ZCARD", "ZSCORE", "ZMSCORE", "ZRANK", "ZREVRANK", "ZINCRBY",
  "ZCOUNT", "ZLEXCOUNT", "ZSCAN", "ZPOPMIN", "ZPOPMAX",
  // Streams
  "XADD", "XRANGE", "XREVRANGE", "XLEN", "XREAD", "XDEL", "XINFO", "XTRIM",
  // Bitmaps / HyperLogLog
  "SETBIT", "GETBIT", "BITCOUNT", "BITPOS", "PFADD", "PFCOUNT",
])

/**
 * A few commands are only safe in a specific sub-form. CONFIG GET is harmless
 * (read-only) but CONFIG SET / REWRITE / RESETSTAT are not, so CONFIG is not in
 * the allowlist above; callers that want CONFIG GET can special-case it.
 */
export function isCommandAllowed(cmd: string): boolean {
  return ALLOWED_REDIS_COMMANDS.has(cmd.toUpperCase())
}
