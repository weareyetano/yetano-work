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
| 2026-08-19 | [Compose the application as a compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md) | Accepted |
| 2026-08-19 | [Enforce authorization and organization scope through a trusted execution context](2026-08-19-trusted-execution-context.md) | Accepted |
| 2026-08-19 | [Publish domain events through a transactional outbox](2026-08-19-transactional-domain-events.md) | Accepted |
| 2026-08-20 | [Use shadcn/ui with React Aria for the web UI](2026-08-20-shadcn-react-aria-ui.md) | Accepted |
| 2026-08-21 | [Identify case lifecycle transitions with client-generated command IDs](2026-08-21-idempotent-case-lifecycle-transitions.md) | Accepted |
| 2026-08-22 | [Declare HTTP access in module descriptors](2026-08-22-declarative-module-http-access.md) | Accepted |
| 2026-08-23 | [Process module events through typed idempotent subscriptions](2026-08-23-typed-idempotent-event-subscriptions.md) | Accepted |
| 2026-08-27 | [Compose web module navigation through a static registry](2026-08-27-static-web-module-registry.md) | Accepted |
| 2026-08-28 | [Enforce module collaboration through static ports](2026-08-28-static-module-ports.md) | Accepted |
