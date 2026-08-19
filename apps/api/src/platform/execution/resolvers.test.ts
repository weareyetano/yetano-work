import { describe, expect, it } from 'vitest'

import type { AppConfig } from '../../config.js'
import {
  assertDevelopmentResolversAllowed,
  createDevActorResolver,
  createDevCapabilityResolver,
  createExecutionContextFactory,
  createSingleOrganizationResolver,
} from './resolvers.js'

describe('execution context resolvers', () => {
  it('uses trusted server configuration instead of a caller-supplied organization header', async () => {
    const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb'
    const factory = createExecutionContextFactory({
      actorResolver: createDevActorResolver(),
      capabilityResolver: createDevCapabilityResolver(),
      organizationResolver: createSingleOrganizationResolver({
        config: createConfig('test', organizationId),
      }),
    })

    const context = await factory.create(
      new Request('http://localhost/api/v1/cases', {
        headers: { 'x-organization-id': '98b5d140-f720-4e64-89c3-59adc699cfe0' },
      }),
      'request-id',
    )

    expect(context.organizationId).toBe(organizationId)
    expect(context.actor).toEqual({ id: 'local-dev', type: 'user' })
    expect(context.capabilities.has('cases.close')).toBe(true)
  })

  it('prevents development identity resolvers from protecting production', () => {
    expect(() => assertDevelopmentResolversAllowed(createConfig('production'))).toThrow(
      'Protected modules require an authenticated actor resolver in production.',
    )
  })
})

function createConfig(
  nodeEnv: AppConfig['nodeEnv'],
  organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
): AppConfig {
  return {
    appVersion: 'test',
    databaseUrl: 'postgresql://unused',
    logLevel: 'error',
    nodeEnv,
    organizationId,
    port: 3000,
    staticRoot: '/tmp',
  }
}
