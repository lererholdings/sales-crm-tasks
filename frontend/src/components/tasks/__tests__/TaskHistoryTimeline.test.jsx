import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskHistoryTimeline from '../TaskHistoryTimeline.jsx'

const ENTRY = {
  id: 'log1',
  entity_type: 'task',
  entity_id: 'task1',
  user: { id: 'u1', display_name: 'Sara' },
  action: 'updated',
  changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
  timestamp: '2026-06-15T10:00:00Z',
}

describe('TaskHistoryTimeline', () => {
  it('shows the total in the collapsed header without fetching further', () => {
    render(<TaskHistoryTimeline entries={[]} total={5} loading={false} onLoadMore={vi.fn()} />)

    expect(screen.getByText('History (5)')).toBeTruthy()
    expect(screen.queryByText('No history yet.')).toBeFalsy()
  })

  it('expands to show entries with their diff on click', () => {
    render(<TaskHistoryTimeline entries={[ENTRY]} total={1} loading={false} onLoadMore={vi.fn()} />)

    fireEvent.click(screen.getByText('History (1)'))

    expect(screen.getByText('Sara')).toBeTruthy()
    expect(screen.getByText('updated')).toBeTruthy()
    expect(screen.getByText(/status/)).toBeTruthy()
    expect(screen.getByText(/backlog/)).toBeTruthy()
    expect(screen.getByText(/in_progress/)).toBeTruthy()
  })

  it('shows the empty state when expanded with no entries', () => {
    render(<TaskHistoryTimeline entries={[]} total={0} loading={false} onLoadMore={vi.fn()} />)

    fireEvent.click(screen.getByText('History'))

    expect(screen.getByText('No history yet.')).toBeTruthy()
  })

  it('shows a load-more button when more entries remain, and calls onLoadMore', async () => {
    const onLoadMore = vi.fn().mockResolvedValue()
    render(<TaskHistoryTimeline entries={[ENTRY]} total={5} loading={false} onLoadMore={onLoadMore} />)

    fireEvent.click(screen.getByText('History (5)'))
    expect(screen.getByText('Load 4 more')).toBeTruthy()

    fireEvent.click(screen.getByText('Load 4 more'))
    expect(onLoadMore).toHaveBeenCalled()
  })

  it('hides the load-more button once every entry has been loaded', () => {
    render(<TaskHistoryTimeline entries={[ENTRY]} total={1} loading={false} onLoadMore={vi.fn()} />)

    fireEvent.click(screen.getByText('History (1)'))

    expect(screen.queryByText(/Load .* more/)).toBeFalsy()
  })
})
