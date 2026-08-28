import { RiAddLine, RiCloseLine, RiSearchLine } from '@remixicon/react'
import type { MutableRefObject, Ref } from 'react'

import { CaseStatusBadge } from '#components/case-status-badge'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#components/ui/empty'
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
import { cn } from '#lib/utils'

import type { CaseItem, CaseListView } from '../cases.api'
import { ErrorNotice, formatDate, LoadingStatus } from './case-workspace.shared'

interface CaseListQueryState {
  error: Error | null
  fetchNextPage(): unknown
  hasNextPage: boolean
  isError: boolean
  isFetchingNextPage: boolean
  isPending: boolean
  isSuccess: boolean
  refetch(): unknown
}

export function CaseListPanel({
  addButtonRef,
  caseButtonRefs,
  cases,
  emptyState,
  items,
  listTitleRef,
  listViewportRef,
  mobileDetailOpen,
  onOpenCase,
  onOpenCreate,
  onSearchChange,
  onViewChange,
  search,
  selectedId,
  view,
}: {
  addButtonRef: Ref<HTMLButtonElement>
  caseButtonRefs: MutableRefObject<Map<string, HTMLButtonElement>>
  cases: CaseListQueryState
  emptyState: { description: string; title: string }
  items: CaseItem[]
  listTitleRef: Ref<HTMLHeadingElement>
  listViewportRef: Ref<HTMLDivElement>
  mobileDetailOpen: boolean
  onOpenCase(caseId: string): void
  onOpenCreate(): void
  onSearchChange(value: string): void
  onViewChange(view: CaseListView): void
  search: string
  selectedId: string | null
  view: CaseListView
}) {
  return (
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
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <InputGroupAddon>
              <RiSearchLine aria-hidden="true" />
            </InputGroupAddon>
            {search ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Wyczyść wyszukiwanie"
                  onPress={() => onSearchChange('')}
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
              onSelectionChange={(key) => onViewChange(key as CaseListView)}
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
              onPress={onOpenCreate}
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
          {cases.isError ? <ErrorNotice error={cases.error} retry={() => cases.refetch()} /> : null}
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
                      onPress={() => onOpenCase(item.id)}
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
                      <CaseStatusBadge status={item.status} />
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
  )
}
