// Consistent error response shape across every endpoint: { error, code }.
// `error` stays a human-readable message (unchanged from before this
// existed); `code` is a stable, machine-readable string the frontend can
// branch on without parsing message text. Derived from the HTTP status by
// default — every error in this codebase so far maps 1:1 onto one of these,
// so call sites don't need to pick a code by hand. Pass an explicit code
// only when a single status covers genuinely distinct error conditions that
// a caller might want to distinguish.
const STATUS_TO_CODE = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
}

export function sendError(res, status, message, code = STATUS_TO_CODE[status] ?? 'ERROR') {
  return res.status(status).json({ error: message, code })
}
