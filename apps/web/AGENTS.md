# Web instructions

These instructions extend the repository root `AGENTS.md` for `apps/web`.

- Consume backend operations through `@yetano/api-client`; do not recreate request or response
  types in the web app.
- Import module-owned symbols from outside their module through `#modules/<module-id>`, which maps to
  the module's public `index.ts`; keep deep relative imports inside the owning module.
- Declare navigable module metadata in the compile-time web module registry. Keep file-based route
  sources authoritative for TanStack Router and do not build routes from the registry.
- Use TanStack Query for server state and keep query keys stable and feature-owned.
- Treat `src/routeTree.gen.ts` as generated output. Change route source files, not the generated tree.
- Every data-driven screen must deliberately handle loading, error, empty, and success states.
- Target WCAG 2.2 AA. Preserve semantic HTML, keyboard access, visible focus, labels, live-region
  behavior, and visible error feedback.
- Use the app-local shadcn/ui `aria-nova` components as the default UI primitives. Before creating a
  custom primitive or interaction, check the current shadcn registry and React Aria API; a matching
  shadcn component takes precedence when it satisfies the required behavior.
- Compose feature and domain UI from shadcn primitives. Create a custom primitive only when the
  registry has no suitable component, and prefer the simplest accessible option, including native
  controls such as `NativeSelect` when richer behavior is unnecessary.
- Use semantic theme tokens instead of literal feature colors. Do not introduce a form library until
  the repository records that separate decision.
- Cover logic with Vitest/Testing Library and user-visible critical paths with Playwright.
- For user-visible web changes, run `pnpm check`, `pnpm build`, and the relevant
  `pnpm test:e2e` path before declaring the change complete.
