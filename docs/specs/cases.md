# Cases

| Field | Value |
| --- | --- |
| Status | Draft |
| Implementation | Not started |

This document is a deliberate skeleton. It does not define implementation-ready case behavior yet.

## Summary

This specification will define the role of a case in Yetano Work and the behavior users can expect
throughout its lifecycle.

## Terminology and scope

The domain meaning and boundaries of a case are not yet defined.

## Behavior and workflows

The creation, assignment, state-transition, completion, reopening, and archival workflows remain to
be decided.

## Rules and invariants

No case invariants have been accepted yet.

## Relationships

The ownership and lifecycle relationships between cases, [tasks](tasks.md), and
[activities](activities.md) remain open.

## Interface impact

No case entity, public TypeBox contract, API operation, or web route exists. An accepted version of
this spec must describe interface behavior and link to exact contracts rather than duplicate them.

## Edge cases and failure behavior

Conflict handling, deletion or archival semantics, concurrent changes, and access failures remain to
be specified.

## Acceptance criteria

Acceptance criteria will be added after the product behavior and lifecycle are approved.

## Open questions

- What business object or process does a case represent?
- Which fields identify and summarize a case?
- Which lifecycle states and transitions are required?
- Can a case exist without an owner, task, or activity?
- Are cases deleted, archived, or retained permanently?

## Related decisions and specifications

- [Tasks](tasks.md)
- [Activities](activities.md)
- [Public module API](../architecture/decisions/2026-08-19-public-module-api.md)
