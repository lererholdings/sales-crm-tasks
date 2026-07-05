import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AdminPage from '../AdminPage.jsx'

// AccountsPage and TasksPage are no longer placeholders (Milestones 3 and 5)
// — see their own __tests__ files (they need Clerk auth context mocked,
// unlike this one, which is still bare).
describe('placeholder pages render without crashing', () => {
  it('renders the Admin page', () => {
    render(<AdminPage />)
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeTruthy()
  })
})
