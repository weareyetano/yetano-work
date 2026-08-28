import {
  RiAddCircleLine,
  RiAddLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiPauseLine,
  RiPlayLine,
} from '@remixicon/react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Alert, AlertAction, AlertDescription } from '#components/ui/alert'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Spinner } from '#components/ui/spinner'
import { Textarea } from '#components/ui/textarea'
import { cn } from '#lib/utils'

import {
  type ActivityItem,
  type ActivityPage,
  type ActivityStatus,
  activityQueryKeys,
  appendActivityNote,
  fetchCaseActivities,
} from '../activities.api'

const ACTIVITY_REFRESH_MS = 2_000

export function ActivityTimeline({
  caseId,
  disabled = false,
  showHeading = true,
}: {
  caseId: string
  disabled?: boolean
  showHeading?: boolean
}) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const activities = useInfiniteQuery<
    ActivityPage,
    Error,
    InfiniteData<ActivityPage>,
    readonly ['activities', 'case', string],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchCaseActivities(caseId, pageParam),
    queryKey: activityQueryKeys.case(caseId),
    refetchInterval: ACTIVITY_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
  const createNote = useMutation({
    mutationFn: appendActivityNote,
    onSuccess: async () => {
      setContent('')
      setPendingActivityId(null)
      await queryClient.invalidateQueries({ queryKey: activityQueryKeys.case(caseId) })
    },
  })
  const entries = activities.data?.pages.flatMap((page) => page.items) ?? []
  const noteBusy = disabled || createNote.isPending

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = content.trim()
    if (!normalized || noteBusy) return
    const activityId = pendingActivityId ?? crypto.randomUUID()
    setPendingActivityId(activityId)
    createNote.mutate({ activityId, caseId, content: normalized })
  }

  return (
    <section
      aria-labelledby={showHeading ? `activity-heading-${caseId}` : undefined}
      className={showHeading ? 'mt-6 border-t pt-5' : undefined}
    >
      {showHeading ? (
        <h3 className="text-base font-semibold" id={`activity-heading-${caseId}`}>
          Aktywność
        </h3>
      ) : null}
      <form className={showHeading ? 'mt-4 grid gap-3' : 'grid gap-3'} onSubmit={submit}>
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Treść notatki"
            className="min-h-10 resize-y"
            disabled={noteBusy}
            id={`activity-note-${caseId}`}
            maxLength={10_000}
            name="activity-note"
            placeholder="Napisz notatkę o tym, co się wydarzyło…"
            required
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              setPendingActivityId(null)
              createNote.reset()
            }}
          />
          <Button
            aria-label={createNote.isPending ? 'Dodawanie notatki…' : 'Dodaj notatkę'}
            className="size-10"
            isDisabled={noteBusy || !content.trim()}
            size="icon"
            type="submit"
          >
            {createNote.isPending ? (
              <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
            ) : (
              <RiAddLine aria-hidden="true" />
            )}
          </Button>
        </div>
        {createNote.isError ? (
          <ErrorNotice
            error={createNote.error}
            retryDisabled={disabled}
            retry={() =>
              submitNoteRetry(createNote.mutate, {
                activityId: pendingActivityId,
                caseId,
                content,
              })
            }
          />
        ) : null}
      </form>

      <div className="mt-5">
        {activities.isPending ? <LoadingStatus label="Ładowanie aktywności…" /> : null}
        {activities.isError ? (
          <ErrorNotice error={activities.error} retry={() => activities.refetch()} />
        ) : null}
        {activities.isSuccess && entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak aktywności.</p>
        ) : null}
        {entries.length > 0 ? (
          <ol className="grid gap-2" aria-label="Oś czasu sprawy">
            {entries.map((entry) => (
              <ActivityEntry entry={entry} key={entry.id} />
            ))}
          </ol>
        ) : null}
        {activities.hasNextPage ? (
          <Button
            className="mt-4"
            isDisabled={activities.isFetchingNextPage}
            onPress={() => activities.fetchNextPage()}
            type="button"
            variant="outline"
          >
            {activities.isFetchingNextPage ? 'Ładowanie…' : 'Pokaż starsze'}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function submitNoteRetry(
  mutate: (input: { activityId: string; caseId: string; content: string }) => void,
  input: { activityId: string | null; caseId: string; content: string },
) {
  const content = input.content.trim()
  if (!input.activityId || !content) return
  mutate({ activityId: input.activityId, caseId: input.caseId, content })
}

function ActivityEntry({ entry }: { entry: ActivityItem }) {
  return (
    <li className="rounded-xl bg-muted/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 whitespace-pre-wrap text-sm">
          <ActivitySentence entry={entry} />
        </p>
        <time
          className="shrink-0 text-right text-xs text-muted-foreground"
          dateTime={entry.occurredAt}
        >
          {formatActivityDate(entry.occurredAt)}
        </time>
      </div>
    </li>
  )
}

function ActivitySentence({ entry }: { entry: ActivityItem }) {
  const actor = entry.actorType === 'system' ? 'System' : 'Użytkownik'

  if (entry.type === 'note') {
    return (
      <>
        <strong>{actor}</strong> dodał notatkę: „<span>{entry.content}</span>”
      </>
    )
  }
  if (entry.type === 'case_created') {
    return (
      <>
        <strong>{actor}</strong> utworzył sprawę.
      </>
    )
  }
  return (
    <>
      <strong>{actor}</strong> zmienił status na{' '}
      <ActivityStatusBadge
        className="mx-0.5 -translate-y-0.5 align-middle"
        status={entry.toStatus}
      />
      {entry.note ? (
        <>
          {' '}
          i dodał: „<span>{entry.note}</span>”
        </>
      ) : (
        '.'
      )}
    </>
  )
}

export function ActivityStatusBadge({
  className,
  status,
}: {
  className?: string
  status: ActivityStatus
}) {
  const StatusIcon = {
    canceled: RiCloseCircleLine,
    new: RiAddCircleLine,
    postponed: RiArchiveLine,
    resolved: RiCheckboxCircleLine,
    waiting: RiPauseLine,
    working: RiPlayLine,
  }[status]

  return (
    <Badge
      className={cn('h-6 px-2.5 text-sm', statusBadgeTone(status), className)}
      variant="outline"
    >
      <StatusIcon aria-hidden="true" data-icon="inline-start" />
      {statusLabel(status)}
    </Badge>
  )
}

function statusBadgeTone(status: ActivityStatus) {
  if (status === 'waiting') {
    return 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
  }
  if (status === 'working') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
  }
  return 'bg-background'
}

export function statusLabel(status: ActivityStatus) {
  return {
    canceled: 'Anulowana',
    new: 'Nowa',
    postponed: 'Odłożona',
    resolved: 'Rozwiązana',
    waiting: 'Czekamy',
    working: 'Pracujemy',
  }[status]
}

export function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function LoadingStatus({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
      role="status"
    >
      <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  )
}

function ErrorNotice({
  error,
  retry,
  retryDisabled = false,
}: {
  error: unknown
  retry(): unknown
  retryDisabled?: boolean
}) {
  return (
    <Alert className="my-3.5 pr-36" variant="destructive">
      <RiErrorWarningLine aria-hidden="true" />
      <AlertDescription className="text-destructive">{readError(error)}</AlertDescription>
      <AlertAction>
        <Button
          isDisabled={retryDisabled}
          onPress={retry}
          size="sm"
          type="button"
          variant="outline"
        >
          Spróbuj ponownie
        </Button>
      </AlertAction>
    </Alert>
  )
}

function readError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'Nie udało się wykonać operacji. Spróbuj ponownie.'
}
