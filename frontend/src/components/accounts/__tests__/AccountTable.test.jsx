import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountTable from '../AccountTable.jsx'

const ACCOUNTS = [
  {
    id: 'a1',
    name: 'Acme Corp',
    country: 'Australia',
    acv: 120000,
    sfdc_account_url: 'https://sfdc.example.com/a1',
    last_updated_by: { id: 'u1', display_name: 'Sara' },
    updated_at: '2026-06-15T10:00:00Z',
  },
  {
    id: 'a2',
    name: 'BetaCo',
    country: 'USA',
    acv: null,
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

  it('shows an "(archived)" caption and greys out an archived account row', () => {
    const archived = [...ACCOUNTS, { ...ACCOUNTS[1], id: 'a3', name: 'Archived Co', deleted_at: '2026-07-01T00:00:00Z' }]
    render(<AccountTable accounts={archived} onSelectAccount={vi.fn()} />)

    expect(screen.getByText('(archived)')).toBeTruthy()
    const row = screen.getByText('Archived Co').closest('tr')
    expect(row.className).toContain('opacity-60')
  })

  it('hides the ACV column by default', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} />)
    expect(screen.queryByText('ACV')).toBeFalsy()
  })

  it('shows a formatted ACV value when the column is made visible', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} columnVisibility={{ acv: true }} />)

    expect(screen.getByText('ACV')).toBeTruthy()
    expect(screen.getByText('120,000')).toBeTruthy()
  })

  it('calls onSort with the backend sort key when a sortable header is clicked', () => {
    const onSort = vi.fn()
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} onSort={onSort} />)

    fireEvent.click(screen.getByText('Country'))

    expect(onSort).toHaveBeenCalledWith('country')
  })

  it('does not attach a sort handler to a non-sortable column header', () => {
    const onSort = vi.fn()
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} onSort={onSort} />)

    fireEvent.click(screen.getByText('SFDC'))

    expect(onSort).not.toHaveBeenCalled()
  })

  it('shows a sort direction indicator only on the active sort column', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} sortBy="country" sortDir="desc" />)

    const countryHeader = screen.getByText('Country').closest('th')
    expect(countryHeader.querySelector('.ti-arrow-down')).toBeTruthy()
    const nameHeader = screen.getByText('Name').closest('th')
    expect(nameHeader.querySelector('.ti-arrow-down')).toBeFalsy()
  })

  it('hides a column when columnVisibility marks it false', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} columnVisibility={{ country: false }} />)

    expect(screen.queryByText('Country')).toBeFalsy()
    expect(screen.getByText('Last updated')).toBeTruthy()
  })

  it('renders columns in the order given by columnOrder', () => {
    render(<AccountTable accounts={ACCOUNTS} onSelectAccount={vi.fn()} columnOrder={['last_updated', 'country', 'sfdc']} />)

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers[1]).toBe('Last updated')
    expect(headers[2]).toBe('Country')
  })
})
