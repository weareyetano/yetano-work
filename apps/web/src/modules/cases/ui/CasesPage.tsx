import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import {
  type CaseItem,
  type CaseListPage,
  type CaseStatusFilter,
  caseQueryKeys,
  createCaseItem,
  fetchCases,
  isCaseVersionConflict,
  transitionCaseItem,
  updateCaseItem,
} from '../cases.api'

export function CasesPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CaseStatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const items = cases.data?.pages.flatMap((page) => page.items) ?? []
  const selected = items.find((item) => item.id === selectedId) ?? null
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createCaseItem,
    onSuccess: async (created) => {
      setSelectedId(created.id)
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
  const transitionMutation = useMutation({
    mutationFn: transitionCaseItem,
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: refresh,
  })

  return (
    <main className="cases-page">
      <header className="cases-heading">
        <div>
          <p className="eyebrow">Moduł Cases</p>
          <h1>Sprawy bez utraconego kontekstu.</h1>
          <p>Rejestruj sprawy, aktualizuj ich opis i zamykaj je z kontrolą równoczesnych zmian.</p>
        </div>
        <span className="quiet-badge">Zakres organizacji ustala serwer</span>
      </header>

      <section className="case-create" aria-labelledby="new-case-title">
        <h2 id="new-case-title">Nowa sprawa</h2>
        <CaseForm
          busy={createMutation.isPending}
          error={createMutation.error}
          onSubmit={(input) => createMutation.mutateAsync(input)}
          submitLabel="Utwórz sprawę"
        />
      </section>

      <section className="case-workspace" aria-labelledby="case-list-title">
        <div className="case-list-panel">
          <div className="case-list-toolbar">
            <div>
              <p className="eyebrow">Kolejka</p>
              <h2 id="case-list-title">Sprawy</h2>
            </div>
            <label>
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as CaseStatusFilter)
                  setSelectedId(null)
                }}
              >
                <option value="all">Wszystkie</option>
                <option value="open">Otwarte</option>
                <option value="closed">Zamknięte</option>
              </select>
            </label>
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
                    onClick={() => setSelectedId(item.id)}
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
          ) : (
            <div className="empty-state case-detail-empty">
              <strong>Wybierz sprawę.</strong>
              <span>Tutaj zobaczysz opis, wersję i dostępne działania.</span>
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
          <p className="eyebrow">Szczegóły · wersja {caseItem.version}</p>
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

function CaseForm({
  busy,
  error,
  initialValue,
  onSubmit,
  submitLabel,
}: {
  busy: boolean
  error: Error | null
  initialValue?: CaseFormValue
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
        customerId: optionalText(data.get('customerId')),
        description: optionalText(data.get('description')),
        title: String(data.get('title') ?? '').trim(),
      })
      setSubmitted(true)
      if (!initialValue) form.reset()
    } catch {
      // The mutation exposes the error in the visible notice below.
    }
  }

  return (
    <form className="case-form" onSubmit={(event) => void submit(event)}>
      <label className="field field--wide">
        <span>Tytuł</span>
        <input defaultValue={initialValue?.title} maxLength={200} name="title" required />
      </label>
      <label className="field">
        <span>Id klienta (opcjonalnie)</span>
        <input
          defaultValue={initialValue?.customerId ?? ''}
          name="customerId"
          pattern="[0-9a-fA-F-]{36}"
          placeholder="UUID"
        />
      </label>
      <label className="field field--wide">
        <span>Opis (opcjonalnie)</span>
        <textarea
          defaultValue={initialValue?.description ?? ''}
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
