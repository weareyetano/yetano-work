import type { MikroORM } from '@mikro-orm/postgresql'
import { describe, expect, it, vi } from 'vitest'

import type { AppContainer } from './container.js'
import { disposeRuntime } from './runtime.js'

describe('disposeRuntime', () => {
  it('disposes the container before closing the ORM', async () => {
    const calls: string[] = []
    const container = {
      dispose: vi.fn(async () => {
        calls.push('container')
      }),
    } as unknown as AppContainer
    const orm = {
      close: vi.fn(async () => {
        calls.push('orm')
      }),
    } as unknown as MikroORM

    await disposeRuntime({ container, orm })

    expect(calls).toEqual(['container', 'orm'])
    expect(orm.close).toHaveBeenCalledWith(true)
  })

  it('closes the ORM when container disposal fails', async () => {
    const failure = new Error('disposer failed')
    const container = {
      dispose: vi.fn().mockRejectedValue(failure),
    } as unknown as AppContainer
    const orm = {
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as MikroORM

    await expect(disposeRuntime({ container, orm })).rejects.toBe(failure)
    expect(orm.close).toHaveBeenCalledWith(true)
  })
})
