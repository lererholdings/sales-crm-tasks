// Fixed-window, in-memory rate limiter — deliberately not backed by
// Vercel KV/Upstash or Postgres. This app has ~5 internal users on the
// Vercel Hobby plan with no Redis/KV already in the stack; adding one
// just for rate limiting isn't worth the new paid dependency at this
// scale. Per-instance counting means the *effective* limit is
// `max × warm instance count` rather than a hard global cap, but that's
// enough to catch a runaway client loop or buggy script, which is the
// actual risk profile here. Revisit with a shared store (Vercel KV,
// Upstash) if the app opens up to more users or public exposure — see
// design.md section 12.
const buckets = new Map()

export const DEFAULT_WINDOW_MS = 60_000
export const DEFAULT_MAX = 120

// Returns { limited, retryAfterSeconds }. `key` is caller-chosen (e.g. a
// user id) — independent keys get independent windows.
export function checkRateLimit(key, { windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX } = {}) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, retryAfterSeconds: 0 }
  }

  bucket.count += 1
  if (bucket.count > max) {
    return { limited: true, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { limited: false, retryAfterSeconds: 0 }
}

// Test-only: fixed-window state must not leak between test cases.
export function _resetRateLimitState() {
  buckets.clear()
}
