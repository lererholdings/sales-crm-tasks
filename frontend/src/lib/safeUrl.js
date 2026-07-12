const URL_RE = /^https?:\/\//i

// Guards against rendering a stored URL (e.g. an SFDC link) as an <a href>
// if it isn't http(s) — defense-in-depth alongside the same check the
// backend applies on write, for data written before that check existed.
export function isSafeUrl(value) {
  return typeof value === 'string' && URL_RE.test(value)
}
