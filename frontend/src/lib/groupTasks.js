// The three group-label rules from design.md's Task table section:
//   - Account + partner  -> "Acme Corp — PartnerX"
//   - Account, no partner -> "Acme Corp"
//   - Partner only, no account yet -> "PartnerZ" + a "Partner only" pill
// Falls back to a single "No account or partner" bucket for the (currently
// possible but unexpected) case where a task has neither — account_id and
// partner_name are both optional at creation.
//
// Groups sharing the same account (e.g. "Acme Corp — PartnerX" and
// "Acme Corp" with no partner) are kept adjacent, positioned where that
// account was first encountered, rather than wherever each combination
// happens to first appear in task order — otherwise two of the same
// account's groups could end up scattered apart with unrelated accounts'
// groups in between. Partner-only/ungrouped buckets (no account to cluster
// by) just keep their own first-appearance position.
export function groupTasks(tasks) {
  const groups = new Map()
  const order = []
  const lastIndexForAccount = new Map()

  for (const task of tasks) {
    const hasAccount = Boolean(task.account)
    const hasPartner = Boolean(task.partner_name)

    let key
    let label
    let isPartnerOnly = false
    let accountId = null

    if (hasAccount && hasPartner) {
      key = `account:${task.account.id}|partner:${task.partner_name}`
      label = `${task.account.name} — ${task.partner_name}`
      accountId = task.account.id
    } else if (hasAccount) {
      key = `account:${task.account.id}`
      label = task.account.name
      accountId = task.account.id
    } else if (hasPartner) {
      key = `partner:${task.partner_name}`
      label = task.partner_name
      isPartnerOnly = true
    } else {
      key = 'ungrouped'
      label = 'No account or partner'
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, isPartnerOnly, tasks: [] })

      if (accountId && lastIndexForAccount.has(accountId)) {
        const insertAt = lastIndexForAccount.get(accountId) + 1
        order.splice(insertAt, 0, key)
        for (const [id, idx] of lastIndexForAccount) {
          if (idx >= insertAt) lastIndexForAccount.set(id, idx + 1)
        }
        lastIndexForAccount.set(accountId, insertAt)
      } else {
        order.push(key)
        if (accountId) lastIndexForAccount.set(accountId, order.length - 1)
      }
    }

    groups.get(key).tasks.push(task)
  }

  return order.map((key) => groups.get(key))
}
