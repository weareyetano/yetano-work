// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WebModuleDefinition } from '#modules'

import { ModuleNavigation } from './module-navigation'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: '/cases',
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useRouterState: ({ select }: { select(state: { location: { pathname: string } }): string }) =>
    select({ location: { pathname: routerMocks.pathname } }),
}))

afterEach(() => {
  cleanup()
  routerMocks.navigate.mockReset()
  routerMocks.pathname = '/cases'
  vi.unstubAllGlobals()
})

describe('ModuleNavigation', () => {
  it('marks cases as current and opens placeholder modules without navigating', async () => {
    const user = userEvent.setup()
    render(<ModuleNavigation />)

    expect(screen.getByRole('navigation', { name: 'Moduły' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sprawy' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Sprawy' })).toHaveAttribute('href', '/cases')

    await user.click(screen.getByRole('link', { name: 'Sprawy' }))
    expect(routerMocks.navigate).toHaveBeenCalledWith({ href: '/cases' })

    const tasks = screen.getByRole('button', { name: 'Zadania' })
    await user.click(tasks)

    expect(screen.getByRole('dialog', { name: 'To tylko atrapa' })).toBeVisible()
    expect(screen.getByText(/Moduł „Zadania”/)).toBeVisible()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(tasks).toHaveFocus())
  })

  it('names the selected placeholder in the dialog and closes it from its action', async () => {
    const user = userEvent.setup()
    render(<ModuleNavigation />)

    const messages = screen.getByRole('button', { name: 'Wiadomości' })
    await user.click(messages)

    expect(screen.getByText(/Moduł „Wiadomości”/)).toBeVisible()
    const close = screen
      .getAllByRole('button', { name: 'Zamknij' })
      .find((button) => button.textContent === 'Zamknij')
    if (!close) throw new Error('Missing visible close action')
    await user.click(close)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps eight modules in a compact menu without shrinking their labels', async () => {
    mockWideNavigation(false)
    const user = userEvent.setup()
    const items = [
      { availability: 'available', id: 'cases', label: 'Sprawy', path: '/cases' },
      ...Array.from({ length: 7 }, (_, index) => ({
        availability: 'planned' as const,
        id: `placeholder-${index + 1}`,
        label: `Moduł ${index + 2}`,
      })),
    ] as const satisfies readonly WebModuleDefinition[]
    render(<ModuleNavigation items={items} />)

    const trigger = screen.getByRole('button', {
      name: 'Wybierz moduł, aktualnie: Sprawy',
    })
    expect(trigger).toHaveTextContent('Sprawy')
    expect(screen.queryByRole('link', { name: 'Sprawy' })).not.toBeInTheDocument()

    await user.click(trigger)

    const menuItems = screen.getAllByRole('menuitemradio')
    expect(menuItems).toHaveLength(8)
    expect(screen.getByRole('menuitemradio', { name: 'Sprawy' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await user.click(screen.getByRole('menuitemradio', { name: 'Moduł 8' }))

    expect(screen.getByRole('dialog', { name: 'To tylko atrapa' })).toHaveTextContent(
      'Moduł „Moduł 8”',
    )
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('does not mark a module as current outside module routes', async () => {
    routerMocks.pathname = '/settings'
    render(<ModuleNavigation />)

    expect(screen.getByRole('link', { name: 'Sprawy' })).not.toHaveAttribute('aria-current')

    cleanup()
    mockWideNavigation(false)
    render(<ModuleNavigation />)

    expect(
      screen.getByRole('button', { name: 'Wybierz moduł, brak aktywnego modułu' }),
    ).toHaveTextContent('Wybierz moduł')
  })
})

function mockWideNavigation(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      media: '(min-width: 1280px)',
      removeEventListener: vi.fn(),
    }),
  )
}
