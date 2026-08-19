---
name: yetano-verify
description: Verify Yetano changes with the smallest sufficient repository gate and explicit evidence. Use for testing, validation, CI readiness, or proving that a change works; do not use as a substitute for code review.
---

# Yetano verification

Prove the changed behavior without turning skipped checks into a green result.

## Workflow

1. Read the root and nearest nested `AGENTS.md` files.
2. Inspect `git status --short`, `git diff --stat`, and the relevant diff. Preserve all existing work.
3. Select every applicable profile from [Gate profiles](references/gates.md).
4. Run gates in the documented order. Stop a dependent gate after its prerequisite fails, but run
   independent useful checks when safe.
5. Recheck `git status --short`. Generated API checks may expose stale committed output; do not hide
   or revert that evidence.
6. Report the exact command and `PASS`, `FAIL`, or `NOT RUN` for each required gate.

## Rules

- Use `pnpm check` as the default quick gate for code changes.
- Use `pnpm verify:full` for pre-PR, CI parity, or an explicit full-verification request.
- API or database behavior requires `pnpm test:integration` with `TEST_DATABASE_URL` set. If the
  variable or database is unavailable, report `NOT RUN`; never infer success from Vitest skips.
- User-visible web behavior requires a production build and the relevant Playwright path.
- Contract or route changes require `pnpm api:check`; generated diffs are a failure until reviewed
  and intentionally included.
- Do not start Docker, apply migrations, install browsers, or change external state unless the task
  authorizes that setup. Report the blocked gate and the exact prerequisite instead.
- A passing unrelated test does not compensate for a required gate that was not run.

## Example

For a database-backed API endpoint with no UI change, run the quick gate and integration profile.
Report end-to-end tests as not required, not as passed. If `TEST_DATABASE_URL` is missing, the final
status is incomplete even when `pnpm check` passes.
