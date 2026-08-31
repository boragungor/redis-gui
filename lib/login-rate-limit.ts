/**
 * In-memory rate limiter for the login endpoint.
 *
 * Two independent limits are enforced on every attempt:
 *
 * 1. **Per username** — always applied. The username is what an attacker is
 *    actually guessing against, and this limit cannot be evaded by changing
 *    source address, so it is the one that genuinely stops brute force.
 * 2. **Per client IP + username** — finer grained, but only meaningful when the
 *    client address can be trusted (see getClientIp in the login route). It is
 *    additive: it can lock an abusive source sooner, never later.
 *
 * The per-username limit is deliberately looser than the per-IP one so that a
 * single noisy client is stopped first, and so normal typos from several people
 * cannot lock an account as easily.
 *
 * Scope / limitations (intentional, documented):
 * - In-memory: state is per Node process. Behind a load balancer with several
 *   app instances an attacker can spread attempts across them. A Redis-backed
 *   limiter is the upgrade path if global enforcement is required.
 * - A per-username lock is a deliberate trade-off: it means someone can lock a
 *   known account for the window. That is preferred here over leaving password
 *   guessing unbounded.
 */

const MAX_IP_FAILURES = 5
const MAX_USERNAME_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

interface AttemptRecord {
  count: number
  firstAttempt: number
  lockedUntil?: number
}

const attempts = new Map<string, AttemptRecord>()

// Occasionally sweep stale entries so the map cannot grow unbounded.
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
  return `ip:${ip}|user:${username.toLowerCase()}`
}

export function usernameRateLimitKey(username: string): string {
  return `user:${username.toLowerCase()}`
}

/** Whether this key is currently locked out, and for how much longer. */
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

/** Record a failed attempt; locks the key once its threshold is reached. */
export function recordFailure(key: string, maxFailures = MAX_IP_FAILURES): void {
  const now = Date.now()
  const rec = attempts.get(key)

  // Start a fresh window if none exists or the previous one has elapsed.
  if (!rec || now - rec.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now })
    return
  }

  rec.count += 1
  if (rec.count >= maxFailures) {
    rec.lockedUntil = now + LOCKOUT_MS
  }
}

/** Clear attempts for a key after a successful login. */
export function clearRateLimit(key: string): void {
  attempts.delete(key)
}

/**
 * Composite check across both limits. `ip` may be a placeholder when the client
 * address cannot be trusted — the per-username limit still applies.
 */
export function checkLoginRateLimit(
  ip: string,
  username: string,
): { limited: boolean; retryAfterSeconds: number } {
  const results = [
    checkRateLimit(usernameRateLimitKey(username)),
    checkRateLimit(rateLimitKey(ip, username)),
  ].filter((r) => r.limited)

  if (results.length === 0) return { limited: false, retryAfterSeconds: 0 }
  return {
    limited: true,
    retryAfterSeconds: Math.max(...results.map((r) => r.retryAfterSeconds)),
  }
}

/** Record a failure against both limits. */
export function recordLoginFailure(ip: string, username: string): void {
  recordFailure(usernameRateLimitKey(username), MAX_USERNAME_FAILURES)
  recordFailure(rateLimitKey(ip, username), MAX_IP_FAILURES)
}

/** Clear both limits after a successful login. */
export function clearLoginRateLimit(ip: string, username: string): void {
  clearRateLimit(usernameRateLimitKey(username))
  clearRateLimit(rateLimitKey(ip, username))
}
