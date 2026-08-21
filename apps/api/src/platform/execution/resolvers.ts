import type { AppConfig } from '../../config.js'
import type {
  Actor,
  ActorResolver,
  CapabilityResolver,
  ExecutionContextFactory,
  OrganizationResolver,
} from './context.js'
import { AuthenticationRequiredError, AuthorizationDeniedError } from './errors.js'

const DEV_CAPABILITIES = new Set([
  'cases.close',
  'cases.create',
  'cases.read',
  'cases.reopen',
  'cases.transition',
  'cases.update',
])
const MAX_CORRELATION_ID_LENGTH = 255

export function createDevActorResolver(): ActorResolver {
  return {
    async resolve() {
      return { id: 'local-dev', type: 'user' }
    },
  }
}

export function createDevCapabilityResolver(): CapabilityResolver {
  return {
    async resolve() {
      return DEV_CAPABILITIES
    },
  }
}

export function createSingleOrganizationResolver({
  config,
}: {
  config: AppConfig
}): OrganizationResolver {
  return {
    async resolve() {
      return config.organizationId
    },
  }
}

export function createExecutionContextFactory({
  actorResolver,
  capabilityResolver,
  organizationResolver,
}: {
  actorResolver: ActorResolver
  capabilityResolver: CapabilityResolver
  organizationResolver: OrganizationResolver
}): ExecutionContextFactory {
  return {
    async create(request, requestId) {
      const actor = await actorResolver.resolve(request)
      if (!actor) throw new AuthenticationRequiredError()
      const organizationId = await organizationResolver.resolve({ actor, request })
      if (!organizationId) throw new AuthorizationDeniedError('organization.scope')
      const capabilities = await capabilityResolver.resolve(actor, organizationId)

      return {
        actor,
        capabilities,
        correlationId: resolveCorrelationId(request, requestId),
        organizationId,
        requestId,
      }
    },
  }
}

export function assertDevelopmentResolversAllowed(config: AppConfig): void {
  if (config.nodeEnv === 'production') {
    throw new Error('Protected modules require an authenticated actor resolver in production.')
  }
}

export function systemActor(id: string): Actor {
  return { id, type: 'system' }
}

function resolveCorrelationId(request: Request, requestId: string): string {
  const correlationId = request.headers.get('x-correlation-id')?.trim()
  if (!correlationId || correlationId.length > MAX_CORRELATION_ID_LENGTH) return requestId
  return correlationId
}
