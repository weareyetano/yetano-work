# Declare HTTP access in module descriptors

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-22 |

## Context

The application composition root creates request scopes for all versioned API routes, but trusted
execution context middleware was registered only for the Cases path. Adding another protected
module would mount its routes without resolving an actor, organization, or capabilities unless its
author also changed application infrastructure. The development capability resolver likewise
listed Cases capabilities manually.

These parallel registration steps make protected module composition fail open and conflict with
the existing decisions to expose module metadata explicitly and resolve authorization state at a
trusted boundary.

## Decision

Every `ModuleDefinition` declares an HTTP base path and an access classification of `public` or
`protected`. Module route factories define paths relative to that base path. The catalog rejects
invalid or overlapping base paths and rejects public modules that declare capabilities or
capability-protected operations.

The application composition root mounts each module at its declared path. It wraps every protected
module with the same middleware, which creates the trusted `ExecutionContext` and centrally maps
authentication and authorization failures to 401 and 403 problem responses. Public modules are
mounted without actor or organization resolution. Request-scoped infrastructure remains available
to both access classes.

The local development capability resolver receives all capability identifiers from the validated
application module catalog. Production continues to require explicitly supplied actor,
organization, and capability resolvers.

## Rationale

Co-locating HTTP access with the rest of the module descriptor makes the security boundary visible
and gives the composition root enough information to apply it uniformly. An explicit base path
lets middleware protect exactly one module instead of relying on broad route patterns or inspecting
router internals. Deriving the permissive local role from the catalog keeps development useful as
new modules are added while preserving the production resolver boundary.

## Alternatives considered

- Registering one middleware path per module in `app.ts` repeats security-sensitive infrastructure
  work and is easy to omit.
- Treating every API route as protected would force public health and future public modules through
  identity resolution.
- Inferring access from whether operations declare capabilities cannot represent an actor-scoped
  module with capability-free operations and makes transport policy implicit.
- Maintaining an explicit local capability list duplicates the catalog and requires synchronized
  edits for every module.

## Consequences

- Adding a protected module requires one descriptor entry but no security middleware change.
- Public modules cannot expose operations guarded by catalog capabilities.
- Module HTTP base paths cannot overlap, preventing one module's middleware from capturing another.
- Local development actors automatically receive newly declared application capabilities.
- Route factories are portable subrouters and no longer own the `/api/v1` or module base prefix.

## References

- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Trusted execution context](2026-08-19-trusted-execution-context.md)
- [Generated module catalog](../../modules/README.md)
