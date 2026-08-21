import type * as React from 'react'
import {
  Dialog as DialogPrimitive,
  Heading,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

interface DialogProps extends Omit<ModalOverlayProps, 'children' | 'className'> {
  children: React.ReactNode
  className?: string
}

function Dialog({ children, className, ...props }: DialogProps) {
  return (
    <ModalOverlay
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      {...props}
    >
      <Modal className="w-full max-w-md outline-none">
        <DialogPrimitive
          className={cn(
            'rounded-xl border bg-background p-5 text-foreground shadow-xl outline-none',
            className,
          )}
        >
          {children}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof Heading>) {
  return <Heading className={cn('text-lg font-semibold', className)} slot="title" {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />
}

export { Dialog, DialogDescription, DialogFooter, DialogTitle }
