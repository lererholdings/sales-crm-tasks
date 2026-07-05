import { describe, expect, it } from 'vitest'
import { groupTasks } from '../groupTasks.js'

function task(overrides = {}) {
  return {
    id: 't1',
    task_name: 'Task',
    account: null,
    partner_name: null,
    ...overrides,
  }
}

describe('groupTasks', () => {
  it('groups account + partner as "Account — Partner"', () => {
    const tasks = [task({ account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' })]
    const [group] = groupTasks(tasks)

    expect(group.label).toBe('Acme Corp — PartnerX')
    expect(group.isPartnerOnly).toBe(false)
  })

  it('groups account with no partner as just "Account"', () => {
    const tasks = [task({ account: { id: 'a1', name: 'Acme Corp' }, partner_name: null })]
    const [group] = groupTasks(tasks)

    expect(group.label).toBe('Acme Corp')
    expect(group.isPartnerOnly).toBe(false)
  })

  it('groups partner-only tasks (no account) with the partner-only flag set', () => {
    const tasks = [task({ account: null, partner_name: 'PartnerZ' })]
    const [group] = groupTasks(tasks)

    expect(group.label).toBe('PartnerZ')
    expect(group.isPartnerOnly).toBe(true)
  })

  it('falls back to an "ungrouped" bucket when neither account nor partner is set', () => {
    const tasks = [task({ account: null, partner_name: null })]
    const [group] = groupTasks(tasks)

    expect(group.label).toBe('No account or partner')
    expect(group.isPartnerOnly).toBe(false)
  })

  it('groups multiple tasks under the same account+partner combination together', () => {
    const tasks = [
      task({ id: 't1', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' }),
      task({ id: 't2', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' }),
    ]
    const groups = groupTasks(tasks)

    expect(groups).toHaveLength(1)
    expect(groups[0].tasks).toHaveLength(2)
  })

  it('keeps account-only and account+partner tasks for the same account in separate groups', () => {
    const tasks = [
      task({ id: 't1', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' }),
      task({ id: 't2', account: { id: 'a1', name: 'Acme Corp' }, partner_name: null }),
    ]
    const groups = groupTasks(tasks)

    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.label)).toEqual(['Acme Corp — PartnerX', 'Acme Corp'])
  })

  it('preserves first-appearance order of groups', () => {
    const tasks = [
      task({ id: 't1', account: { id: 'a2', name: 'BetaCo' } }),
      task({ id: 't2', account: { id: 'a1', name: 'Acme Corp' } }),
      task({ id: 't3', account: { id: 'a2', name: 'BetaCo' } }),
    ]
    const groups = groupTasks(tasks)

    expect(groups.map((g) => g.label)).toEqual(['BetaCo', 'Acme Corp'])
  })

  // Regression test: an account can produce two different groups (with vs
  // without a partner). Per review feedback, both should stay adjacent
  // rather than getting scattered wherever each combination first appears
  // relative to an unrelated account's group in between.
  it('keeps all of one account\'s groups adjacent even when another account\'s group appears in between', () => {
    const tasks = [
      task({ id: 't1', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' }),
      task({ id: 't2', account: { id: 'a2', name: 'BetaCo' } }),
      task({ id: 't3', account: { id: 'a1', name: 'Acme Corp' }, partner_name: null }),
    ]
    const groups = groupTasks(tasks)

    expect(groups.map((g) => g.label)).toEqual(['Acme Corp — PartnerX', 'Acme Corp', 'BetaCo'])
  })

  it('clusters a third group for the same account right after the others, not at the end unrelated', () => {
    const tasks = [
      task({ id: 't1', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerX' }),
      task({ id: 't2', account: { id: 'a2', name: 'BetaCo' } }),
      task({ id: 't3', account: { id: 'a1', name: 'Acme Corp' }, partner_name: null }),
      task({ id: 't4', account: { id: 'a3', name: 'Gamma Inc' } }),
      task({ id: 't5', account: { id: 'a1', name: 'Acme Corp' }, partner_name: 'PartnerY' }),
    ]
    const groups = groupTasks(tasks)

    expect(groups.map((g) => g.label)).toEqual([
      'Acme Corp — PartnerX',
      'Acme Corp',
      'Acme Corp — PartnerY',
      'BetaCo',
      'Gamma Inc',
    ])
  })

  it('does not cluster partner-only groups (no account to cluster by)', () => {
    const tasks = [
      task({ id: 't1', account: null, partner_name: 'PartnerZ' }),
      task({ id: 't2', account: { id: 'a1', name: 'Acme Corp' } }),
      task({ id: 't3', account: null, partner_name: 'PartnerZ' }),
    ]
    const groups = groupTasks(tasks)

    expect(groups.map((g) => g.label)).toEqual(['PartnerZ', 'Acme Corp'])
  })
})
