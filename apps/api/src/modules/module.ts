import type { EntitySchema } from '@mikro-orm/core'
import type { OrganizationId } from '@yetano/contracts'
import type { Resolver } from 'awilix'
import type { Hono } from 'hono'
import type { Static, TSchema } from 'typebox'

import type { AppEnvironment } from '../http-types.js'
import type { Actor } from '../platform/execution/context.js'
import type { OperationDefinition } from '../platform/execution/operation.js'

export interface CapabilityDefinition {
  description: string
  id: string
  requires?: readonly string[]
}

export interface EventVersionDefinition<
  Version extends number = number,
  Schema extends TSchema = TSchema,
> {
  payloadSchema: Schema
  schemaVersion: Version
}

export interface EventDefinition<
  Id extends string = string,
  Versions extends readonly EventVersionDefinition[] = readonly EventVersionDefinition[],
  CurrentVersion extends Versions[number]['schemaVersion'] = Versions[number]['schemaVersion'],
> {
  description: string
  id: Id
  schemaVersion: CurrentVersion
  versions: Versions
}

export function defineEvent<
  const Id extends string,
  const Versions extends readonly EventVersionDefinition[],
  const CurrentVersion extends Versions[number]['schemaVersion'],
>(definition: EventDefinition<Id, Versions, CurrentVersion>) {
  return definition
}

type VersionOf<Definition extends EventDefinition> = Definition['versions'][number]

type VersionNumberOf<Definition extends EventDefinition> = VersionOf<Definition>['schemaVersion']

type VersionDefinitionOf<
  Definition extends EventDefinition,
  Version extends VersionNumberOf<Definition>,
> = Extract<VersionOf<Definition>, { schemaVersion: Version }>

type PayloadOf<
  Definition extends EventDefinition,
  Version extends VersionNumberOf<Definition>,
> = Static<VersionDefinitionOf<Definition, Version>['payloadSchema']> & Record<string, unknown>

export type CurrentEventPayload<Definition extends EventDefinition> = PayloadOf<
  Definition,
  Definition['schemaVersion']
>

export type PublishedEvent<
  Definition extends EventDefinition = EventDefinition,
  SupportedVersions extends
    readonly VersionNumberOf<Definition>[] = readonly VersionNumberOf<Definition>[],
> = {
  [Version in SupportedVersions[number]]: {
    aggregateId: string
    aggregateVersion: number
    payload: PayloadOf<Definition, Version>
    schemaVersion: Version
    type: Definition['id']
  }
}[SupportedVersions[number]]

export interface EventSubscriptionContext {
  actor: Actor
  correlationId: string
  eventId: string
  occurredAt: Date
  organizationId: OrganizationId
}

export interface EventSubscriptionHandler<
  Definition extends EventDefinition = EventDefinition,
  SupportedVersions extends
    readonly VersionNumberOf<Definition>[] = readonly VersionNumberOf<Definition>[],
> {
  handle(
    event: PublishedEvent<Definition, SupportedVersions>,
    context: EventSubscriptionContext,
  ): Promise<void>
}

export interface EventSubscription<
  Definition extends EventDefinition = EventDefinition,
  SupportedVersions extends
    readonly VersionNumberOf<Definition>[] = readonly VersionNumberOf<Definition>[],
> {
  event: Definition
  handlerRegistration: string
  supportedVersions: SupportedVersions
}

export function defineSubscription<
  const Definition extends EventDefinition,
  const SupportedVersions extends readonly VersionNumberOf<Definition>[],
>(subscription: EventSubscription<Definition, SupportedVersions>) {
  return subscription
}

export function eventSubscriptionId(moduleId: string, eventId: string) {
  return `${moduleId}:${eventId}`
}

export interface ExtensionMetadata {
  contributes: readonly string[]
  provides: readonly string[]
}

export interface ModuleHttpDefinition {
  access: 'protected' | 'public'
  path: `/${string}`
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
  http: ModuleHttpDefinition
  id: string
  operations: readonly OperationDefinition<unknown, unknown>[]
  registrations: Record<string, Resolver<unknown>>
  routes(): Hono<AppEnvironment>
}

export function defineModule<const Definition extends ModuleDefinition>(definition: Definition) {
  return definition
}
