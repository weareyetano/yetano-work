# Activities

| Field | Value |
| --- | --- |
| Status | Implemented |
| Implementation | Activities module, API, generated client, and in-panel case timeline |

## Summary

Activities provides an immutable, organization-scoped timeline reachable from case details. It
combines case creation, case status transitions, and manually appended notes without introducing a
separate page, navigation item, general activity feed, or task-planning model.

The first release begins collecting entries when it is deployed. Existing case history is not
backfilled.

## Terminology and scope

- An **activity** is one immutable timeline entry belonging to a case.
- A **system activity** is projected from a trusted Cases event.
- A **note activity** is appended explicitly by a user and cannot be edited or deleted.
- The **activity identifier** is the Cases event identifier for a system activity and a
  client-generated UUID for a note.

Activities are limited to `case_created`, `case_status_changed`, and `note`. Title, description, and
customer-reference updates do not produce activity entries. Scheduling, completion, assignment,
attachments, mentions, and a cross-case feed are outside this version.

## Behavior and workflows

Below the case form, the detail panel shows only a compact row with the current status, the time of
the latest lifecycle entry that established that status, and an icon action. The row has no section
label and does not render activity entries. Activating the icon replaces the detail panel contents
with the activity view; the case-title breadcrumb restores the case form without opening a dialog
or changing the route.

Activity entries are ordered newest first and older pages can be appended with an opaque cursor.
While the case summary or activity view remains open, its current data refreshes every two seconds
so projected outbox events appear without a page reload. Until the newest lifecycle entry is
projected, the compact row uses the case timestamp as a temporary fallback.

Users can append a note containing 1 to 10,000 characters. Outer whitespace is trimmed while
internal whitespace and newlines are retained. The form keeps its content and activity identifier
after a failed request so retrying is idempotent; it clears after success.

The timeline exposes loading, error, empty, populated, note-submission, and pagination states. Actor
identifiers are retained in the contract for auditing, while the web interface renders each entry
as a human-readable sentence beginning with `Użytkownik` or `System`.

## Rules and invariants

- Every activity stores its organization and case identifiers and every repository query scopes by
  both values.
- Activities are append-only and have no update or delete operation.
- `case_created` stores the resulting case version and no status or body fields.
- `case_status_changed` stores the resulting case version, source and target statuses, and the
  normalized transition note when present.
- `note` stores only normalized user content in its type-specific body fields.
- The database constrains common enums and the allowed nullable-field shape for every activity
  type.
- System activities use the event envelope's identifier, actor, organization, and occurrence time.
- Subscription inboxes and the activity primary key make repeated event delivery harmless.
- No activity is written for `case.updated`.

## Relationships

Activities depends only on the organization-scoped `CasesReadPort` to verify that a requested case
exists. It subscribes to `case.created` version 1 and `case.transitioned` versions 1 through 3. It
does not read or relate to the private Cases status ledger and defines no ORM relationship to Cases.

## Interface impact

The exact activity, note request, pagination, and conflict shapes are defined by the TypeBox schemas
in [`packages/contracts/src/activities.ts`](../../packages/contracts/src/activities.ts).

The HTTP API exposes:

- `GET /api/v1/activities/cases/{caseId}` for a newest-first page, with a default limit of 25 and a
  maximum of 100;
- `POST /api/v1/activities/cases/{caseId}/notes` to append an idempotent note.

The module declares `activities.read`, which requires `cases.read`, and
`activities.create-note`, which requires `activities.read`. The first successful note request
returns 201. An exact replay by the same actor returns the existing activity with 200. Reusing the
identifier for another case, content, actor, actor type, or organization returns 409
`activity_id_conflict`.

## Edge cases and failure behavior

- Invalid identifiers, bodies, pagination limits, and cursors return `400 ProblemDetails`.
- Missing identity and insufficient capability return 401 and 403 respectively.
- A missing case and a case outside the active organization both return 404.
- An empty timeline is valid because deployment performs no historical backfill.
- Events are projected asynchronously through the transactional outbox; temporary absence from the
  newest page is expected until delivery completes.
- Equal occurrence times are ordered deterministically by activity identifier and encoded together
  in the cursor.
- A failed list or note request is retryable without losing the current note draft.

## Acceptance criteria

- Creating a case eventually adds exactly one creation activity with trusted envelope metadata.
- Each status transition event version from 1 through 3 maps to exactly one status activity.
- Updating a case title, description, or customer reference adds no activity.
- Concurrent exact note retries yield one stored row and responses with one 201 and one 200.
- Conflicting reuse of an activity identifier returns `activity_id_conflict` without exposing data
  from another organization.
- The compact case row exposes only the status, its timestamp, and an icon action. The in-panel
  activity view supports all list and form states, older-page loading, retry, asynchronous status
  entries, and keyboard focus restoration; no dialog, separate Activities route, or navigation item
  exists.
- OpenAPI, the generated client, and the generated module catalog expose Activities and omit the old
  public Cases status-history operation.

## Open questions

- Should a future version resolve and display user names while retaining actor snapshots?
- Which additional domain events, if any, belong in the case timeline?
- Is retention or export required beyond the append-only application view?

## Related decisions and specifications

- [Cases](cases.md)
- [Tasks](tasks.md)
- [Public module API](../architecture/decisions/2026-08-19-public-module-api.md)
- [Transactional domain events](../architecture/decisions/2026-08-19-transactional-domain-events.md)
- [Typed idempotent event subscriptions](../architecture/decisions/2026-08-23-typed-idempotent-event-subscriptions.md)
