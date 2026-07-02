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

// First login for a given clerk_user_id creates the users row (display name
// + email pulled from Clerk); every login after that just resolves it.
// ON CONFLICT guards against two concurrent first-logins racing each other.
async function provisionUser(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress
  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email

  const { rows } = await query(
    `INSERT INTO users (clerk_user_id, display_name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_user_id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
     RETURNING id, role, display_name, email`,
    [clerkUserId, displayName, email],
  )
  return rows[0]
}

export async function validateSession(req) {
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
  const { rows } = await query('SELECT id, role, display_name, email FROM users WHERE clerk_user_id = $1', [
    clerkUserId,
  ])
  const row = rows[0] ?? (await provisionUser(clerkUserId))
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
