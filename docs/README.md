# Yetano Work documentation

This directory separates current product behavior from the history and rationale of architecture
decisions.

| Question | Source | Maintenance model |
| --- | --- | --- |
| What does the product do and how does it behave? | [`specs`](specs/README.md) | Living documentation |
| What architecture choice was made and why? | [`architecture/decisions`](architecture/decisions/README.md) | Dated decision record |
| What is the exact public API wire shape? | [`packages/contracts`](../packages/contracts/src/index.ts) | TypeBox source of truth |
| Which modules and extension surfaces exist? | [`modules`](modules/README.md) | Generated from module descriptors |
| How is the behavior implemented and verified? | Application code and tests | Executable source of truth |

An `Implemented` spec is expected to agree with the code and tests. A mismatch is a defect to
resolve explicitly; do not silently treat one side as an excuse to leave the other stale. A `Draft`
spec records unresolved intent and is not an implementation contract.

Keep implementation checklists in issues or pull requests. Documentation should retain product
behavior, durable constraints, and decisions that remain useful after an individual change ships.
