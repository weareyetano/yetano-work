---
name: yetano-api-slice
description: Implement a typed Yetano capability through shared contracts, Hono API, generated client, and web consumption. Use when an API operation or its end-to-end vertical slice is added or changed.
---

# Yetano typed API slice

Build one coherent capability through the existing contract-first path. Read the
[Health slice map](references/health-slice.md) only when you need a concrete example or the current
repository layout is unclear; use it for navigation, not as code to copy blindly.

## Workflow

1. Read the root instructions and the nested instructions for every touched workspace.
2. State the operation, success shape, known errors, persistence needs, and compatibility impact.
   Do not invent deferred infrastructure to solve a local feature.
3. Add or update the shared TypeBox schema and exported `Type.Static` type in
   `packages/contracts`. Make required fields and `additionalProperties` deliberate.
4. Implement the API behavior:
   - keep the Hono route focused on transport and OpenAPI metadata;
   - put application behavior in a service;
   - register dependencies explicitly in the Awilix container;
   - use the request-scoped entity manager for database work;
   - return documented `ProblemDetails` for known non-success outcomes.
5. If persistence changes, use `defineEntity`, add a migration, and test the real PostgreSQL path.
   Do not apply the migration to a user's database without explicit authorization.
6. Add focused unit tests and a database integration test when behavior crosses persistence.
7. Run `pnpm api:generate`. Review the OpenAPI and generated client diff; never edit it by hand.
8. When the web consumes the operation, call the generated client through TanStack Query and cover
   loading, error, empty, and success states. Add Playwright coverage for the critical user path.
9. Run the final gates required by the applicable `AGENTS.md` files and report their exact outcomes.

## Completion contract

- The shared schema, OpenAPI operation, service result, generated client, and consumer agree.
- Spec export works without a server listener or database connection.
- Compatibility risks and generated diffs are explicit.
- Database-backed behavior has evidence from an integration suite that actually ran.
- User-visible behavior has production-build and browser evidence.

If the task only changes internal API implementation and does not alter the public operation, skip
contract/client churn and explain why the existing contract remains valid.
