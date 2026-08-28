import { CASES_CAPABILITIES } from '../cases/index.js'
import type { CapabilityDefinition } from '../module.js'

export const ACTIVITIES_CAPABILITIES = {
  createNote: 'activities.create-note',
  read: 'activities.read',
} as const

export const activitiesCapabilities: readonly CapabilityDefinition[] = [
  {
    description: 'Read activity timelines for accessible cases.',
    id: ACTIVITIES_CAPABILITIES.read,
    requires: [CASES_CAPABILITIES.read],
  },
  {
    description: 'Append notes to activity timelines.',
    id: ACTIVITIES_CAPABILITIES.createNote,
    requires: [ACTIVITIES_CAPABILITIES.read],
  },
]
