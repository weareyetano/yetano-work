import { RiArrowDownSLine } from '@remixicon/react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type * as React from 'react'
import { useRef, useState } from 'react'

import { Button, LinkButton } from '#components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '#components/ui/dialog'
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '#components/ui/dropdown-menu'
import { useMediaQuery } from '#hooks/use-media-query'
import { cn } from '#lib/utils'
import { isWebModuleActive, type WebModuleDefinition, webModules } from '#modules'

const WIDE_MODULE_NAVIGATION_QUERY = '(min-width: 1280px)'

function ModuleNavigation({
  className,
  items = webModules,
  ...props
}: React.ComponentProps<'nav'> & { items?: readonly WebModuleDefinition[] }) {
  const isWide = useMediaQuery(WIDE_MODULE_NAVIGATION_QUERY, true)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const compactTriggerRef = useRef<HTMLButtonElement>(null)
  const placeholderReturnFocusRef = useRef<HTMLElement | null>(null)
  const [placeholderModule, setPlaceholderModule] = useState<string | null>(null)
  const currentItem = items.find((item) => isWebModuleActive(item, pathname))

  if (items.length === 0) return null

  const openPlaceholder = (label: string, returnFocus: HTMLElement | null) => {
    placeholderReturnFocusRef.current = returnFocus
    setPlaceholderModule(label)
  }

  const closePlaceholder = () => {
    setPlaceholderModule(null)
    window.setTimeout(() => placeholderReturnFocusRef.current?.focus(), 0)
  }

  const navigateToModule = (event: React.MouseEvent<Element>, path: `/${string}`) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.defaultPrevented
    ) {
      return
    }

    event.preventDefault()
    void navigate({ href: path })
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
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1 ring-1 ring-border">
          {items.map((item) =>
            item.availability === 'available' ? (
              <LinkButton
                aria-current={item.id === currentItem?.id ? 'page' : undefined}
                className={cn(
                  'h-10 px-4 text-base text-muted-foreground hover:bg-card hover:text-foreground',
                  item.id === currentItem?.id &&
                    'bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-card',
                )}
                href={item.path}
                key={item.id}
                onClick={(event) => navigateToModule(event, item.path)}
                variant="ghost"
              >
                {item.label}
              </LinkButton>
            ) : (
              <Button
                className="h-10 px-4 text-base text-muted-foreground hover:bg-card hover:text-foreground"
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
            aria-label={
              currentItem
                ? `Wybierz moduł, aktualnie: ${currentItem.label}`
                : 'Wybierz moduł, brak aktywnego modułu'
            }
            className="w-full justify-between bg-background"
            type="button"
            variant="outline"
          >
            <span className="truncate">{currentItem?.label ?? 'Wybierz moduł'}</span>
            <RiArrowDownSLine aria-hidden="true" />
          </Button>
          <DropdownMenu
            aria-label="Wybierz moduł"
            className="min-w-56"
            selectedKeys={new Set(currentItem ? [currentItem.id] : [])}
            selectionMode="single"
            shouldCloseOnSelect
          >
            {items.map((item) =>
              item.availability === 'available' ? (
                <DropdownMenuItem
                  aria-current={item.id === currentItem?.id ? 'page' : undefined}
                  id={item.id}
                  key={item.id}
                  onAction={() => void navigate({ href: item.path })}
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

export { ModuleNavigation }
