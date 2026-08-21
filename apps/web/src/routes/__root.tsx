import { createRootRoute, Outlet } from '@tanstack/react-router'

import { ModuleNavigation } from '#components/module-navigation'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="mx-auto w-[calc(100%_-_2.5rem)] max-w-[100rem] max-[720px]:w-[calc(100%_-_1.75rem)]">
      <header className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 max-[720px]:grid-cols-1 max-[720px]:gap-2 max-[720px]:py-3">
        <a
          className="font-heading text-base font-semibold text-foreground no-underline"
          href="/cases"
          aria-label="Yet Another Company"
        >
          Yet Another Company
        </a>
        <ModuleNavigation className="col-start-2 max-[720px]:col-start-1 max-[720px]:row-start-2" />
      </header>
      <Outlet />
    </div>
  )
}
