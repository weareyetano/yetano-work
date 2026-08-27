# Enforce module collaboration through static ports

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-28 |

## Context

The compile-time module catalog validates identities, capabilities, events, and registration
ownership, but dependency injection still exposed one flat application cradle. Module factories
could request any root registration, routes recovered private service types with assertions, and
public entrypoints were protected only by repository instructions. These gaps become material when
a second domain module starts consuming Cases.

## Decision

Module descriptors separate public and private container registrations. Dependencies identify both
the provider module and the public ports consumed from it. Catalog construction rejects missing,
private, wrongly owned, duplicate, unused, or undeclared ports.

Every module registration is created through a typed builder with an explicit dependency list. The
builder supplies only the declared platform services, registrations owned by the module, and public
ports imported through descriptor dependencies. Application cradle types are inferred from module
registration resolvers, while routes resolve their own services through a module-local typed
resolver.

A repository architecture test parses TypeScript imports, re-exports, and dynamic imports. Code may
deep-import only within its owning module; other consumers use the module `index.ts`, and API
cross-module imports require a descriptor dependency.

Awilix still uses one root container and ordinary child scopes. This decision adds static and
factory-level enforcement rather than per-module containers or runtime module discovery.

## Rationale

Explicit ports make collaboration reviewable in the same descriptor that already owns events and
operations. Restricting factory inputs prevents an inherited child scope from silently becoming an
API to unrelated infrastructure or modules. One typed resolver preserves ordinary Awilix lifecycle
behavior without repeating casts in routes.

## Alternatives considered

- Separate containers per module provide a stronger runtime boundary but add scope propagation,
  lifecycle, and transaction coordination that the current monolith does not need.
- Workspace packages enforce imports through package exports but add packaging overhead before the
  module structure is stable.
- Biome restricted-import patterns cannot reliably distinguish same-module relative imports from
  cross-module deep imports at varying directory depths.

## Consequences

- Adding a collaboration port requires an explicit public registration, dependency declaration,
  and typed factory dependency.
- Infrastructure registrations not included in the module platform allowlist remain unavailable to
  module factories.
- Module routes can resolve only registrations owned by their module through the typed helper.
- The root scope still contains flattened registrations, so deliberate bypasses remain visible code
  review violations rather than a security sandbox.

## References

- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Public module entrypoints](2026-08-19-public-module-api.md)
- [Typed idempotent event subscriptions](2026-08-23-typed-idempotent-event-subscriptions.md)
