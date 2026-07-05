import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotesTimeline from '../NotesTimeline.jsx'

const NOTES = [
  { id: 'n2', content: 'Newest note', user: { id: 'u1', display_name: 'Sara' }, created_at: 't2', edited_at: null },
  { id: 'n1', content: 'Oldest note', user: { id: 'u1', display_name: 'Sara' }, created_at: 't1', edited_at: null },
]

describe('NotesTimeline', () => {
  it('renders the add-note field above the notes list', () => {
    render(
      <NotesTimeline
        notes={NOTES}
        notesTotal={2}
        currentUserId="u1"
        onLoadMore={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
      />,
    )

    const addNotePlaceholder = screen.getByPlaceholderText('Add a note… (markdown supported)')
    const newestNote = screen.getByText('Newest note')

    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING (4) means the note
    // comes after the add-note field in document order.
    expect(addNotePlaceholder.compareDocumentPosition(newestNote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders notes newest-first', () => {
    render(
      <NotesTimeline
        notes={NOTES}
        notesTotal={2}
        currentUserId="u1"
        onLoadMore={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
      />,
    )

    const newest = screen.getByText('Newest note')
    const oldest = screen.getByText('Oldest note')
    expect(newest.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('only offers Edit on the first (newest) note, not older ones, for its author', () => {
    render(
      <NotesTimeline
        notes={NOTES}
        notesTotal={2}
        currentUserId="u1"
        onLoadMore={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Edit')).toHaveLength(1)
  })
})
