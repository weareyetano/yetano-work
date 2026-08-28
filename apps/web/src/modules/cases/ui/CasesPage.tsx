import { RiArrowLeftLine } from '@remixicon/react'
import { type InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

import {
  type CaseListPage,
  type CaseListView,
  caseQueryKeys,
  fetchCase,
  fetchCases,
} from '../cases.api'
import { CaseCreatePanel } from './CaseCreatePanel'
import { CaseDetailPanel } from './CaseDetailPanel'
import { CaseListPanel } from './CaseListPanel'
import {
  CaseEmptyState,
  caseListEmptyState,
  caseListViewForStatus,
  ErrorNotice,
  LoadingStatus,
} from './case-workspace.shared'
import { CaseDraftGuardDialog, useCaseDraftGuard } from './useCaseDraftGuard'
import { useCaseMutations } from './useCaseMutations'
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
  const [view, setView] = useState<CaseListView>('open')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedSearch(search.trim())
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
  const mutations = useCaseMutations({
    onCreated: (caseId) => {
      setView('open')
      navigation.finishCreate(caseId)
    },
    onTransitioned: (status) => {
      setView(caseListViewForStatus(status))
    },
  })
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
          onOpenCase={(caseId) => navigation.openCase(caseId, mutations.resetAll)}
          onOpenCreate={() => navigation.openCreate(mutations.resetCreate)}
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
                      ? navigation.cancelCreate(mutations.resetCreate)
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
                busy={mutations.createPending}
                error={mutations.createError}
                titleRef={createTitleRef}
                onCancel={() => navigation.cancelCreate(mutations.resetCreate)}
                registerDraftController={registerDraftController}
                onSubmit={mutations.create}
              />
            ) : selected ? (
              <CaseDetailPanel
                key={selected.id}
                caseItem={selected}
                headingLevel={isDesktop ? 2 : 1}
                isDesktop={isDesktop}
                titleRef={detailTitleInputRef}
                mutationBusy={mutations.mutationBusy}
                transitionError={mutations.transitionError}
                updateError={mutations.updateError}
                registerDraftController={registerDraftController}
                onResetUpdateError={mutations.resetUpdate}
                onRetryTransition={() => {
                  requestDraftDiscard(() => void mutations.retryTransition())
                }}
                onRequestDraftDiscard={requestDraftDiscard}
                onTransition={(input) => void mutations.runTransition(selected, input)}
                onUpdate={mutations.runUpdate}
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
        onDiscard={() => discardDraft(mutations.resetUpdate)}
      />
    </main>
  )
}
