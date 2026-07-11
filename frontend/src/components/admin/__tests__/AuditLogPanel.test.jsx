import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: AuditLogPanel } = await import('../AuditLogPanel.jsx')

const ENTRY = {
  id: 'log1',
  entity_type: 'task',
  entity_id: 'task1abcdef',
  entity_label: 'RFP response',
  entity_link: null,
  user: { id: 'u2', display_name: 'Sara' },
  action: 'updated',
  changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
  timestamp: '2026-06-15T10:00:00Z',
  task_id: null,
  account_id: null,
}

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url, opts) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        const body = typeof handler === 'function' ? handler(url, opts) : handler
        return Promise.resolve(jsonResponse(body))
      }
    }
    return Promise.resolve(jsonResponse([]))
  })
}

describe('AuditLogPanel', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('lists audit entries with formatted changed fields', async () => {
    mockFetchByUrl({ '/api/audit-log': { entries: [ENTRY], total: 1 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
    expect(screen.getByText('updated')).toBeTruthy()
    expect(screen.getByText('RFP response')).toBeTruthy()
    expect(screen.getByText(/status/)).toBeTruthy()
    expect(screen.getByText(/backlog/)).toBeTruthy()
    expect(screen.getByText(/in_progress/)).toBeTruthy()
    expect(screen.getByText('1 entry')).toBeTruthy()
  })

  it('links the entity label to its target when entity_link is present', async () => {
    mockFetchByUrl({
      '/api/audit-log': {
        entries: [{ ...ENTRY, entity_link: { type: 'task', id: 'task1abcdef' } }],
        total: 1,
      },
      '/api/users': [],
    })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    expect(screen.getByText('RFP response').closest('a').getAttribute('href')).toBe('/tasks?taskId=task1abcdef')
  })

  it('renders the entity label as plain text (no link) when entity_link is null', async () => {
    mockFetchByUrl({ '/api/audit-log': { entries: [ENTRY], total: 1 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    expect(screen.getByText('RFP response').closest('a')).toBeFalsy()
  })

  it('shows the empty state when no entries match', async () => {
    mockFetchByUrl({ '/api/audit-log': { entries: [], total: 0 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('No audit events match these filters.')).toBeTruthy())
    expect(screen.getByText('0 entries')).toBeTruthy()
  })

  it('refetches with the action filter and resets offset', async () => {
    mockFetchByUrl({ '/api/audit-log': { entries: [ENTRY], total: 1 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Action' }))
    fireEvent.click(screen.getByRole('button', { name: 'updated' }))

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => url.includes('action=updated'))
      expect(call).toBeDefined()
      expect(call[0]).toContain('offset=0')
    })
  })

  it('paginates via the Next button', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ ...ENTRY, id: `log${i}` }))
    mockFetchByUrl({ '/api/audit-log': { entries: fullPage, total: 250 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('250 entries')).toBeTruthy())

    fireEvent.click(screen.getByText(/Next/))

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => url.includes('offset=100'))
      expect(call).toBeDefined()
    })
  })

  it('jumps straight to the last page via the jump-to-last button', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ ...ENTRY, id: `log${i}` }))
    mockFetchByUrl({ '/api/audit-log': { entries: fullPage, total: 250 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('250 entries')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Jump to last page'))

    // 250 rows at 100/page = 3 pages, so the last page starts at offset 200.
    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => url.includes('offset=200'))
      expect(call).toBeDefined()
    })
  })

  it('jumps back to the first page via the jump-to-first button', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ ...ENTRY, id: `log${i}` }))
    mockFetchByUrl({ '/api/audit-log': { entries: fullPage, total: 250 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('250 entries')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Jump to last page'))
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url]) => url.includes('offset=200'))).toBe(true)
    })

    fireEvent.click(screen.getByLabelText('Jump to first page'))
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url]) => url.includes('offset=0'))).toBe(true)
    })
  })

  it('jumps to an arbitrary page via the page dropdown', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ ...ENTRY, id: `log${i}` }))
    mockFetchByUrl({ '/api/audit-log': { entries: fullPage, total: 250 }, '/api/users': [] })

    render(
      <MemoryRouter>
        <AuditLogPanel />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('250 entries')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Jump to page'), { target: { value: '2' } })

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => url.includes('offset=100'))
      expect(call).toBeDefined()
    })
  })
})
