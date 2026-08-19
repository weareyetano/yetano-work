import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Yetano Work — strona główna">
          <span className="brand-mark" aria-hidden="true">
            Y
          </span>
          <span>Yetano Work</span>
        </a>
        <nav aria-label="Główna nawigacja">
          <a className="nav-link" href="/cases">
            Sprawy
          </a>
          <a className="docs-link" href="/api/docs">
            API docs
          </a>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
