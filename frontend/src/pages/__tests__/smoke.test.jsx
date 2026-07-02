import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TasksPage from '../TasksPage.jsx'
import AccountsPage from '../AccountsPage.jsx'
import AdminPage from '../AdminPage.jsx'

describe('placeholder pages render without crashing', () => {
  it('renders the Tasks page', () => {
    render(<TasksPage />)
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy()
  })

  it('renders the Accounts page', () => {
    render(<AccountsPage />)
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeTruthy()
  })

  it('renders the Admin page', () => {
    render(<AdminPage />)
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeTruthy()
  })
})
