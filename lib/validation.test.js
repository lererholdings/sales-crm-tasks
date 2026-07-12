import { describe, expect, it } from 'vitest'
import { isSafeUrl, validateTextFields } from './validation.js'

describe('isSafeUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(isSafeUrl('https://sfdc.example.com/acme')).toBe(true)
    expect(isSafeUrl('http://sfdc.example.com/acme')).toBe(true)
  })

  it('accepts null/undefined/empty as "not provided"', () => {
    expect(isSafeUrl(null)).toBe(true)
    expect(isSafeUrl(undefined)).toBe(true)
    expect(isSafeUrl('')).toBe(true)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeUrl('ftp://example.com')).toBe(false)
  })
})

describe('validateTextFields', () => {
  it('returns null when all present fields satisfy their rules', () => {
    const error = validateTextFields(
      { task_name: 'RFP', sfdc_task_url: 'https://sfdc.example.com/t1' },
      { task_name: { maxLength: 300 }, sfdc_task_url: { url: true } },
    )
    expect(error).toBeNull()
  })

  it('ignores fields not present in the body', () => {
    const error = validateTextFields({}, { task_name: { maxLength: 5 } })
    expect(error).toBeNull()
  })

  it('rejects a field longer than maxLength', () => {
    const error = validateTextFields({ task_name: 'a'.repeat(301) }, { task_name: { maxLength: 300 } })
    expect(error).toBe('task_name must be 300 characters or fewer')
  })

  it('rejects a non-string value for a text rule', () => {
    const error = validateTextFields({ task_name: 12345 }, { task_name: { maxLength: 300 } })
    expect(error).toBe('task_name must be a string')
  })

  it('rejects an unsafe URL scheme for a url rule', () => {
    const error = validateTextFields(
      { sfdc_task_url: 'javascript:alert(1)' },
      { sfdc_task_url: { url: true } },
    )
    expect(error).toBe('sfdc_task_url must be a valid http(s) URL')
  })

  it('allows null for a url rule (clearing the field)', () => {
    const error = validateTextFields({ sfdc_task_url: null }, { sfdc_task_url: { url: true } })
    expect(error).toBeNull()
  })
})
