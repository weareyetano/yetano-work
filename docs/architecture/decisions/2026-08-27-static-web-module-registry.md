# Compose web module navigation through a static registry

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-27 |

## Context

The API already composes modules from an explicit list of module descriptors, while the web shell
kept module labels, links, placeholder state, and the active item inside its navigation component.
Adding another web module would therefore require changing feature code, route sources, navigation,
and shell state independently. Deep imports from route sources also bypassed the accepted public
module entrypoint convention.

The web application uses TanStack Router file-based routing. It does not need runtime discovery or
a second mechanism for constructing the generated route tree.

## Decision

Compose web module navigation from one explicit, compile-time registry. An available module owns a
descriptor containing its identifier, label, and root path and exports it through the module's
public `index.ts`. Planned navigation items are declared in the registry without a path. The first
implemented module remains an explicitly selected default rather than an implicit active item.

The web shell derives the active module from the router pathname. Exact module roots and their
nested paths are active; unrelated application routes have no active module. Internal module
navigation uses the router without a full document reload.

TanStack Router route source files remain the source of truth for routes, and its generated route
tree remains generated output. The registry supplies navigation and shell metadata only. Web code
outside a module imports module-owned symbols through the public entrypoint.

Capability-based visibility is deferred until the web application has an authoritative session or
identity contract that supplies the current actor's capabilities. Hiding navigation will complement,
not replace, backend authorization.

## Rationale

One small registry removes repeated shell edits while preserving explicit composition and ordinary
TypeScript imports. Keeping route construction with TanStack Router retains its file-based typing,
code splitting, and generation workflow. A discriminated available/planned state preserves current
product placeholders without treating them as implemented routes.

## Alternatives considered

- Runtime plugin discovery would add lifecycle, loading, and authorization complexity without a
  product requirement.
- Building the route tree from the registry would duplicate or replace TanStack Router's file-based
  composition.
- Keeping navigation metadata inside the navigation component would continue to couple each new
  module to shared presentation code.
- Declaring capability strings before the web app can consume trusted grants would create unused,
  unvalidated metadata duplicated from the API.

## Consequences

- Adding an implemented web module requires a public entrypoint and descriptor, a route source, and
  one registry composition change.
- Navigation order, planned state, and the default module are reviewable in one place.
- Module navigation and the root redirect no longer require module-specific branches.
- Route paths remain present in both the module descriptor and file route declaration; route tests
  and TypeScript navigation calls expose drift without introducing another generator.
- Capability metadata will be added only with the frontend identity integration that consumes it.

## References

- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Public module entrypoints](2026-08-19-public-module-api.md)
- [Web application instructions](../../../apps/web/AGENTS.md)
