import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type CaseItem,
  type CaseListPage,
  type CaseStatusFilter,
  caseQueryKeys,
  createCaseItem,
  fetchCase,
  fetchCases,
  isCaseVersionConflict,
  transitionCaseItem,
  updateCaseItem,
} from '../cases.api'

const LAST_VIEWED_CASE_KEY = 'yetano:last-viewed-case-id'
const DESKTOP_VIEW_QUERY = '(min-width: 721px)'

function ignoreSelectionChange() {}

export function CasesPage({
  onSelectedIdChange = ignoreSelectionChange,
  requestedId = null,
}: {
  onSelectedIdChange?(caseId: string | null): void
  requestedId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CaseStatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const lastViewedIdRef = useRef(readLastViewedCaseId())
  const isDesktop = useDesktopViewport()
  const cases = useInfiniteQuery<
    CaseListPage,
    Error,
    InfiniteData<CaseListPage>,
    readonly ['cases', 'list', CaseStatusFilter],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchCases({ cursor: pageParam, status }),
    queryKey: caseQueryKeys.list(status),
  })
  const items = useMemo(() => cases.data?.pages.flatMap((page) => page.items) ?? [], [cases.data])
  const requestedFromList = requestedId
    ? (items.find((item) => item.id === requestedId) ?? null)
    : null
  const requestedCase = useQuery({
    enabled: Boolean(requestedId && !requestedFromList),
    queryFn: () => fetchCase(requestedId as string),
    queryKey: caseQueryKeys.detail(requestedId ?? ''),
    retry: false,
  })
  const selectCase = useCallback(
    (caseId: string | null) => {
      if (selectedIdRef.current === caseId) return
      selectedIdRef.current = caseId
      setSelectedId(caseId)
      if (caseId) {
        lastViewedIdRef.current = caseId
        storeLastViewedCaseId(caseId)
      }
      onSelectedIdChange(caseId)
    },
    [onSelectedIdChange],
  )
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createCaseItem,
    onSuccess: async (created) => {
      selectCase(created.id)
      await refresh()
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ current, input }: { current: CaseItem; input: CaseFormValue }) =>
      updateCaseItem(current, input),
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: refresh,
  })

  useEffect(() => {
    if (requestedId) {
      if (requestedFromList || requestedCase.data?.id === requestedId) {
        selectCase(requestedId)
        return
      }
      if (requestedCase.isPending) return
    }

    if (!isDesktop || !cases.isSuccess) return

    const lastViewed = items.find((item) => item.id === lastViewedIdRef.current)
    selectCase(lastViewed?.id ?? items[0]?.id ?? null)
  }, [
    cases.isSuccess,
    isDesktop,
    items,
    requestedCase.data,
    requestedCase.isPending,
    requestedFromList,
    requestedId,
    selectCase,
  ])

  const selected =
    items.find((item) => item.id === selectedId) ??
    (requestedCase.data?.id === selectedId ? requestedCase.data : null)
  const transitionMutation = useMutation({
    mutationFn: transitionCaseItem,
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: refresh,
  })

  return (
    <main className="cases-page">
      <section className="case-workspace" aria-labelledby="case-list-title">
        <div className="case-list-panel">
          <CaseCreateForm
            busy={createMutation.isPending}
            error={createMutation.error}
            onSubmit={(input) => createMutation.mutateAsync(input)}
          />
          <div className="case-list-toolbar">
            <div>
              <h1 id="case-list-title">Sprawy</h1>
            </div>
            <select
              aria-label="Status"
              className="case-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CaseStatusFilter)
                selectCase(null)
              }}
            >
              <option value="all">Wszystkie</option>
              <option value="open">Otwarte</option>
              <option value="closed">Zamknięte</option>
            </select>
          </div>

          {cases.isPending ? <p role="status">Ładowanie spraw…</p> : null}
          {cases.isError ? <ErrorNotice error={cases.error} retry={() => cases.refetch()} /> : null}
          {cases.isSuccess && items.length === 0 ? (
            <div className="empty-state">
              <strong>Brak spraw w tym widoku.</strong>
              <span>Utwórz pierwszą sprawę albo zmień filtr statusu.</span>
            </div>
          ) : null}
          {items.length > 0 ? (
            <ul className="case-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={selectedId === item.id ? 'case-row case-row--selected' : 'case-row'}
                    onClick={() => selectCase(item.id)}
                    type="button"
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>Aktualizacja {formatDate(item.updatedAt)}</small>
                    </span>
                    <span className={`case-status case-status--${item.status}`}>
                      {item.status === 'open' ? 'Otwarta' : 'Zamknięta'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {cases.hasNextPage ? (
            <button
              className="secondary-button load-more"
              disabled={cases.isFetchingNextPage}
              onClick={() => cases.fetchNextPage()}
              type="button"
            >
              {cases.isFetchingNextPage ? 'Ładowanie…' : 'Pokaż kolejne'}
            </button>
          ) : null}
        </div>

        <div className="case-detail-panel">
          {selected ? (
            <CaseDetail
              caseItem={selected}
              transitionBusy={transitionMutation.isPending}
              transitionError={transitionMutation.error}
              updateBusy={updateMutation.isPending}
              updateError={updateMutation.error}
              onTransition={() => transitionMutation.mutate(selected)}
              onUpdate={(input) => updateMutation.mutateAsync({ current: selected, input })}
            />
          ) : cases.isSuccess && status === 'all' && items.length === 0 ? (
            <div className="empty-state case-detail-empty">
              <strong>Dodaj pierwszą sprawę.</strong>
              <span>Wpisz jej tytuł po lewej stronie.</span>
            </div>
          ) : cases.isSuccess && items.length === 0 ? (
            <div className="empty-state case-detail-empty">
              <strong>Brak spraw w tym widoku.</strong>
              <span>Zmień filtr statusu, aby zobaczyć pozostałe sprawy.</span>
            </div>
          ) : !isDesktop ? (
            <div className="empty-state case-detail-empty">
              <strong>Wybierz sprawę z listy.</strong>
            </div>
          ) : (
            <div className="case-detail-loading" role="status">
              Ładowanie sprawy…
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function CaseDetail({
  caseItem,
  onTransition,
  onUpdate,
  transitionBusy,
  transitionError,
  updateBusy,
  updateError,
}: {
  caseItem: CaseItem
  onTransition(): void
  onUpdate(input: CaseFormValue): Promise<unknown>
  transitionBusy: boolean
  transitionError: Error | null
  updateBusy: boolean
  updateError: Error | null
}) {
  return (
    <article aria-labelledby="selected-case-title">
      <div className="case-detail-heading">
        <div>
          <h2 id="selected-case-title">{caseItem.title}</h2>
        </div>
        <button
          className="secondary-button"
          disabled={transitionBusy}
          onClick={onTransition}
          type="button"
        >
          {transitionBusy
            ? 'Zapisywanie…'
            : caseItem.status === 'open'
              ? 'Zamknij sprawę'
              : 'Otwórz ponownie'}
        </button>
      </div>
      {transitionError ? <ErrorNotice error={transitionError} /> : null}
      <CaseForm
        key={`${caseItem.id}:${caseItem.version}`}
        busy={updateBusy}
        error={updateError}
        initialValue={caseItem}
        onSubmit={onUpdate}
        submitLabel="Zapisz zmiany"
      />
    </article>
  )
}

interface CaseFormValue {
  customerId: string | null
  description: string | null
  title: string
}

function CaseCreateForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean
  error: Error | null
  onSubmit(value: CaseFormValue): Promise<unknown>
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await onSubmit({
        customerId: null,
        description: null,
        title: String(data.get('title') ?? '').trim(),
      })
      form.reset()
    } catch {
      // The mutation exposes the error in the visible notice below.
    }
  }

  return (
    <form
      aria-label="Nowa sprawa"
      className="case-create-form"
      onSubmit={(event) => void submit(event)}
    >
      <input aria-label="Tytuł" maxLength={200} name="title" placeholder="Nowa sprawa" required />
      <button
        aria-label="Utwórz sprawę"
        className="primary-button case-create-button"
        disabled={busy}
        type="submit"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>
      {error ? <ErrorNotice error={error} /> : null}
    </form>
  )
}

function CaseForm({
  busy,
  error,
  initialValue,
  onSubmit,
  submitLabel,
}: {
  busy: boolean
  error: Error | null
  initialValue: CaseFormValue
  onSubmit(value: CaseFormValue): Promise<unknown>
  submitLabel: string
}) {
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(false)
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await onSubmit({
        customerId: initialValue.customerId,
        description: optionalText(data.get('description')),
        title: String(data.get('title') ?? '').trim(),
      })
      setSubmitted(true)
    } catch {
      // The mutation exposes the error in the visible notice below.
    }
  }

  return (
    <form className="case-form" onSubmit={(event) => void submit(event)}>
      <label className="field field--wide">
        <span>Tytuł</span>
        <input defaultValue={initialValue.title} maxLength={200} name="title" required />
      </label>
      <label className="field field--wide">
        <span>Opis (opcjonalnie)</span>
        <textarea
          defaultValue={initialValue.description ?? ''}
          maxLength={10_000}
          name="description"
        />
      </label>
      <div className="case-form-actions">
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Zapisywanie…' : submitLabel}
        </button>
        {submitted && !error ? <span role="status">Zapisano.</span> : null}
      </div>
      {error ? <ErrorNotice error={error} /> : null}
    </form>
  )
}

function ErrorNotice({ error, retry }: { error: unknown; retry?: () => unknown }) {
  return (
    <div className="error-notice" role="alert">
      <span>{readError(error)}</span>
      {retry ? (
        <button onClick={() => retry()} type="button">
          Spróbuj ponownie
        </button>
      ) : null}
    </div>
  )
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function readError(error: unknown) {
  if (isCaseVersionConflict(error)) {
    return 'Sprawa została zmieniona w innym miejscu. Sprawdź odświeżone dane i spróbuj ponownie.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Nie udało się wykonać operacji. Odśwież dane i spróbuj ponownie.'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function readLastViewedCaseId() {
  try {
    return window.localStorage.getItem(LAST_VIEWED_CASE_KEY)
  } catch {
    return null
  }
}

function storeLastViewedCaseId(caseId: string) {
  try {
    window.localStorage.setItem(LAST_VIEWED_CASE_KEY, caseId)
  } catch {
    // Selection still works when storage is unavailable.
  }
}

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window.matchMedia !== 'function') return true
    return window.matchMedia(DESKTOP_VIEW_QUERY).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(DESKTOP_VIEW_QUERY)
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}
