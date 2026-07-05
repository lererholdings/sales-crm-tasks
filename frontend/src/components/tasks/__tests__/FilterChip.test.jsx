import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FilterChip from '../FilterChip.jsx'

const OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'done', label: 'Done' },
]

describe('FilterChip — select mode', () => {
  it('shows the label when nothing is selected', () => {
    render(<FilterChip label="Status" options={OPTIONS} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByText('Status')).toBeTruthy()
  })

  it('opens the option list and calls onChange when an option is picked', () => {
    const onChange = vi.fn()
    render(<FilterChip label="Status" options={OPTIONS} value={undefined} onChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))
    fireEvent.click(screen.getByText('Done'))

    expect(onChange).toHaveBeenCalledWith('done')
  })

  it('shows the selected option label as the chip label once chosen', () => {
    render(<FilterChip label="Status" options={OPTIONS} value="done" onChange={vi.fn()} />)
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('clears the filter via the Clear entry', () => {
    const onChange = vi.fn()
    render(<FilterChip label="Status" options={OPTIONS} value="done" onChange={onChange} />)

    fireEvent.click(screen.getByText('Done'))
    fireEvent.click(screen.getByText('Clear'))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('closes the dropdown when clicking outside', () => {
    render(
      <div>
        <FilterChip label="Status" options={OPTIONS} value={undefined} onChange={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    )

    fireEvent.click(screen.getByText('Status'))
    expect(screen.getByText('Backlog')).toBeTruthy()

    fireEvent.click(screen.getByText('Outside'))
    expect(screen.queryByText('Backlog')).toBeFalsy()
  })
})

describe('FilterChip — text mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onChange with the trimmed value after the debounce delay', () => {
    const onChange = vi.fn()
    render(<FilterChip label="Partner" mode="text" value={undefined} onChange={onChange} />)

    fireEvent.click(screen.getByText('Partner'))
    fireEvent.change(screen.getByPlaceholderText('Filter by partner…'), { target: { value: '  PartnerX ' } })

    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)

    expect(onChange).toHaveBeenCalledWith('PartnerX')
  })

  it('clears the filter via the clear button', () => {
    const onChange = vi.fn()
    render(<FilterChip label="Partner" mode="text" value="PartnerX" onChange={onChange} />)

    fireEvent.click(screen.getByText('PartnerX'))
    fireEvent.click(screen.getByLabelText('Clear Partner filter'))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
