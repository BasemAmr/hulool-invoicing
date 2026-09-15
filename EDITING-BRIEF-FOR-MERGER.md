# Editing Brief for Merger Agent — feat/invoices-always-published

## 0. Where this work lives
- Worktree: `D:\_awad work\invoice app\hulool-invoicing` (main) → new worktree `D:\_awad work\invoice app\hulool-invoicing-published`
- Branch: `feat/invoices-always-published` (branched from `main` @ `dd38ff4`)
- Base repo: `D:\_awad work\invoice app\hulool-invoicing`
- Verify: `git worktree list` shows both paths; `git status --short` in the
  `-published` worktree lists the files below.

## 1. What the user asked (literal)
1. No more "published/draft" split: everything is published, no draft option.
2. Full edit + delete for invoices from (a) invoice preview page and
   (b) all-invoices table actions.
3. New "duplicate invoice" action in preview + table: dialog asks for client
   (default = same client) and date (default = today); on confirm it opens the
   create-new-invoice page prefilled with the duplicated invoice's data but
   with the newly chosen client + date.
4. Fix: creating a new invoice reuses `INV-00001` instead of incrementing
   (e.g. second invoice should be `INV-00002`).
5. Leave this brief so a later merge is clean.

## 2. Root causes found (read, don't guess)
- **Numbering looked frozen at `...-00001` for two stacked reasons:**
  - (a) `InvoiceWizardForm` showed a cosmetic `${prefix}-00001` "simulation"
    as if it were the real number. The server ignores that field; the real
    number is allocated only inside `IssueInvoice` via `PostgresSequenceService`.
  - (b) `createDraftInvoiceAction` swallowed issue errors
    (`try { Issue } catch { console.error }`) and still redirected to the
    (draft) detail page. So when issuance failed (e.g. unique-violation on
    the number), the invoice stayed a draft with `invoiceNumber = NULL` and
    the UI kept displaying the fake `...-00001`. Every new invoice then
    *looked* like a duplicate.
  - (c) Structural: sequence was bucketed per `(company_id, year)` while the
    format is `PREFIX-nnnnn` (no year) with a `unique(company_id,
    invoice_number)` constraint. Each January the counter restarted at 1 and
    had to collide. Fix had to be structural, not a retry.
- **Draft/published split was enforced in 4 layers:** Zod-level nothing, but
  `InvoiceRepository.updateDraft/deleteDraft` + `UpdateDraftInvoice` /
  `DeleteDraftInvoice` threw `InvalidTransitionError` for non-drafts, the edit
  pages redirected non-drafts away, and the UI hid edit/delete for `issued`.
- **Duplicate didn't exist:** preview gear "نسخ الفاتورة" was a toast-only
  stub; table had no duplicate affordance at all.

## 3. What changed (per file — WHAT + WHY)

### Numbering fix (the important one)
- `src/infrastructure/database/repositories/postgres-sequence-service.ts`
  (MODIFIED) — allocation now uses ONE sentinel row per company
  (`year = 0`, exported as `INVOICE_SEQUENCE_SENTINEL_YEAR`). On first use it
  backfills the sentinel to `max(existing invoice trailing seq)` parsed from
  `invoices.invoice_number` (`/-(\d+)$/` handles both `PREFIX-nnnnn` and
  legacy `PREFIX-YYYY-nnnnn`), via `INSERT ... ON CONFLICT DO NOTHING` (safe
  under concurrency), then does the atomic
  `INSERT ... ON CONFLICT DO UPDATE last_value+1 RETURNING` increment. The
  `year` param is kept but ignored (interface compat). WHY: matches the
  year-less number format; stops January resets; heals installs whose
  `company_sequences` lag behind existing invoices.
- `src/application/ports/sequence-port.ts` (MODIFIED, comments only) —
  documents per-company (not per-year) semantics and `PREFIX-nnnnn` return.
- `src/app/actions/invoices.ts` — `createDraftInvoiceAction` (MODIFIED):
  issuance is now MANDATORY and its error surfaces as `ActionState.error`
  instead of being logged-and-ignored. WHY: silent failure was the visible
  "doesn't increment" bug; with always-published there is no draft fallback.
- `src/app/(company)/c/[companyId]/invoices/new/page.tsx` (MODIFIED) — adds
  server-side `previewNextInvoiceNumber()` (max+1, display-only) passed as
  `suggestedInvoiceNumber`; real allocation still happens atomically on save.
  WHY: replaces the lying `...-00001` preview with an honest estimate.
- `src/components/forms/invoice-wizard-form.tsx` — invoice-number field is now
  read-only/disabled with helper text (MODIFIED). WHY: the field was never
  submitted; letting users edit it implied control they didn't have.

