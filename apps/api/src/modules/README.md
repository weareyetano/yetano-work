# API module anatomy

Each module keeps its domain behavior under one directory and exposes one descriptor from its
public `index.ts`. A developer should be able to understand most of a module by reading that
descriptor and the files beside it.

A typical domain module contains:

```text
modules/<module>/
  <module>.module.ts       composition descriptor
  <module>.capabilities.ts authorization vocabulary
  <module>.operations.ts   typed application operations
  <module>.events.ts       published event contracts
  <entity>.entity.ts       owned persistence model
  <entity>.repository.ts   organization-scoped persistence access
  <module>.service.ts      application behavior
  <module>.routes.ts       HTTP and OpenAPI adapter
  index.ts                 public module surface
```

The shape is guidance, not a scaffold contract. Add only files a module needs. A scaffolder is
deferred until a second domain module establishes real repetition.

The module descriptor owns its HTTP base path and declares whether access is `public` or
`protected`. Route factories define paths relative to that base. The composition root creates a
trusted execution context for every protected module, so adding a module never requires a separate
security middleware registration.

Module descriptors are composed explicitly in `modules/index.ts` and validated by the catalog.
Run `pnpm modules:generate` after changing a descriptor and inspect the generated
[`docs/modules`](../../../../../docs/modules/README.md) fact sheet. `pnpm modules:check` detects
stale generated documentation.
