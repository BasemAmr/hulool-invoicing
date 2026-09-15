# Editing Brief — Template 21 (generic monochrome delivery note) + real-invoice preview fix

## Branch / base / worktree

- Branch: `feat/template-21-pepsico-delivery-note`
- Base commit: `dd38ff4` ("finally") — `git merge-base HEAD main` = `dd38ff4a18a636f288fa55303ff1668dcda1f528`
- Worktree path: `D:\_awad work\invoice app\hulool-invoicing-template21`
- Main checkout (`D:\_awad work\invoice app\hulool-invoicing`) was NOT touched. Nothing committed, pushed, or PR'd — all edits are uncommitted in this worktree.

## Added files

- `src/infrastructure/pdf/templates/generic-delivery-note-template.tsx` — new `GenericDeliveryNoteTemplate` (+ `GenericDeliveryNoteTemplateProps`, same prop shape as `SaAlkoufiTemplateProps`). Monochrome (black/gray only) A4-portrait delivery note: centered bilingual company header (dynamic name/address/phones/VAT/CR + centered logo when available), "بيان تسليم بضاعة Delivery Note" + "أصلي ORIGINAL" title band, bilingual meta grid (date / delivery-note no / customer / address / customer VAT / salesman), 7-column items table (code / description / qty / goods value / disc / VAT / total) with summed TOTAL row, salesman+customer signature boxes, "Amounts are in SAR", "Printed On" date, QR when available. Uses only the already-registered `Amiri` font family. All values dynamic with `""` fallbacks; salesman/fax/toll-free/product-code read via optional chaining because `InvoiceDto`/`CompanyRecord`/`CustomerRecord` have no such columns (see WHY comments in-file).
- `EDITING-BRIEF-TEMPLATE21.md` — this file.

## Edited files (why)

- `src/app/(company)/c/[companyId]/invoices/[id]/invoice-preview-client.tsx` — THE BUG FIX: passes `companyId={companyId}` + `invoiceId={invoice.id}` to `<TemplateBrowserDrawer />` so the picker previews the real invoice instead of sample stubs (2 added lines; `selectedTemplateId` + `onSelect` logic unchanged).
- `src/components/drawers/template-browser-drawer.tsx` — trivial UX badge only: "معاينة الفاتورة الحالية" (green, when `invoiceId` present) vs "بيانات تجريبية" (amber, when absent), invoice-mode only. No layout/API change; receipt-mode URL (`type=receipt`) untouched.
- `src/infrastructure/pdf/templates/registry.ts` — appends `generic_delivery_21` entry (`نموذج 21` / `Template 21`, `company_chosen`, `classic`, monochrome colors, bilingual). No existing entries touched.
- `src/infrastructure/pdf/invoice-document.tsx` — appends import + `if (templateDef.id === "generic_delivery_21")` dispatcher branch alongside the other `company_chosen` branches. No existing branches touched.
- `src/infrastructure/pdf/templates/registry.test.ts` — registry count 38 → 39 and `generic_delivery_21` added to expected IDs (required: the test asserts exact registry size).

## Deleted files

- None.

## Caller audit (`<TemplateBrowserDrawer` usages — all correct)

- `invoice-preview-client.tsx` — now passes `companyId` + `invoiceId` ✅ (fixed here)
- `invoice-wizard-form.tsx` (~1088) — already passes `companyId` + `invoiceId` (`initialInvoice?.id`; undefined for brand-new drafts correctly falls back to stubs) ✅
- `company-settings-form.tsx` (~479, ~489, invoice + receipt modes) — passes `companyId` only; correct as-is since no invoice exists in settings context ✅

## Merge guidance

- Clean merge expected: this branch only **appends** in the two hotspot files (`registry.ts` entry, `invoice-document.tsx` branch) and touches two UI files for the preview fix.
- If main has added templates since `dd38ff4`, keep **both sides'** registry entries and dispatcher branches; ensure the `generic_delivery_21` entry + its dispatcher `if` survive, and bump `registry.test.ts` counts/expected-IDs to match the merged total.
- Keep the badge conditional (`!isReceipt`) so receipt mode stays sample-based by design.

## How to verify

- `npx tsc --noEmit` → exit 0 (verified).
- `npx vitest run src/infrastructure/pdf/templates/registry.test.ts` → 3/3 passed (verified).
- Render smoke test (temporary `tsx` script, since removed): `GenericDeliveryNoteTemplate` rendered via `renderToBuffer` with empty items (35,367 bytes, placeholder row, no crash) and with 2 items (36,126 bytes) → OK.
- Manual: open any issued invoice → magnifier (تغيير القالب) → picker now shows the real invoice (green "معاينة الفاتورة الحالية" badge); select `نموذج 21` → PDF shows the monochrome delivery-note layout with dynamic company/customer/items and QR when available.

## Intentionally NOT changed

- `company-settings-form.tsx` stub fallback (no `invoiceId`) is correct — no invoice exists in settings context.
- No font files registered or added (reuses `Amiri` via `react-pdf-renderer.ts`); no binary assets.
- No new dependencies, env changes, or migrations.
- Visible Arabic name is generic `نموذج 21` only — no English/brand marketing name in the UI (`nameEn: "Template 21"` is registry metadata only).
