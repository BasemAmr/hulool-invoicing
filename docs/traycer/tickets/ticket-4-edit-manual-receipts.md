# Ticket 4: Edit Manually Created Receipts on /receipts

## Objective
Add an Edit icon button in `/receipts` table action cell ONLY for manually created receipt vouchers (`invoiceId == null`), omitting it for auto invoice-linked receipts, and build the editing flow.

## Scope
1. **Receipts Table (`src/app/(company)/c/[companyId]/receipts/page.tsx`):**
   - Check `receipt.invoiceId`:
     - If `null`: Render Edit button icon (`Edit2` from `lucide-react`) linking to `/c/[companyId]/receipts/[receipt.id]/edit`.
     - If not `null`: Do not render Edit button.
2. **Edit Page (`src/app/(company)/c/[companyId]/receipts/[id]/edit/page.tsx`):**
   - Form pre-populated with customer, amount, receipt date, payment method, reference, notes.
   - Rejects editing of auto invoice receipts.
3. **Repository & Server Action:**
   - Add `update` method to `ReceiptVoucherRepository`.
   - Add `updateReceiptVoucherAction` in `src/app/actions/receipts.ts`.

## Invariants & Acceptance Criteria
- [x] Edit button only appears on rows where `invoiceId == null`.
- [x] Auto invoice-linked receipts cannot be edited.
- [x] Submitting the edit form updates the receipt voucher in the database and redirects to `/receipts`.
