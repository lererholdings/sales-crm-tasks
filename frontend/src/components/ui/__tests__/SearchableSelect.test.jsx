import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchableSelect from '../SearchableSelect.jsx'

function mockTriggerRect(rect) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.bottom - rect.top,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.left + rect.width,
    toJSON: () => {},
  })
}

const OPTIONS = [
  { value: 'a1', label: 'Acme Corp' },
  { value: 'a2', label: 'BetaCo' },
  { value: 'a3', label: 'Old Co', archived: true },
]

describe('SearchableSelect', () => {
  it('shows the selected option label, or the placeholder when nothing is selected', () => {
    render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} placeholder="No account" />)
    expect(screen.getByText('No account')).toBeTruthy()
  })

  it('opens the option list on click and calls onChange when an option is picked', () => {
    const onChange = vi.fn()
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('BetaCo'))

    expect(onChange).toHaveBeenCalledWith('a2')
  })

  it('renders archived options with an "(archived)" suffix', () => {
    render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('(archived)')).toBeTruthy()
  })

  it('filters options as the user types', () => {
    render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Type to filter…'), { target: { value: 'Beta' } })

    expect(screen.getByText('BetaCo')).toBeTruthy()
    expect(screen.queryByText('Acme Corp')).toBeFalsy()
  })

  // Regression test: the dropdown used to be a plain absolutely-positioned
  // child, which still contributes to a scrollable ancestor's scrollHeight
  // — inside NewTaskModal (overflow-y-auto), that silently grew the modal
  // and forced a scroll instead of floating on top of it. Rendering via a
  // portal into document.body means it's never a DOM descendant of whatever
  // scrollable container the select lives inside.
  it('renders the open dropdown outside its own container (portalled to document.body)', () => {
    const { container } = render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button'))

    const dropdownInput = screen.getByPlaceholderText('Type to filter…')
    expect(container.contains(dropdownInput)).toBe(false)
    expect(document.body.contains(dropdownInput)).toBe(true)
  })

  describe('smart placement', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('opens downward when there is enough room below the trigger', () => {
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
      mockTriggerRect({ top: 100, bottom: 130, left: 10, width: 200 })

      render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />)
      fireEvent.click(screen.getByRole('button'))

      const dropdown = screen.getByPlaceholderText('Type to filter…').parentElement
      expect(dropdown.style.top).not.toBe('')
      expect(dropdown.style.bottom).toBe('')
    })

    it('opens upward when there is not enough room below the trigger', () => {
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
      mockTriggerRect({ top: 350, bottom: 380, left: 10, width: 200 })

      render(<SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />)
      fireEvent.click(screen.getByRole('button'))

      const dropdown = screen.getByPlaceholderText('Type to filter…').parentElement
      expect(dropdown.style.bottom).not.toBe('')
      expect(dropdown.style.top).toBe('')
    })
  })

  it('closes the dropdown when clicking outside', () => {
    render(
      <div>
        <SearchableSelect options={OPTIONS} value="" onChange={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select…' }))
    expect(screen.getByPlaceholderText('Type to filter…')).toBeTruthy()

    fireEvent.click(screen.getByText('Outside'))
    expect(screen.queryByPlaceholderText('Type to filter…')).toBeFalsy()
  })
})
