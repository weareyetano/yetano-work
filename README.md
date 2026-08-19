# Yetano Work

Easy, open-source CRM/ERP for future-ready businesses.

## Fundament technologiczny

Monorepo pnpm zawiera:

- `apps/web` — React 19, Vite 8, TanStack Router, Query i Table,
- `apps/api` — Hono, Awilix, TypeBox, OpenAPI/Scalar oraz MikroORM,
- `packages/contracts` — współdzielone schematy TypeBox,
- `packages/api-client` — klient generowany przez Hey API z pliku OpenAPI.

Projekt używa Node.js 24 LTS, TypeScript 6, ESM i PostgreSQL 18. Jedna instalacja
obsługuje na pierwszym etapie jedną firmę, dlatego model nie zawiera `tenantId`. Nie
zakładamy przy tym, że pojęcie organizacji nigdy nie pojawi się w domenie.

Encje MikroORM należy definiować przez `defineEntity`; projekt celowo nie używa
dekoratorów ani `reflect-metadata`.

## Start lokalny

Wymagane są Node.js 24, pnpm 10 oraz Docker z Compose.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

Jeśli port 5432 jest zajęty, ustaw ten sam alternatywny port w `POSTGRES_PORT` oraz
`DATABASE_URL`.

Frontend działa pod `http://localhost:5173`, API pod `http://localhost:3000`, a
dokumentacja Scalar pod `http://localhost:3000/api/docs`.

## Kontrakt API

OpenAPI jest eksportowane bez uruchamiania serwera i bez połączenia z bazą. Wynik oraz
wygenerowany klient są przechowywane w repozytorium.

```bash
pnpm api:generate
pnpm api:check
```

## Weryfikacja

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Testy integracyjne korzystają z `TEST_DATABASE_URL`. Jeśli zmienna nie jest ustawiona,
są pomijane; CI uruchamia je na PostgreSQL 18.

## Świadomie odłożone decyzje

PWA, pgvector, uwierzytelnianie, biblioteka formularzy i system UI nie są częścią
pierwszego etapu. PWA warto dodać dopiero wraz z konkretnymi wymaganiami instalacji,
offline i strategią aktualizacji service workera. Rozszerzenie pgvector należy dodać
razem z pierwszym przypadkiem użycia embeddingów, ustalonym modelem wektorów oraz
strategią indeksowania. PostgreSQL pozostaje gotową granicą dla obu późniejszych zmian
bez kosztu utrzymywania ich już teraz.
