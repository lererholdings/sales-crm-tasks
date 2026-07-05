import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotesPreview from '../NotesPreview.jsx'

const NOTES = [
  { id: 'n1', content: 'Sent initial draft', created_at: new Date().toISOString() },
  { id: 'n2', content: 'Customer confirmed receipt', created_at: new Date().toISOString() },
]

describe('NotesPreview', () => {
  it('shows an em dash with no notes', () => {
    render(<NotesPreview notes={[]} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  // Regression test: notes used to be joined inline on one line ("· "
  // separated) — per review feedback, each note should be its own line.
  it('renders each note on its own line, not run together', () => {
    const { container } = render(<NotesPreview notes={NOTES} />)

    const lines = container.querySelectorAll('div.truncate')
    expect(lines).toHaveLength(2)
    expect(lines[0].textContent).toContain('Sent initial draft')
    expect(lines[1].textContent).toContain('Customer confirmed receipt')
  })
})
