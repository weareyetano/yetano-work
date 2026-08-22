---
name: yetano-code-review
description: Review Yetano changes read-only with repository-specific checks, prioritized findings, and a mechanical verdict. Use for PR, branch, commit, or working-tree review; do not edit files or implement fixes.
---

# Yetano code review

Review the requested change, not the whole repository. This workflow is read-only.

## Workflow

1. Read the root and applicable nested `AGENTS.md` files.
2. Establish the review range from the user's target. Otherwise review staged and unstaged changes,
   and identify untracked files with `git status --short`.
3. Read complete changed files and enough callers, tests, contracts, migrations, and generated output
   to verify behavior beyond the diff hunk.
4. Apply every relevant item in the checklist below.
5. Inspect fresh `$yetano-verify` or CI evidence when supplied. Do not call a skipped integration
   suite green. If required evidence is absent, record it separately as a verification gap.
6. Produce findings and the mechanical verdict below.

## Read-only boundary

- Do not edit, format, generate, migrate, commit, or push.
- Do not run commands that can rewrite tracked generated output.
- Read-only Git inspection and tests known not to mutate tracked files are allowed when useful.
- If review and verification are both requested, complete verification as a separate workflow,
  restore no files, then review the resulting working tree and report any side effects.

## Finding standard

Raise a finding only when the change introduces a concrete correctness, security, compatibility,
operability, accessibility, or maintainability problem. Include the triggering scenario and a direct
fix. Prefer one finding per root cause. Do not present style preferences as defects when automated
formatting or repository instructions do not require them.

Absence of findings is not proof of readiness: required verification can still be incomplete.

## Review checklist

Apply only items relevant to the changed paths.

### Contracts and generated API

- Shared TypeBox schema, API response, OpenAPI output, generated client, and consumer agree.
- Required fields, narrowed values, removed fields, and error-shape changes are compatibility-safe.
- Generated output reflects source changes and was not edited as the source of truth.
- Spec export remains independent of a listener and database connection.

### API, dependency injection, and persistence

- Route metadata covers success and known non-success responses with stable operation identifiers.
- Business behavior lives outside transport code and dependencies are registered at the right scope.
- Request-scoped database access cannot leak across requests or tests.
- Entities use `defineEntity`; schema changes include reversible, ordered migrations.
- Integration tests exercise PostgreSQL and are not silently skipped.

### Web and user experience

- The generated client is used instead of duplicate API types or ad hoc requests.
- Loading, error, empty, and success states are reachable and understandable.
- Semantics, labels, keyboard interaction, focus, and error announcements remain accessible.
- Critical changed behavior has an appropriate browser test.

### Cross-cutting

- Inputs, authorization assumptions, secrets, logs, and error details do not create a security leak.
- Tests would fail before the fix and assert behavior rather than implementation trivia.
- The change stays within requested scope and does not introduce deferred platform choices.
- Documentation and committed generated artifacts match runtime behavior.

## Review output

List findings first, ordered by severity:

```text
[BLOCKER|MAJOR|MINOR] Short title
path/to/file.ts:line
Problem: <observable failure and triggering scenario>
Fix: <smallest direct correction>
```

Then report:

```text
Verdict: APPROVE | COMMENT | REQUEST CHANGES | INCOMPLETE
Verification: <PASS/FAIL/NOT RUN evidence, or "not provided">
Residual risk: <one concise statement, or "none identified">
```

- `REQUEST CHANGES`: at least one blocker or major finding, or required verification failed because
  of the change.
- `INCOMPLETE`: no blocker or major finding, but required verification is missing or could not run.
- `COMMENT`: only minor findings and all required verification passed.
- `APPROVE`: no findings and all required verification passed.

If there are no findings, say `No findings.` before the verdict. Keep verification gaps out of the
finding list unless the change itself disabled, skipped, or weakened the gate.
