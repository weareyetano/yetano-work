import type { AwilixContainer } from 'awilix'
import Type from 'typebox'

import type { Cradle } from '../container.js'
import {
  createModuleRegistrationBuilder,
  createModuleResolver,
  defineEvent,
  defineSubscription,
  type EventSubscription,
  type EventSubscriptionContext,
  type ModulePlatformCradle,
  type PublishedEvent,
} from './module.js'

interface ExampleCradle {
  exampleEventHandler: {
    handle: (
      event: PublishedEvent<typeof exampleEvent, readonly [1, 2]>,
      context: EventSubscriptionContext,
    ) => Promise<void>
  }
  examplePort: { read(): string }
  exampleService: { execute(): string }
  invalidEventHandler: { run(): Promise<void> }
  latestEventHandler: {
    handle: (
      event: PublishedEvent<typeof exampleEvent, readonly [2]>,
      context: EventSubscriptionContext,
    ) => Promise<void>
  }
}

const registerExample = createModuleRegistrationBuilder<ModulePlatformCradle & ExampleCradle>()
const exampleEvent = defineEvent({
  description: 'Event used to verify module subscription types.',
  id: 'example.updated',
  schemaVersion: 2,
  versions: [
    { payloadSchema: Type.Object({ legacyValue: Type.String() }), schemaVersion: 1 },
    { payloadSchema: Type.Object({ value: Type.String() }), schemaVersion: 2 },
  ],
})

const exampleRegistrations = {
  private: {
    exampleEventHandler: registerExample.scoped([], () => ({
      handle: async (
        _event: PublishedEvent<typeof exampleEvent, readonly [1, 2]>,
        _context: EventSubscriptionContext,
      ) => {},
    })),
    exampleService: registerExample.scoped(['examplePort'], ({ examplePort }) => ({
      execute: () => examplePort.read(),
    })),
    invalidEventHandler: registerExample.scoped([], () => ({ run: async () => {} })),
    latestEventHandler: registerExample.scoped([], () => ({
      handle: async (
        _event: PublishedEvent<typeof exampleEvent, readonly [2]>,
        _context: EventSubscriptionContext,
      ) => {},
    })),
  },
  public: {
    examplePort: registerExample.scoped([], () => ({ read: () => 'example' })),
  },
}

const resolveExampleRegistration = createModuleResolver(exampleRegistrations)

export function assertModuleRegistrationTypes(container: AwilixContainer<Cradle>) {
  resolveExampleRegistration(container, 'exampleService').execute()

  // @ts-expect-error Subscriptions must be created through the registration-aware builder.
  const directSubscription: EventSubscription<typeof exampleEvent, readonly [1, 2]> = {
    event: exampleEvent,
    handlerRegistration: 'invalidEventHandler',
    supportedVersions: [1, 2],
  }
  void directSubscription

  defineSubscription(exampleRegistrations.private, {
    event: exampleEvent,
    handlerRegistration: 'exampleEventHandler',
    supportedVersions: [1, 2],
  })

  defineSubscription(exampleRegistrations.private, {
    event: exampleEvent,
    // @ts-expect-error A subscription registration must resolve to an event handler.
    handlerRegistration: 'invalidEventHandler',
    supportedVersions: [1, 2],
  })

  defineSubscription(exampleRegistrations.private, {
    event: exampleEvent,
    // @ts-expect-error A handler must accept every version declared by its subscription.
    handlerRegistration: 'latestEventHandler',
    supportedVersions: [1, 2],
  })

  // @ts-expect-error Root infrastructure is not available to module factories.
  registerExample.scoped(['orm'], () => ({ execute: () => 'invalid' }))

  // @ts-expect-error A module-local resolver cannot access another module registration.
  resolveExampleRegistration(container, 'casesService')
}
