# Architecture — hulool-invoicing

Binding contract for all slices. Deviations require updating this file first.

## Layer law (dependency direction)

    app  →  application  →  domain
    infrastructure  →  application  (implements ports)
    components  ←  app  (presentation only)

- `domain/` imports zod ONLY. Pure TS. No Next, no drizzle, no pg.
- `application/` defines ports (interfaces) + use cases. One transaction per use case.
  Single pragmatic leak: `Tx` type alias (drizzle tx handle) re-exported via `application/tx.ts`.
- `infrastructure/` implements ports: drizzle repositories, PostgresSequenceService,
  idempotency store, env config, clock. Numeric↔Halalas conversion happens ONLY here.
- `app/` = delivery: pages, layouts, route handlers, server actions. Actions are THIN:
  FormData → Zod contract → use case → `{status}` return. Never business logic here.
- `components/` = presentation. `ui/` = shadcn primitives (untouched); everything else
  composes them. No data fetching in components/ (pages pass props).

## Money law

Integer halalas everywhere in domain/application. `numeric(15,2)` strings at the DB edge.
`toDecimalString()` at the DTO boundary. Formatting ("1,150.00 SAR") only in components.

## Folder map

    src/
      app/
        layout.tsx                  root: <html lang="ar" dir="rtl"> + fonts
        (dashboard)/                authenticated shell (sidebar layout in Slice 2)
          companies/                list + new
          customers/                list + new
          invoices/                 list + new + [id] detail
        api/documents/[id]/pdf/     route.ts — PDF stream (Slice 3)
        actions/                    server actions: companies.ts customers.ts invoices.ts
      components/
        ui/                         shadcn primitives (do not hand-edit)
        layout/                     Sidebar, TopBar, PageHeader (server-safe)
        forms/                      client forms (useActionState + pending + errors)
        documents/                  StatusBadge, MoneyText, QrPreview, ItemsTable
      domain/
        branding.ts constants.ts errors.ts
        contracts/                  Zod schemas = single validation source (client+server)
        value-objects/              money, document-status, invoice-number
        services/                   zatca-qr-service, totals-calculator (+ .test.ts)
      application/
        ports/                      repository + sequence + clock + idempotency interfaces
        use-cases/                  CreateCompany, CreateCustomer, CreateDraftInvoice, IssueInvoice
        container.ts dto.ts tx.ts
      infrastructure/
        config/env.ts               lazy zod-validated env (getEnv())
        database/                   schema.ts (drizzle), index.ts (pool+db+Tx), repositories/
        pdf/                        (Slice 3) parametric template engine implements PdfRenderer port
        system-clock.ts
      lib/                          cn(), formatters (halalas→display, dates)

    drizzle/                        generated SQL migrations (committed, never hand-edited)

## Next.js 16 conventions (binding)

- params/searchParams are Promises: `const { id } = await params`. Use global
  PageProps<'/route'> / RouteContext<'/route'> helpers.
- Server Actions: expected errors are RETURN VALUES, never throws. useActionState drives UI.
- revalidatePath() after mutations; redirect() last (it throws).
- error.tsx boundaries use `retry` prop (not reset). Must be 'use client'.
- No route.ts beside page.tsx at the same segment.
- 'middleware' is dead — file is proxy.ts if ever needed.

## Naming

- Queries: `find*` (maybe-null), `list*` (collections). Mutations: verbNoun use cases.
- One word per concept (no fetch/get/retrieve mix).
- Tables snake_case; TS camelCase; branded IDs (CompanyId...) at boundaries.

## Parking lot (do NOT build until client asks)

employees module, full accounting/ledger, ZATCA Phase 2 signing, credit notes,
multi-user roles, template customizer UI (engine lands in Slice 3 as config-only).
