# Hulool Invoicing

Saudi multi-company invoicing platform: ZATCA Phase 1 QR codes, PDF invoices, and per-company invoice sequences.

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- PostgreSQL (Docker) + Drizzle ORM

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- Docker Desktop (for the Postgres container)

## Quickstart

```bash
pnpm install      # install dependencies
pnpm db:up        # start Postgres via docker compose
pnpm db:push      # push the Drizzle schema to the database
pnpm dev          # start the Next.js dev server (http://localhost:3000)
```

## Database scripts

- `pnpm db:up` — start the Postgres container (`docker compose up -d`)
- `pnpm db:down` — stop the Postgres container (`docker compose down`)
- `pnpm db:push` — push the Drizzle schema to the database (`drizzle-kit push`)
- `pnpm db:studio` — open Drizzle Studio (`drizzle-kit studio`)

## Other scripts

- `pnpm dev` — Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — run ESLint
- `pnpm typecheck` — run `tsc --noEmit`