# Publish domain events through a transactional outbox

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-19 |

## Context

Modules need reliable event-based collaboration without allowing a database write to commit while
its event is lost. Event envelopes also carry sensitive scope: allowing emitters to supply actor or
organization fields would recreate the forged-scope and process-global event-tap risks represented
in open-mercato #5230.

The first deployment should not require a separate broker or worker service.

## Decision

Commands run in one database transaction. Domain handlers may emit events that declare only the
event definition, aggregate identity and version, and payload. The operation executor writes those
events to `platform_outbox_events` in the same transaction as the aggregate change.

The outbox writer derives actor, organization, request correlation, event type, and schema version
from trusted execution context and compile-time event metadata. Callers cannot override those
envelope fields.

An embedded dispatcher claims ready rows with a lease and `FOR UPDATE SKIP LOCKED`, invokes declared
module subscribers, and deletes successfully delivered rows. Failures are retried with bounded
exponential backoff and retained after the retry limit for diagnosis. Delivery is at least once, so
subscribers must be idempotent.

Case lifecycle events are emitted only for committed state changes. Repeating an already completed
close or reopen transition succeeds without producing a duplicate event.

## Rationale

The transactional outbox closes the atomicity gap while PostgreSQL remains the only operational
dependency. Trusted envelope construction prevents forged scope. Compile-time subscriptions keep
event consumers discoverable and avoid process-global hooks.

## Alternatives considered

- In-process publish after commit can lose events on process failure.
- Publishing to a broker inside the database transaction cannot atomically cover both systems
  without additional coordination.
- Database triggers hide domain intent and cannot naturally carry actor and request context.

## Consequences

- Event delivery can occur more than once.
- Subscribers cannot assume immediate delivery in the originating request.
- Operational monitoring must include failed and repeatedly retried outbox rows.
- A separate dispatcher process or broker can be introduced later without changing domain event
  production semantics.

## References

- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Trusted execution context](2026-08-19-trusted-execution-context.md)
- [Cases specification](../../specs/cases.md)
- [open-mercato issue #5230](https://github.com/open-mercato/open-mercato/issues/5230)
