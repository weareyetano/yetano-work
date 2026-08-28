import { RiArrowRightSLine, RiCheckLine } from '@remixicon/react'
import { cva } from 'class-variance-authority'
import type * as React from 'react'
import {
  composeRenderProps,
  Header as HeaderPrimitive,
  MenuItem as MenuItemPrimitive,
  type MenuItemProps as MenuItemPrimitiveProps,
  Menu as MenuPrimitive,
  MenuSection as MenuSectionPrimitive,
  type MenuSectionProps as MenuSectionPrimitiveProps,
  MenuTrigger as MenuTriggerPrimitive,
  Popover as PopoverPrimitive,
  Separator as SeparatorPrimitive,
  SubmenuTrigger as SubmenuTriggerPrimitive,
} from 'react-aria-components'
import { cn } from '#lib/utils'

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof MenuTriggerPrimitive>) {
  return <MenuTriggerPrimitive data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenu({
  'data-slot': dataSlot = 'dropdown-menu-content',
  placement = 'bottom start',
  offset = 4,
  crossOffset = 0,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuPrimitive<object>>, 'children' | 'className'> &
  Pick<React.ComponentProps<typeof PopoverPrimitive>, 'placement' | 'offset' | 'crossOffset'> & {
    'data-slot'?: string
    className?: string
    children?: React.ReactNode
  }) {
  return (
    <PopoverPrimitive
      data-slot={dataSlot}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      className={cn(
        'z-50 w-(--trigger-width) min-w-32 origin-(--trigger-anchor-point) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border duration-100 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:overflow-hidden data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 **:data-[slot$=-item]:data-focused:bg-accent animate-none! **:data-[slot$=-item]:focus:bg-accent **:data-[slot$=-item]:data-highlighted:bg-accent **:data-[slot$=-separator]:bg-border **:data-[slot$=-trigger]:focus:bg-accent **:data-[slot$=-trigger]:aria-expanded:bg-accent! **:data-[variant=destructive]:focus:bg-status-danger! **:data-[variant=destructive]:focus:text-status-danger-foreground!',
        className,
      )}
    >
      <MenuPrimitive
        className="max-h-[inherit] overflow-x-hidden overflow-y-auto outline-hidden"
        {...props}
      >
        {children}
      </MenuPrimitive>
    </PopoverPrimitive>
  )
}

function DropdownMenuGroup({
  ...props
}: Omit<MenuSectionPrimitiveProps<object>, 'children'> & {
  children?: React.ReactNode
}) {
  return <MenuSectionPrimitive data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof HeaderPrimitive> & {
  inset?: boolean
}) {
  return (
    <HeaderPrimitive
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2.5 py-1.5 text-sm font-semibold text-muted-foreground data-inset:pl-8',
        className,
      )}
      {...props}
    />
  )
}

const dropdownMenuItemVariants = cva(
  'group/dropdown-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      selectionMode: {
        none: "min-h-9 gap-2 rounded-md px-2.5 py-2 text-base focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-8 data-[variant=destructive]:text-status-danger-foreground data-[variant=destructive]:focus:bg-status-danger data-[variant=destructive]:focus:text-status-danger-foreground [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-status-danger-foreground",
        single:
          "min-h-9 gap-2 rounded-md py-2 pr-9 pl-2.5 text-base focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-8 [&_svg:not([class*='size-'])]:size-4",
        multiple:
          "min-h-9 gap-2 rounded-md py-2 pr-9 pl-2.5 text-base focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
  },
)

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  children,
  ...props
}: MenuItemPrimitiveProps<object> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <MenuItemPrimitive
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      {...(typeof children === 'string' ? { textValue: children } : {})}
      className={composeRenderProps(className, (className, { selectionMode }) =>
        cn(dropdownMenuItemVariants({ selectionMode }), className),
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected, selectionMode }) => (
        <>
          {selectionMode !== 'none' ? (
            <span
              className="pointer-events-none absolute right-2 flex items-center justify-center"
              data-slot={
                selectionMode === 'single'
                  ? 'dropdown-menu-radio-item-indicator'
                  : 'dropdown-menu-checkbox-item-indicator'
              }
            >
              {isSelected ? <RiCheckLine /> : null}
            </span>
          ) : null}
          {children}
        </>
      ))}
    </MenuItemPrimitive>
  )
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof SubmenuTriggerPrimitive>) {
  return <SubmenuTriggerPrimitive data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuItemPrimitiveProps<object> & {
  inset?: boolean
}) {
  return (
    <MenuItemPrimitive
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      {...(typeof children === 'string' ? { textValue: children } : {})}
      className={cn(
        "flex min-h-9 cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-base outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-8 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          {children}
          <RiArrowRightSLine className="ml-auto" />
        </>
      ))}
    </MenuItemPrimitive>
  )
}

function DropdownMenuSubContent({
  placement = 'end top',
  crossOffset = -3,
  offset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenu>) {
  return (
    <DropdownMenu
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'w-auto min-w-[96px] rounded-lg bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border duration-100 animate-none! **:data-[slot$=-item]:focus:bg-accent **:data-[slot$=-item]:data-highlighted:bg-accent **:data-[slot$=-separator]:bg-border **:data-[slot$=-trigger]:focus:bg-accent **:data-[slot$=-trigger]:aria-expanded:bg-accent!',
        className,
      )}
      placement={placement}
      crossOffset={crossOffset}
      offset={offset}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'ml-auto font-mono text-sm tracking-wide text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
