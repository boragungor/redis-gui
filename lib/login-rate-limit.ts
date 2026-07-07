/**
 * Simple in-memory rate limiter for the login endpoint.
 *
 * Counts *failed* login attempts per key (client IP + username). After
 * MAX_FAILURES within WINDOW_MS, the key is locked out for LOCKOUT_MS. A
 * successful login clears the counter.
 *
 * Scope / limitations (intentional, documented):
 * - In-memory: state is per Node process. Behind a load balancer with multiple
 *   app instances, an attacker could spread attempts across instances. This
 *   still raises the bar substantially; a Redis-backed limiter is the upgrade
 *   path if global enforcement is needed.
 * - Keyed by IP+username, so username spraying from one IP creates separate
 *   buckets. Acceptable for an internal admin tool; revisit with the Redis
 *   limiter if spraying becomes a concern.
 */

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

interface AttemptRecord {
  count: number
  firstAttempt: number
  lockedUntil?: number
}

const attempts = new Map<string, AttemptRecord>()

// Occasionally sweep stale entries so the map can't grow unbounded.
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return
  lastSweep = now
  for (const [key, rec] of attempts) {
    const expired =
      (rec.lockedUntil === undefined || rec.lockedUntil < now) &&
      now - rec.firstAttempt > WINDOW_MS
    if (expired) attempts.delete(key)
  }
}

export function rateLimitKey(ip: string, username: string): string {
  return `${ip}:${username.toLowerCase()}`
}

/**
 * Returns whether the key is currently locked out, and if so, how many seconds
 * remain. Does not mutate state (call recordFailure / clear separately).
 */
export function checkRateLimit(key: string): {
  limited: boolean
  retryAfterSeconds: number
} {
  const now = Date.now()
  sweep(now)

  const rec = attempts.get(key)
  if (rec?.lockedUntil && rec.lockedUntil > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
    }
  }
  return { limited: false, retryAfterSeconds: 0 }
}

/** Record a failed attempt; locks the key once MAX_FAILURES is reached. */
export function recordFailure(key: string): void {
  const now = Date.now()
  const rec = attempts.get(key)

  // Start a fresh window if none exists or the previous one has elapsed.
  if (!rec || now - rec.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now })
    return
  }

  rec.count += 1
  if (rec.count >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCKOUT_MS
  }
}

/** Clear attempts for a key after a successful login. */
export function clearRateLimit(key: string): void {
  attempts.delete(key)
}