### Always-published: full edit + delete (no draft option)
- `src/infrastructure/database/repositories/invoice-repository.ts` (MODIFIED)
  - `updateDraft`: removed draft-only guard; now only `cancelled` is locked.
    `SET` still preserves `invoiceNumber/status/qr/issuedAt` (QR refreshed by
    the action layer). WHY: issued invoices must be editable in place without
    losing their number.
  - `deleteDraft`: removed status guard entirely. WHY: any invoice deletable.
  - Method names (`createDraft/updateDraft/deleteDraft`) INTENTIONALLY KEPT
    to minimize merge conflicts — treat them as "invoice" methods now.
- `src/application/use-cases/update-draft-invoice.ts` (MODIFIED, comment only).
- `src/application/use-cases/delete-draft-invoice.ts` (MODIFIED) — removed
  `InvalidTransitionError` guard + unused import. Name kept for compat.
- `src/app/actions/invoices.ts` — `updateDraftInvoiceAction` (MODIFIED):
  snapshots `wasIssued`; non-issued → issue after save (surfaces errors);
  issued → rebuilds ZATCA QR (`buildQrPayload` with new totals) + deletes and
  recreates the linked receipt voucher with the new amount/reference.
  WHY: editing totals without refreshing QR/voucher leaves non-compliant docs.
- `src/app/actions/invoices.ts` — `deleteDraftInvoiceAction(id, companyId?)`
  (MODIFIED): now deletes the linked receipt voucher first (best-effort),
  accepts optional `companyId` for correct `revalidatePath`, plus new alias
  `export const deleteInvoiceAction = deleteDraftInvoiceAction`. WHY: no
  orphan vouchers; both old and new call-site names work after merge.
- Edit pages (MODIFIED, guards only):
  - `src/app/(company)/c/[companyId]/invoices/[id]/edit/page.tsx` — removed
    `redirect` for non-draft; `cancelled` → `notFound()`; title now shows the
    real invoice number.
  - `src/app/(dashboard)/invoices/[id]/edit/page.tsx` — same.
- `src/components/documents/invoice-draft-actions.tsx` (MODIFIED) — removed
  `if (status !== draft) return null`; now renders for draft+issued (only
  `cancelled` hidden); added optional `companyId` prop for correct
  edit-href/delete revalidation; texts changed مسودة→الفاتورة. Name kept.
- `src/components/documents/invoice-table-actions.tsx` (MODIFIED) — edit +
  delete now render for ALL statuses (not just draft); added duplicate
  icon-button + dialogs; delete passes `activeCompanyId`; itemName fallbacks
  renamed to فاتورة.
- `src/app/(company)/c/[companyId]/invoices/invoices-filter-view.tsx`
  (MODIFIED) — passes `customerId` into table actions (needed for duplicate
  defaults); status filter keeps `draft` only as "مسودة قديمة" for legacy
  rows; invoice-number fallback "بانتظار الترقيم".
