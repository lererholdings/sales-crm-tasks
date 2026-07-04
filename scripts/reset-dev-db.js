import { createInterface } from 'node:readline/promises'
import { query } from '../lib/db.js'

// Hard structural guard, not just a warning: refuses to run against
// anything but the dev Supabase project (see docs/operations.md). This is
// the actual safety mechanism — there's no other check standing between
// this script and a real database.
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

async function confirm() {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    'This deletes all accounts, tasks, task notes, and audit log entries in the DEV database ' +
      '(your users and task_types stay intact). Type "yes" to continue: ',
  )
  rl.close()
  return answer.trim().toLowerCase() === 'yes'
}

// Deliberately excludes users and task_types — those aren't "content" to
// reset, they're your login/admin status and the admin-configured type
// list. Clearing accounts also clears audit_log entries pointing at them
// via CASCADE.
const TABLES_TO_CLEAR = ['audit_log', 'task_notes', 'tasks', 'accounts']

async function main() {
  assertDevDatabase()

  if (!(await confirm())) {
    console.log('Cancelled.')
    return
  }

  await query(`TRUNCATE TABLE ${TABLES_TO_CLEAR.join(', ')} CASCADE`)
  console.log(`Cleared: ${TABLES_TO_CLEAR.join(', ')}. users and task_types left untouched.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
