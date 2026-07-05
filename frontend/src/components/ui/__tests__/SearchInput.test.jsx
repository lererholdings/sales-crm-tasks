import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SearchInput from '../SearchInput.jsx'

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call onChange immediately on every keystroke', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Search tasks, accounts, notes…'), { target: { value: 'pricing' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange with the trimmed value after the debounce delay', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Search tasks, accounts, notes…'), { target: { value: ' pricing ' } })
    vi.advanceTimersByTime(300)

    expect(onChange).toHaveBeenCalledWith('pricing')
  })

  it('calls onChange with null when cleared', () => {
    const onChange = vi.fn()
    render(<SearchInput value="pricing" onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Search tasks, accounts, notes…'), { target: { value: '' } })
    vi.advanceTimersByTime(300)

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('follows external value changes (e.g. filters reset elsewhere)', () => {
    const { rerender } = render(<SearchInput value="pricing" onChange={vi.fn()} />)
    rerender(<SearchInput value="" onChange={vi.fn()} />)

    expect(screen.getByPlaceholderText('Search tasks, accounts, notes…').value).toBe('')
  })
})
