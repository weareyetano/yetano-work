---
name: yetano-verify
description: Verify existing Yetano changes with repository-specific gates and explicit evidence. Use when the primary request is to verify a branch or working tree, reproduce CI, assess CI readiness, or report test evidence; do not invoke only because implementation includes routine checks, and do not use as a substitute for code review.
---

# Yetano verification

Prove the changed behavior without turning skipped checks into a green result.

## Workflow

1. Read the root and nearest nested `AGENTS.md` files.
2. Inspect `git status --short`, `git diff --stat`, and the relevant diff. Preserve all existing work.
3. Select every applicable gate profile below.
4. Run gates in the documented order. Stop a dependent gate after its prerequisite fails, but run
   independent useful checks when safe.
5. Recheck `git status --short`. Generated API checks may expose stale committed output; do not hide
   or revert that evidence.
6. Report the exact command and `PASS`, `FAIL`, or `NOT RUN` for each required gate.

## Rules

- `pnpm check` may run in any isolated worktree. Commands that start or use the shared Docker, API,
  or web runtime may run only in the current runtime owner's checkout.
- The primary checkout owns the runtime by default. Transfer ownership only after stopping the
  previous stack; otherwise report runtime-dependent gates as `NOT RUN` with that reason.
- Do not start Docker, apply migrations, install browsers, or change external state unless the task
  authorizes that setup. Report the blocked gate and the exact prerequisite instead.
- A passing unrelated test does not compensate for a required gate that was not run.

## Gate profiles

Profiles are additive.

| Change | Required commands |
| --- | --- |
| Agent instructions or skills only | `pnpm agents:check` |
| Documentation only | targeted document checks; `pnpm agents:check` when agent assets changed |
| Application or package code | `pnpm check` |
| API contract or route | `pnpm check`, including `pnpm api:check` |
| Database-backed API behavior | `pnpm check`, then `pnpm test:integration` |
| User-visible web behavior | `pnpm check`, `pnpm build`, then the relevant `pnpm test:e2e` path |
| CI parity or pre-PR | `pnpm verify:full` |

If `TEST_DATABASE_URL` or the database is unavailable, a required integration gate is `NOT RUN`;
never infer success from Vitest skips. Generated API diffs fail until reviewed and intentionally
included.

The full gate checks `TEST_DATABASE_URL` before running lint, agent asset validation, typecheck,
unit and integration tests, generated API and module catalog consistency, build, and end-to-end tests.

## Report format

```text
Verification
- PASS — pnpm agents:check
- FAIL — pnpm test: <short failure and relevant file>
- NOT RUN — pnpm test:integration: TEST_DATABASE_URL is not set

Overall: PASS | FAIL | INCOMPLETE
Working tree impact: none | <generated or unexpected paths>
```

`PASS` requires exit code zero with no required suite silently skipped. `FAIL` means the command
failed or produced an unexpected tracked diff. `NOT RUN` means a required command could not execute.
Overall status is `INCOMPLETE` whenever a required gate is `NOT RUN`.

## Example

For a database-backed API endpoint with no UI change, run the quick gate and integration profile.
Report end-to-end tests as not required, not as passed. If `TEST_DATABASE_URL` is missing, the final
status is incomplete even when `pnpm check` passes.
