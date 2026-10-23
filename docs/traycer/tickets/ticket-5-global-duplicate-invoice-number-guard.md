# Ticket 5: Universal Invoice Number Duplicate Guard (UI & Server)

## Objective
Prevent duplicate invoice numbers across all companies globally, guarding both in the UI and on the server.

## Scope
1. **Server-Side Validation:**
   - Add `findByGlobalNumber(invoiceNumber: string, excludeInvoiceId?: string)` to `InvoiceRepository`.
   - Update `createDraftInvoiceAction` and `updateDraftInvoiceAction` to verify global uniqueness before saving or issuing.
   - Update `IssueInvoice` use-case to guard against existing numbers across ANY company.
2. **UI Live Validation:**
   - Create API route `/api/invoices/check-number?number=...&excludeId=...`.
   - In `src/components/forms/invoice-wizard-form.tsx`, debounce check on custom invoice number input.
   - If number exists in any company, display clear inline error: "رقم الفاتورة مستخدم بالفعل، يرجى اختيار رقم آخر" and disable form submission.

## Invariants & Acceptance Criteria
- [x] Entering an invoice number belonging to Company A while creating/editing in Company B is blocked in UI with inline error.
- [x] Submitting a duplicate invoice number directly to server returns friendly error and creates no records.
- [x] Editing an invoice and keeping its own invoice number is permitted.
