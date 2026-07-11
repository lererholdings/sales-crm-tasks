import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  user: { id: 'u2', display_name: 'Sara' },
  action: 'updated',
  changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
  timestamp: '2026-06-15T10:00:00Z',
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
    mockFetchByUrl({ '/api/audit-log': [ENTRY], '/api/users': [] })

    render(<AuditLogPanel />)

    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
    expect(screen.getByText('updated')).toBeTruthy()
    expect(screen.getByText(/task1abc/)).toBeTruthy()
    expect(screen.getByText(/status/)).toBeTruthy()
    expect(screen.getByText(/backlog/)).toBeTruthy()
    expect(screen.getByText(/in_progress/)).toBeTruthy()
  })

  it('shows the empty state when no entries match', async () => {
    mockFetchByUrl({ '/api/audit-log': [], '/api/users': [] })

    render(<AuditLogPanel />)

    await waitFor(() => expect(screen.getByText('No audit events match these filters.')).toBeTruthy())
  })

  it('refetches with the action filter and resets offset', async () => {
    mockFetchByUrl({ '/api/audit-log': [ENTRY], '/api/users': [] })

    render(<AuditLogPanel />)
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
    const fullPage = Array.from({ length: 50 }, (_, i) => ({ ...ENTRY, id: `log${i}` }))
    mockFetchByUrl({ '/api/audit-log': fullPage, '/api/users': [] })

    render(<AuditLogPanel />)
    await waitFor(() => expect(screen.getByText('Page 1')).toBeTruthy())

    fireEvent.click(screen.getByText(/Next/))

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => url.includes('offset=50'))
      expect(call).toBeDefined()
    })
    await waitFor(() => expect(screen.getByText('Page 2')).toBeTruthy())
  })
})
