# Product specifications

Specifications describe what Yetano Work does and how it behaves at the product, domain, and
interface level. "How" means workflows, rules, state transitions, failure behavior, and system
interactions—not a list of files or implementation steps.

## Statuses

| Status | Meaning |
| --- | --- |
| `Draft` | Incomplete and not authoritative for implementation. |
| `Accepted` | Approved target behavior; implementation may still be pending. |
| `Implemented` | The code and tests have been verified against the specification. |
| `Superseded` | Replaced by another linked specification. |

## Naming and maintenance

- Use stable, descriptive kebab-case names without dates.
- Maintain one canonical specification for the current behavior of a domain area.
- Update a specification in place when its behavior changes; Git provides the change history.
- Do not duplicate exact TypeBox schemas or generated OpenAPI. Link to the contract source instead.
- Do not include source line numbers, temporary implementation checklists, or unapproved behavior.

## Expected structure

Adapt the sections to the subject, but cover these concerns when they apply:

1. Summary
2. Terminology and scope
3. Behavior and workflows
4. Rules and invariants
5. Relationships
6. Interface impact
7. Edge cases and failure behavior
8. Acceptance criteria
9. Open questions
10. Related decisions and specifications

## Specification index

| Specification | Status |
| --- | --- |
| [Cases](cases.md) | Implemented |
| [Tasks](tasks.md) | Draft |
| [Activities](activities.md) | Draft |
