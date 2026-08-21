import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiSearchLine,
} from '@remixicon/react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type FormEvent,
  type ReactNode,
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
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '#components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { useMediaQuery } from '#hooks/use-media-query'
import { cn } from '#lib/utils'

import {
  type CaseItem,
  type CaseListPage,
  type CaseListView,
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
const SEARCH_DEBOUNCE_MS = 300

function ignoreSelectionChange() {}
function ignoreCreateModeChange() {}

function useDebouncedSearch(value: string) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    if (!value) {
      setDebouncedValue('')
      return
    }
    const timeout = window.setTimeout(() => setDebouncedValue(value), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [value])

  return debouncedValue
}

export type CaseSelectionNavigationMode = 'push' | 'replace'

export function CasesPage({
  createRequested = false,
  onCreateModeChange = ignoreCreateModeChange,
  onSelectedIdChange = ignoreSelectionChange,
  requestedId = null,
}: {
  createRequested?: boolean
  onCreateModeChange?(open: boolean, navigationMode: CaseSelectionNavigationMode): void
  onSelectedIdChange?(caseId: string | null, navigationMode: CaseSelectionNavigationMode): void
  requestedId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<CaseListView>('new')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedSearch(search.trim())
  const [isCreating, setIsCreating] = useState(createRequested)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const previousRequestedIdRef = useRef(requestedId)
  const previousCreateRequestedRef = useRef(createRequested)
  const previousSelectedIdRef = useRef<string | null>(null)
  const lastViewedIdRef = useRef(readLastViewedCaseId())
  const workspaceRef = useRef<HTMLElement>(null)
  const listTitleRef = useRef<HTMLHeadingElement>(null)
  const detailTitleInputRef = useRef<HTMLInputElement>(null)
  const createTitleRef = useRef<HTMLInputElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const mobileBackButtonRef = useRef<HTMLButtonElement>(null)
  const caseButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const listScrollPositionRef = useRef(0)
  const returnFocusCaseIdRef = useRef<string | null>(null)
  const returnFocusToAddRef = useRef(false)
  const pendingDetailFocusIdRef = useRef<string | null>(null)
  const pendingCreateFocusRef = useRef(false)
  const pendingDesktopAddFocusRef = useRef(false)
  const wasMobileDetailOpenRef = useRef(false)
  const isDesktop = useMediaQuery(DESKTOP_VIEW_QUERY, true)
  const cases = useInfiniteQuery<
    CaseListPage,
    Error,
    InfiniteData<CaseListPage>,
    readonly ['cases', 'list', CaseListView, string],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchCases({ cursor: pageParam, search: debouncedSearch, view }),
    queryKey: caseQueryKeys.list(view, debouncedSearch),
  })
  const items = useMemo(() => cases.data?.pages.flatMap((page) => page.items) ?? [], [cases.data])
  const emptyState = caseListEmptyState(view, debouncedSearch)
  const requestedFromList = requestedId
    ? (items.find((item) => item.id === requestedId) ?? null)
    : null
  const requestedCase = useQuery({
    enabled: Boolean(!createRequested && requestedId && !requestedFromList),
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
      setView('new')
      setIsCreating(false)
      previousSelectedIdRef.current = null
      pendingDetailFocusIdRef.current = created.id
      selectCase(created.id, 'replace')
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

  useLayoutEffect(() => {
    const wasCreateRequested = previousCreateRequestedRef.current
    if (wasCreateRequested === createRequested) return
    previousCreateRequestedRef.current = createRequested

    if (createRequested) {
      if (selectedIdRef.current) {
        previousSelectedIdRef.current = selectedIdRef.current
      }
      selectedIdRef.current = null
      setSelectedId(null)
      setIsCreating(true)
      return
    }

    if (wasCreateRequested) setIsCreating(false)
  }, [createRequested])

  useEffect(() => {
    if (createRequested) return
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
    createRequested,
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
  const mobileDetailOpen = !isDesktop && Boolean(isCreating || selectedId || requestedId)
  const transitionMutation = useMutation({
    mutationFn: ({ current, input }: { current: CaseItem; input: CaseTransitionIntent }) =>
      transitionCaseItem(current, input),
    onError: async (error) => {
      if (isCaseVersionConflict(error)) await refresh()
    },
    onSuccess: async (change) => {
      setView(caseListViewForStatus(change.toStatus))
      await refresh()
    },
  })

  const openCreate = () => {
    createMutation.reset()
    previousSelectedIdRef.current = selectedIdRef.current
    selectedIdRef.current = null
    setSelectedId(null)
    setIsCreating(true)
    pendingCreateFocusRef.current = true
    if (!isDesktop) {
      listScrollPositionRef.current = window.scrollY
      returnFocusToAddRef.current = true
    }
    onCreateModeChange(true, 'push')
  }

  const cancelCreate = () => {
    const previousSelectedId =
      previousSelectedIdRef.current ??
      (isDesktop
        ? (items.find((item) => item.id === lastViewedIdRef.current)?.id ?? items[0]?.id ?? null)
        : null)
    previousSelectedIdRef.current = null
    setIsCreating(false)
    createMutation.reset()

    if (previousSelectedId) selectCase(previousSelectedId, 'replace')
    else onCreateModeChange(false, 'replace')

    if (isDesktop) pendingDesktopAddFocusRef.current = true
  }

  const openCase = (caseId: string) => {
    setIsCreating(false)
    previousSelectedIdRef.current = null
    createMutation.reset()
    rememberMobileListPosition(caseId)
    selectCase(caseId, isDesktop ? 'replace' : 'push')
  }

  useEffect(() => {
    let restoreFrame: number | null = null
    let settledRestoreFrame: number | null = null

    if (isDesktop) {
      wasMobileDetailOpenRef.current = false
      return
    }

    const wasOpen = wasMobileDetailOpenRef.current
    if (mobileDetailOpen && !wasOpen) {
      pendingDetailFocusIdRef.current = isCreating ? null : (selectedId ?? requestedId)
      const workspace = workspaceRef.current
      if (workspace && typeof workspace.scrollIntoView === 'function') {
        workspace.scrollIntoView({ block: 'start' })
      }
    } else if (!mobileDetailOpen && wasOpen) {
      const returnTarget = returnFocusToAddRef.current
        ? addButtonRef.current
        : returnFocusCaseIdRef.current
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
      returnFocusToAddRef.current = false
      pendingDetailFocusIdRef.current = null
    }
    wasMobileDetailOpenRef.current = mobileDetailOpen

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
      if (settledRestoreFrame !== null) window.cancelAnimationFrame(settledRestoreFrame)
    }
  }, [isCreating, isDesktop, mobileDetailOpen, requestedId, selectedId])

  useEffect(() => {
    if (!isCreating || !pendingCreateFocusRef.current) return
    createTitleRef.current?.focus({ preventScroll: true })
    pendingCreateFocusRef.current = false
  }, [isCreating])

  useEffect(() => {
    if (isCreating || !isDesktop || !pendingDesktopAddFocusRef.current) return
    addButtonRef.current?.focus({ preventScroll: true })
    pendingDesktopAddFocusRef.current = false
  }, [isCreating, isDesktop])

  useEffect(() => {
    if (!mobileDetailOpen || pendingDetailFocusIdRef.current === null) return
    if (selected?.id === pendingDetailFocusIdRef.current) {
      detailTitleInputRef.current?.focus({ preventScroll: true })
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
        className="mt-2 grid grid-cols-1 items-start gap-4 min-[721px]:grid-cols-[clamp(20rem,32vw,40rem)_minmax(0,1fr)]"
        aria-label="Sprawy"
      >
        <Card className="min-h-[460px] gap-0 py-0" hidden={mobileDetailOpen}>
          <CardContent className="flex flex-1 flex-col p-4">
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
              <h1 ref={listTitleRef} className="sr-only" id="case-list-title" tabIndex={-1}>
                Sprawy
              </h1>
              <InputGroup className="h-10 min-w-48 flex-1">
                <InputGroupInput
                  aria-label="Szukaj spraw"
                  maxLength={200}
                  placeholder="Szukaj spraw…"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <InputGroupAddon>
                  <RiSearchLine aria-hidden="true" />
                </InputGroupAddon>
                {search ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label="Wyczyść wyszukiwanie"
                      onPress={() => setSearch('')}
                      size="icon-xs"
                    >
                      <RiCloseLine aria-hidden="true" />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  aria-label="Widok spraw"
                  className="min-w-36"
                  selectedKey={view}
                  onSelectionChange={(key) => {
                    setView(key as CaseListView)
                    if (!isCreating) selectCase(null)
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="new">Nowe</SelectItem>
                    <SelectItem id="working">Pracujemy</SelectItem>
                    <SelectItem id="waiting">Czekamy</SelectItem>
                    <SelectItem id="all">Wszystkie</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  ref={addButtonRef}
                  aria-label="Dodaj sprawę"
                  className="size-10"
                  onPress={openCreate}
                  size="icon"
                  type="button"
                >
                  <RiAddLine aria-hidden="true" />
                </Button>
              </div>
            </div>

            {cases.isPending ? <LoadingStatus label="Ładowanie spraw…" /> : null}
            {cases.isError ? (
              <ErrorNotice error={cases.error} retry={() => cases.refetch()} />
            ) : null}
            {cases.isSuccess && items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{emptyState.title}</EmptyTitle>
                  <EmptyDescription>{emptyState.description}</EmptyDescription>
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
                          'h-auto w-full justify-between gap-3 border-0 px-3 py-2.5 text-left whitespace-normal',
                          selectedRow ? 'bg-muted text-foreground' : 'bg-transparent',
                        )}
                        onPress={() => {
                          openCase(item.id)
                        }}
                        type="button"
                        variant="ghost"
                      >
                        <span className="grid min-w-0 gap-1">
                          <strong className="truncate">{item.title}</strong>
                          <small
                            className={selectedRow ? 'text-foreground/70' : 'text-muted-foreground'}
                          >
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
          <CardContent className="flex flex-1 flex-col p-4">
            {mobileDetailOpen ? (
              <div className="mb-4 min-[721px]:hidden">
                <Button
                  ref={mobileBackButtonRef}
                  aria-label="Wróć do listy spraw"
                  className="size-11"
                  onPress={() => (isCreating ? cancelCreate() : selectCase(null, 'replace'))}
                  size="icon-lg"
                  type="button"
                  variant="ghost"
                >
                  <RiArrowLeftLine aria-hidden="true" />
                </Button>
              </div>
            ) : null}
            {isCreating ? (
              <CaseCreatePanel
                busy={createMutation.isPending}
                error={createMutation.error}
                titleRef={createTitleRef}
                onCancel={cancelCreate}
                onSubmit={(input) => createMutation.mutateAsync(input)}
              />
            ) : selected ? (
              <CaseDetail
                caseItem={selected}
                headingLevel={isDesktop ? 2 : 1}
                isDesktop={isDesktop}
                titleRef={detailTitleInputRef}
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
            ) : cases.isSuccess && view === 'all' && items.length === 0 ? (
              <CaseEmptyState
                description="Użyj przycisku „Dodaj sprawę” po lewej stronie."
                title="Dodaj pierwszą sprawę."
              />
            ) : cases.isSuccess && items.length === 0 ? (
              <CaseEmptyState
                description="Zmień widok albo utwórz nową sprawę."
                title="Brak wybranej sprawy."
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
  isDesktop,
  onRetryTransition,
  onTransition,
  onUpdate,
  titleRef,
  transitionBusy,
  transitionError,
  updateBusy,
  updateError,
}: {
  caseItem: CaseItem
  headingLevel: 1 | 2
  isDesktop: boolean
  onRetryTransition(): void
  onTransition(input: CaseTransitionIntent): void
  onUpdate(input: CaseFormValue): Promise<unknown>
  titleRef: Ref<HTMLInputElement>
  transitionBusy: boolean
  transitionError: Error | null
  updateBusy: boolean
  updateError: Error | null
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const [notedStatus, setNotedStatus] = useState<'canceled' | 'waiting' | null>(null)
  const compactStatusTriggerRef = useRef<HTMLButtonElement>(null)

  const transition = (toStatus: CaseTransitionIntent['toStatus'], note?: string) => {
    onTransition({
      ...(note ? { note } : {}),
      toStatus,
      transitionId: crypto.randomUUID(),
    } as CaseTransitionIntent)
  }

  return (
    <article aria-labelledby="selected-case-title">
      <Heading className="sr-only" id="selected-case-title">
        {caseItem.title}
      </Heading>
      {transitionError ? <ErrorNotice error={transitionError} retry={onRetryTransition} /> : null}
      <CaseForm
        key={`${caseItem.id}:${caseItem.version}`}
        busy={updateBusy}
        error={updateError}
        footerActions={
          <CaseStatusActions
            busy={transitionBusy}
            caseItem={caseItem}
            compactTriggerRef={compactStatusTriggerRef}
            isDesktop={isDesktop}
            onNotedTransition={setNotedStatus}
            onTransition={transition}
          />
        }
        initialValue={caseItem}
        onSubmit={onUpdate}
        submitLabel="Zapisz"
        titleRef={titleRef}
      />
      <CaseStatusHistory caseId={caseItem.id} />
      <StatusNoteDialog
        busy={transitionBusy}
        status={notedStatus}
        onClose={() => {
          setNotedStatus(null)
          window.setTimeout(() => compactStatusTriggerRef.current?.focus(), 0)
        }}
        onSubmit={(note) => {
          if (!notedStatus) return
          transition(notedStatus, note)
          setNotedStatus(null)
          window.setTimeout(() => compactStatusTriggerRef.current?.focus(), 0)
        }}
      />
    </article>
  )
}

function CaseStatusActions({
  busy,
  caseItem,
  compactTriggerRef,
  isDesktop,
  onNotedTransition,
  onTransition,
}: {
  busy: boolean
  caseItem: CaseItem
  compactTriggerRef: Ref<HTMLButtonElement>
  isDesktop: boolean
  onNotedTransition(status: 'canceled' | 'waiting'): void
  onTransition(status: CaseTransitionIntent['toStatus']): void
}) {
  const actions = caseStatusActions(caseItem)
  const runAction = (action: CaseStatusAction) => {
    if (action.requiresNote) onNotedTransition(action.toStatus)
    else onTransition(action.toStatus)
  }

  if (!isDesktop) {
    return (
      <DropdownMenuTrigger>
        <Button
          ref={compactTriggerRef}
          className="w-full"
          isDisabled={busy}
          type="button"
          variant="outline"
        >
          {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
          {busy ? 'Zmiana statusu…' : 'Zmień status'}
          <RiArrowDownSLine aria-hidden="true" />
        </Button>
        <DropdownMenu aria-label="Zmień status" className="min-w-48">
          {actions.map((action) => (
            <DropdownMenuItem
              id={action.toStatus}
              key={action.toStatus}
              onAction={() => runAction(action)}
              variant={action.variant === 'destructive' ? 'destructive' : 'default'}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      </DropdownMenuTrigger>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          className={cn(
            action.variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
          )}
          isDisabled={busy}
          key={action.toStatus}
          onPress={() => runAction(action)}
          type="button"
          variant={action.variant}
        >
          {busy && actions.length === 1 ? (
            <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
          ) : null}
          {busy && actions.length === 1 ? 'Zapisywanie…' : action.label}
        </Button>
      ))}
    </div>
  )
}

type CaseStatusAction =
  | {
      label: string
      requiresNote: true
      toStatus: 'canceled' | 'waiting'
      variant: 'outline' | 'destructive'
    }
  | {
      label: string
      requiresNote?: false
      toStatus: 'resolved' | 'working'
      variant: 'default' | 'outline'
    }

function caseStatusActions(caseItem: CaseItem): CaseStatusAction[] {
  if (caseItem.status === 'resolved' || caseItem.status === 'canceled') {
    return [{ label: 'Otwórz ponownie', toStatus: 'working', variant: 'outline' }]
  }

  return [
    ...(caseItem.status === 'new'
      ? ([
          { label: 'Pracuj', toStatus: 'working', variant: 'default' },
        ] satisfies CaseStatusAction[])
      : []),
    ...(caseItem.status === 'new' || caseItem.status === 'working'
      ? ([
          { label: 'Oczekuj', requiresNote: true, toStatus: 'waiting', variant: 'outline' },
        ] satisfies CaseStatusAction[])
      : []),
    ...(caseItem.status === 'waiting'
      ? ([{ label: 'Wznów', toStatus: 'working', variant: 'default' }] satisfies CaseStatusAction[])
      : []),
    { label: 'Rozwiąż', toStatus: 'resolved', variant: 'outline' },
    {
      label: 'Anuluj',
      requiresNote: true,
      toStatus: 'canceled',
      variant: 'destructive',
    },
  ]
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
    <section aria-label="Historia statusu" className="mt-4">
      {history.isPending ? <LoadingStatus label="Ładowanie historii…" /> : null}
      {history.isError ? (
        <ErrorNotice error={history.error} retry={() => history.refetch()} />
      ) : null}
      {history.isSuccess && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak wpisów historii.</p>
      ) : null}
      {entries.length > 0 ? (
        <ol className="grid gap-2">
          {entries.map((entry, index) => {
            const isCurrent = index === 0
            return (
              <li
                aria-current={isCurrent ? 'true' : undefined}
                className="rounded-xl bg-muted/50 px-3 py-2.5"
                key={entry.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <strong className="text-sm font-semibold">{statusLabel(entry.toStatus)}</strong>
                  <time
                    className="shrink-0 text-right text-xs text-muted-foreground"
                    dateTime={entry.changedAt}
                  >
                    {formatDate(entry.changedAt)}
                  </time>
                </div>
                {entry.note ? (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>
                ) : null}
              </li>
            )
          })}
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

function CaseCreatePanel({
  busy,
  error,
  onCancel,
  onSubmit,
  titleRef,
}: {
  busy: boolean
  error: Error | null
  onCancel(): void
  onSubmit(value: CaseFormValue): Promise<unknown>
  titleRef: Ref<HTMLInputElement>
}) {
  return (
    <article aria-label="Nowa sprawa">
      <CaseForm
        ariaLabel="Nowa sprawa"
        busy={busy}
        busyLabel="Tworzenie…"
        error={error}
        initialValue={{ customerId: null, description: null, title: '' }}
        onCancel={onCancel}
        onSubmit={onSubmit}
        submitLabel="Utwórz sprawę"
        titleRef={titleRef}
      />
    </article>
  )
}

function CaseForm({
  ariaLabel,
  busy,
  busyLabel = 'Zapisywanie…',
  error,
  footerActions,
  initialValue,
  onCancel,
  onSubmit,
  submitLabel,
  titleRef,
}: {
  ariaLabel?: string
  busy: boolean
  busyLabel?: string
  error: Error | null
  footerActions?: ReactNode
  initialValue: CaseFormValue
  onCancel?(): void
  onSubmit(value: CaseFormValue): Promise<unknown>
  submitLabel: string
  titleRef?: Ref<HTMLInputElement>
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
    <form aria-label={ariaLabel} onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="case-title">
            Tytuł{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            aria-label="Tytuł"
            ref={titleRef}
            defaultValue={initialValue.title}
            id="case-title"
            maxLength={200}
            name="title"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="case-description">Opis</FieldLabel>
          <Textarea
            className="min-h-24 resize-y"
            defaultValue={initialValue.description ?? ''}
            id="case-description"
            maxLength={10_000}
            name="description"
          />
        </Field>
        <div
          className={cn(
            'grid min-h-10 items-center gap-2 min-[721px]:flex min-[721px]:flex-wrap',
            footerActions ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          <Button
            className={cn(footerActions && 'w-full min-[721px]:w-auto')}
            isDisabled={busy}
            type="submit"
          >
            {busy ? <Spinner aria-hidden="true" className="motion-reduce:animate-none" /> : null}
            {busy ? busyLabel : submitLabel}
          </Button>
          {onCancel ? (
            <Button isDisabled={busy} onPress={onCancel} type="button" variant="outline">
              Anuluj
            </Button>
          ) : null}
          {footerActions}
          {submitted && !error ? (
            <span className="col-span-full text-sm font-medium text-muted-foreground" role="status">
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
    waiting: 'Czekamy',
    working: 'Pracujemy',
  }[status]
}

function caseListViewForStatus(status: CaseItem['status']): CaseListView {
  return status === 'canceled' || status === 'resolved' ? 'all' : status
}

function caseListEmptyState(view: CaseListView, search: string) {
  if (search) {
    return {
      description: 'Spróbuj innej frazy albo wyczyść wyszukiwanie.',
      title: 'Brak pasujących spraw.',
    }
  }
  return {
    all: {
      description: 'Utwórz pierwszą sprawę przyciskiem „Dodaj sprawę”.',
      title: 'Brak spraw.',
    },
    new: {
      description: 'Nowe sprawy pojawią się tutaj po utworzeniu.',
      title: 'Brak nowych spraw.',
    },
    waiting: {
      description: 'Sprawy, na które czekamy, pojawią się tutaj.',
      title: 'Brak spraw, na które czekamy.',
    },
    working: {
      description: 'Rozpocznij pracę nad nową sprawą, aby pojawiła się tutaj.',
      title: 'Brak spraw, nad którymi pracujemy.',
    },
  }[view]
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
