import { query } from '../api/_lib/db.js'

// Same hard guard as reset-dev-db.js — see docs/operations.md.
const DEV_PROJECT_REF = 'mtloxubtjinllxaenavu'

function assertDevDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url.includes(DEV_PROJECT_REF)) {
    console.error(
      `Refusing to run: DATABASE_URL doesn't look like the dev project (${DEV_PROJECT_REF}).\n` +
        'This script only ever runs against dev — never point it at production.',
    )
    process.exit(1)
  }
}

const DEMO_ACCOUNTS = [
  { name: 'Acme Corp', country: 'Australia', acv: 120000, sfdc_account_url: 'https://sfdc.example.com/acme' },
  { name: 'BetaCo', country: 'USA', acv: 45000, sfdc_account_url: null },
  { name: 'Globex Pty Ltd', country: 'Australia', acv: null, sfdc_account_url: null },
  { name: 'Initech', country: 'New Zealand', acv: 85000, sfdc_account_url: 'https://sfdc.example.com/initech' },
  { name: 'Umbrella Partners', country: 'Singapore', acv: 250000, sfdc_account_url: null },
]

// Direct SQL, not the API — this is dev-only tooling with no server
// running and no auth token to attach, so it bypasses the API layer
// entirely. That also means seeded accounts get no audit_log "created"
// entry (nothing calls logFieldChanges here) — edit one via the UI
// afterward if you want to see a real audit trail.
async function main() {
  assertDevDatabase()

  const { rows: existingUsers } = await query('SELECT id FROM users ORDER BY created_at LIMIT 1')
  const lastUpdatedBy = existingUsers[0]?.id ?? null

  let created = 0
  let skipped = 0
  for (const account of DEMO_ACCOUNTS) {
    const { rows: existing } = await query('SELECT id FROM accounts WHERE name = $1', [account.name])
    if (existing.length > 0) {
      skipped += 1
      continue
    }

    await query(
      `INSERT INTO accounts (name, country, acv, sfdc_account_url, last_updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [account.name, account.country, account.acv, account.sfdc_account_url, lastUpdatedBy],
    )
    created += 1
  }

  console.log(`Seeded ${created} account(s), skipped ${skipped} already present.`)
  if (!lastUpdatedBy) {
    console.log('No existing users found — seeded accounts have no last_updated_by. Log in once first if you want that populated.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
