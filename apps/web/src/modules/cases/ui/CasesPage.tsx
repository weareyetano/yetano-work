import { RiAddLine, RiArrowLeftLine, RiErrorWarningLine, RiMore2Line } from '@remixicon/react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type FormEvent,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Alert, AlertAction, AlertDescription } from '#components/ui/alert'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { NativeSelect, NativeSelectOption } from '#components/ui/native-select'
import { Separator } from '#components/ui/separator'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

import {
  type CaseItem,
  type CaseListPage,
  type CaseStatusFilter,
  type CaseStatusHistoryPage,
  type CaseTransitionIntent,
  caseQueryKeys,
  createCaseItem,
  fetchCase,
  fetchCaseStatusHistory,
  fetchCases,
  isCaseVersionConflict,
  transitionCaseItem,
  updateCaseItem,
} from '../cases.api'

const LAST_VIEWED_CASE_KEY = 'yetano:last-viewed-case-id'
const DESKTOP_VIEW_QUERY = '(min-width: 721px)'

function ignoreSelectionChange() {}

export type CaseSelectionNavigationMode = 'push' | 'replace'

export function CasesPage({
  onSelectedIdChange = ignoreSelectionChange,
  requestedId = null,
}: {
  onSelectedIdChange?(caseId: string | null, navigationMode: CaseSelectionNavigationMode): void
  requestedId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CaseStatusFilter>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const previousRequestedIdRef = useRef(requestedId)
  const lastViewedIdRef = useRef(readLastViewedCaseId())
  const workspaceRef = useRef<HTMLElement>(null)
  const listTitleRef = useRef<HTMLHeadingElement>(null)
  const detailTitleRef = useRef<HTMLHeadingElement>(null)
  const mobileBackButtonRef = useRef<HTMLButtonElement>(null)
  const caseButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const listScrollPositionRef = useRef(0)
  const returnFocusCaseIdRef = useRef<string | null>(null)
  const pendingDetailFocusIdRef = useRef<string | null>(null)
  const wasMobileDetailOpenRef = useRef(false)
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
    (caseId: string | null, navigationMode: CaseSelectionNavigationMode = 'replace') => {
      if (selectedIdRef.current === caseId && (caseId !== null || requestedId === null)) return
      selectedIdRef.current = caseId
      setSelectedId(caseId)
      if (caseId) {
        lastViewedIdRef.current = caseId
        storeLastViewedCaseId(caseId)
      }
      onSelectedIdChange(caseId, navigationMode)
    },
    [onSelectedIdChange, requestedId],
  )
  const rememberMobileListPosition = useCallback(
    (caseId: string) => {
      if (isDesktop) return
      listScrollPositionRef.current = window.scrollY
      returnFocusCaseIdRef.current = caseId
    },
    [isDesktop],
  )
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createCaseItem,
    onSuccess: async (created) => {
      rememberMobileListPosition(created.id)
      selectCase(created.id, isDesktop ? 'replace' : 'push')
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

  useLayoutEffect(() => {
    const previousRequestedId = previousRequestedIdRef.current
    previousRequestedIdRef.current = requestedId
    if (isDesktop || !previousRequestedId || requestedId) return
    selectedIdRef.current = null
    setSelectedId(null)
  }, [isDesktop, requestedId])

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
  const mobileDetailOpen = !isDesktop && Boolean(selectedId || requestedId)
  const transitionMutation = useMutation({
    mutationFn: ({ current, input }: { current: CaseItem; input: CaseTransitionIntent }) =>
      transitionCaseItem(current, input),
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: refresh,
  })

  useEffect(() => {
    let restoreFrame: number | null = null
    let settledRestoreFrame: number | null = null

    if (isDesktop) {
      wasMobileDetailOpenRef.current = false
      return
    }

    const wasOpen = wasMobileDetailOpenRef.current
    if (mobileDetailOpen && !wasOpen) {
      pendingDetailFocusIdRef.current = selectedId ?? requestedId
      const workspace = workspaceRef.current
      if (workspace && typeof workspace.scrollIntoView === 'function') {
        workspace.scrollIntoView({ block: 'start' })
      }
    } else if (!mobileDetailOpen && wasOpen) {
      const returnTarget = returnFocusCaseIdRef.current
        ? caseButtonRefs.current.get(returnFocusCaseIdRef.current)
        : null
      const scrollPosition = listScrollPositionRef.current
      restoreFrame = window.requestAnimationFrame(() => {
        settledRestoreFrame = window.requestAnimationFrame(() => {
          ;(returnTarget ?? listTitleRef.current)?.focus({ preventScroll: true })
          window.scrollTo({ behavior: 'auto', top: scrollPosition })
        })
      })
      returnFocusCaseIdRef.current = null
      pendingDetailFocusIdRef.current = null
    }
    wasMobileDetailOpenRef.current = mobileDetailOpen

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
      if (settledRestoreFrame !== null) window.cancelAnimationFrame(settledRestoreFrame)
    }
  }, [isDesktop, mobileDetailOpen, requestedId, selectedId])

  useEffect(() => {
    if (!mobileDetailOpen || pendingDetailFocusIdRef.current === null) return
    if (selected?.id === pendingDetailFocusIdRef.current) {
      detailTitleRef.current?.focus({ preventScroll: true })
      pendingDetailFocusIdRef.current = null
      return
    }
    if (requestedCase.isError) {
      mobileBackButtonRef.current?.focus({ preventScroll: true })
      pendingDetailFocusIdRef.current = null
    }
  }, [mobileDetailOpen, requestedCase.isError, selected?.id])

  return (
    <main className="pt-2 pb-24">
      <section
        ref={workspaceRef}
        className="mt-2 grid grid-cols-1 gap-5 min-[721px]:grid-cols-[clamp(20rem,32vw,40rem)_minmax(0,1fr)]"
        aria-label="Sprawy"
      >
        <Card className="min-h-[460px] gap-0 py-0" hidden={mobileDetailOpen}>
          <CardContent className="flex flex-1 flex-col p-6">
            <CaseCreateForm
              busy={createMutation.isPending}
              error={createMutation.error}
              onSubmit={(input) => createMutation.mutateAsync(input)}
            />
            <div className="mb-5 flex items-start justify-between gap-5">
              <h1
                ref={listTitleRef}
                className="font-heading text-2xl font-semibold tracking-tight"
                id="case-list-title"
                tabIndex={-1}
              >
                Sprawy
              </h1>
              <NativeSelect
                aria-label="Status"
                className="shrink-0 [&_select]:h-10"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as CaseStatusFilter)
                  selectCase(null)
                }}
              >
                <NativeSelectOption value="all">Wszystkie</NativeSelectOption>
                <NativeSelectOption value="open">Otwarte</NativeSelectOption>
                <NativeSelectOption value="closed">Zamknięte</NativeSelectOption>
                <NativeSelectOption value="new">Nowe</NativeSelectOption>
                <NativeSelectOption value="working">Zajmujemy się</NativeSelectOption>
                <NativeSelectOption value="waiting">Oczekujące</NativeSelectOption>
                <NativeSelectOption value="resolved">Rozwiązane</NativeSelectOption>
                <NativeSelectOption value="canceled">Anulowane</NativeSelectOption>
              </NativeSelect>
            </div>

            {cases.isPending ? <LoadingStatus label="Ładowanie spraw…" /> : null}
            {cases.isError ? (
              <ErrorNotice error={cases.error} retry={() => cases.refetch()} />
            ) : null}
            {cases.isSuccess && items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Brak spraw w tym widoku.</EmptyTitle>
                  <EmptyDescription>
                    Utwórz pierwszą sprawę albo zmień filtr statusu.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {items.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label="Lista spraw">
                {items.map((item) => {
                  const selectedRow = selectedId === item.id
                  return (
                    <li key={item.id}>
                      <Button
                        ref={(button) => {
                          if (button) caseButtonRefs.current.set(item.id, button)
                          else caseButtonRefs.current.delete(item.id)
                        }}
                        aria-pressed={selectedRow}
                        className={cn(
                          'h-auto w-full justify-between gap-4 whitespace-normal border px-3.5 py-3.5 text-left',
                          selectedRow
                            ? 'border-border bg-accent text-accent-foreground'
                            : 'border-transparent bg-transparent',
                        )}
                        onPress={() => {
                          rememberMobileListPosition(item.id)
                          selectCase(item.id, isDesktop ? 'replace' : 'push')
                        }}
                        type="button"
                        variant="ghost"
                      >
                        <span className="grid min-w-0 gap-1">
                          <strong className="truncate">{item.title}</strong>
                          <small className="text-muted-foreground">
                            Aktualizacja {formatDate(item.updatedAt)}
                          </small>
                        </span>
                        <Badge variant={isOpenStatus(item.status) ? 'default' : 'secondary'}>
                          {statusLabel(item.status)}
                        </Badge>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {cases.hasNextPage ? (
              <Button
                className="mt-4 w-full"
                isDisabled={cases.isFetchingNextPage}
                onPress={() => cases.fetchNextPage()}
                type="button"
                variant="outline"
              >
                {cases.isFetchingNextPage ? (
                  <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
                ) : null}
                {cases.isFetchingNextPage ? 'Ładowanie…' : 'Pokaż kolejne'}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-h-[460px] gap-0 py-0" hidden={!isDesktop && !mobileDetailOpen}>
          <CardContent className="flex flex-1 flex-col p-6">
            {mobileDetailOpen ? (
              <div className="mb-4 min-[721px]:hidden">
                <Button
                  ref={mobileBackButtonRef}
                  aria-label="Wróć do listy spraw"
                  className="size-11"
                  onPress={() => selectCase(null, 'replace')}
                  size="icon-lg"
                  type="button"
                  variant="ghost"
                >
                  <RiArrowLeftLine aria-hidden="true" />
                </Button>
              </div>
            ) : null}
            {selected ? (
              <CaseDetail
                caseItem={selected}
                headingLevel={isDesktop ? 2 : 1}
                headingRef={detailTitleRef}
                transitionBusy={transitionMutation.isPending}
                transitionError={transitionMutation.error}
                updateBusy={updateMutation.isPending}
                updateError={updateMutation.error}
                onRetryTransition={() => {
                  if (transitionMutation.variables) {
                    transitionMutation.mutate(transitionMutation.variables)
                  }
                }}
                onTransition={(input) => transitionMutation.mutate({ current: selected, input })}
                onUpdate={(input) => updateMutation.mutateAsync({ current: selected, input })}
              />
            ) : requestedId && requestedCase.isError ? (
              <ErrorNotice error={requestedCase.error} retry={() => requestedCase.refetch()} />
            ) : requestedId || selectedId ? (
              <LoadingStatus className="min-h-[390px]" label="Ładowanie sprawy…" />
            ) : cases.isSuccess && (status === 'all' || status === 'open') && items.length === 0 ? (
              <CaseEmptyState
                description="Wpisz jej tytuł po lewej stronie."
                title="Dodaj pierwszą sprawę."
              />
            ) : cases.isSuccess && items.length === 0 ? (
              <CaseEmptyState
                description="Zmień filtr statusu, aby zobaczyć pozostałe sprawy."
                title="Brak spraw w tym widoku."
              />
            ) : !isDesktop ? (
              <CaseEmptyState title="Wybierz sprawę z listy." />
            ) : (
              <LoadingStatus className="min-h-[390px]" label="Ładowanie sprawy…" />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function CaseDetail({
  caseItem,
  headingLevel,
  headingRef,
  onRetryTransition,
  onTransition,
  onUpdate,
  transitionBusy,
  transitionError,
  updateBusy,
  updateError,
}: {
  caseItem: CaseItem
  headingLevel: 1 | 2
  headingRef: Ref<HTMLHeadingElement>
  onRetryTransition(): void
  onTransition(input: CaseTransitionIntent): void
  onUpdate(input: CaseFormValue): Promise<unknown>
  transitionBusy: boolean
  transitionError: Error | null
  updateBusy: boolean
  updateError: Error | null
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const [notedStatus, setNotedStatus] = useState<'canceled' | 'waiting' | null>(null)

  const transition = (toStatus: CaseTransitionIntent['toStatus'], note?: string) => {
    onTransition({
      ...(note ? { note } : {}),
      toStatus,
      transitionId: crypto.randomUUID(),
    } as CaseTransitionIntent)
  }

  return (
    <article aria-labelledby="selected-case-title">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 min-[721px]:flex-row">
        <div className="grid gap-2">
          <Heading
            ref={headingRef}
            className="font-heading text-2xl font-semibold tracking-tight"
            id="selected-case-title"
            tabIndex={-1}
          >
            {caseItem.title}
          </Heading>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isOpenStatus(caseItem.status) ? 'default' : 'secondary'}>
              {statusLabel(caseItem.status)}
            </Badge>
            {caseItem.status === 'waiting' && caseItem.statusNote ? (
              <span className="text-sm text-muted-foreground">{caseItem.statusNote}</span>
            ) : null}
          </div>
        </div>
        <CaseStatusActions
          busy={transitionBusy}
          caseItem={caseItem}
          onNotedTransition={setNotedStatus}
          onTransition={transition}
        />
      </div>
      {transitionError ? <ErrorNotice error={transitionError} retry={onRetryTransition} /> : null}
      <CaseForm
        key={`${caseItem.id}:${caseItem.version}`}
        busy={updateBusy}
        error={updateError}
        initialValue={caseItem}
        onSubmit={onUpdate}
        submitLabel="Zapisz zmiany"
      />
      <Separator className="my-7" />
      <CaseStatusHistory caseId={caseItem.id} />
      <StatusNoteDialog
        busy={transitionBusy}
        status={notedStatus}
        onClose={() => setNotedStatus(null)}
        onSubmit={(note) => {
          if (!notedStatus) return
          transition(notedStatus, note)
          setNotedStatus(null)
        }}
      />
    </article>
  )
}

function CaseStatusActions({
  busy,
  caseItem,
  onNotedTransition,
  onTransition,
}: {
  busy: boolean
  caseItem: CaseItem
  onNotedTransition(status: 'canceled' | 'waiting'): void
  onTransition(status: CaseTransitionIntent['toStatus']): void
}) {
  if (caseItem.status === 'resolved' || caseItem.status === 'canceled') {
    return (
      <Button
        isDisabled={busy}
        onPress={() => onTransition('working')}
        type="button"
        variant="outline"
      >
        {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
        {busy ? 'Zapisywanie…' : 'Otwórz ponownie'}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {caseItem.status === 'new' ? (
        <Button isDisabled={busy} onPress={() => onTransition('working')} type="button">
          Rozpocznij pracę
        </Button>
      ) : null}
      {caseItem.status === 'new' || caseItem.status === 'working' ? (
        <Button
          isDisabled={busy}
          onPress={() => onNotedTransition('waiting')}
          type="button"
          variant="outline"
        >
          Oczekuj
        </Button>
      ) : null}
      {caseItem.status === 'waiting' ? (
        <Button isDisabled={busy} onPress={() => onTransition('working')} type="button">
          Wznów pracę
        </Button>
      ) : null}
      <Button
        isDisabled={busy}
        onPress={() => onTransition('resolved')}
        type="button"
        variant="outline"
      >
        Rozwiąż
      </Button>
      <details className="relative">
        <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <RiMore2Line aria-hidden="true" />
          <span className="sr-only">Więcej działań</span>
        </summary>
        <div className="absolute right-0 z-10 mt-1 rounded-lg border bg-background p-1 shadow-lg">
          <Button
            isDisabled={busy}
            onPress={() => onNotedTransition('canceled')}
            size="sm"
            type="button"
            variant="destructive"
          >
            Anuluj
          </Button>
        </div>
      </details>
    </div>
  )
}

function StatusNoteDialog({
  busy,
  onClose,
  onSubmit,
  status,
}: {
  busy: boolean
  onClose(): void
  onSubmit(note: string): void
  status: 'canceled' | 'waiting' | null
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const note = String(new FormData(event.currentTarget).get('status-note') ?? '').trim()
    if (note) onSubmit(note)
  }

  return (
    <Dialog isDismissable isOpen={status !== null} onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={submit}>
        <DialogTitle>{status === 'waiting' ? 'Na co czekamy?' : 'Dlaczego anulujemy?'}</DialogTitle>
        <DialogDescription>
          Notatka będzie widoczna przy aktualnym statusie i w historii sprawy.
        </DialogDescription>
        <Field className="mt-4">
          <FieldLabel htmlFor="case-status-note">Notatka</FieldLabel>
          <Textarea
            autoFocus
            className="min-h-24 resize-y"
            id="case-status-note"
            maxLength={2_000}
            name="status-note"
            required
          />
        </Field>
        <DialogFooter>
          <Button isDisabled={busy} onPress={onClose} type="button" variant="outline">
            Wróć
          </Button>
          <Button
            isDisabled={busy}
            type="submit"
            variant={status === 'canceled' ? 'destructive' : 'default'}
          >
            {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
            {status === 'waiting' ? 'Ustaw oczekiwanie' : 'Anuluj sprawę'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function CaseStatusHistory({ caseId }: { caseId: string }) {
  const history = useInfiniteQuery<
    CaseStatusHistoryPage,
    Error,
    InfiniteData<CaseStatusHistoryPage>,
    readonly ['cases', 'history', string],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchCaseStatusHistory(caseId, pageParam),
    queryKey: caseQueryKeys.history(caseId),
  })
  const entries = history.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <section aria-labelledby="case-status-history-title">
      <h3 className="font-heading text-lg font-semibold" id="case-status-history-title">
        Historia statusu
      </h3>
      {history.isPending ? <LoadingStatus label="Ładowanie historii…" /> : null}
      {history.isError ? (
        <ErrorNotice error={history.error} retry={() => history.refetch()} />
      ) : null}
      {history.isSuccess && entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Brak wpisów historii.</p>
      ) : null}
      {entries.length > 0 ? (
        <ol className="mt-4 grid gap-4">
          {entries.map((entry) => (
            <li className="border-l-2 border-border pl-4" key={entry.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-sm">
                  {entry.type === 'created'
                    ? `Utworzono jako „${statusLabel(entry.toStatus)}”`
                    : `${statusLabel(entry.fromStatus ?? 'new')} → ${statusLabel(entry.toStatus)}`}
                </strong>
                <time className="text-xs text-muted-foreground" dateTime={entry.changedAt}>
                  {formatDate(entry.changedAt)}
                </time>
              </div>
              {entry.note ? (
                <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>
              ) : null}
              <small className="mt-1 block text-muted-foreground">
                {entry.source === 'migration'
                  ? 'Migracja systemowa'
                  : entry.actorType === 'system'
                    ? 'System'
                    : entry.actorId}
              </small>
            </li>
          ))}
        </ol>
      ) : null}
      {history.hasNextPage ? (
        <Button
          className="mt-4"
          isDisabled={history.isFetchingNextPage}
          onPress={() => history.fetchNextPage()}
          type="button"
          variant="outline"
        >
          {history.isFetchingNextPage ? 'Ładowanie…' : 'Pokaż starsze'}
        </Button>
      ) : null}
    </section>
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
      className="mb-6 grid grid-cols-[minmax(0,1fr)_44px] gap-2"
      onSubmit={(event) => void submit(event)}
    >
      <Input
        aria-label="Tytuł"
        className="h-11"
        maxLength={200}
        name="title"
        placeholder="Nowa sprawa"
        required
      />
      <Button
        aria-label="Utwórz sprawę"
        className="size-11"
        isDisabled={busy}
        size="icon-lg"
        type="submit"
      >
        {busy ? (
          <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
        ) : (
          <RiAddLine aria-hidden="true" />
        )}
      </Button>
      {error ? <ErrorNotice className="col-span-full my-0" error={error} /> : null}
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
    <form onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-[18px]">
        <Field>
          <FieldLabel htmlFor="case-title">Tytuł</FieldLabel>
          <Input
            defaultValue={initialValue.title}
            id="case-title"
            maxLength={200}
            name="title"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="case-description">Opis (opcjonalnie)</FieldLabel>
          <Textarea
            className="min-h-24 resize-y"
            defaultValue={initialValue.description ?? ''}
            id="case-description"
            maxLength={10_000}
            name="description"
          />
        </Field>
        <div className="flex min-h-10 items-center gap-3.5">
          <Button isDisabled={busy} type="submit">
            {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
            {busy ? 'Zapisywanie…' : submitLabel}
          </Button>
          {submitted && !error ? (
            <span className="text-sm font-medium text-muted-foreground" role="status">
              Zapisano.
            </span>
          ) : null}
        </div>
        {error ? <ErrorNotice className="my-0" error={error} /> : null}
      </FieldGroup>
    </form>
  )
}

function ErrorNotice({
  className,
  error,
  retry,
}: {
  className?: string
  error: unknown
  retry?: () => unknown
}) {
  return (
    <Alert className={cn('my-3.5', retry ? 'pr-36' : undefined, className)} variant="destructive">
      <RiErrorWarningLine aria-hidden="true" />
      <AlertDescription className="text-destructive">{readError(error)}</AlertDescription>
      {retry ? (
        <AlertAction>
          <Button onPress={() => retry()} size="sm" type="button" variant="outline">
            Spróbuj ponownie
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}

function CaseEmptyState({ description, title }: { description?: string; title: string }) {
  return (
    <Empty className="min-h-[390px]">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  )
}

function LoadingStatus({ className, label }: { className?: string; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground',
        className,
      )}
      role="status"
    >
      <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  )
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function isOpenStatus(status: CaseItem['status']) {
  return status === 'new' || status === 'working' || status === 'waiting'
}

function statusLabel(status: CaseItem['status']) {
  return {
    canceled: 'Anulowana',
    new: 'Nowa',
    resolved: 'Rozwiązana',
    waiting: 'Oczekuje',
    working: 'Zajmujemy się',
  }[status]
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
