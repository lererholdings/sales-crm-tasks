import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AddNoteForm from '../AddNoteForm.jsx'

describe('AddNoteForm', () => {
  it('shows an inline validation error when posting with empty content, without calling onAdd', () => {
    const onAdd = vi.fn()
    render(<AddNoteForm onAdd={onAdd} />)

    fireEvent.click(screen.getByText('Post note'))

    expect(screen.getByText('Note content is required.')).toBeTruthy()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('clears the validation error once content is typed and posted', async () => {
    const onAdd = vi.fn().mockResolvedValue({})
    render(<AddNoteForm onAdd={onAdd} />)

    fireEvent.click(screen.getByText('Post note'))
    expect(screen.getByText('Note content is required.')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Add a note… (markdown supported)'), {
      target: { value: 'A real note' },
    })
    fireEvent.click(screen.getByText('Post note'))

    expect(onAdd).toHaveBeenCalledWith('A real note')
    expect(screen.queryByText('Note content is required.')).toBeFalsy()
  })
})
