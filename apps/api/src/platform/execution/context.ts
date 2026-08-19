import type { OrganizationId } from '@yetano/contracts'

export interface Actor {
  id: string
  type: 'system' | 'user'
}

export type CapabilitySet = ReadonlySet<string>

export interface ExecutionContext {
  actor: Actor
  capabilities: CapabilitySet
  correlationId: string
  organizationId: OrganizationId
  requestId: string
}

export interface ActorResolver {
  resolve(request: Request): Promise<Actor | null>
}

export interface OrganizationResolutionInput {
  actor: Actor
  request: Request
}

export interface OrganizationResolver {
  resolve(input: OrganizationResolutionInput): Promise<OrganizationId>
}

export interface CapabilityResolver {
  resolve(actor: Actor, organizationId: OrganizationId): Promise<CapabilitySet>
}

export interface ExecutionContextFactory {
  create(request: Request, requestId: string): Promise<ExecutionContext>
}
