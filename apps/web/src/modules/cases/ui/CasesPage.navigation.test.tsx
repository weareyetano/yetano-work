// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getCase, listCaseStatusHistory, listCases } from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CasesPage } from './CasesPage'
import {
  apiResult,
  caseItem,
  getViewSelect,
  mockDesktopViewport,
  renderCasesPage,
  secondCaseItem,
  selectView,
} from './CasesPage.test-harness'

vi.mock('@yetano/api-client', () => ({
  createCase: vi.fn(),
  getCase: vi.fn(),
  listCaseStatusHistory: vi.fn(),
  listCases: vi.fn(),
  transitionCase: vi.fn(),
  updateCase: vi.fn(),
}))

describe('CasesPage navigation and drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
    vi.mocked(listCaseStatusHistory).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })
  it('selects the case requested in the URL before the last viewed case', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', caseItem.id)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('loads a case requested in the URL when it is outside the visible list', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(getCase).mockResolvedValue(apiResult(secondCaseItem))

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
    expect(getCase).toHaveBeenCalledWith({
      path: { caseId: secondCaseItem.id },
      throwOnError: true,
    })
  })

  it('selects the last viewed visible case before the first case', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', secondCaseItem.id)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )

    renderCasesPage()

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('selects the first visible case when the last viewed case is unavailable', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', secondCaseItem.id)
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))

    renderCasesPage()

    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
  })

  it('selects a case from the keyboard and exposes the selected state', async () => {
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    const secondCase = await screen.findByRole('button', { name: /Second case/ })
    secondCase.focus()
    await user.keyboard(' ')

    expect(secondCase).toHaveFocus()
    expect(secondCase).toHaveAttribute('aria-pressed', 'true')
    expect(secondCase).toHaveClass('border-0', 'bg-muted', 'text-foreground')
    expect(secondCase).not.toHaveClass('border-border', 'bg-accent')
    expect(within(secondCase).getByText(/Aktualizacja/)).toHaveClass('text-foreground/70')
    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('requires confirmation before selecting another case with a dirty draft', async () => {
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    const title = await screen.findByDisplayValue('Invoice access')
    await user.clear(title)
    await user.type(title, 'Unsaved invoice title')
    const secondCase = screen.getByRole('button', { name: /Second case/ })
    await user.click(secondCase)

    const dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    expect(title).toHaveValue('Unsaved invoice title')
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(title).toHaveValue('Unsaved invoice title')

    await user.click(secondCase)
    await user.click(
      within(screen.getByRole('dialog', { name: 'Niezapisane zmiany' })).getByRole('button', {
        name: 'Odrzuć zmiany',
      }),
    )
    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('requires confirmation before changing the view with a dirty draft', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    const title = await screen.findByDisplayValue('Invoice access')
    await user.type(title, ' unsaved')
    await selectView(user, 'Odłożone')

    const dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(getViewSelect()).toHaveTextContent('Otwarte')
    expect(title).toHaveValue('Invoice access unsaved')

    await selectView(user, 'Odłożone')
    await user.click(
      within(screen.getByRole('dialog', { name: 'Niezapisane zmiany' })).getByRole('button', {
        name: 'Odrzuć zmiany',
      }),
    )
    await waitFor(() => expect(getViewSelect()).toHaveTextContent('Odłożone'))
  })

  it('keeps the desktop list position while resetting new details and filtered results', async () => {
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    const listPanel = await screen.findByRole('region', { name: 'Panel listy spraw' })
    const detailPanel = screen.getByRole('region', { name: 'Panel szczegółów sprawy' })
    const secondCase = await screen.findByRole('button', { name: /Second case/ })
    listPanel.scrollTop = 240
    detailPanel.scrollTop = 180

    await user.click(secondCase)

    expect(listPanel.scrollTop).toBe(240)
    expect(detailPanel.scrollTop).toBe(0)
    expect(secondCase).toHaveFocus()

    listPanel.scrollTop = 240
    await selectView(user, 'Odłożone')

    expect(listPanel.scrollTop).toBe(0)
  })

  it('opens one mobile detail view and restores the triggering case from the icon-only back button', async () => {
    mockDesktopViewport(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(320)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onSelectedIdChange })

    const listTitle = await screen.findByRole('heading', { level: 1, name: 'Sprawy' })
    const secondCase = await screen.findByRole('button', { name: /Second case/ })
    await user.click(secondCase)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(secondCaseItem.id, 'push')
    expect(listTitle).not.toBeVisible()
    const detailTitle = screen.getByDisplayValue('Second case')
    expect(detailTitle).toBeVisible()
    await waitFor(() => expect(detailTitle).toHaveFocus())

    const back = screen.getByRole('button', { name: 'Wróć do listy spraw' })
    expect(back.textContent).toBe('')
    await user.click(back)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(null, 'replace')
    expect(listTitle).toBeVisible()
    await waitFor(() => expect(secondCase).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 320 })
  })

  it('opens mobile creation in place and restores the add button from the back control', async () => {
    mockDesktopViewport(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(180)
    const onCreateModeChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onCreateModeChange })

    const listTitle = await screen.findByRole('heading', { level: 1, name: 'Sprawy' })
    const add = screen.getByRole('button', { name: 'Dodaj sprawę' })
    await user.click(add)

    expect(onCreateModeChange).toHaveBeenLastCalledWith(true, 'push')
    expect(listTitle).not.toBeVisible()
    expect(screen.getByRole('form', { name: 'Nowa sprawa' })).toBeVisible()
    expect(screen.getByLabelText('Tytuł')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Wróć do listy spraw' }))

    expect(onCreateModeChange).toHaveBeenLastCalledWith(false, 'replace')
    expect(listTitle).toBeVisible()
    await waitFor(() => expect(add).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 180 })
  })

  it('requires confirmation before leaving a dirty mobile creation draft', async () => {
    mockDesktopViewport(false)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const onCreateModeChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onCreateModeChange })

    await screen.findByText('Brak otwartych spraw.')
    await user.click(screen.getByRole('button', { name: 'Dodaj sprawę' }))
    const title = screen.getByLabelText('Tytuł')
    await user.type(title, 'Unsaved new case')
    await user.click(screen.getByRole('button', { name: 'Wróć do listy spraw' }))

    let dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    expect(title).toHaveValue('Unsaved new case')
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(title).toHaveValue('Unsaved new case')

    await user.click(screen.getByRole('button', { name: 'Wróć do listy spraw' }))
    dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zmiany' }))

    expect(onCreateModeChange).toHaveBeenLastCalledWith(false, 'replace')
    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
  })

  it('keeps mobile back navigation available when a direct case link fails to load', async () => {
    mockDesktopViewport(false)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(getCase).mockRejectedValue(new Error('Nie znaleziono sprawy.'))
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onSelectedIdChange, requestedId: secondCaseItem.id })

    expect(await screen.findByText('Nie znaleziono sprawy.')).toBeVisible()
    const back = screen.getByRole('button', { name: 'Wróć do listy spraw' })
    await waitFor(() => expect(back).toHaveFocus())
    await user.click(back)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(null, 'replace')
  })

  it('cancels creation and restores the previously selected case', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const onCreateModeChange = vi.fn()
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()
    renderCasesPage({ onCreateModeChange, onSelectedIdChange })

    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    onSelectedIdChange.mockClear()
    const add = screen.getByRole('button', { name: 'Dodaj sprawę' })
    await user.click(add)
    const createForm = screen.getByRole('form', { name: 'Nowa sprawa' })
    await user.type(within(createForm).getByLabelText('Tytuł'), 'Draft title')
    await user.click(within(createForm).getByRole('button', { name: 'Anuluj' }))

    let dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(within(createForm).getByLabelText('Tytuł')).toHaveValue('Draft title')

    await user.click(within(createForm).getByRole('button', { name: 'Anuluj' }))
    dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zmiany' }))

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(caseItem.id, 'replace')
    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Invoice access')).toBeVisible()
    await waitFor(() => expect(add).toHaveFocus())
  })

  it('requires confirmation before selecting a case from a dirty creation draft', async () => {
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    await screen.findByDisplayValue('Invoice access')
    await user.click(screen.getByRole('button', { name: 'Dodaj sprawę' }))
    const title = screen.getByLabelText('Tytuł')
    await user.type(title, 'Draft title')
    await user.click(screen.getByRole('button', { name: /Second case/ }))

    const dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    expect(title).toHaveValue('Draft title')
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zmiany' }))

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('guards browser back and reload for a dirty creation draft', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const onCreateModeChange = vi.fn()
    const user = userEvent.setup()
    const page = (createRequested: boolean) => (
      <QueryClientProvider client={client}>
        <CasesPage createRequested={createRequested} onCreateModeChange={onCreateModeChange} />
      </QueryClientProvider>
    )
    const rendered = render(page(true))

    const title = await screen.findByLabelText('Tytuł')
    await user.type(title, 'Draft from history')
    const beforeUnload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(beforeUnload)).toBe(false)

    rendered.rerender(page(false))
    let dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(onCreateModeChange).toHaveBeenLastCalledWith(true, 'replace')
    expect(title).toHaveValue('Draft from history')

    rendered.rerender(page(true))
    expect(screen.queryByRole('dialog', { name: 'Niezapisane zmiany' })).not.toBeInTheDocument()
    rendered.rerender(page(false))
    dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zmiany' }))

    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
