# Repository instructions

## Working agreements

- For every file you change, read and follow the nearest `AGENTS.md`; nested instructions extend
  this file.
- Read `README.md` before changing architecture, generated code, or deferred technology choices.
- Preserve unrelated working-tree changes. Never hand-edit generated files.
- Keep repository documentation in English.

## Documentation

- Read `docs/README.md` before a significant domain or architecture change.
- Keep behavior in `docs/specs`; update the relevant spec when accepted behavior changes.
- Record durable architecture choices in `docs/architecture/decisions`. Supersede accepted ADRs
  instead of rewriting them.
- Small fixes, typos, and behavior-preserving refactors need neither a spec nor an ADR.

## Invariants

- Shared TypeBox contracts are the source of truth for public API shapes.
- OpenAPI and `packages/api-client/src/generated` are generated and committed.
- MikroORM entities use `defineEntity`; decorators and `reflect-metadata` remain absent.
- OpenAPI export must not start the server or require a database connection.
- `.agents/skills` is canonical; `.claude/skills` contains metadata-only adapters.
- Do not add authentication, PWA support, pgvector, a form library, or other deferred foundations
  without an explicit product requirement.

## Verification

- Run `pnpm agents:check` for agent assets, `pnpm check` for code, and `pnpm verify:full` for CI
  parity or pre-PR verification. The full gate loads the workspace `.env`, requires an explicit,
  dedicated `TEST_DATABASE_URL`, and rejects reuse of `DATABASE_URL`.
- Add integration, generated API, build, and browser gates when the changed surface requires them.
- Report each relevant gate as `PASS`, `FAIL`, or `NOT RUN`; skipped checks are never green.
- Shared Docker, API, and web runtime commands may run only in the checkout that owns the runtime.

## Worktrees, branches, and publication

- Use one task, writer, short-lived topic branch, and isolated worktree together. Read-only work
  needs no branch. Create worktrees from a fresh base, never from inside another worktree.
- A Codex-managed Worktree chat already satisfies the isolation requirement; never create another
  worktree from inside it. Use Open or the integrated terminal to inspect it, and use Handoff to
  Local when work must continue in the primary checkout or use its shared runtime.
- Reuse the current task's existing topic branch. Otherwise start from the latest verified
  `origin/main` without switching or repurposing the primary checkout, then run
  `pnpm worktree:setup`.
- Before creating a branch, inspect the working tree, worktrees, refs, and existing PRs. Stop on a
  collision; never reset or overwrite existing work.
- Name branches `<type>/<kebab-case-summary>` and include an issue number when available, for example
  `fix/123-contact-import`.
- The primary checkout owns the shared runtime by default. Transfer ownership only after stopping
  the previous stack; keep environment files and secrets local to the owner checkout.
- Unless explicitly requested, never force-clean/remove a worktree. Never force-push, rewrite
  published history, bypass hooks, or delete unpreserved work.
- Push or create, update, or merge a PR only when explicitly requested. Reuse the branch PR, target
  `main`, and keep incomplete work in draft status.

## Commits

- Use atomic English Conventional Commits: `<type>(<scope>): <lowercase description>` with no
  trailing period.
- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.
- Prefer scopes `web`, `api`, `db`, `contracts`, `api-client`, `core`, or the module name; add `!` for
  breaking changes.
- Do not combine unrelated work or commit failing tests or typecheck errors.
