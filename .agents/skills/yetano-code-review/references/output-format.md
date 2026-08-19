# Review output

List findings first, ordered by severity. Each finding must use this shape:

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

Mechanical verdict rules:

- `REQUEST CHANGES`: at least one blocker or major finding, or required verification failed because
  of the change.
- `INCOMPLETE`: no blocker/major finding, but required verification is missing or could not run.
- `COMMENT`: only minor findings and all required verification passed.
- `APPROVE`: no findings and all required verification passed.

If there are no findings, say `No findings.` before the verdict. Keep verification gaps out of the
finding list unless the change itself disabled, skipped, or weakened the gate.
