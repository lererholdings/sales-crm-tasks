import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ShowDeletedToggle from '../ShowDeletedToggle.jsx'

describe('ShowDeletedToggle', () => {
  it('calls onToggle(true) when clicked while inactive', () => {
    const onToggle = vi.fn()
    render(<ShowDeletedToggle active={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByText('Show deleted'))

    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('calls onToggle(false) when clicked while active', () => {
    const onToggle = vi.fn()
    render(<ShowDeletedToggle active onToggle={onToggle} />)

    fireEvent.click(screen.getByText('Show deleted'))

    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('reflects active state via aria-pressed', () => {
    const { rerender } = render(<ShowDeletedToggle active={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')

    rerender(<ShowDeletedToggle active onToggle={vi.fn()} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })
})
