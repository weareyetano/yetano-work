import type { EntitySchema } from '@mikro-orm/core'
import type { Resolver } from 'awilix'
import type { Hono } from 'hono'
import type { Static, TSchema } from 'typebox'

import type { AppEnvironment } from '../http-types.js'
import type { OperationDefinition } from '../platform/execution/operation.js'

export interface CapabilityDefinition {
  description: string
  id: string
  requires?: readonly string[]
}

export interface EventDefinition<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly _payload?: Payload
  description: string
  id: string
  payloadSchema: TSchema
  schemaVersion: number
}

export function defineEvent<const Schema extends TSchema>(
  definition: Omit<EventDefinition, '_payload' | 'payloadSchema'> & { payloadSchema: Schema },
): EventDefinition<Static<Schema> & Record<string, unknown>> & { payloadSchema: Schema } {
  return definition
}

export interface EventSubscription {
  eventId: string
  handle(envelope: PublishedEventEnvelope): Promise<void>
  id: string
}

export interface PublishedEventEnvelope {
  actorId: string
  actorType: 'system' | 'user'
  aggregateId: string
  aggregateVersion: number
  correlationId: string
  eventId: string
  organizationId: string
  payload: Record<string, unknown>
  schemaVersion: number
  type: string
}

export interface ExtensionMetadata {
  contributes: readonly string[]
  provides: readonly string[]
}

export interface ModuleDefinition {
  capabilities: readonly CapabilityDefinition[]
  dependencies: readonly string[]
  entities: readonly EntitySchema[]
  events: {
    publishes: readonly EventDefinition[]
    subscribes: readonly EventSubscription[]
  }
  extensions: ExtensionMetadata
  id: string
  operations: readonly OperationDefinition<unknown, unknown>[]
  registrations: Record<string, Resolver<unknown>>
  routes(): Hono<AppEnvironment>
}

export function defineModule<const Definition extends ModuleDefinition>(definition: Definition) {
  return definition
}
