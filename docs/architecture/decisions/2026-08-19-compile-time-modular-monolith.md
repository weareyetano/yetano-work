# Compose the application as a compile-time modular monolith

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-19 |

## Context

Yetano Work needs modules that are easy to discover and change without turning the application into
a process-global plugin system. A module must make its operations, capabilities, events,
persistence, routes, dependencies, and extension metadata visible in one place. Missing or invalid
links should fail during application composition rather than on a production request.

The issue clusters reviewed in open-mercato #5230 show recurring failures caused by implicit ACL
dependencies, unscoped helpers, deep cross-module imports, and process-global extension hooks. The
architecture should make those relationships reviewable while the codebase is still small.

## Decision

Use a compile-time modular monolith. Every API module exports one `ModuleDefinition` from its public
entrypoint. The application composition root imports an explicit module list and builds a validated
catalog from it.

A descriptor declares:

- module dependencies;
- capabilities and their inherited requirements;
- operations and the capability required by each operation;
- owned ORM entities and container registrations;
- published events and subscriptions;
- provided and consumed extension-point metadata;
- the module route factory.

Catalog construction rejects duplicate identifiers, unknown dependencies, undeclared capability or
event references, unknown extension points, and cyclic module dependencies. Extension points are
metadata only: there is no runtime module discovery or mutable global registry.

Keep implementation details inside `apps/api/src/modules/<module>`. Cross-module consumers import
only the public `index.ts`. A scaffolder remains deferred until a second domain module demonstrates
which structure is genuinely repeated.

## Rationale

An explicit descriptor gives developers and tools a compact map of a module without sacrificing
ordinary TypeScript navigation. Static composition preserves refactorability and startup
predictability. Validation catches the dependency and authorization declaration drift represented
in several #5230 issue clusters before a handler can run.

## Alternatives considered

- Runtime plugin discovery supports independently installed modules but adds ordering, lifecycle,
  security, and debugging complexity that the product does not require.
- Convention-only folders are initially simple but cannot validate dependencies, capabilities, or
  event contracts.
- A workspace package per module creates stronger build boundaries at substantially greater
  packaging cost for the current repository size.

## Consequences

- Adding a module requires one explicit composition-root change.
- A developer can inspect the descriptor and module directory for most module behavior.
- The generated module catalog can be checked for drift in CI.
- Dynamic third-party modules are not supported by this decision.
- Extension metadata can evolve into typed composition hooks only when a concrete use case exists.

## References

- [Public module entrypoints](2026-08-19-public-module-api.md)
- [Generated module catalog](../../modules/README.md)
- [open-mercato issue #5230](https://github.com/open-mercato/open-mercato/issues/5230)
