import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="mx-auto w-[calc(100%_-_2.5rem)] max-w-[100rem] max-[720px]:w-[calc(100%_-_1.75rem)]">
      <header className="flex min-h-16 items-center justify-between">
        <a
          className="font-heading text-base font-semibold text-foreground no-underline"
          href="/cases"
          aria-label="Yet Another Company — sprawy"
        >
          Yet Another Company
        </a>
      </header>
      <Outlet />
    </div>
  )
}
