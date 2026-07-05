// The three group-label rules from design.md's Task table section:
//   - Account + partner  -> "Acme Corp — PartnerX"
//   - Account, no partner -> "Acme Corp"
//   - Partner only, no account yet -> "PartnerZ" + a "Partner only" pill
// Falls back to a single "No account or partner" bucket for the (currently
// possible but unexpected) case where a task has neither — account_id and
// partner_name are both optional at creation.
// Preserves first-appearance order rather than sorting groups alphabetically,
// matching the order tasks already come back in from the API.
export function groupTasks(tasks) {
  const groups = new Map()

  for (const task of tasks) {
    const hasAccount = Boolean(task.account)
    const hasPartner = Boolean(task.partner_name)

    let key
    let label
    let isPartnerOnly = false

    if (hasAccount && hasPartner) {
      key = `account:${task.account.id}|partner:${task.partner_name}`
      label = `${task.account.name} — ${task.partner_name}`
    } else if (hasAccount) {
      key = `account:${task.account.id}`
      label = task.account.name
    } else if (hasPartner) {
      key = `partner:${task.partner_name}`
      label = task.partner_name
      isPartnerOnly = true
    } else {
      key = 'ungrouped'
      label = 'No account or partner'
    }

    if (!groups.has(key)) groups.set(key, { key, label, isPartnerOnly, tasks: [] })
    groups.get(key).tasks.push(task)
  }

  return Array.from(groups.values())
}
