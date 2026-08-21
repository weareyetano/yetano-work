import type { CapabilityDefinition } from '../module.js'

export const CASES_CAPABILITIES = {
  close: 'cases.close',
  create: 'cases.create',
  read: 'cases.read',
  reopen: 'cases.reopen',
  transition: 'cases.transition',
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
    description: 'Resolve and cancel cases.',
    id: CASES_CAPABILITIES.close,
    requires: [CASES_CAPABILITIES.read],
  },
  {
    description: 'Move cases between open statuses.',
    id: CASES_CAPABILITIES.transition,
    requires: [CASES_CAPABILITIES.read],
  },
  {
    description: 'Reopen resolved and canceled cases.',
    id: CASES_CAPABILITIES.reopen,
    requires: [CASES_CAPABILITIES.read],
  },
]
