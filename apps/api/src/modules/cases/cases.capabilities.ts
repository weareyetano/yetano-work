import type { CapabilityDefinition } from '../module.js'

export const CASES_CAPABILITIES = {
  close: 'cases.close',
  create: 'cases.create',
  read: 'cases.read',
  update: 'cases.update',
} as const

export const casesCapabilities: readonly CapabilityDefinition[] = [
  {
    description: 'Read organization-scoped cases.',
    id: CASES_CAPABILITIES.read,
  },
  {
    description: 'Create cases.',
    id: CASES_CAPABILITIES.create,
    requires: [CASES_CAPABILITIES.read],
  },
  {
    description: 'Update case details.',
    id: CASES_CAPABILITIES.update,
    requires: [CASES_CAPABILITIES.read],
  },
  {
    description: 'Close and reopen cases.',
    id: CASES_CAPABILITIES.close,
    requires: [CASES_CAPABILITIES.read],
  },
]
