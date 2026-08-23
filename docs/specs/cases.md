# Cases

| Field | Value |
| --- | --- |
| Status | Implemented |
| Implementation | Cases module, API, generated client, and web workspace |

## Summary

A case is a lightweight organization-scoped record for work that needs a durable title, optional
context, and an explicit lifecycle. It supports intake, active work, waiting, postponement,
successful resolution, cancellation, and immutable status history without assignment, tasks,
general activities, archival, or deletion.

## Terminology and scope

- An **open case** is new, being worked, or waiting.
- A **postponed case** is a new case deliberately moved out of the current backlog before work
  begins. It is neither actively open nor closed.
- A **closed case** is resolved or canceled and records when it was last closed.
- The **active organization** is resolved by the server and is never selected by case API input.
- A **customer reference** is an optional UUID. It is a soft cross-module reference because a
  customer module does not exist yet.

Cases have an identifier, organization identifier, optional customer identifier, title, optional
description, status, current status note, optimistic-lock version, creation and update timestamps,
and an optional close timestamp. Cases have no owner in this version.

## Behavior and workflows

Users with the declared capabilities can:

1. Create a new case.
2. Get one case or list cases in the active organization.
3. Update title, description, or customer reference using the last observed version.
4. Move a case through new, postponed, working, waiting, resolved, and canceled statuses.
5. Read its immutable status history.

Status transitions use a client-generated transition identifier. Repeating the same command returns
the first stored transition result without changing the case or publishing another event. Reusing
that identifier for another command is a conflict.

The supported transitions are:

| Current status | Available next status |
| --- | --- |
| `new` | `working`, `waiting`, `postponed`, `resolved`, `canceled` |
| `postponed` | `new`, `resolved`, `canceled` |
| `working` | `waiting`, `resolved`, `canceled` |
| `waiting` | `working`, `resolved`, `canceled` |
| `resolved`, `canceled` | `working` |

Lists use opaque cursor pagination. They accept exact status, actively open or closed status group,
customer, and case-insensitive text filters with a bounded page size. The open group contains new,
working, and waiting cases; postponed cases are queried by exact status; the closed group contains
resolved and canceled cases. Text search matches literal fragments of the title, description, or
case identifier. When exact statuses and a status group are supplied together, results satisfy both
filters. Results are ordered by most recent modification with the case identifier as a
stable tie-breaker. Status history is independently cursor-paginated newest first.

The web workspace starts in the Open view and exposes three list views: Open, Postponed, and Closed.
A created or restored case opens in Open. Postponing a new case follows it to Postponed; resolving or
canceling a case follows it to Closed. Priority and SLA ordering are deferred; every view orders
cases by most recent modification, with newly created cases naturally included because their
creation and modification timestamps initially match.

The case search field narrows the selected list view after a short typing delay. Its value remains
local to the workspace while users change views or open and return from a case, and resets after a
page reload. It can be cleared directly and distinguishes no matches from a genuinely empty view.

Creating a case starts from the add action next to the list view filter. It opens the same workspace
panel used for case details, with a required title and optional description. The initial New status
is assigned implicitly and is not shown as a separate creation control.

Creation is represented by `mode=new` in the workspace URL, remains open across a reload, and can be
canceled through in-app or browser back navigation. A successful creation replaces that transient
URL state with the created case and exposes its normal lifecycle actions and status history.

The detail panel uses the editable title field as its only visible title and omits a separate current
status badge. On wide screens, its Save action is followed by every lifecycle transition currently
allowed for the case. On narrow screens, Save remains directly available while those transitions,
including Cancel, are grouped under a Change status menu.

Title and description edits in the detail panel form a local draft tied to the selected case and
the last server version observed when editing began. Selecting another case, changing the list view,
or starting a status transition requires users to keep editing or explicitly discard a dirty draft.
Browser-level navigation also warns while a dirty draft exists. Any in-flight case update or status
transition disables all other mutating actions for that case.

When an update fails because its expected version is stale, the workspace keeps the local draft and
shows it alongside the newer server summary. The server value replaces the draft only after the user
explicitly chooses to load that version. Automatic merging is deferred.

On wide screens, the case workspace fits inside the available viewport and keeps the case list and
detail panel independently scrollable. Search and view controls remain visible above the list.
Selecting a case preserves the list position while opening its details at the top, and loading the
next cursor page appends cases inside the list without extending the document. Changing the list
view or effective search resets the list to its beginning. Narrow screens retain document scrolling
and the single-panel list-to-detail flow.

## Rules and invariants

