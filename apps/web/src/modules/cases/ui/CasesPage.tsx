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

interface CaseDraftController {
  caseId: string
  isDirty: boolean
  resetDraft(): void
}

interface PendingDiscardAction {
  cancel?(): void
  proceed(): void
}

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
  const [view, setView] = useState<CaseListView>('open')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedSearch(search.trim())
  const [isCreating, setIsCreating] = useState(createRequested)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false)
  const [activeCaseMutation, setActiveCaseMutation] = useState<'transition' | 'update' | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const draftControllerRef = useRef<CaseDraftController | null>(null)
  const pendingDiscardActionRef = useRef<PendingDiscardAction | null>(null)
  const mutationLockRef = useRef(false)
  const previousRequestedIdRef = useRef(requestedId)
  const previousCreateRequestedRef = useRef(createRequested)
  const previousSelectedIdRef = useRef<string | null>(null)
  const lastViewedIdRef = useRef(readLastViewedCaseId())
  const workspaceRef = useRef<HTMLElement>(null)
  const listViewportRef = useRef<HTMLDivElement>(null)
  const detailViewportRef = useRef<HTMLDivElement>(null)
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
  const requestDraftDiscard = useCallback((proceed: () => void, cancel?: () => void) => {
    if (!draftControllerRef.current?.isDirty) {
      proceed()
      return
    }
    if (pendingDiscardActionRef.current) return
    pendingDiscardActionRef.current = { ...(cancel ? { cancel } : {}), proceed }
    setDiscardPromptOpen(true)
  }, [])
  const commitCaseSelection = useCallback(
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
  const selectCase = useCallback(
    (
      caseId: string | null,
      navigationMode: CaseSelectionNavigationMode = 'replace',
      cancel?: () => void,
    ) => {
      if (selectedIdRef.current === caseId && (caseId !== null || requestedId === null)) return
      requestDraftDiscard(() => commitCaseSelection(caseId, navigationMode), cancel)
    },
    [commitCaseSelection, requestDraftDiscard, requestedId],
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
      setView('open')
      setIsCreating(false)
      previousSelectedIdRef.current = null
      pendingDetailFocusIdRef.current = created.id
      commitCaseSelection(created.id, 'replace')
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
    requestDraftDiscard(
      () => {
        selectedIdRef.current = null
        setSelectedId(null)
      },
      () => onSelectedIdChange(previousRequestedId, 'replace'),
    )
  }, [isDesktop, onSelectedIdChange, requestDraftDiscard, requestedId])

  useLayoutEffect(() => {
    const wasCreateRequested = previousCreateRequestedRef.current
    if (wasCreateRequested === createRequested) return
    previousCreateRequestedRef.current = createRequested

    if (createRequested) {
      requestDraftDiscard(
        () => {
          if (selectedIdRef.current) {
            previousSelectedIdRef.current = selectedIdRef.current
          }
          selectedIdRef.current = null
          setSelectedId(null)
          setIsCreating(true)
        },
        () => onCreateModeChange(false, 'replace'),
      )
      return
    }

    if (wasCreateRequested) setIsCreating(false)
  }, [createRequested, onCreateModeChange, requestDraftDiscard])

  useEffect(() => {
    if (createRequested) return
    if (requestedId) {
      if (requestedFromList || requestedCase.data?.id === requestedId) {
        selectCase(requestedId, 'replace', () =>
          onSelectedIdChange(selectedIdRef.current, 'replace'),
        )
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
    onSelectedIdChange,
  ])

  const selected =
    items.find((item) => item.id === selectedId) ??
    (requestedCase.data?.id === selectedId ? requestedCase.data : null)
  const mobileDetailOpen = !isDesktop && Boolean(isCreating || selectedId || requestedId)

  useLayoutEffect(() => {
    if (!isDesktop || !listViewportRef.current) return
    listViewportRef.current.scrollTop = 0
  }, [debouncedSearch, isDesktop, view])

  useLayoutEffect(() => {
    if (!isDesktop || !detailViewportRef.current) return
    detailViewportRef.current.scrollTop = 0
  }, [isCreating, isDesktop, selected?.id])

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

  const runUpdate = async (current: CaseItem, input: CaseFormValue) => {
    if (mutationLockRef.current) throw new Error('Inna operacja na sprawie jest już w toku.')
    mutationLockRef.current = true
    setActiveCaseMutation('update')
    try {
      return await updateMutation.mutateAsync({ current, input })
    } finally {
      mutationLockRef.current = false
      setActiveCaseMutation(null)
    }
  }

  const runTransition = async (current: CaseItem, input: CaseTransitionIntent): Promise<void> => {
    if (mutationLockRef.current) return
    mutationLockRef.current = true
    setActiveCaseMutation('transition')
    try {
      await transitionMutation.mutateAsync({ current, input })
    } catch {
      // The mutation exposes the error in the visible notice.
    } finally {
      mutationLockRef.current = false
      setActiveCaseMutation(null)
    }
  }

  const openCreate = () => {
    requestDraftDiscard(() => {
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
    })
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

    if (previousSelectedId) commitCaseSelection(previousSelectedId, 'replace')
    else onCreateModeChange(false, 'replace')

    if (isDesktop) pendingDesktopAddFocusRef.current = true
  }

  const openCase = (caseId: string) => {
    requestDraftDiscard(() => {
      setIsCreating(false)
      previousSelectedIdRef.current = null
      createMutation.reset()
      updateMutation.reset()
      transitionMutation.reset()
      rememberMobileListPosition(caseId)
      commitCaseSelection(caseId, isDesktop ? 'replace' : 'push')
    })
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

  const caseMutationBusy =
    activeCaseMutation !== null || updateMutation.isPending || transitionMutation.isPending

  return (
    <main className="flex min-h-0 flex-col pt-2 pb-24 min-[721px]:h-[calc(100dvh-4rem)] min-[721px]:overflow-hidden min-[721px]:pb-4">
      <section
        ref={workspaceRef}
        className="mt-2 grid min-h-0 flex-1 grid-cols-1 items-start gap-4 min-[721px]:grid-cols-[clamp(20rem,32vw,40rem)_minmax(0,1fr)] min-[721px]:items-stretch"
        aria-label="Sprawy"
      >
        <Card
          className="min-h-[460px] gap-0 py-0 min-[721px]:h-full min-[721px]:min-h-0"
          hidden={mobileDetailOpen}
        >
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
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
                    requestDraftDiscard(() => {
                      setView(key as CaseListView)
                      if (!isCreating) commitCaseSelection(null)
                    })
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="open">Otwarte</SelectItem>
                    <SelectItem id="postponed">Odłożone</SelectItem>
                    <SelectItem id="closed">Zamknięte</SelectItem>
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

            <section
              ref={listViewportRef}
              aria-label="Panel listy spraw"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
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
                              className={
                                selectedRow ? 'text-foreground/70' : 'text-muted-foreground'
                              }
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
            </section>
          </CardContent>
        </Card>

        <Card
          className="min-h-[460px] gap-0 py-0 min-[721px]:h-full min-[721px]:min-h-0"
          hidden={!isDesktop && !mobileDetailOpen}
        >
          <CardContent
            ref={detailViewportRef}
            aria-label="Panel szczegółów sprawy"
            className="flex flex-1 flex-col p-4 min-[721px]:min-h-0 min-[721px]:overflow-y-auto min-[721px]:overscroll-contain"
            role="region"
          >
            {mobileDetailOpen ? (
              <div className="mb-4 min-[721px]:hidden">
                <Button
                  ref={mobileBackButtonRef}
                  aria-label="Wróć do listy spraw"
                  className="size-11"
                  onPress={() =>
                    isCreating
                      ? cancelCreate()
                      : requestDraftDiscard(() => commitCaseSelection(null, 'replace'))
                  }
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
                key={selected.id}
                caseItem={selected}
                headingLevel={isDesktop ? 2 : 1}
                isDesktop={isDesktop}
                titleRef={detailTitleInputRef}
                mutationBusy={caseMutationBusy}
                transitionError={transitionMutation.error}
                updateError={updateMutation.error}
                onDraftControllerChange={(controller) => {
                  draftControllerRef.current = controller
                }}
                onResetUpdateError={() => updateMutation.reset()}
                onRetryTransition={() => {
                  if (transitionMutation.variables) {
                    requestDraftDiscard(() => {
                      void runTransition(
                        transitionMutation.variables.current,
                        transitionMutation.variables.input,
                      )
                    })
                  }
                }}
                onRequestDraftDiscard={requestDraftDiscard}
                onTransition={(input) => void runTransition(selected, input)}
                onUpdate={(current, input) => runUpdate(current, input)}
              />
            ) : requestedId && requestedCase.isError ? (
              <ErrorNotice error={requestedCase.error} retry={() => requestedCase.refetch()} />
            ) : requestedId || selectedId ? (
              <LoadingStatus className="min-h-[390px]" label="Ładowanie sprawy…" />
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
      <UnsavedChangesDialog
        isOpen={discardPromptOpen}
        onCancel={() => {
          pendingDiscardActionRef.current?.cancel?.()
          pendingDiscardActionRef.current = null
          setDiscardPromptOpen(false)
        }}
        onDiscard={() => {
          const action = pendingDiscardActionRef.current
          draftControllerRef.current?.resetDraft()
          draftControllerRef.current = null
          pendingDiscardActionRef.current = null
          setDiscardPromptOpen(false)
          updateMutation.reset()
          action?.proceed()
        }}
      />
    </main>
  )
}

function CaseDetail({
  caseItem,
  headingLevel,
  isDesktop,
  mutationBusy,
  onDraftControllerChange,
  onRetryTransition,
  onRequestDraftDiscard,
  onResetUpdateError,
  onTransition,
  onUpdate,
  titleRef,
  transitionError,
  updateError,
}: {
  caseItem: CaseItem
  headingLevel: 1 | 2
  isDesktop: boolean
  mutationBusy: boolean
  onDraftControllerChange(controller: CaseDraftController): void
  onRetryTransition(): void
  onRequestDraftDiscard(action: () => void): void
  onResetUpdateError(): void
  onTransition(input: CaseTransitionIntent): void
  onUpdate(current: CaseItem, input: CaseFormValue): Promise<CaseItem>
  titleRef: Ref<HTMLInputElement>
  transitionError: Error | null
  updateError: Error | null
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const [notedStatus, setNotedStatus] = useState<'canceled' | 'waiting' | null>(null)
  const [draftState, setDraftState] = useState<CaseDraftState>(() => createCaseDraft(caseItem))
  const compactStatusTriggerRef = useRef<HTMLButtonElement>(null)
  const isDirty = !caseFormValuesEqual(draftState.draft, draftState.serverValue)
  const resetDraft = useCallback((serverCase: CaseItem) => {
    setDraftState(createCaseDraft(serverCase))
  }, [])
  const discardDraft = useCallback(() => resetDraft(caseItem), [caseItem, resetDraft])

  useEffect(() => {
    setDraftState((current) => {
      if (current.serverVersion === caseItem.version) return current
      if (!caseFormValuesEqual(current.draft, current.serverValue)) return current
      return createCaseDraft(caseItem)
    })
  }, [caseItem])

  useEffect(() => {
    onDraftControllerChange({ caseId: caseItem.id, isDirty, resetDraft: discardDraft })
  }, [caseItem.id, discardDraft, isDirty, onDraftControllerChange])

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  const transition = (toStatus: CaseTransitionIntent['toStatus'], note?: string) => {
    onTransition({
      ...(note ? { note } : {}),
      toStatus,
      transitionId: crypto.randomUUID(),
    } as CaseTransitionIntent)
  }

  const update = async (input: CaseFormValue) => {
    const updated = await onUpdate({ ...caseItem, version: draftState.serverVersion }, input)
    resetDraft(updated)
    return updated
  }

  const updateDraft = (draft: CaseFormValue) => {
    setDraftState((current) => ({ ...current, draft }))
  }

  const updateConflict = isCaseVersionConflict(updateError)
  const transitionConflict = isCaseVersionConflict(transitionError)

  return (
    <article aria-labelledby="selected-case-title">
      <Heading className="sr-only" id="selected-case-title">
        {caseItem.title}
      </Heading>
      {transitionError ? (
        <ErrorNotice
          error={transitionError}
          {...(transitionConflict ? {} : { retry: onRetryTransition })}
        />
      ) : null}
      {updateConflict ? (
        <CaseConflictNotice
          draft={draftState.draft}
          serverCase={caseItem}
          serverVersion={draftState.serverVersion}
          onLoadServerVersion={() => {
            resetDraft(caseItem)
            onResetUpdateError()
          }}
        />
      ) : null}
      <CaseForm
        busy={mutationBusy}
        error={updateConflict ? null : updateError}
        footerActions={
          <CaseStatusActions
            busy={mutationBusy}
            caseItem={caseItem}
            compactTriggerRef={compactStatusTriggerRef}
            isDesktop={isDesktop}
            onNotedTransition={(status) => onRequestDraftDiscard(() => setNotedStatus(status))}
            onTransition={(status) => onRequestDraftDiscard(() => transition(status))}
          />
        }
        isDirty={isDirty}
        value={draftState.draft}
        onChange={updateDraft}
        onSubmit={update}
        submitLabel="Zapisz"
        titleRef={titleRef}
      />
      <CaseStatusHistory caseId={caseItem.id} />
      <StatusNoteDialog
        busy={mutationBusy}
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
      toStatus: 'new' | 'postponed' | 'resolved' | 'working'
      variant: 'default' | 'outline'
    }

function caseStatusActions(caseItem: CaseItem): CaseStatusAction[] {
  if (caseItem.status === 'resolved' || caseItem.status === 'canceled') {
    return [{ label: 'Otwórz ponownie', toStatus: 'working', variant: 'outline' }]
  }

  if (caseItem.status === 'postponed') {
    return [
      { label: 'Przywróć', toStatus: 'new', variant: 'default' },
      { label: 'Rozwiąż', toStatus: 'resolved', variant: 'outline' },
      {
        label: 'Anuluj',
        requiresNote: true,
        toStatus: 'canceled',
        variant: 'destructive',
      },
    ]
  }

  return [
    ...(caseItem.status === 'new'
      ? ([
          { label: 'Pracuj', toStatus: 'working', variant: 'default' },
          { label: 'Odłóż', toStatus: 'postponed', variant: 'outline' },
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

function UnsavedChangesDialog({
  isOpen,
  onCancel,
  onDiscard,
}: {
  isOpen: boolean
  onCancel(): void
  onDiscard(): void
}) {
  return (
    <Dialog isDismissable isOpen={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogTitle>Niezapisane zmiany</DialogTitle>
      <DialogDescription>
        Masz niezapisane zmiany tytułu lub opisu. Możesz zostać przy edycji albo świadomie je
        odrzucić.
      </DialogDescription>
      <DialogFooter>
        <Button autoFocus onPress={onCancel} type="button" variant="outline">
          Zostań przy edycji
        </Button>
        <Button onPress={onDiscard} type="button" variant="destructive">
          Odrzuć zmiany
        </Button>
      </DialogFooter>
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

interface CaseDraftState {
  draft: CaseFormValue
  serverValue: CaseFormValue
  serverVersion: number
}

function createCaseDraft(serverCase: CaseItem): CaseDraftState {
  const serverValue = caseFormValue(serverCase)
  return { draft: serverValue, serverValue, serverVersion: serverCase.version }
}

function caseFormValue(caseItem: CaseItem): CaseFormValue {
  return {
    customerId: caseItem.customerId,
    description: caseItem.description,
    title: caseItem.title,
  }
}

function caseFormValuesEqual(left: CaseFormValue, right: CaseFormValue) {
  return (
    left.customerId === right.customerId &&
    left.description === right.description &&
    left.title === right.title
  )
}

function CaseConflictNotice({
  draft,
  onLoadServerVersion,
  serverCase,
  serverVersion,
}: {
  draft: CaseFormValue
  onLoadServerVersion(): void
  serverCase: CaseItem
  serverVersion: number
}) {
  const serverIsNewer = serverCase.version > serverVersion
  return (
    <Alert className="my-3.5" variant="destructive">
      <RiErrorWarningLine aria-hidden="true" />
      <AlertDescription className="grid gap-2 text-destructive">
        <strong>Sprawa została zmieniona w innym miejscu. Lokalny szkic został zachowany.</strong>
        <span>
          Wersja serwera {serverCase.version}: {caseDraftSummary(caseFormValue(serverCase))}
        </span>
        <span>
          Lokalny szkic dla wersji {serverVersion}: {caseDraftSummary(draft)}
        </span>
        <Button
          className="w-fit"
          isDisabled={!serverIsNewer}
          onPress={onLoadServerVersion}
          size="sm"
          type="button"
          variant="outline"
        >
          {serverIsNewer ? 'Załaduj wersję z serwera' : 'Pobieranie wersji serwera…'}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function caseDraftSummary(value: CaseFormValue) {
  return `${value.title} — ${value.description || 'bez opisu'}`
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
  const initialValue = { customerId: null, description: null, title: '' }
  const [value, setValue] = useState<CaseFormValue>(initialValue)

  return (
    <article aria-label="Nowa sprawa">
      <CaseForm
        ariaLabel="Nowa sprawa"
        busy={busy}
        busyLabel="Tworzenie…"
        error={error}
        isDirty={!caseFormValuesEqual(value, initialValue)}
        value={value}
        onCancel={onCancel}
        onChange={setValue}
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
  isDirty,
  onCancel,
  onChange,
  onSubmit,
  submitLabel,
  titleRef,
  value,
}: {
  ariaLabel?: string
  busy: boolean
  busyLabel?: string
  error: Error | null
  footerActions?: ReactNode
  isDirty: boolean
  onCancel?(): void
  onChange(value: CaseFormValue): void
  onSubmit(value: CaseFormValue): Promise<unknown>
  submitLabel: string
  titleRef?: Ref<HTMLInputElement>
  value: CaseFormValue
}) {
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(false)
    try {
      await onSubmit({
        customerId: value.customerId,
        description: optionalText(value.description),
        title: value.title.trim(),
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
            id="case-title"
            maxLength={200}
            name="title"
            required
            disabled={busy}
            value={value.title}
            onChange={(event) => {
              setSubmitted(false)
              onChange({ ...value, title: event.target.value })
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="case-description">Opis</FieldLabel>
          <Textarea
            className="min-h-24 resize-y"
            id="case-description"
            maxLength={10_000}
            name="description"
            disabled={busy}
            value={value.description ?? ''}
            onChange={(event) => {
              setSubmitted(false)
              onChange({ ...value, description: event.target.value })
            }}
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
          {isDirty && !busy ? (
            <span className="col-span-full text-sm text-muted-foreground" role="status">
              Niezapisane zmiany.
            </span>
          ) : null}
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
    postponed: 'Odłożona',
    resolved: 'Rozwiązana',
    waiting: 'Czekamy',
    working: 'Pracujemy',
  }[status]
}

function caseListViewForStatus(status: CaseItem['status']): CaseListView {
  if (status === 'canceled' || status === 'resolved') return 'closed'
  return status === 'postponed' ? 'postponed' : 'open'
}

function caseListEmptyState(view: CaseListView, search: string) {
  if (search) {
    return {
      description: 'Spróbuj innej frazy albo wyczyść wyszukiwanie.',
      title: 'Brak pasujących spraw.',
    }
  }
  return {
    closed: {
      description: 'Rozwiązane i anulowane sprawy pojawią się tutaj.',
      title: 'Brak zamkniętych spraw.',
    },
    open: {
      description: 'Nowe i aktywne sprawy pojawią się tutaj.',
      title: 'Brak otwartych spraw.',
    },
    postponed: {
      description: 'Nową sprawę możesz odłożyć na później.',
      title: 'Brak odłożonych spraw.',
    },
  }[view]
}

function readError(error: unknown) {
  if (isCaseVersionConflict(error)) {
    return 'Sprawa została zmieniona w innym miejscu. Sprawdź odświeżone dane i wybierz właściwą akcję.'
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
