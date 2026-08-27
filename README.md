# Yetano Work

Easy, open-source CRM/ERP for future-ready businesses.

## Technical foundation

The pnpm monorepo contains:

- `apps/web` — React 19, Vite 8, TanStack Router, Query, and Table, with Tailwind CSS 4 and
  app-local shadcn/ui components built on React Aria,
- `apps/api` — Hono, Awilix, TypeBox, OpenAPI/Scalar, and MikroORM,
- `packages/contracts` — shared TypeBox schemas,
- `packages/api-client` — a client generated from the OpenAPI document by Hey API.

The project uses Node.js 24 LTS, TypeScript 6, ESM, and PostgreSQL 18. During the first
stage, one installation serves one company. Domain data is still scoped by a required
server-resolved `organizationId`; the model does not add a separate `tenantId`.

MikroORM entities should be defined with `defineEntity`; the project intentionally does
not use decorators or `reflect-metadata`.

## Documentation

Repository documentation starts at [`docs/README.md`](docs/README.md). Product specifications
describe what the system does and how it behaves. Architecture Decision Records capture what was
decided, why it was chosen, and the consequences of that choice.

## Local development

Node.js 24, pnpm 10, and Docker with Compose are required.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm db:up` waits for PostgreSQL and idempotently creates the dedicated test database configured by
the explicit `TEST_DATABASE_URL`. The setup and verification commands fail before touching the
database when that variable is missing or points to the same database as `DATABASE_URL`.

If port 5432 is already in use, configure the same alternative port in `POSTGRES_PORT`,
`DATABASE_URL`, and `TEST_DATABASE_URL`.

The frontend runs at `http://localhost:5173`, the API at `http://localhost:3000`, and
the Scalar documentation at `http://localhost:3000/api/docs`.

## API contract

The OpenAPI document is exported without starting the server or connecting to the
database. Both the document and the generated client are committed to the repository.

```bash
pnpm api:generate
pnpm api:check
pnpm modules:check
```

## Verification

```bash
pnpm check
pnpm verify:full
```

`pnpm check` is the quick local gate. `pnpm verify:full` runs the same lint, typecheck,
unit, integration, generated API, generated module catalog, build, and end-to-end gates as CI. The
full gate loads the workspace `.env`, requires a dedicated test database, and refuses to run when
`TEST_DATABASE_URL` points to the same database as `DATABASE_URL`, so a skipped or destructive
integration suite cannot look green or touch development data. Playwright also requires that
dedicated database, resets and migrates it before every end-to-end run, and starts its own API on
port 3100 instead of reusing the development server.

## AI-assisted development

Repository-specific agent workflows live in `.agents/skills`. Codex discovers them from their
metadata. Path-specific instructions may require a skill when repository guarantees depend on that
workflow; other API, web, and contract conventions remain close to their code.

Codex reads the canonical skills directly and invokes them as `$yetano-verify`,
`$yetano-api-slice`, or `$yetano-code-review`. Claude Code uses the matching `/yetano-*`
commands from `.claude/skills`. Those files are metadata-only adapters; workflow instructions
remain canonical in `.agents/skills`.

```bash
pnpm agents:check
```

This command validates skill metadata, references, size limits, and the layered instruction files,
including the Claude Code adapters. Keep product and architecture facts in
the canonical documentation or nearest `AGENTS.md`; skills should describe procedures rather
than duplicate those facts.

### Isolated worktrees

Use one task per worktree and initialize every new checkout with:

```bash
pnpm worktree:setup
```

Environment files and secrets are intentionally not copied into new worktrees. Code edits and
`pnpm check` can run in parallel, but only one checkout may run the shared Docker, API, and web
stack. The primary checkout owns that runtime by default; stop it before transferring ownership.

- In Codex, start a Worktree chat from a fresh base and configure `pnpm worktree:setup` as the
  local environment setup command.
- In Claude Code, run `claude --worktree <task>`, then run `pnpm worktree:setup` in the new
  checkout.
- In OpenCode or a regular terminal, use the optional Worktrunk fallback. After installing its
  shell integration, run `wt switch --create <branch> --base origin/main`; the committed hook runs
  the setup command automatically. Start `opencode` from the resulting checkout when needed.

Do not force cleanup. Remove a worktree only when it is clean or its work has been intentionally
preserved in commits or another checkout.

## Deferred decisions

PWA support, pgvector, production authentication, and a form library are not part of the first
stage. Protected modules use an explicit development identity locally and production startup
remains blocked until real identity and capability resolvers are supplied. PWA support should be
added once installation, offline behavior, and service worker update requirements are defined. The
pgvector extension should be added
with the first embedding use case, a selected vector model, and an indexing strategy.
PostgreSQL remains a suitable boundary for both future changes without incurring their
maintenance cost today.
