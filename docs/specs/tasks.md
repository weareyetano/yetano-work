# Tasks

| Field | Value |
| --- | --- |
| Status | Draft |
| Implementation | Not started |

This document is a deliberate skeleton. It does not define implementation-ready task behavior yet.

## Summary

This specification will define how Yetano Work represents, schedules, assigns, and completes tasks.

## Terminology and scope

The boundary between a task, a case action, and a general reminder is not yet defined.

## Behavior and workflows

The creation, assignment, scheduling, completion, reopening, and cancellation workflows remain to
be decided.

## Rules and invariants

No task invariants have been accepted yet.

## Relationships

It remains undecided whether every task belongs to a [case](cases.md), how task changes produce
[activities](activities.md), and which records own task lifecycle.

## Interface impact

No task entity, public TypeBox contract, API operation, or web route exists. An accepted version of
this spec must describe interface behavior and link to exact contracts rather than duplicate them.

## Edge cases and failure behavior

Overdue behavior, invalid scheduling, reassignment conflicts, duplicate completion, and deletion or
cancellation semantics remain to be specified.

## Acceptance criteria

Acceptance criteria will be added after task ownership and lifecycle behavior are approved.

## Open questions

- Can a task exist independently of a case?
- Does a task have one assignee, multiple assignees, or only an owner?
- Which statuses and transitions are required?
- How do due dates, priorities, reminders, and time zones behave?
- Are recurrence, dependencies, and subtasks in scope?

## Related decisions and specifications

- [Cases](cases.md)
- [Activities](activities.md)
- [Public module API](../architecture/decisions/2026-08-19-public-module-api.md)
