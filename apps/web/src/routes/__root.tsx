import { createRootRoute, Outlet } from '@tanstack/react-router'

import yetanoMark from '../assets/yetano-mark.svg'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/cases" aria-label="Yetano Work — sprawy">
          <img className="brand-mark" src={yetanoMark} alt="" />
          <span className="brand-name">WORK</span>
        </a>
      </header>
      <Outlet />
    </div>
  )
}
