# Cases

| Field | Value |
| --- | --- |
| Status | Implemented |
| Implementation | Cases module, API, generated client, and web workspace |

## Summary

A case is a lightweight organization-scoped record for work that needs a durable title, optional
context, and an explicit open or closed lifecycle. The first version supports intake and lifecycle
tracking without assignment, tasks, activities, archival, or deletion.

## Terminology and scope

- An **open case** is active work.
- A **closed case** has completed its current lifecycle and records when it was closed.
- The **active organization** is resolved by the server and is never selected by case API input.
- A **customer reference** is an optional UUID. It is a soft cross-module reference because a
  customer module does not exist yet.

Cases have an identifier, organization identifier, optional customer identifier, title, optional
description, status, optimistic-lock version, creation and update timestamps, and an optional close
timestamp. Cases have no owner in this version.

## Behavior and workflows

Users with the declared capabilities can:

1. Create an open case.
2. Get one case or list cases in the active organization.
3. Update title, description, or customer reference using the last observed version.
4. Close an open case.
5. Reopen a closed case.

Close and reopen are idempotent. Repeating a transition after it has already reached the requested
state returns the current case without changing its version or publishing another event.

Lists use opaque cursor pagination. They accept optional status and customer filters and a bounded
page size. Results are ordered newest first with the case identifier as a stable tie-breaker.

## Rules and invariants

- Every case belongs to exactly one non-null organization resolved by the server.
- Every read and mutation includes that organization in its persistence predicate.
- A title is required, trimmed, non-blank, and no longer than 200 characters.
- A description is optional, trimmed, and no longer than 10,000 characters; blank input becomes
  null.
- New cases are open, have version 1, and do not have a close timestamp.
- Closed cases have a close timestamp; reopened cases do not.
- A state-changing update increments the version. A no-op update does not.
- A mutation with a stale expected version fails with a structured conflict response.
- Cases are retained; deletion and archival are outside the current scope.

## Relationships

The customer identifier does not create an ORM relationship or require a customer module at
runtime. Tasks and activities are not created implicitly and remain governed by their draft
specifications.

## Interface impact

The exact request, response, query, and conflict shapes are defined by the TypeBox schemas in
[`packages/contracts/src/cases.ts`](../../packages/contracts/src/cases.ts). The HTTP API exposes
create, get, list, update, close, and reopen operations under `/api/v1/cases`. OpenAPI and the web
client are generated from those routes.

The module declares read, create, update, and close capabilities. Create, update, and close include
read as an inherited requirement. It publishes versioned `case.created`, `case.updated`,
`case.closed`, and `case.reopened` events through the transactional outbox.

## Edge cases and failure behavior

- Invalid bodies, identifiers, filters, and cursors return `400 ProblemDetails`.
- Missing identity and insufficient capability return `401` and `403` respectively.
- A case outside the active organization is indistinguishable from a missing case and returns 404.
- Stale state-changing mutations return a 409 `case_version_conflict` with the current known
  version.
- Event delivery is at least once; subscribers must be idempotent.
- Production startup fails until explicit production identity and capability resolvers are wired.

## Acceptance criteria

- Organization scope cannot be supplied or overridden by a case request.
- Cross-organization get and list operations do not expose case data.
- Aggregate changes and their event envelopes commit atomically with trusted organization and actor
  fields.
- Repeated close and reopen calls are successful and do not create duplicate lifecycle events.
- Concurrent stale updates return the documented conflict response.
- The web workspace handles loading, error, empty, and populated states and supports every case
  operation.
- On narrow screens, the web workspace shows either the case list or the selected case. Opening a
  case moves focus to its details, while in-app and browser back navigation restore the list,
  previous scroll position, and triggering case. Wider screens retain the side-by-side workspace.

## Open questions

- When should a soft customer reference become a validated cross-module lookup?
- Which assignment or ownership model is needed?
- Do cases later need archival distinct from closure?
- How should tasks and activities attach to cases once their specifications are accepted?

## Related decisions and specifications

- [Tasks](tasks.md)
- [Activities](activities.md)
- [Compile-time modular monolith](../architecture/decisions/2026-08-19-compile-time-modular-monolith.md)
- [Trusted execution context](../architecture/decisions/2026-08-19-trusted-execution-context.md)
- [Transactional domain events](../architecture/decisions/2026-08-19-transactional-domain-events.md)
