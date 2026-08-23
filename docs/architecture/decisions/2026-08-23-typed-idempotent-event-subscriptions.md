# Process module events through typed idempotent subscriptions

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-23 |

## Context

The transactional outbox reliably stores module events, but reliable storage alone is not a safe
consumer contract. String-only subscriptions and unvalidated payloads defer version mistakes to
handler code. Process-level handlers also need trusted organization, actor, correlation, and time
metadata without reconstructing it from payloads.

At-least-once delivery can repeat a handler that already completed when a later handler fails. A
consumer needs a durable identity and an inbox transaction boundary before Activities or another
module can maintain a projection safely.

## Decision

Every published event is a named contract that declares its current schema version and the TypeBox
payload schema for every retained version. Modules subscribe with `defineSubscription`, importing
the publisher's contract object and explicitly listing supported versions. The module catalog
rejects unknown contracts, missing or duplicate versions, undeclared publisher dependencies, and
duplicate subscriptions. A stable subscription identity is derived as `<moduleId>:<eventId>`.

Before calling a handler, the dispatcher selects the declared schema version and validates the
payload at runtime. It creates a child dependency-injection scope for the delivery and supplies a
controlled context containing the transaction-scoped `EntityManager`, child logger, organization,
actor, correlation identifier, event identifier, and occurrence time.

Each subscription runs in its own database transaction. That transaction first inserts
`(subscriptionId, eventId)` into `platform_event_inbox`; a conflict means the subscription already
completed and is skipped. The handler and inbox marker commit or roll back together. The outbox row
is deleted only after every declared subscription has a durable marker. Inbox records have no
automatic cleanup until a retention policy preserves deduplication across the complete redelivery
horizon.

Delivery is ordered strictly within `(organizationId, aggregateId)` by `aggregateVersion`, then
`occurredAt` and `eventId`. Only the earliest retained event for an aggregate may be claimed. A
retry delay or terminal failure therefore blocks later events for that aggregate until operators
resolve the earlier row; the dispatcher does not silently build a projection with a gap.

Named event contracts and purpose-specific collaboration ports are exported from module
entrypoints. Broad application services remain private. The Cases read port initially exposes only
an organization-scoped lookup, while `case.transitioned` version 3 carries the status-history
identifier, normalized note, and occurrence time needed to build a timeline projection without
reading Cases persistence.

## Rationale

Versioned schemas make compatibility reviewable and turn malformed persisted data into a
dispatcher failure before consumer state changes. A per-subscription inbox avoids repeating
completed handlers while keeping independent module projections isolated. Sharing the inbox
transaction's entity manager with the handler makes projection writes and deduplication atomic in
PostgreSQL, the system's existing operational dependency.

Strict aggregate ordering favors a visible blocked projection over a silently incomplete one.
Derived subscription identities remain stable across handler refactors and avoid another manually
coordinated identifier.

## Alternatives considered

- Keeping string event identifiers and casting payloads in each handler would duplicate validation
  and make version support implicit.
- One transaction for all subscribers would couple independent modules and roll back earlier
  projections whenever a later subscriber failed.
- Marking the outbox row once without a per-subscriber inbox would repeat successful handlers after
  partial delivery.
- Allowing later aggregate versions past a failed event would improve throughput while producing
  projections with unexplained gaps.
- Passing the root container to handlers would expose unrelated dependencies and weaken the
  controlled execution boundary.

## Consequences

- Database effects written through the supplied entity manager are idempotent with the inbox
  marker; external side effects still require their own idempotency key because a process can fail
  around a remote call.
- Adding or removing a payload field requires a new schema version, while consumers can retain
  support for explicitly declared older versions.
- One failed aggregate can stop its later events without stopping unrelated aggregates.
- Operational tooling must surface blocked outbox rows and must not prune inbox records without an
  explicit retention policy.
- A module has one subscription per published event identity; it can coordinate multiple internal
  projection updates inside that handler.

## References

- [Transactional domain events](2026-08-19-transactional-domain-events.md)
- [Compile-time modular monolith](2026-08-19-compile-time-modular-monolith.md)
- [Public module entrypoints](2026-08-19-public-module-api.md)
- [Trusted execution context](2026-08-19-trusted-execution-context.md)
- [Cases specification](../../specs/cases.md)
