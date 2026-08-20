import { createRootRoute, Outlet } from '@tanstack/react-router'

import yetanoMark from '../assets/yetano-mark.svg'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="mx-auto w-[calc(100%_-_2.5rem)] max-w-[70rem] max-[720px]:w-[calc(100%_-_1.75rem)]">
      <header className="flex min-h-21 items-center justify-between">
        <a
          className="inline-flex items-center gap-2 text-foreground no-underline"
          href="/cases"
          aria-label="Yetano Work — sprawy"
        >
          <img className="size-6.5" src={yetanoMark} alt="" />
          <span className="font-heading text-base font-semibold tracking-[0.16em]">WORK</span>
        </a>
      </header>
      <Outlet />
    </div>
  )
}
