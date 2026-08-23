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

The outbox is a delivery queue, not an event store. An event with no declared subscribers is
considered successfully dispatched and is deleted. Adding a subscription does not replay events
that the dispatcher has already removed. A module that needs a historical projection owns an
explicit backfill from the authoritative domain history and must define an idempotent cutover to
live event delivery. The source and mechanism for that backfill are decided with the consuming
module rather than added to the generic outbox contract.

Case lifecycle events are emitted only for committed state changes. Their retry identity is defined
by [client-generated lifecycle command IDs](2026-08-21-idempotent-case-lifecycle-transitions.md),
which supersede the earlier close/reopen retry rule while preserving the outbox guarantees here.

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
- New subscriptions receive only events still eligible for delivery in the outbox. Historical
  projections require an explicit module-owned backfill and are not reconstructed from the outbox.
- Operational monitoring must include failed and repeatedly retried outbox rows.
- A separate dispatcher process or broker can be introduced later without changing domain event
  production semantics.

## References

- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Trusted execution context](2026-08-19-trusted-execution-context.md)
- [Cases specification](../../specs/cases.md)
- [Idempotent case lifecycle transitions](2026-08-21-idempotent-case-lifecycle-transitions.md)
- [Typed idempotent event subscriptions](2026-08-23-typed-idempotent-event-subscriptions.md)
- [open-mercato issue #5230](https://github.com/open-mercato/open-mercato/issues/5230)
