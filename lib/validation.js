const URL_RE = /^https?:\/\//i

export function isSafeUrl(value) {
  return value === null || value === undefined || value === '' || URL_RE.test(value)
}

// Checks maxLength/url rules for whichever `rules` keys are present in
// `body` — callers own their own required-field checks. Returns an error
// message for the first violation found, or null if everything passes.
export function validateTextFields(body, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    if (!(field in body)) continue
    const value = body[field]
    if (rule.url) {
      if (!isSafeUrl(value)) return `${field} must be a valid http(s) URL`
      continue
    }
    if (value === null || value === undefined) continue
    if (typeof value !== 'string') return `${field} must be a string`
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${field} must be ${rule.maxLength} characters or fewer`
    }
  }
  return null
}
