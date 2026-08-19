# Health slice map

The current health capability is the smallest working example of the repository's typed path:

| Concern | Canonical example |
| --- | --- |
| Shared success and error schemas | `packages/contracts/src/index.ts` |
| Hono route and OpenAPI metadata | `apps/api/src/modules/health/health.routes.ts` |
| Database-backed service | `apps/api/src/modules/health/health.service.ts` |
| Dependency registration | `apps/api/src/container.ts` |
| OpenAPI export | `apps/api/src/openapi.ts` |
| Generated document and client | `packages/api-client/openapi` and `packages/api-client/src/generated` |
| Web consumer | `apps/web/src/routes/index.tsx` |

Trace the actual imports and tests before implementing because paths can evolve. Preserve these
properties rather than copying file contents:

- the route declares a stable operation and all response schemas;
- the service owns the PostgreSQL readiness check;
- the dependency is resolved from request scope;
- the generated client is the browser-facing API boundary;
- unit, integration, and browser tests cover distinct layers.
