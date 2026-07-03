import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountTable from '../AccountTable.jsx'

const ACCOUNTS = [
  {
    id: 'a1',
    name: 'Acme Corp',
    country: 'Australia',
    sfdc_account_url: 'https://sfdc.example.com/a1',
    last_updated_by: { id: 'u1', display_name: 'Sara' },
    updated_at: '2026-06-15T10:00:00Z',
  },
  {
    id: 'a2',
    name: 'BetaCo',
    country: 'USA',
    sfdc_account_url: null,
    last_updated_by: null,
    updated_at: '2026-06-14T10:00:00Z',
  },
]

describe('AccountTable', () => {
  it('renders one row per account', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} />)

    expect(screen.getByText('Acme Corp')).toBeTruthy()
    expect(screen.getByText('BetaCo')).toBeTruthy()
    expect(screen.getByText('Australia')).toBeTruthy()
  })

  it('shows an em dash when there is no SFDC link', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows an empty state with no accounts', () => {
    render(<AccountTable accounts={[]} onSelectAccount={vi.fn()} />)
    expect(screen.getByText('No accounts yet.')).toBeTruthy()
  })

  it('calls onSelectAccount with the clicked account when a row is clicked', async () => {
    const onSelectAccount = vi.fn()
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={onSelectAccount} />)

    screen.getByText('Acme Corp').closest('tr').click()

    expect(onSelectAccount).toHaveBeenCalledWith(ACCOUNTS[0])
  })
})
