# Repository instructions

## Start here

- Read the nearest `AGENTS.md` for the files you change; nested instructions add to this file.
- Read `README.md` before changing architecture, generated code, or deferred technology choices.
- Preserve unrelated work in the working tree. Do not rewrite generated files by hand.
- Keep repository documentation in English.

## Task router

Use the smallest matching repository skill. Open its `SKILL.md` and follow it before acting.

| Task | Skill |
| --- | --- |
| Validate a change, reproduce CI, or report test evidence | `.agents/skills/yetano-verify/SKILL.md` |
| Add or change a typed API capability across contracts, API, client, and web | `.agents/skills/yetano-api-slice/SKILL.md` |
| Review a change without editing it | `.agents/skills/yetano-code-review/SKILL.md` |

Do not load all skills preemptively. For database-only work, follow `apps/api/AGENTS.md` until
the repository has a canonical domain entity worth extracting into a dedicated skill.

## Repository invariants

- Shared TypeBox contracts are the source of truth for public API shapes.
- OpenAPI and `packages/api-client/src/generated` are generated and committed.
- MikroORM entities use `defineEntity`; decorators and `reflect-metadata` are intentionally absent.
- OpenAPI export must not start the server or require a database connection.
- `.agents/skills` is canonical; `.claude/skills` contains metadata-only adapters.
- Do not introduce deferred foundations such as authentication, PWA support, pgvector, a form
  library, or a UI system without an explicit product requirement.

## Verification

- `pnpm check` is the quick repository gate.
- `pnpm verify:full` reproduces the complete CI gate and requires `TEST_DATABASE_URL`.
- `pnpm agents:check` validates this instruction hierarchy and repository skills.
- Report every relevant gate as `PASS`, `FAIL`, or `NOT RUN`; never describe skipped checks as green.

## Git commits

Use Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.

Prefer scopes matching workspace packages or modules: `web`, `api`, `db`, `contracts`,
`api-client`, `core`, or `<module-name>`.

Keep commits atomic. Do not combine unrelated changes. Do not commit failing tests or typecheck
errors. Write commit messages in English, with a lowercase description and no trailing period.
Use `!` for breaking changes, for example:

```text
feat(api)!: change contact response format
```
