import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskTable from '../TaskTable.jsx'
import TaskRow from '../TaskRow.jsx'
import TaskGroupHeader from '../TaskGroupHeader.jsx'

function task(overrides = {}) {
  return {
    id: 't1',
    task_name: 'RFP response',
    account: { id: 'a1', name: 'Acme Corp' },
    partner_name: 'PartnerX',
    task_type: { id: 'tt1', category: 'pre-sale', name: 'RFP' },
    status: 'in_progress',
    priority: 'high',
    eta: null,
    next_action: 'Send draft',
    assignee: { id: 'u1', display_name: 'Sara' },
    notes: [],
    ...overrides,
  }
}

describe('TaskTable', () => {
  it('shows an empty state with no tasks', () => {
    render(<TaskTable tasks={[]} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)
    expect(screen.getByText('No tasks yet.')).toBeTruthy()
  })

  it('renders a group header with the task count and each task row underneath it', () => {
    const tasks = [
      task({ id: 't1', task_name: 'RFP response' }),
      task({ id: 't2', task_name: 'Product demo' }),
    ]
    render(<TaskTable tasks={tasks} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)

    expect(screen.getByText('Acme Corp — PartnerX')).toBeTruthy()
    expect(screen.getByText('2 tasks')).toBeTruthy()
    expect(screen.getByText('RFP response')).toBeTruthy()
    expect(screen.getByText('Product demo')).toBeTruthy()
  })

  it('shows a "Partner only" tag for partner-only groups', () => {
    const tasks = [task({ account: null, partner_name: 'PartnerZ' })]
    render(<TaskTable tasks={tasks} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)

    expect(screen.getByText('Partner only')).toBeTruthy()
  })

  it('collapses and expands a group when its header is clicked', () => {
    const tasks = [task()]
    render(<TaskTable tasks={tasks} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)

    expect(screen.getByText('RFP response')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp — PartnerX'))
    expect(screen.queryByText('RFP response')).toBeFalsy()
    fireEvent.click(screen.getByText('Acme Corp — PartnerX'))
    expect(screen.getByText('RFP response')).toBeTruthy()
  })

  it('calls onOpen with the task when a row is clicked', () => {
    const onOpen = vi.fn()
    const tasks = [task()]
    render(<TaskTable tasks={tasks} onOpen={onOpen} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)

    fireEvent.click(screen.getByText('RFP response'))
    expect(onOpen).toHaveBeenCalledWith(tasks[0])
  })

  it('marks a soft-deleted task with a "(deleted)" tag and dims the row', () => {
    render(
      <TaskTable
        tasks={[task({ deleted_at: '2026-07-01T00:00:00Z' })]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
      />,
    )

    expect(screen.getByText('(deleted)')).toBeTruthy()
    const row = screen.getByText('RFP response').closest('tr')
    expect(row.className).toContain('opacity-60')
  })

  it('does not tag or dim an active task', () => {
    render(<TaskTable tasks={[task()]} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} />)

    expect(screen.queryByText('(deleted)')).toBeFalsy()
    const row = screen.getByText('RFP response').closest('tr')
    expect(row.className).not.toContain('opacity-60')
  })

  it('calls onSort with the backend sort key when a sortable header is clicked', () => {
    const onSort = vi.fn()
    render(<TaskTable tasks={[task()]} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} onSort={onSort} />)

    fireEvent.click(screen.getByText('Priority'))

    expect(onSort).toHaveBeenCalledWith('priority')
  })

  it('does not attach a sort handler to a non-sortable column header', () => {
    const onSort = vi.fn()
    render(<TaskTable tasks={[task()]} onOpen={vi.fn()} onDuplicate={vi.fn()} onDeleteRequest={vi.fn()} onSort={onSort} />)

    fireEvent.click(screen.getByText('Notes'))

    expect(onSort).not.toHaveBeenCalled()
  })

  it('shows a sort direction indicator only on the active sort column', () => {
    render(
      <TaskTable
        tasks={[task()]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        sortBy="priority"
        sortDir="desc"
      />,
    )

    const priorityHeader = screen.getByText('Priority').closest('th')
    expect(priorityHeader.querySelector('.ti-arrow-down')).toBeTruthy()
    const statusHeader = screen.getByText('Status').closest('th')
    expect(statusHeader.querySelector('.ti-arrow-down')).toBeFalsy()
  })

  it('hides a column when columnVisibility marks it false', () => {
    render(
      <TaskTable
        tasks={[task()]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        columnVisibility={{ priority: false }}
      />,
    )

    expect(screen.queryByText('Priority')).toBeFalsy()
    expect(screen.getByText('Status')).toBeTruthy()
  })

  it('renders columns in the order given by columnOrder', () => {
    render(
      <TaskTable
        tasks={[task()]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        columnOrder={['status', 'type', 'assignee', 'next_action', 'priority', 'eta', 'notes_preview', 'last_updated']}
      />,
    )

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers[1]).toBe('Status')
    expect(headers[2]).toBe('Type')
  })

  // Regression guard: TaskRow/TaskGroupHeader are wrapped in React.memo so
  // updating one task in place (hooks/useTasks.js's updateTaskInPlace)
  // only re-renders that row, not the whole table. This only works because
  // both are memoized AND their callback props are stable references
  // (useCallback in TasksPage.jsx / TaskTable.jsx) — losing either wrapper
  // silently defeats the optimization without any other test catching it.
  it('memoizes TaskRow and TaskGroupHeader', () => {
    expect(TaskRow.$$typeof).toBe(Symbol.for('react.memo'))
    expect(TaskGroupHeader.$$typeof).toBe(Symbol.for('react.memo'))
  })
})
