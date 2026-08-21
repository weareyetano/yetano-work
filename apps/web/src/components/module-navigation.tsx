import { RiArrowDownSLine } from '@remixicon/react'
import type * as React from 'react'
import { useRef, useState } from 'react'

import { Button, LinkButton } from '#components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '#components/ui/dropdown-menu'
import { useMediaQuery } from '#hooks/use-media-query'
import { cn } from '#lib/utils'

const WIDE_MODULE_NAVIGATION_QUERY = '(min-width: 1280px)'

type ModuleNavigationItem = {
  href?: string
  id: string
  isCurrent?: boolean
  label: string
}

const defaultItems = [
  { href: '/cases', id: 'cases', isCurrent: true, label: 'Sprawy' },
  { id: 'tasks', label: 'Zadania' },
  { id: 'messages', label: 'Wiadomości' },
] satisfies readonly ModuleNavigationItem[]

function ModuleNavigation({
  className,
  items = defaultItems,
  ...props
}: React.ComponentProps<'nav'> & { items?: readonly ModuleNavigationItem[] }) {
  const isWide = useMediaQuery(WIDE_MODULE_NAVIGATION_QUERY, true)
  const compactTriggerRef = useRef<HTMLButtonElement>(null)
  const placeholderReturnFocusRef = useRef<HTMLElement | null>(null)
  const [placeholderModule, setPlaceholderModule] = useState<string | null>(null)
  const currentItem = items.find((item) => item.isCurrent) ?? items[0]

  if (!currentItem) return null

  const openPlaceholder = (label: string, returnFocus: HTMLElement | null) => {
    placeholderReturnFocusRef.current = returnFocus
    setPlaceholderModule(label)
  }

  const closePlaceholder = () => {
    setPlaceholderModule(null)
    window.setTimeout(() => placeholderReturnFocusRef.current?.focus(), 0)
  }

  return (
    <nav
      aria-label="Moduły"
      className={cn(
        'min-w-0 justify-self-center max-[720px]:w-full min-[721px]:max-[1279px]:w-56',
        className,
      )}
      {...props}
    >
      {isWide ? (
        <div className="inline-flex items-center gap-1 rounded-xl bg-border/70 p-1">
          {items.map((item) =>
            item.href ? (
              <LinkButton
                aria-current={item.isCurrent ? 'page' : undefined}
                className={cn(
                  'h-8 px-3 text-sm text-foreground/70 hover:bg-background/60 hover:text-foreground',
                  item.isCurrent &&
                    'bg-background text-foreground shadow-sm ring-1 ring-foreground/5 hover:bg-background',
                )}
                href={item.href}
                key={item.id}
                variant="ghost"
              >
                {item.label}
              </LinkButton>
            ) : (
              <Button
                className="h-8 px-3 text-sm text-foreground/70 hover:bg-background/60 hover:text-foreground"
                key={item.id}
                onPress={(event) =>
                  openPlaceholder(
                    item.label,
                    event.target instanceof HTMLElement ? event.target : null,
                  )
                }
                type="button"
                variant="ghost"
              >
                {item.label}
              </Button>
            ),
          )}
        </div>
      ) : (
        <DropdownMenuTrigger>
          <Button
            ref={compactTriggerRef}
            aria-label={`Wybierz moduł, aktualnie: ${currentItem.label}`}
            className="w-full justify-between bg-background"
            type="button"
            variant="outline"
          >
            <span className="truncate">{currentItem.label}</span>
            <RiArrowDownSLine aria-hidden="true" />
          </Button>
          <DropdownMenu
            aria-label="Wybierz moduł"
            className="min-w-56"
            selectedKeys={new Set([currentItem.id])}
            selectionMode="single"
            shouldCloseOnSelect
          >
            {items.map((item) =>
              item.href ? (
                <DropdownMenuItem
                  aria-current={item.isCurrent ? 'page' : undefined}
                  href={item.href}
                  id={item.id}
                  key={item.id}
                >
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  id={item.id}
                  key={item.id}
                  onAction={() => openPlaceholder(item.label, compactTriggerRef.current)}
                >
                  {item.label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenu>
        </DropdownMenuTrigger>
      )}

      <Dialog
        isDismissable
        isOpen={placeholderModule !== null}
        onOpenChange={(open) => !open && closePlaceholder()}
      >
        <DialogTitle>To tylko atrapa</DialogTitle>
        <DialogDescription>
          Moduł „{placeholderModule}” jest przykładem przyszłego modułu i nie prowadzi jeszcze do
          żadnego ekranu.
        </DialogDescription>
        <DialogFooter showCloseButton />
      </Dialog>
    </nav>
  )
}

export { ModuleNavigation, type ModuleNavigationItem }
