# Review checklist

Apply only items relevant to the changed paths.

## Contracts and generated API

- Shared TypeBox schema, API response, OpenAPI output, generated client, and consumer agree.
- Required fields, narrowed values, removed fields, and error-shape changes are compatibility-safe.
- Generated output reflects source changes and was not edited as the source of truth.
- Spec export remains independent of a listener and database connection.

## API, dependency injection, and persistence

- Route metadata covers success and known non-success responses with stable operation identifiers.
- Business behavior lives outside transport code and dependencies are registered at the right scope.
- Request-scoped database access cannot leak across requests or tests.
- Entities use `defineEntity`; schema changes include reversible, ordered migrations.
- Integration tests exercise PostgreSQL and are not silently skipped.

## Web and user experience

- The generated client is used instead of duplicate API types or ad hoc requests.
- Loading, error, empty, and success states are reachable and understandable.
- Semantics, labels, keyboard interaction, focus, and error announcements remain accessible.
- Critical changed behavior has an appropriate browser test.

## Cross-cutting

- Inputs, authorization assumptions, secrets, logs, and error details do not create a security leak.
- Tests would fail before the fix and assert behavior rather than implementation trivia.
- The change stays within requested scope and does not introduce deferred platform choices.
- Documentation and committed generated artifacts match runtime behavior.
