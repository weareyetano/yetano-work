# Contract instructions

These instructions extend the repository root `AGENTS.md` for `packages/contracts`.

- TypeBox schemas are the runtime and compile-time source of truth for public API data.
- Export both each schema and its `Type.Static` type from the package entry point.
- Use descriptive titles and descriptions. Set `additionalProperties` deliberately rather than
  relying on an implicit default.
- Treat changes as compatibility-sensitive: call out removed fields, narrowed values, new required
  fields, or changed error shapes before implementing them.
- Add focused schema tests for validation boundaries when a contract has meaningful constraints.
- After a contract change, run `pnpm api:generate`; never hand-edit OpenAPI or generated client files.

Use `.agents/skills/yetano-api-slice/SKILL.md` when the contract change belongs to a vertical API
capability.
