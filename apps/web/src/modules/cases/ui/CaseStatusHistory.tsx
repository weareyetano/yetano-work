import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query'

import { Button } from '#components/ui/button'

import { type CaseStatusHistoryPage, caseQueryKeys, fetchCaseStatusHistory } from '../cases.api'
import { ErrorNotice, formatDate, LoadingStatus, statusLabel } from './case-workspace.shared'

export function CaseStatusHistory({ caseId }: { caseId: string }) {
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