- Every case belongs to exactly one non-null organization resolved by the server.
- Every read and mutation includes that organization in its persistence predicate.
- A title is required, trimmed, non-blank, and no longer than 200 characters.
- A description is optional, trimmed, and no longer than 10,000 characters; blank input becomes
  null.
- New cases have status `new`, version 1, no status note, and no close timestamp.
- Only new cases can be postponed. Postponing and restoring are one-step transitions without a note.
- Postponed cases have no status note or close timestamp and restore to `new`, not `working`.
- `waiting` and `canceled` require a non-blank status note.
- Resolved and canceled cases have a close timestamp; reopened cases do not.
- Reopening a resolved or canceled case moves it to `working`.
- Status history entries are append-only and record the actor, time, source, resulting case version,
  and optional note.
- Creating a case appends a `created` history entry from no prior status to `new`, while publishing
  only the public `case.created` event.
- Migrated history entries have migration source, document their legacy mapping, and neither run
  normal lifecycle automation nor publish outbox events.
- A state-changing update increments the version. A no-op update does not.
- A mutation with a stale expected version fails with a structured conflict response.
- Cases are retained; deletion and archival are outside the current scope.

## Relationships

The customer identifier does not create an ORM relationship or require a customer module at
runtime. Tasks and activities are not created implicitly and remain governed by their draft
specifications.

## Interface impact

The exact request, response, query, history, and conflict shapes are defined by the TypeBox schemas
in [`packages/contracts/src/cases.ts`](../../packages/contracts/src/cases.ts). The HTTP API exposes
create, get, list, update, transition, and status-history operations under `/api/v1/cases`. OpenAPI
and the web client are generated from those routes.

The module declares read, create, update, transition, close, and reopen capabilities. Movement among
active statuses plus postponing or restoring requires transition, nonterminal-to-terminal movement
requires close, and terminal-to-working movement requires reopen. Mutating capabilities include read
as an inherited requirement. It publishes versioned `case.created`, `case.updated`, and
`case.transitioned` events through the transactional outbox. The current `case.transitioned`
contract is version 3 and includes the immutable status-change and transition identifiers, case
version, source and target statuses, and normalized note. The canonical occurrence time comes from
the event envelope exposed to subscribers as `context.occurredAt`. This is sufficient for another
module to project a case timeline without reading Cases persistence. Named event contracts and the
organization-scoped `CasesReadPort` are exported from the Cases module entrypoint; the broad
application service is private.

## Edge cases and failure behavior

- Invalid bodies, identifiers, filters, and cursors return `400 ProblemDetails`.
- Missing identity and insufficient capability return `401` and `403` respectively.
- A case outside the active organization is indistinguishable from a missing case and returns 404.
- Stale state-changing mutations return a 409 `case_version_conflict` with the current known
  version.
- Event delivery is at least once. Database projection writes use a per-subscription inbox and the
  supplied transaction-scoped entity manager; external side effects still require an idempotency
  key.
- Events for one organization-scoped aggregate are delivered in aggregate-version order. A failed
  earlier event blocks later versions until it is resolved.
- Production startup fails until explicit production identity and capability resolvers are wired.

## Acceptance criteria

- Organization scope cannot be supplied or overridden by a case request.
- Cross-organization get and list operations do not expose case data.
- Aggregate changes and their event envelopes commit atomically with trusted organization and actor
  fields.
- Repeated transition commands with the same transition identifier return the original result and
  do not create duplicate history or lifecycle events.
- Concurrent stale updates return the documented conflict response.
- Unsaved detail edits survive refreshes and version conflicts, and case selection, view changes,
  and status transitions require explicit confirmation before discarding them.
- While one case mutation is pending, every other mutating action for that case is disabled.
- The web workspace handles loading, error, empty, and populated states and supports every case
  operation.
- The Postpone action is available only for new cases, performs no note prompt, and moves the case to
  Postponed; Restore returns it to New and the Open view.
- The creation panel preserves entered values after a failed request and restores the previous case
  on desktop, or the list and triggering add action on narrow screens, when canceled.
- On narrow screens, the web workspace shows either the case list or the selected case. Opening a
  case moves focus to its details, while in-app and browser back navigation restore the list,
  previous scroll position, and triggering case. Wider screens retain the side-by-side workspace.
- On wide screens, the document remains fixed while the list and detail panels scroll independently;
  selecting a case preserves the visible list context and keeps keyboard focus on the triggering
  case, while the selected details start at the top.

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
- [Idempotent case lifecycle transitions](../architecture/decisions/2026-08-21-idempotent-case-lifecycle-transitions.md)
