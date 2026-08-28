// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CaseStatusBadge } from './case-status-badge'

afterEach(cleanup)

describe('CaseStatusBadge', () => {
  it.each([
    ['new', 'Nowa', 'info', 'bg-status-info'],
    ['working', 'Pracujemy', 'warning', 'bg-status-warning'],
    ['waiting', 'Czekamy', 'notice', 'bg-status-notice'],
    ['postponed', 'Odłożona', 'neutral', 'bg-secondary'],
    ['resolved', 'Rozwiązana', 'success', 'bg-status-success'],
    ['canceled', 'Anulowana', 'danger', 'bg-status-danger'],
  ] as const)(
    'renders %s with its label, icon, and semantic tone',
    (status, label, variant, tone) => {
      render(<CaseStatusBadge status={status} />)

      const badge = screen.getByText(label)
      expect(badge).toHaveAttribute('data-slot', 'badge')
      expect(badge).toHaveAttribute('data-variant', variant)
      expect(badge).toHaveClass('h-7', 'text-sm', 'font-semibold', tone)
      expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    },
  )
})
