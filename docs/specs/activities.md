# Activities

| Field | Value |
| --- | --- |
| Status | Draft |
| Implementation | Not started |

This document is a deliberate skeleton. It does not define implementation-ready activity behavior
yet.

Before Activities can be accepted for implementation, it must decide whether historical case
changes are in scope. If they are, the accepted specification must choose a module-owned backfill
source and mechanism plus an idempotent cutover to live events. A current-state case read cannot
reconstruct the status history.

## Summary

This specification will define what an activity represents and how it records or schedules work in
Yetano Work.

## Terminology and scope

The boundary between a user-created activity, a domain event, an audit entry, and a timeline item is
not yet defined.

## Behavior and workflows

Activity creation, editing, completion, ordering, visibility, and retention remain to be decided.

## Rules and invariants

No activity invariants have been accepted yet.

## Relationships

It remains undecided whether activities belong to [cases](cases.md), originate from
[tasks](tasks.md), or can reference other future domain records.

## Interface impact

No activity entity, public TypeBox contract, API operation, or web route exists. An accepted version
of this spec must describe interface behavior and link to exact contracts rather than duplicate
them.

## Edge cases and failure behavior

Ordering ties, edits to historical entries, deletion, actor removal, and visibility failures remain
to be specified.

## Acceptance criteria

Acceptance criteria will be added after the activity model and retention behavior are approved.

## Open questions

- Is an activity planned work, completed history, or a shared representation of both?
- Which activity types are required initially?
- Are activities mutable, append-only, or selectively editable?
- Which actor and timestamp information must be retained?
- Should system-generated changes and user-authored notes share the same timeline?
- If Activities projects historical case changes, will its module-owned backfill read the
  authoritative case status history through a narrow module port or build the initial projection in
  a migration, and how will it cut over idempotently to live events without gaps or duplicates?

## Related decisions and specifications

- [Cases](cases.md)
- [Tasks](tasks.md)
- [Public module API](../architecture/decisions/2026-08-19-public-module-api.md)
- [Transactional domain events](../architecture/decisions/2026-08-19-transactional-domain-events.md)
