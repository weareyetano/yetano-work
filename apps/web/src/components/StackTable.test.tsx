// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StackTable } from './StackTable'

describe('StackTable', () => {
  it('renders the selected foundation layers', () => {
    render(<StackTable />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Hono · TypeBox · OpenAPI')).toBeInTheDocument()
    expect(screen.getAllByText('Gotowe')).toHaveLength(3)
  })
})
