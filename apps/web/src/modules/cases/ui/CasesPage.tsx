import { RiAddLine, RiArrowLeftLine, RiErrorWarningLine } from '@remixicon/react'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { NativeSelect, NativeSelectOption } from '#components/ui/native-select'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

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

export type CaseSelectionNavigationMode = 'push' | 'replace'

export function CasesPage({
  onSelectedIdChange = ignoreSelectionChange,
  requestedId = null,
}: {
  onSelectedIdChange?(caseId: string | null, navigationMode: CaseSelectionNavigationMode): void
  requestedId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CaseStatusFilter>('all')
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
    mutationFn: transitionCaseItem,
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
                        <Badge variant={item.status === 'open' ? 'default' : 'secondary'}>
                          {item.status === 'open' ? 'Otwarta' : 'Zamknięta'}
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
                onTransition={() => transitionMutation.mutate(selected)}
                onUpdate={(input) => updateMutation.mutateAsync({ current: selected, input })}
              />
            ) : requestedId && requestedCase.isError ? (
              <ErrorNotice error={requestedCase.error} retry={() => requestedCase.refetch()} />
            ) : requestedId || selectedId ? (
              <LoadingStatus className="min-h-[390px]" label="Ładowanie sprawy…" />
            ) : cases.isSuccess && status === 'all' && items.length === 0 ? (
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
  onTransition(): void
  onUpdate(input: CaseFormValue): Promise<unknown>
  transitionBusy: boolean
  transitionError: Error | null
  updateBusy: boolean
  updateError: Error | null
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <article aria-labelledby="selected-case-title">
      <div className="mb-7 flex flex-col items-start justify-between gap-5 min-[721px]:flex-row">
        <Heading
          ref={headingRef}
          className="font-heading text-2xl font-semibold tracking-tight"
          id="selected-case-title"
          tabIndex={-1}
        >
          {caseItem.title}
        </Heading>
        <Button isDisabled={transitionBusy} onPress={onTransition} type="button" variant="outline">
          {transitionBusy ? (
            <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
          ) : null}
          {transitionBusy
            ? 'Zapisywanie…'
            : caseItem.status === 'open'
              ? 'Zamknij sprawę'
              : 'Otwórz ponownie'}
        </Button>
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
