# Yetano Work

Easy, open-source CRM/ERP for future-ready businesses.

## Technical foundation

The pnpm monorepo contains:

- `apps/web` — React 19, Vite 8, TanStack Router, Query, and Table,
- `apps/api` — Hono, Awilix, TypeBox, OpenAPI/Scalar, and MikroORM,
- `packages/contracts` — shared TypeBox schemas,
- `packages/api-client` — a client generated from the OpenAPI document by Hey API.

The project uses Node.js 24 LTS, TypeScript 6, ESM, and PostgreSQL 18. During the first
stage, one installation serves one company, so the model does not include a `tenantId`.
This does not assume that an organization concept will never appear in the domain.

MikroORM entities should be defined with `defineEntity`; the project intentionally does
not use decorators or `reflect-metadata`.

## Local development

Node.js 24, pnpm 10, and Docker with Compose are required.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

If port 5432 is already in use, configure the same alternative port in `POSTGRES_PORT`
and `DATABASE_URL`.

The frontend runs at `http://localhost:5173`, the API at `http://localhost:3000`, and
the Scalar documentation at `http://localhost:3000/api/docs`.

## API contract

The OpenAPI document is exported without starting the server or connecting to the
database. Both the document and the generated client are committed to the repository.

```bash
pnpm api:generate
pnpm api:check
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Integration tests use `TEST_DATABASE_URL`. They are skipped when the variable is not
set; CI runs them against PostgreSQL 18.

## Deferred decisions

PWA support, pgvector, authentication, a form library, and a UI system are not part of
the first stage. PWA support should be added once installation, offline behavior, and
service worker update requirements are defined. The pgvector extension should be added
with the first embedding use case, a selected vector model, and an indexing strategy.
PostgreSQL remains a suitable boundary for both future changes without incurring their
maintenance cost today.
