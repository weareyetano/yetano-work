import type { EntityManager } from '@mikro-orm/postgresql'
import type { CaseId, OrganizationId } from '@yetano/contracts'
import { describe, expect, it, vi } from 'vitest'

import { ActivityEntity } from './activity.entity.js'
import { createActivityRepository } from './activity.repository.js'

const caseId = '122c8615-6bcd-4a36-90e6-d18ca0c06928' as CaseId
const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb' as OrganizationId

describe('activity repository', () => {
  it('keeps case activity pagination organization-scoped', async () => {
    const find = vi.fn().mockResolvedValue([])
    const repository = createActivityRepository({ find } as unknown as EntityManager)
    const cursor = {
      id: '75bb9ef0-b103-4df7-89ce-efcbd2f79728',
      occurredAt: new Date('2026-08-28T10:00:00.000Z'),
    }

    await repository.list(organizationId, caseId, { cursor, limit: 25 })

    expect(find).toHaveBeenCalledWith(
      ActivityEntity,
      {
        $or: [
          { occurredAt: { $lt: cursor.occurredAt } },
          { id: { $lt: cursor.id }, occurredAt: cursor.occurredAt },
        ],
        caseId,
        organizationId,
      },
      { limit: 26, orderBy: [{ occurredAt: 'DESC' }, { id: 'DESC' }] },
    )
  })
})
