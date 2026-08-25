export type RedisDataType = "string" | "list" | "set" | "hash" | "zset" | "stream"

export interface RedisKey {
  key: string
  type: RedisDataType
  ttl: number | null
  size: number
  value: unknown
  /** Set to "java" when the stored bytes were Java-serialized and decoded for display. */
  encoding?: "java"
  /** Populated when a Java-serialized value could not be decoded. */
  decodeError?: string
}

export const mockKeys: RedisKey[] = [
  {
    key: "user:1001",
    type: "hash",
    ttl: null,
    size: 256,
    value: {
      id: "1001",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
      created_at: "2024-01-15T10:30:00Z",
    },
  },
  {
    key: "user:1002",
    type: "hash",
    ttl: 7200,
    size: 248,
    value: {
      id: "1002",
      name: "Bob Smith",
      email: "bob@example.com",
      role: "user",
      created_at: "2024-02-20T14:45:00Z",
    },
  },
  {
    key: "session:abc123",
    type: "string",
    ttl: 3600,
    size: 512,
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMDAxIiwiaWF0IjoxNjE2MjM5MDIyfQ",
  },
  {
    key: "session:def456",
    type: "string",
    ttl: 1800,
    size: 498,
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMDAyIiwiaWF0IjoxNjE2MjM5MDIyfQ",
  },
  {
    key: "cache:products",
    type: "string",
    ttl: 300,
    size: 4096,
    value: '{"products":[{"id":1,"name":"Laptop"},{"id":2,"name":"Phone"}]}',
  },
  {
    key: "queue:emails",
    type: "list",
    ttl: null,
    size: 1024,
    value: [
      '{"to":"user1@example.com","subject":"Welcome!"}',
      '{"to":"user2@example.com","subject":"Order Confirmed"}',
      '{"to":"user3@example.com","subject":"Password Reset"}',
      '{"to":"user4@example.com","subject":"Newsletter"}',
    ],
  },
  {
    key: "queue:notifications",
    type: "list",
    ttl: null,
    size: 768,
    value: [
      '{"userId":"1001","message":"New follower"}',
      '{"userId":"1002","message":"Comment on your post"}',
      '{"userId":"1001","message":"Like on your photo"}',
    ],
  },
  {
    key: "tags:popular",
    type: "set",
    ttl: 86400,
    size: 128,
    value: ["javascript", "react", "nodejs", "typescript", "redis", "nextjs"],
  },
  {
    key: "tags:trending",
    type: "set",
    ttl: 3600,
    size: 96,
    value: ["ai", "machine-learning", "chatgpt", "vercel"],
  },
  {
    key: "leaderboard:weekly",
    type: "zset",
    ttl: 604800,
    size: 512,
    value: [
      { member: "player:alice", score: 15000 },
      { member: "player:bob", score: 12500 },
      { member: "player:charlie", score: 11000 },
      { member: "player:diana", score: 9500 },
      { member: "player:eve", score: 8000 },
    ],
  },
  {
    key: "leaderboard:monthly",
    type: "zset",
    ttl: null,
    size: 1024,
    value: [
      { member: "player:bob", score: 85000 },
      { member: "player:alice", score: 72000 },
      { member: "player:frank", score: 65000 },
      { member: "player:diana", score: 58000 },
    ],
  },
  {
    key: "config:app",
    type: "hash",
    ttl: null,
    size: 384,
    value: {
      max_connections: "100",
      timeout: "30",
      debug_mode: "false",
      version: "2.1.0",
      feature_flags: "premium,beta",
    },
  },
  {
    key: "rate_limit:api:1001",
    type: "string",
    ttl: 60,
    size: 8,
    value: "47",
  },
  {
    key: "rate_limit:api:1002",
    type: "string",
    ttl: 45,
    size: 8,
    value: "23",
  },
  {
    key: "events:stream",
    type: "stream",
    ttl: null,
    size: 2048,
    value: [
      { id: "1706789123456-0", data: { event: "user_signup", userId: "1003" } },
      { id: "1706789234567-0", data: { event: "purchase", orderId: "ORD-123" } },
      { id: "1706789345678-0", data: { event: "page_view", path: "/products" } },
    ],
  },
]

export interface RedisStats {
  connectedClients: number
  usedMemory: string
  usedMemoryPeak: string
  totalKeys: number
  expiredKeys: number
  evictedKeys: number
  hitRate: number
  opsPerSec: number
  uptimeDays: number
}

export const mockStats: RedisStats = {
  connectedClients: 24,
  usedMemory: "128.5 MB",
  usedMemoryPeak: "156.2 MB",
  totalKeys: 15,
  expiredKeys: 1247,
  evictedKeys: 0,
  hitRate: 94.7,
  opsPerSec: 1256,
  uptimeDays: 47,
}

export const typeColors: Record<RedisDataType, { bg: string; text: string }> = {
  string: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  list: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  set: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  hash: { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300" },
  zset: { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300" },
  stream: { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
}

export const defaultTypeColor = { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" }

export function formatTTL(ttl: number | null): string {
  if (ttl === null || ttl === -1) return "No expiry"
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m ${ttl % 60}s`
  return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
