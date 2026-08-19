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
4. Apply every relevant item in [Review checklist](references/checklist.md).
5. Inspect fresh `$yetano-verify` or CI evidence when supplied. Do not call a skipped integration
   suite green. If required evidence is absent, record it separately as a verification gap.
6. Produce findings and the mechanical verdict from [Output format](references/output-format.md).

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
