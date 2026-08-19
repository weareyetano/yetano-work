# API instructions

These instructions extend the repository root `AGENTS.md` for `apps/api`.

- Keep routes thin: declare HTTP/OpenAPI behavior, resolve a scoped service, and translate known
  failures to `ProblemDetails` responses.
- Put reusable application behavior in services and register dependencies explicitly in
  `src/container.ts`. Database work must use the request-scoped `EntityManager`/`RequestContext`.
- Define public request and response schemas in `packages/contracts`; do not duplicate them locally.
- Every public route needs a stable `operationId`, response descriptions, TypeBox schemas, and
  explicit non-success responses.
- Keep OpenAPI export side-effect free: importing the app/spec path must not listen on a port or
  connect to PostgreSQL.
- Define MikroORM entities with `defineEntity`. Add migrations for schema changes, but do not apply
  migrations to a user's database unless requested.
- Place fast behavior tests beside the module. Add an integration test for database-backed behavior
  and prove that it actually ran with `TEST_DATABASE_URL`.
- After contract or route changes, run `pnpm api:generate` and commit the generated OpenAPI/client
  changes. Never edit generated output manually.

For a vertical API change, use `.agents/skills/yetano-api-slice/SKILL.md`. For final evidence, use
`.agents/skills/yetano-verify/SKILL.md`.
