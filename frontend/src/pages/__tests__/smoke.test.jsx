import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TasksPage from '../TasksPage.jsx'
import AdminPage from '../AdminPage.jsx'

// AccountsPage is no longer a placeholder as of Milestone 3 — see
// src/pages/__tests__/AccountsPage.test.jsx for its own tests (it needs
// Clerk auth context mocked, unlike these two which are still bare).
describe('placeholder pages render without crashing', () => {
  it('renders the Tasks page', () => {
    render(<TasksPage />)
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy()
  })

  it('renders the Admin page', () => {
    render(<AdminPage />)
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeTruthy()
  })
})
