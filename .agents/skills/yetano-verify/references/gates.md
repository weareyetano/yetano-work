# Gate profiles

Choose profiles from the diff and requested confidence level. Profiles are additive.

| Change | Required commands |
| --- | --- |
| Agent instructions or skills only | `pnpm agents:check` |
| Documentation only | targeted document checks; `pnpm agents:check` when agent assets changed |
| Application or package code | `pnpm check` |
| API contract or route | `pnpm check`, including `pnpm api:check` |
| Database-backed API behavior | `pnpm check`, then `pnpm test:integration` |
| User-visible web behavior | `pnpm check`, `pnpm build`, then the relevant `pnpm test:e2e` path |
| CI parity or pre-PR | `pnpm verify:full` |

The full gate checks `TEST_DATABASE_URL` before doing work, then runs lint, agent asset validation,
typecheck, unit tests, integration tests, generated API consistency, build, and end-to-end tests.

## Report format

```text
Verification
- PASS — pnpm agents:check
- FAIL — pnpm test: <short failure and relevant file>
- NOT RUN — pnpm test:integration: TEST_DATABASE_URL is not set

Overall: PASS | FAIL | INCOMPLETE
Working tree impact: none | <generated or unexpected paths>
```

`PASS` means exit code zero and no required suite was silently skipped. `FAIL` means the command ran
and failed or produced an unexpected tracked diff. `NOT RUN` means a required command could not be
executed. Overall status is `INCOMPLETE` whenever a required gate is `NOT RUN`.
