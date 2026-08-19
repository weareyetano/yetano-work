# Expose modules through public entrypoints

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-19 |

## Context

Application modules group routes, services, entities, and other feature-owned implementation. If
code outside a module imports arbitrary internal files, those paths become accidental contracts and
make later refactoring, extraction, and dependency analysis harder.

The repository is still small, so the boundary should be established before domain modules create a
large network of deep imports.

## Decision

Every application module exposes its supported collaboration surface from a root `index.ts` file.
Code outside that module—including application composition roots—imports module-owned symbols only
through this entrypoint. Symbols not exported there are private implementation details.

Code within the same module may use direct relative imports. Module-local unit tests may also import
internals when they intentionally test a private unit; tests outside the module use the public
entrypoint.

Keep the public surface minimal and intentional. This convention does not create a workspace package
for every module and does not replace package-level `exports`. Shared public HTTP shapes continue to
come from `@yetano/contracts`, while the web application consumes operations through
`@yetano/api-client`.

## Rationale

A single module entrypoint makes dependencies visible and prevents internal layout from becoming a
cross-module contract. It leaves modules easy to reorganize and provides a clear place to review
which services, route factories, types, and integration hooks are intentionally shared.

## Alternatives considered

- Unrestricted deep imports require no entrypoint maintenance but make module internals effectively
  public and increase coupling.
- A separate workspace package for every module creates stronger tooling boundaries but adds
  packaging and build overhead that is not justified at the current scale.

## Consequences

- Adding or removing a public module capability requires an explicit `index.ts` export change.
- Internal files may move without updating consumers as long as the entrypoint remains stable.
- Entrypoints must avoid broad wildcard exports that expose implementation details accidentally.
- Circular dependencies become easier to identify but still require design attention.
- The existing health module receives the first public entrypoint, and its external imports move to
  that surface as part of accepting this decision.

## References

- [Repository layout](../../../README.md#technical-foundation)
- [API repository instructions](../../../apps/api/AGENTS.md)
- [Public API contracts](../../../packages/contracts/src/index.ts)
