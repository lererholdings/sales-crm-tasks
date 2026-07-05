import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ColumnManager from '../ColumnManager.jsx'
import { DEFAULT_COLUMN_ORDER } from '../../../lib/columns.js'

describe('ColumnManager', () => {
  it('opens the popover and lists every configurable column in order', () => {
    render(
      <ColumnManager
        columnOrder={DEFAULT_COLUMN_ORDER}
        columnVisibility={{}}
        onReorder={vi.fn()}
        onToggleVisibility={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Manage columns'))

    expect(screen.getByText('Type')).toBeTruthy()
    expect(screen.getByText('Last updated')).toBeTruthy()
  })

  it('toggles a column off by unchecking it', () => {
    const onToggleVisibility = vi.fn()
    render(
      <ColumnManager
        columnOrder={DEFAULT_COLUMN_ORDER}
        columnVisibility={{}}
        onReorder={vi.fn()}
        onToggleVisibility={onToggleVisibility}
      />,
    )

    fireEvent.click(screen.getByLabelText('Manage columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Priority' }))

    expect(onToggleVisibility).toHaveBeenCalledWith(expect.objectContaining({ priority: false }))
  })

  it('toggles an already-hidden column back on', () => {
    const onToggleVisibility = vi.fn()
    render(
      <ColumnManager
        columnOrder={DEFAULT_COLUMN_ORDER}
        columnVisibility={{ priority: false }}
        onReorder={vi.fn()}
        onToggleVisibility={onToggleVisibility}
      />,
    )

    fireEvent.click(screen.getByLabelText('Manage columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Priority' }))

    expect(onToggleVisibility).toHaveBeenCalledWith(expect.objectContaining({ priority: true }))
  })

  it('reorders columns via drag and drop, moving the dragged column to the target position', () => {
    const onReorder = vi.fn()
    render(
      <ColumnManager
        columnOrder={DEFAULT_COLUMN_ORDER}
        columnVisibility={{}}
        onReorder={onReorder}
        onToggleVisibility={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Manage columns'))

    // Drag "Type" (index 0) onto "Priority" (index 3) — Type should land
    // immediately before Priority in the resulting order.
    fireEvent.dragStart(screen.getByRole('listitem', { name: 'Type' }))
    fireEvent.dragOver(screen.getByRole('listitem', { name: 'Priority' }))
    fireEvent.drop(screen.getByRole('listitem', { name: 'Priority' }))

    expect(onReorder).toHaveBeenCalledWith(['assignee', 'next_action', 'type', 'priority', 'status', 'eta', 'notes_preview', 'last_updated'])
  })

  it('does nothing when a column is dropped on itself', () => {
    const onReorder = vi.fn()
    render(
      <ColumnManager
        columnOrder={DEFAULT_COLUMN_ORDER}
        columnVisibility={{}}
        onReorder={onReorder}
        onToggleVisibility={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Manage columns'))
    fireEvent.dragStart(screen.getByRole('listitem', { name: 'Type' }))
    fireEvent.drop(screen.getByRole('listitem', { name: 'Type' }))

    expect(onReorder).not.toHaveBeenCalled()
  })
})
