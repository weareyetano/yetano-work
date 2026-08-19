# Web instructions

These instructions extend the repository root `AGENTS.md` for `apps/web`.

- Consume backend operations through `@yetano/api-client`; do not recreate request or response
  types in the web app.
- Use TanStack Query for server state and keep query keys stable and feature-owned.
- Treat `src/routeTree.gen.ts` as generated output. Change route source files, not the generated tree.
- Every data-driven screen must deliberately handle loading, error, empty, and success states.
- Preserve semantic HTML, keyboard access, focus behavior, labels, and visible error feedback.
- Keep the current lightweight styling approach. Do not introduce a UI system or form library until
  the repository records that decision.
- Cover logic with Vitest/Testing Library and user-visible critical paths with Playwright.

Run the UI profile from `.agents/skills/yetano-verify/SKILL.md` before declaring a user-visible
change complete.
