import { RiArrowLeftLine } from '@remixicon/react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'
import { useMediaQuery } from '#hooks/use-media-query'

import {
  type CaseItem,
  type CaseListPage,
  type CaseListView,
  type CaseTransitionIntent,
  caseQueryKeys,
  createCaseItem,
  fetchCase,
  fetchCases,
  isCaseVersionConflict,
  transitionCaseItem,
  updateCaseItem,
} from '../cases.api'
import { CaseCreatePanel } from './CaseCreatePanel'
import { CaseDetailPanel } from './CaseDetailPanel'
import { CaseListPanel } from './CaseListPanel'
import {
  CaseEmptyState,
  type CaseFormValue,
  caseListEmptyState,
  caseListViewForStatus,
  type DraftController,
  ErrorNotice,
  LoadingStatus,
} from './case-workspace.shared'

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
  const draftControllerRef = useRef<DraftController | null>(null)
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
  const registerDraftController = useCallback((controller: DraftController) => {
    draftControllerRef.current = controller
    return () => {
      if (draftControllerRef.current?.key === controller.key) {
        draftControllerRef.current = null
      }
    }
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
      if (isCreating) return
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

    if (wasCreateRequested && isCreating) {
      requestDraftDiscard(
        () => setIsCreating(false),
        () => onCreateModeChange(true, 'replace'),
      )
    }
  }, [createRequested, isCreating, onCreateModeChange, requestDraftDiscard])

  useEffect(() => {
    if (createRequested || isCreating) return
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
    isCreating,
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

  const commitCancelCreate = () => {
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
  const cancelCreate = () => requestDraftDiscard(commitCancelCreate)

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
        <CaseListPanel
          addButtonRef={addButtonRef}
          caseButtonRefs={caseButtonRefs}
          cases={cases}
          emptyState={emptyState}
          items={items}
          listTitleRef={listTitleRef}
          listViewportRef={listViewportRef}
          mobileDetailOpen={mobileDetailOpen}
          search={search}
          selectedId={selectedId}
          view={view}
          onOpenCase={openCase}
          onOpenCreate={openCreate}
          onSearchChange={setSearch}
          onViewChange={(nextView) => {
            requestDraftDiscard(() => {
              setView(nextView)
              if (!isCreating) commitCaseSelection(null)
            })
          }}
        />

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
                registerDraftController={registerDraftController}
                onSubmit={(input) => createMutation.mutateAsync(input)}
              />
            ) : selected ? (
              <CaseDetailPanel
                key={selected.id}
                caseItem={selected}
                headingLevel={isDesktop ? 2 : 1}
                isDesktop={isDesktop}
                titleRef={detailTitleInputRef}
                mutationBusy={caseMutationBusy}
                transitionError={transitionMutation.error}
                updateError={updateMutation.error}
                registerDraftController={registerDraftController}
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
