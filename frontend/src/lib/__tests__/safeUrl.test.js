import { describe, expect, it } from 'vitest'
import { isSafeUrl } from '../safeUrl.js'

describe('isSafeUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(isSafeUrl('https://sfdc.example.com/acme')).toBe(true)
    expect(isSafeUrl('http://sfdc.example.com/acme')).toBe(true)
  })

  it('rejects null/undefined/empty', () => {
    expect(isSafeUrl(null)).toBe(false)
    expect(isSafeUrl(undefined)).toBe(false)
    expect(isSafeUrl('')).toBe(false)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })
})
