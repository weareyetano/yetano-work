# Architecture Decision Records

Architecture Decision Records capture what was decided, why the choice was made, which alternatives
were considered, and what consequences follow. They complement specifications rather than describe
product behavior.

## Statuses

| Status | Meaning |
| --- | --- |
| `Proposed` | Under discussion and not yet binding. |
| `Accepted` | Current architecture policy. |
| `Rejected` | Considered and explicitly not adopted. |
| `Superseded` | Replaced by a newer linked ADR. |

## Naming and maintenance

- Name ADRs `{YYYY-MM-DD}-{descriptive-kebab-case-title}.md` using the record creation date.
- Include Context, Decision, Rationale, Alternatives considered, Consequences, and References.
- State the decision explicitly; rationale alone is insufficient.
- After acceptance, limit edits to corrections and links. Record a changed decision in a new ADR
  and connect both records with `Supersedes` and `Superseded by` links.
- Use Git history instead of a changelog inside each ADR.

## Decision index

| Date | Decision | Status |
| --- | --- | --- |
| 2026-08-19 | [Use Hono for the HTTP API](2026-08-19-hono.md) | Accepted |
| 2026-08-19 | [Use MikroORM for persistence](2026-08-19-mikroorm.md) | Accepted |
| 2026-08-19 | [Expose modules through public entrypoints](2026-08-19-public-module-api.md) | Accepted |
