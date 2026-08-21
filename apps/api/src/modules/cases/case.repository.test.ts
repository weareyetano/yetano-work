import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import { CaseEntity } from './case.entity.js'
import { createCaseRepository } from './case.repository.js'

describe('case repository list ordering', () => {
  it('orders and paginates cases by most recent modification', async () => {
    const find = vi.fn().mockResolvedValue([])
    const repository = createCaseRepository({ find } as unknown as EntityManager)
    const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId
    const cursor = {
      id: '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId,
      updatedAt: new Date('2026-08-21T12:00:00.000Z'),
    }

    await repository.list(organizationId, { cursor, limit: 25 })

    expect(find).toHaveBeenCalledWith(
      CaseEntity,
      {
        $and: [
          {
            $or: [
              { updatedAt: { $lt: cursor.updatedAt } },
              { id: { $lt: cursor.id }, updatedAt: cursor.updatedAt },
            ],
          },
        ],
        organizationId,
      },
      {
        limit: 26,
        orderBy: [{ updatedAt: 'DESC' }, { id: 'DESC' }],
      },
    )
  })
})
