import pg from 'pg'

const { Pool } = pg

// Direct Postgres over the pooled (transaction-mode) connection string —
// see docs/design.md section 4 for why this is a plain pg.Pool and not the
// Supabase JS client: migrating hosts later means changing DATABASE_URL,
// not rewriting queries. Lazily created so tests can mock this module
// without needing a real DATABASE_URL, and reused across warm invocations
// on Vercel rather than reconnecting per request.
let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export function query(text, params) {
  return getPool().query(text, params)
}