- `src/components/forms/invoice-wizard-form.tsx` (MODIFIED) — removed
  `invoiceStatus` state + Draft/Issued toggle UI (replaced with a static
  "معتمدة ومصدرة" badge); hidden `_action`/`status` are now hardcoded to
  `issue`/`issued`; submit button always "إصدار واعتماد..." (or "حفظ
  التعديلات" when editing); removed unused icon imports.
- Dashboard pages (MODIFIED):
  - `src/app/(dashboard)/invoices/[id]/page.tsx` — always renders
    `InvoiceDraftActions` (issue button only for legacy drafts); passes
    `companyId/customerId` into detail actions; neutral "—"/"بانتظار الإصدار"
    fallbacks instead of DRAFT/مسودة.
  - `src/app/(dashboard)/invoices/[id]/preview/page.tsx` — same.
  - `src/app/(dashboard)/invoices/[id]/invoice-detail-client.tsx` —
    added Edit (link) + Duplicate (dialog) buttons; extended props with
    `companyId?/customerId?`.
- Company preview (MODIFIED):
  - `src/app/(company)/c/[companyId]/invoices/[id]/invoice-preview-client.tsx`
    — top bar now ALWAYS shows تعديل + تكرار + حذف (was draft-only edit);
    gear menu items updated (تكرار.../تعديل/حذف); legacy-draft issue button
    kept; added mounted `DuplicateInvoiceDialog` + `DeleteConfirmDialog`
    (delete redirects to list); `handleCopyInvoice` now opens the dialog
    instead of a toast; "مسودة" fallbacks → "فاتورة جديدة"/"بانتظار الترقيم".

### Duplicate invoice (new)
- `src/components/documents/duplicate-invoice-dialog.tsx` (ADDED) — client
  modal: fetches `/api/customers` on open, `<select>` for client (default =
  `defaultCustomerId` = same client) + `DatePickerInput` (default = today or
  `defaultIssueDate`); confirm → `router.push` to
  `/c/<companyId>/invoices/new?duplicateFrom=<id>&customerId=<c>&issueDate=<d>`
  (falls back to `/invoices/new?...` when no companyId). WHY: exact dialog
  behavior requested; self-sufficient (no customer-list prop drilling).
- `src/app/(company)/c/[companyId]/invoices/new/page.tsx` (MODIFIED, duplicate
  half) — accepts `searchParams.{duplicateFrom,customerId,issueDate}`; loads
  source via `findByIdWithItems`, builds `duplicatePrefill` (client/date
  overridden, lines/notes/terms/template/type carried over); header switches
  to "تكرار فاتورة" with guidance text; passes `duplicatePrefill` through.
- `src/components/forms/invoice-wizard-form.tsx` (MODIFIED, duplicate half) —
  new exported `DuplicatePrefill` interface + optional `duplicatePrefill` /
  `suggestedInvoiceNumber` props; customer/date/notes/terms/template/type/lines
  initializers all prefer `initialInvoice` then `duplicatePrefill` then
  defaults. Create-vs-update routing UNCHANGED (`initialInvoice` presence
  decides), so duplicates correctly hit `createDraftInvoiceAction`.

## 4. What was NOT changed (deliberately)
- DB schema / migrations: NO schema change. Sentinel reuses existing
  `company_sequences(company_id, year)` PK with `year=0`. Old per-year rows
  stay untouched (harmless). No migration needed → no merge risk there.
- `IssueInvoice` use-case logic (except via sequence service): untouched.
- `invoiceType` (simplified/standard) toggle: kept.
- Template picker, QR rendering, PDF routes, receipt-voucher numbering: untouched.
- Dashboard `/invoices/new` does NOT exist (only `/c/[companyId]/invoices/new`);
  dashboard duplicate dialogs therefore route into the company new-page. If
  main later adds a dashboard new-page, wire it the same way.

## 5. How to merge (instructions for the merger agent)
1. Work ONLY from the `-published` worktree; do NOT hand-copy files into main.
2. `git fetch origin` then `git merge origin/main` (or `git rebase origin/main`
   if the team prefers linear history) INSIDE
   `hulool-invoicing-published` on `feat/invoices-always-published`.
3. Expected conflict hotspots (all small, semantic):
   - `src/app/actions/invoices.ts` — main may have touched issue/create flows.
     Keep THIS branch's mandatory-issue + QR-refresh + voucher-cleanup logic.
   - `src/components/forms/invoice-wizard-form.tsx` — main may have added
     fields. Keep the read-only number + no-status-toggle + `duplicatePrefill`
     props; re-apply any main-side field additions around them.
   - `invoice-repository.ts` / `delete-draft-invoice.ts` — if main re-added a
     status guard, REMOVE it again (this branch is authoritative: everything
     published, everything deletable/editable except cancelled-edit).
   - Edit pages + preview/table actions — if main added buttons, keep BOTH
     sets; just don't reintroduce `status !== draft` gates.
4. After resolving: `pnpm typecheck` (must be clean) + `pnpm test` (82 tests).
5. Manual smoke (needs DB): create invoice → number is max+1 (not ...-00001);
   edit an issued invoice → totals + QR update; delete from table + preview;
   duplicate from table + preview → dialog defaults (same client/today) →
   new page prefilled → save issues a fresh number.
6. Then open PR `feat/invoices-always-published` → `main`.

## 6. Verification done in this worktree
- `pnpm typecheck` (`tsc --noEmit`): CLEAN.
- `pnpm test` (`vitest run`): 8 files / 82 tests PASSED.
- `git diff --stat`: 17 modified + 1 added (this brief excluded at time of
  diff; re-run to include it).

## 7. Risk notes for the merger
- First issue after deploy backfills the sentinel per company by scanning that
  company's invoice numbers — one extra SELECT inside the issue transaction.
  Negligible at this scale; revisit only if issue-throughput becomes a problem.
- Concurrent first-issues for a brand-new company both `DO NOTHING` on the
  backfill then serialize on the sentinel UPSERT — no duplicate numbers, at
  most a benign gap is impossible (both paths converge to 1, 2, ...).
- Edited issued invoices get a FRESH QR timestamp (`now()`), which is correct
  for Phase-1 QR (total/VAT changed) but means the QR timestamp ≠ issueDate.
  If the business later requires original-timestamp preservation, adjust only
  the `updateDraftInvoiceAction` QR-refresh block.
- Deleted invoices also delete their linked receipt voucher. If finance later
  requires voucher retention, change only the voucher-cleanup block in
  `deleteDraftInvoiceAction`.
