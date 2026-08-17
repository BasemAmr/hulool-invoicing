# app/actions — server actions (delivery boundary)

Files: companies.ts, customers.ts, invoices.ts — each 'use server' at top.

Rules:
- THIN wrappers only: parse FormData -> build input -> call use case -> map domain errors
  to returned { status: 'ok'|'error' } values (NEVER throw for expected errors).
- Every action validates via the Zod contract from src/domain/contracts (single source).
- Auth guard goes here once single-admin login exists (actions are public POST endpoints).
- After mutation: revalidatePath() then redirect() (redirect throws — call it last).
