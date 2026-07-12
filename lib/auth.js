import { createClerkClient, verifyToken } from '@clerk/backend'
import { query } from './db.js'

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function toUser(row, clerkUserId) {
  return {
    id: row.id,
    role: row.role,
    clerkUserId,
    displayName: row.display_name,
    email: row.email,
  }
}

function deriveDisplayName(firstName, lastName, email) {
  return [firstName, lastName].filter(Boolean).join(' ') || email
}

// First login for a given clerk_user_id creates the users row; every login
// after that just resolves it. ON CONFLICT guards against two concurrent
// first-logins racing each other. provisionDetails is only called when a
// row doesn't already exist, so the real (Clerk API) path and the test
// bypass path can supply displayName/email differently without duplicating
// the lookup/insert logic.
//
// syncTarget (existing users only): { displayName, email } derived from the
// session token's custom claims (see design.md section 12 / issue #2) —
// already verified as part of the token, so this is a diff against the
// stored row, not a fresh Clerk API call. undefined means "don't sync"
// (the test bypass path, or a token minted before the claims were
// configured), in which case the stored row wins as-is. Only writes when
// something actually changed, to avoid an unconditional UPDATE on every
// authenticated request.
async function resolveOrProvision(clerkUserId, provisionDetails, syncTarget) {
  const { rows } = await query('SELECT id, role, display_name, email FROM users WHERE clerk_user_id = $1', [
    clerkUserId,
  ])
  if (rows[0]) {
    if (syncTarget && (syncTarget.displayName !== rows[0].display_name || syncTarget.email !== rows[0].email)) {
      const { rows: updated } = await query(
        'UPDATE users SET display_name = $2, email = $3 WHERE id = $1 RETURNING id, role, display_name, email',
        [rows[0].id, syncTarget.displayName, syncTarget.email],
      )
      return updated[0]
    }
    return rows[0]
  }

  const { displayName, email } = await provisionDetails()
  const inserted = await query(
    `INSERT INTO users (clerk_user_id, display_name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_user_id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
     RETURNING id, role, display_name, email`,
    [clerkUserId, displayName, email],
  )
  return inserted.rows[0]
}

async function clerkProvisionDetails(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress
  const displayName = deriveDisplayName(clerkUser.firstName, clerkUser.lastName, email)
  return { displayName, email }
}

// Test-only escape hatch for automated testing (CI integration tests, and
// verifying deployed Preview environments without a browser login). Never
// reachable unless TEST_AUTH_BYPASS_SECRET is set — which must NEVER be set
// in Production (see design.md section 12, "Test auth bypass"). Skips real
// Clerk verification entirely; the DB lookup/auto-provisioning logic below
// still runs for real, so these tests exercise real behavior, not mocks.
async function validateTestBypass(req) {
  const clerkUserId = req.headers['x-test-clerk-user-id']
  if (!clerkUserId) {
    throw new AuthError(401, 'x-test-clerk-user-id header required in test bypass mode')
  }
  const row = await resolveOrProvision(clerkUserId, () => ({
    displayName: req.headers['x-test-display-name'] ?? 'Test User',
    email: req.headers['x-test-email'] ?? `${clerkUserId}@test.invalid`,
  }))
  return toUser(row, clerkUserId)
}

export async function validateSession(req) {
  const bypassSecret = process.env.TEST_AUTH_BYPASS_SECRET
  if (bypassSecret && req.headers['x-test-bypass-secret'] === bypassSecret) {
    return validateTestBypass(req)
  }

  const header = req.headers.authorization ?? req.headers.Authorization
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError(401, 'Missing bearer token')
  }
  const token = header.slice('Bearer '.length)

  let claims
  try {
    claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
  } catch {
    throw new AuthError(401, 'Invalid or expired session')
  }

  const clerkUserId = claims.sub
  // claims.email only exists once "Customize session token" is configured
  // in the Clerk Dashboard (Sessions) to include it — undefined here just
  // means "not configured (yet)" or "a token minted before it was," and
  // resolveOrProvision treats that as "don't sync," not an error.
  const syncTarget = claims.email
    ? { email: claims.email, displayName: deriveDisplayName(claims.first_name, claims.last_name, claims.email) }
    : undefined
  const row = await resolveOrProvision(clerkUserId, () => clerkProvisionDetails(clerkUserId), syncTarget)
  return toUser(row, clerkUserId)
}

// Wraps a handler so every endpoint gets { id, role, ... } on req.user
// without repeating the try/catch. Role checks (admin-only, etc.) stay in
// the endpoint itself — see design.md section 7.
export function withAuth(handler) {
  return async (req, res) => {
    try {
      const user = await validateSession(req)
      return await handler(req, res, user)
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message })
      }
      console.error(err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }
}
