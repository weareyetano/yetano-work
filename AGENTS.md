# Repository instructions

## Start here

- Read the nearest `AGENTS.md` for the files you change; nested instructions add to this file.
- Read `README.md` before changing architecture, generated code, or deferred technology choices.
- Preserve unrelated work in the working tree. Do not rewrite generated files by hand.
- Keep repository documentation in English.

## Documentation model

- Read `docs/README.md` before making a significant domain or architecture change.
- Keep `docs/specs` focused on what the product does and how it behaves. Update the relevant spec
  when an accepted or implemented behavior changes.
- Use `docs/architecture/decisions` to record durable architecture decisions, their rationale, and
  their consequences. Supersede an accepted decision with a new ADR instead of rewriting its history.
- Small bug fixes, typo-only changes, and behavior-preserving refactors do not require a spec or ADR.

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

## Worktrees

- Use one task and one writer per worktree. Start isolated work from a fresh base and do not create
  a worktree from inside another worktree.
- Run `pnpm worktree:setup` after creating a worktree. Keep environment files and secrets local to
  the checkout that owns the runtime.
- Code changes and `pnpm check` may run concurrently in separate worktrees. Only one checkout may
  own the shared Docker, API, and web runtime at a time; the primary checkout owns it by default.
- Transfer runtime ownership only after stopping the previous stack. Preserve unfinished work and
  never force-remove or force-clean a worktree unless explicitly requested.

## Branches and pull requests

- Use one short-lived topic branch per task, paired with its isolated worktree. Read-only tasks do
  not require a branch.
- Reuse the current topic branch when the environment already created one. Otherwise base new work
  on the latest verified `origin/main`; never switch or repurpose the primary checkout.
- Name branches `<type>/<kebab-case-summary>`, using the same types as Conventional Commits. Include
  the issue number when one exists, for example `fix/123-contact-import`.
- Before creating a branch, inspect the working tree, worktree list, local and remote refs, and any
  existing pull request. Stop on a collision; never reset or overwrite an existing branch.
- Do not push or create, update, or merge a pull request unless the user explicitly requests
  publication. Reuse an existing pull request for the branch, target `main`, and keep incomplete
  work in draft status.
- Never force-push, rewrite published history, bypass hooks, or delete a branch or worktree with
  unpreserved work.

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
