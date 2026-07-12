import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetRateLimitState, checkRateLimit } from './rateLimit.js'

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitState()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the max within the window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('u1', { windowMs: 60_000, max: 5 }).limited).toBe(false)
    }
  })

  it('limits once the max is exceeded within the window', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('u1', { windowMs: 60_000, max: 5 })

    const result = checkRateLimit('u1', { windowMs: 60_000, max: 5 })
    expect(result.limited).toBe(true)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets once the window elapses', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('u1', { windowMs: 60_000, max: 5 })
    expect(checkRateLimit('u1', { windowMs: 60_000, max: 5 }).limited).toBe(true)

    vi.setSystemTime(60_001)

    expect(checkRateLimit('u1', { windowMs: 60_000, max: 5 }).limited).toBe(false)
  })

  it('tracks independent keys separately', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('u1', { windowMs: 60_000, max: 5 })
    expect(checkRateLimit('u1', { windowMs: 60_000, max: 5 }).limited).toBe(true)

    expect(checkRateLimit('u2', { windowMs: 60_000, max: 5 }).limited).toBe(false)
  })
})
