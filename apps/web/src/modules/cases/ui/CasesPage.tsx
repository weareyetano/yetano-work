import { RiArrowLeftLine } from '@remixicon/react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

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
  ErrorNotice,
  LoadingStatus,
} from './case-workspace.shared'
import { CaseDraftGuardDialog, useCaseDraftGuard } from './useCaseDraftGuard'
import {
  type CaseSelectionNavigationMode,
  useCaseWorkspaceNavigation,
} from './useCaseWorkspaceNavigation'

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

export type { CaseSelectionNavigationMode } from './useCaseWorkspaceNavigation'

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
  const [activeCaseMutation, setActiveCaseMutation] = useState<'transition' | 'update' | null>(null)
  const mutationLockRef = useRef(false)
  const {
    cancelDiscard,
    discardDraft,
    discardPromptOpen,
    registerDraftController,
    requestDraftDiscard,
  } = useCaseDraftGuard()
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
  const navigation = useCaseWorkspaceNavigation({
    casesIsSuccess: cases.isSuccess,
    createRequested,
    debouncedSearch,
    items,
    onCreateModeChange,
    onSelectedIdChange,
    requestDraftDiscard,
    requestedCase: requestedCase.data,
    requestedCaseIsError: requestedCase.isError,
    requestedCaseIsPending: requestedCase.isPending,
    requestedFromList,
    requestedId,
    view,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createCaseItem,
    onSuccess: async (created) => {
      setView('open')
      navigation.finishCreate(created.id)
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

  const resetCreateMutation = () => createMutation.reset()
  const resetAllMutations = () => {
    createMutation.reset()
    updateMutation.reset()
    transitionMutation.reset()
  }
  const {
    addButtonRef,
    caseButtonRefs,
    createTitleRef,
    detailTitleInputRef,
    detailViewportRef,
    isCreating,
    isDesktop,
    listTitleRef,
    listViewportRef,
    mobileBackButtonRef,
    mobileDetailOpen,
    selected,
    selectedId,
    workspaceRef,
  } = navigation
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
          onOpenCase={(caseId) => navigation.openCase(caseId, resetAllMutations)}
          onOpenCreate={() => navigation.openCreate(resetCreateMutation)}
          onSearchChange={setSearch}
          onViewChange={(nextView) => {
            requestDraftDiscard(() => {
              setView(nextView)
              if (!isCreating) navigation.commitCaseSelection(null)
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
                      ? navigation.cancelCreate(resetCreateMutation)
                      : navigation.closeMobileDetail()
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
                onCancel={() => navigation.cancelCreate(resetCreateMutation)}
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
      <CaseDraftGuardDialog
        isOpen={discardPromptOpen}
        onCancel={cancelDiscard}
        onDiscard={() => discardDraft(() => updateMutation.reset())}
      />
    </main>
  )
}
