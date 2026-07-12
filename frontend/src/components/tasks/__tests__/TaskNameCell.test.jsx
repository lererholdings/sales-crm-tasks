import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskNameCell from '../TaskNameCell.jsx'

function task(overrides = {}) {
  return {
    id: 't1',
    task_name: 'RFP response',
    account: { id: 'a1', name: 'Acme Corp' },
    deleted_at: null,
    ...overrides,
  }
}

describe('TaskNameCell', () => {
  it('does not show "Link to account" for a task that already has an account', () => {
    render(
      <TaskNameCell task={task()} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} onLinkToAccount={vi.fn()} />,
    )

    fireEvent.click(screen.getByLabelText('Task actions'))

    expect(screen.queryByText('Link to account')).toBeFalsy()
  })

  it('shows "Link to account" for a partner-only task (no account)', () => {
    render(
      <TaskNameCell
        task={task({ account: null })}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        onLinkToAccount={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Task actions'))

    expect(screen.getByText('Link to account')).toBeTruthy()
  })

  it('calls onLinkToAccount (not onOpen) when "Link to account" is clicked', () => {
    const onOpen = vi.fn()
    const onLinkToAccount = vi.fn()
    const t = task({ account: null })
    render(
      <TaskNameCell task={t} onOpen={onOpen} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} onLinkToAccount={onLinkToAccount} />,
    )

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Link to account'))

    expect(onLinkToAccount).toHaveBeenCalledWith(t)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('closes the menu after clicking "Link to account"', () => {
    render(
      <TaskNameCell
        task={task({ account: null })}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        onLinkToAccount={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Link to account'))

    expect(screen.queryByText('Edit task')).toBeFalsy()
  })
})
