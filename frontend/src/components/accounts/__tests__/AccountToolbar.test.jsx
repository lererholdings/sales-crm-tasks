import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountToolbar from '../AccountToolbar.jsx'
import { DEFAULT_ACCOUNT_COLUMN_ORDER, DEFAULT_ACCOUNT_COLUMN_VISIBILITY } from '../../../lib/accountColumns.js'

const DEFAULT_PREFERENCES = {
  accounts_column_order: DEFAULT_ACCOUNT_COLUMN_ORDER,
  accounts_column_visibility: DEFAULT_ACCOUNT_COLUMN_VISIBILITY,
}

function renderToolbar(props = {}) {
  return render(
    <AccountToolbar
      filters={{}}
      onFilterChange={vi.fn()}
      preferences={DEFAULT_PREFERENCES}
      onReorderColumns={vi.fn()}
      onToggleColumnVisibility={vi.fn()}
      onNewAccount={vi.fn()}
      {...props}
    />,
  )
}

describe('AccountToolbar', () => {
  it('renders the search input, Country filter, and Columns button', () => {
    renderToolbar()

    expect(screen.getByPlaceholderText('Search accounts…')).toBeTruthy()
    expect(screen.getByText('Country')).toBeTruthy()
    expect(screen.getByLabelText('Manage columns')).toBeTruthy()
  })

  it('debounces the Country text filter and calls onFilterChange with the trimmed value', () => {
    vi.useFakeTimers()
    const onFilterChange = vi.fn()
    renderToolbar({ onFilterChange })

    fireEvent.click(screen.getByText('Country'))
    fireEvent.change(screen.getByPlaceholderText('Filter by country…'), { target: { value: ' Australia ' } })
    vi.advanceTimersByTime(300)

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ country: 'Australia' }))
    vi.useRealTimers()
  })

  it('toggles the ACV column via the Columns manager', () => {
    const onToggleColumnVisibility = vi.fn()
    renderToolbar({ onToggleColumnVisibility })

    fireEvent.click(screen.getByLabelText('Manage columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'ACV' }))

    expect(onToggleColumnVisibility).toHaveBeenCalledWith(expect.objectContaining({ acv: true }))
  })

  it('calls onNewAccount when the New account button is clicked', () => {
    const onNewAccount = vi.fn()
    renderToolbar({ onNewAccount })

    fireEvent.click(screen.getByText('New account'))

    expect(onNewAccount).toHaveBeenCalled()
  })
})
