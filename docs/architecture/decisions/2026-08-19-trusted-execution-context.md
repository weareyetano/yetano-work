# Enforce authorization and organization scope through a trusted execution context

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-19 |

## Context

Organization isolation and authorization are cross-cutting invariants. Requiring each route or
service author to remember actor lookup, capability checks, and organization filters creates
fail-open paths. Cross-tenant ID-only loads, nullable organization fallbacks, and workers that forge
scope are recurring security themes in open-mercato #5230.

Authentication is intentionally deferred for the first Yetano Work stage, but protected domain
operations already need a seam that cannot be bypassed when production authentication arrives.

## Decision

Every domain operation executes with an `ExecutionContext` containing a resolved actor, a
server-resolved organization identifier, a capability set, request identity, and correlation
identity. HTTP bodies, paths, and headers cannot select the organization.

Actor, capability, and organization resolution are interfaces wired at the composition root. The
current development and test runtime uses an explicit local actor and a single organization from
the required `ORGANIZATION_ID` configuration. Production server startup fails while those
development resolvers would protect domain modules; production authentication must supply explicit
resolvers first.

The operation executor checks the operation's declared capability, including transitive capability
requirements, before invoking application behavior. Repositories accept the trusted organization
identifier and include it in every case read and list predicate. Background work must construct a
system actor and resolve organization scope through the same trusted seam.

## Rationale

Resolving scope once makes the security boundary testable and prevents transport input from
silently becoming authorization state. Declaring authorization at the operation layer also covers
non-HTTP callers, including future workers and agents.

## Alternatives considered

- Reading an organization header in each route is convenient but caller-controlled and easy to
  omit from downstream queries.
- Passing nullable organization identifiers preserves an "all organizations" mode but encourages
  fail-open query branches.
- Route-only middleware cannot protect direct operation calls from workers or internal tools.

## Consequences

- Public case requests never include organization scope.
- All protected operations require a resolved actor and organization even in development.
- Repository methods expose organization scope explicitly rather than hiding it in ambient state.
- Production deployment remains intentionally blocked until real authentication and authorization
  resolvers are implemented.
- Cross-organization administration will require an explicit, separately authorized operation; it
  cannot be represented by a null organization.

## References

- [Cases specification](../../specs/cases.md)
- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [open-mercato issue #5230](https://github.com/open-mercato/open-mercato/issues/5230)
