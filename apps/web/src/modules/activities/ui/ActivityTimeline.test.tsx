// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createActivityNote, listCaseActivities } from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ActivityTimeline } from './ActivityTimeline'

vi.mock('@yetano/api-client', () => ({
  createActivityNote: vi.fn(),
  listCaseActivities: vi.fn(),
}))

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928'

describe('ActivityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listCaseActivities).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })

  it('handles the loading state deliberately', () => {
    vi.mocked(listCaseActivities).mockReturnValue(new Promise(() => undefined) as never)
    renderTimeline()

    expect(screen.getByRole('status')).toHaveTextContent('Ładowanie aktywności…')
  })

  it('handles the empty state deliberately', async () => {
    renderTimeline()

    expect(await screen.findByText('Brak aktywności.')).toBeVisible()
    expect(screen.getByPlaceholderText('Napisz notatkę o tym, co się wydarzyło…')).toBeVisible()
  })

  it('disables note mutations while another case mutation is pending', () => {
    renderTimeline({ disabled: true })

    expect(screen.getByLabelText('Treść notatki')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dodaj notatkę' })).toBeDisabled()
  })

  it('renders system entries and paginates older activities', async () => {
    vi.mocked(listCaseActivities)
      .mockResolvedValueOnce(
        apiResult({
          items: [statusActivity],
          nextCursor: 'older-cursor',
        }),
      )
      .mockResolvedValueOnce(apiResult({ items: [createdActivity], nextCursor: null }))
    const user = userEvent.setup()
    renderTimeline()

    const timeline = await screen.findByRole('region', { name: 'Aktywność' })
    expect(await within(timeline).findByText('Odpowiedź klienta')).toBeVisible()
    expect(timeline).toHaveTextContent(
      'Użytkownik zmienił status na Czekamy i dodał: „Odpowiedź klienta”',
    )
    expect(within(timeline).queryByText('development-user')).not.toBeInTheDocument()

    await user.click(within(timeline).getByRole('button', { name: 'Pokaż starsze' }))
    await waitFor(() => expect(timeline).toHaveTextContent('System utworzył sprawę.'))
    expect(listCaseActivities).toHaveBeenLastCalledWith({
      path: { caseId },
      query: { cursor: 'older-cursor', limit: 25 },
      throwOnError: true,
    })
  })

  it('shows list errors and retries the request', async () => {
    vi.mocked(listCaseActivities)
      .mockRejectedValueOnce(new Error('Timeline unavailable'))
      .mockResolvedValueOnce(apiResult({ items: [], nextCursor: null }))
    const user = userEvent.setup()
    renderTimeline()

    expect(await screen.findByText('Timeline unavailable')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

    expect(await screen.findByText('Brak aktywności.')).toBeVisible()
    expect(listCaseActivities).toHaveBeenCalledTimes(2)
  })

  it('retains content and the client id when retrying a failed note', async () => {
    const activityId = '75bb9ef0-b103-4df7-89ce-efcbd2f79728'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(activityId)
    vi.mocked(createActivityNote)
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(apiResult(noteActivity))
    const user = userEvent.setup()
    renderTimeline()
    await screen.findByText('Brak aktywności.')

    const input = screen.getByLabelText('Treść notatki')
    await user.type(input, '  Oddzwonić jutro  ')
    await user.click(screen.getByRole('button', { name: 'Dodaj notatkę' }))

    expect(await screen.findByText('Temporary failure')).toBeVisible()
    expect(input).toHaveValue('  Oddzwonić jutro  ')
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

    await waitFor(() => expect(input).toHaveValue(''))
    expect(createActivityNote).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(createActivityNote).mock.calls) {
      expect(call[0]).toMatchObject({
        body: { activityId, content: 'Oddzwonić jutro' },
        path: { caseId },
      })
    }
  })
})

function renderTimeline({ disabled = false }: { disabled?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityTimeline caseId={caseId} disabled={disabled} />
    </QueryClientProvider>,
  )
}

function apiResult<Data>(data: Data) {
  return {
    data,
    error: undefined,
    request: new Request('http://localhost/api/v1/activities'),
    response: new Response(),
  }
}

const statusActivity = {
  actorId: 'development-user',
  actorType: 'user' as const,
  caseId,
  caseVersion: 2,
  fromStatus: 'working' as const,
  id: '1ddb62bc-cc28-442f-a324-0a8c0a4b48dd',
  note: 'Odpowiedź klienta',
  occurredAt: '2026-08-19T11:00:00.000Z',
  toStatus: 'waiting' as const,
  type: 'case_status_changed' as const,
}

const createdActivity = {
  actorId: 'case-service',
  actorType: 'system' as const,
  caseId,
  caseVersion: 1,
  id: '721317b8-e4e8-46b9-9ed8-1c34ad7448aa',
  occurredAt: '2026-08-19T10:30:00.000Z',
  type: 'case_created' as const,
}

const noteActivity = {
  actorId: 'development-user',
  actorType: 'user' as const,
  caseId,
  content: 'Oddzwonić jutro',
  id: '75bb9ef0-b103-4df7-89ce-efcbd2f79728',
  occurredAt: '2026-08-19T12:00:00.000Z',
  type: 'note' as const,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
