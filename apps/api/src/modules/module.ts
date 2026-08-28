import type { EntitySchema } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OrganizationId } from '@yetano/contracts'
import {
  type AwilixContainer,
  asFunction,
  Lifetime,
  type LifetimeType,
  type Resolver,
} from 'awilix'
import type { Hono } from 'hono'
import type { Static, TSchema } from 'typebox'

import type { AppConfig } from '../config.js'
import type { AppEnvironment } from '../http-types.js'
import type { Logger } from '../logger.js'
import type { Actor } from '../platform/execution/context.js'
import type { OperationDefinition, OperationExecutor } from '../platform/execution/operation.js'

const moduleRegistrationMetadata = Symbol('moduleRegistrationMetadata')
const eventSubscriptionMetadata = Symbol('eventSubscriptionMetadata')

export interface ModulePlatformCradle {
  config: AppConfig
  entityManager: EntityManager
  logger: Logger
  operationExecutor: OperationExecutor
}

export const modulePlatformRegistrationIds = [
  'config',
  'entityManager',
  'logger',
  'operationExecutor',
] as const satisfies readonly (keyof ModulePlatformCradle)[]

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
  handle: (
    event: PublishedEvent<Definition, SupportedVersions>,
    context: EventSubscriptionContext,
  ) => Promise<void>
}

interface EventSubscriptionConfiguration<
  Definition extends EventDefinition = EventDefinition,
  SupportedVersions extends
    readonly VersionNumberOf<Definition>[] = readonly VersionNumberOf<Definition>[],
  HandlerRegistration extends string = string,
> {
  event: Definition
  handlerRegistration: HandlerRegistration
  supportedVersions: SupportedVersions
}

export interface EventSubscription<
  Definition extends EventDefinition = EventDefinition,
  SupportedVersions extends
    readonly VersionNumberOf<Definition>[] = readonly VersionNumberOf<Definition>[],
  HandlerRegistration extends string = string,
> extends EventSubscriptionConfiguration<Definition, SupportedVersions, HandlerRegistration> {
  [eventSubscriptionMetadata]: true
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

export interface ModuleDependency {
  moduleId: string
  ports: readonly string[]
}

interface ModuleRegistrationMetadata {
  dependencies: readonly string[]
}

export interface ModuleRegistration<Value = unknown> extends Resolver<Value> {
  [moduleRegistrationMetadata]: ModuleRegistrationMetadata
}

export type ModuleRegistrationMap = Record<string, ModuleRegistration<unknown>>

export interface ModuleRegistrations<
  Public extends ModuleRegistrationMap = ModuleRegistrationMap,
  Private extends ModuleRegistrationMap = ModuleRegistrationMap,
> {
  private: Private
  public: Public
}

export interface ModuleDefinition<
  Public extends ModuleRegistrationMap = ModuleRegistrationMap,
  Private extends ModuleRegistrationMap = ModuleRegistrationMap,
> {
  capabilities: readonly CapabilityDefinition[]
  dependencies: readonly ModuleDependency[]
  entities: readonly EntitySchema[]
  events: {
    publishes: readonly EventDefinition[]
    subscribes: readonly EventSubscription[]
  }
  extensions: ExtensionMetadata
  http: ModuleHttpDefinition
  id: string
  operations: readonly OperationDefinition<unknown, unknown>[]
  registrations: ModuleRegistrations<Public, Private>
  routes(): Hono<AppEnvironment>
}

export function defineModule<const Definition extends ModuleDefinition>(definition: Definition) {
  return definition
}

type StringKeyOf<Value> = Extract<keyof Value, string>

export function createModuleRegistrationBuilder<Available extends object>() {
  const register = <const Dependencies extends readonly StringKeyOf<Available>[], Value>(
    lifetime: LifetimeType,
    dependencies: Dependencies,
    factory: (cradle: Pick<Available, Dependencies[number]>) => Value,
  ): ModuleRegistration<Value> => {
    const resolver = asFunction((cradle: Available) => {
      const allowed = {} as Pick<Available, Dependencies[number]>
      for (const dependency of dependencies) allowed[dependency] = cradle[dependency]
      return factory(allowed)
    }).setLifetime(lifetime)
    return Object.assign(resolver, {
      [moduleRegistrationMetadata]: { dependencies },
    })
  }

  return {
    scoped: <const Dependencies extends readonly StringKeyOf<Available>[], Value>(
      dependencies: Dependencies,
      factory: (cradle: Pick<Available, Dependencies[number]>) => Value,
    ) => register(Lifetime.SCOPED, dependencies, factory),
    singleton: <const Dependencies extends readonly StringKeyOf<Available>[], Value>(
      dependencies: Dependencies,
      factory: (cradle: Pick<Available, Dependencies[number]>) => Value,
    ) => register(Lifetime.SINGLETON, dependencies, factory),
    transient: <const Dependencies extends readonly StringKeyOf<Available>[], Value>(
      dependencies: Dependencies,
      factory: (cradle: Pick<Available, Dependencies[number]>) => Value,
    ) => register(Lifetime.TRANSIENT, dependencies, factory),
  }
}

type RegistrationValue<Registration> = Registration extends Resolver<infer Value> ? Value : never

type RegistrationKeyForValue<Registrations extends ModuleRegistrationMap, Value> = {
  [Key in StringKeyOf<Registrations>]: RegistrationValue<Registrations[Key]> extends Value
    ? Key
    : never
}[StringKeyOf<Registrations>]

export function defineSubscription<
  const Registrations extends ModuleRegistrationMap,
  const Definition extends EventDefinition,
  const SupportedVersions extends readonly VersionNumberOf<Definition>[],
  const HandlerRegistration extends RegistrationKeyForValue<
    Registrations,
    EventSubscriptionHandler<Definition, SupportedVersions>
  >,
>(
  _registrations: Registrations,
  subscription: EventSubscriptionConfiguration<Definition, SupportedVersions, HandlerRegistration>,
) {
  return Object.assign(subscription, { [eventSubscriptionMetadata]: true as const })
}

type RegistrationCradle<Registrations extends ModuleRegistrationMap> = {
  [Key in keyof Registrations]: RegistrationValue<Registrations[Key]>
}

export type ModuleCradle<Definition extends ModuleDefinition> = RegistrationCradle<
  Definition['registrations']['public']
> &
  RegistrationCradle<Definition['registrations']['private']>

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never

export type ModulesCradle<Modules extends readonly ModuleDefinition[]> = UnionToIntersection<
  ModuleCradle<Modules[number]>
>

export function createModuleResolver<const Registrations extends ModuleRegistrations>(
  _registrations: Registrations,
) {
  type Cradle = RegistrationCradle<Registrations['public']> &
    RegistrationCradle<Registrations['private']>

  return function resolveModuleRegistration<
    ContainerCradle extends object,
    Key extends StringKeyOf<Cradle>,
  >(container: AwilixContainer<ContainerCradle>, key: Key): Cradle[Key] {
    return container.resolve<Cradle[Key]>(key)
  }
}

export function moduleRegistrations(module: ModuleDefinition) {
  return { ...module.registrations.public, ...module.registrations.private }
}

export function moduleRegistrationDependencies(registration: ModuleRegistration) {
  return registration[moduleRegistrationMetadata].dependencies
}
