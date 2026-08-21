# Identify case lifecycle transitions with client-generated command IDs

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-21 |

## Context

Case status changes use optimistic concurrency, but an expected aggregate version cannot also
identify a retry. A server may commit a transition and lose the response; retrying with the old
version must return the committed result, while treating the current target status as sufficient
would lose the identity, actor, note, and exact outcome of the original command.

Lifecycle outcomes also need a durable audit trail. Reconstructing them from the current case row or
from outbox retention would conflate current state, integration delivery, and business history.

## Decision

Every runtime status-change command carries a client-generated UUID `transitionId`. The API stores
an immutable `CaseStatusChange` in the same transaction as the optimistic case update and the
`case.transitioned` outbox event. The database enforces uniqueness on organization and transition
identifier.

Before checking the expected version, the command looks up that identifier. An exact replay returns
the first stored status-change result. Reuse for a different case, version, source status, target
status, or normalized note returns a typed conflict. Concurrent requests recover the committed
record after either the history uniqueness constraint or the aggregate optimistic lock rejects the
losing transaction.

Case creation writes a history entry without a transition identifier and continues to publish only
`case.created`. Migration-created entries are marked with migration source and do not publish
outbox events. Authorization remains operation-specific: open-to-open, close, and reopen commands
require separate capabilities even though they share one HTTP endpoint.

This decision supersedes the case-specific close/reopen retry rule in
[Publish domain events through a transactional outbox](2026-08-19-transactional-domain-events.md).
The transactional outbox decision otherwise remains in force.

## Rationale

A command identifier makes retries independent of the aggregate's later state and preserves the
first command's complete result. Persisting history as domain data gives it retention and query
semantics independent of the integration outbox. Organization-scoped uniqueness prevents tenant
collisions without requiring globally coordinated clients.

## Alternatives considered

- Treating an already-current target status as success cannot prove which command produced it and
  may return the wrong actor or note.
- Ignoring the expected version on retries weakens concurrency protection without identifying the
  original command.
- Using only an HTTP idempotency cache makes correctness depend on cache retention and does not
  provide durable lifecycle history.
- Giving every status change one broad capability would let routine workflow access imply close or
  reopen authority.

## Consequences

- Clients must generate one UUID per user intent and reuse it only when retrying that intent.
- Status changes add one immutable history row and one uniqueness check.
- Transition results remain stable even when the case has since changed again.
- History retention is part of domain persistence rather than outbox operations.
- Adding future terminal reasons such as duplicate or won't-do requires an explicit schema and
  migration decision; existing cancellation notes cannot classify old records reliably.

## References

- [Cases specification](../../specs/cases.md)
- [Transactional domain events](2026-08-19-transactional-domain-events.md)
- [Trusted execution context](2026-08-19-trusted-execution-context.md)
