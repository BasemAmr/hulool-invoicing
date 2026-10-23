# Ticket 3: Full Invoice Amount Discount & Template Effects

## Objective
Support an overall lump-sum discount on the entire invoice in `/invoices/new` and `/invoices/[id]/edit`, positioned in the summary block (Subtotal -> VAT -> Discount -> Grand Total), and update PDF templates to display the discount and balanced totals.

## Scope
1. **Schema & DTO:**
   - Add `discount_amount` column to `invoices` table (`numeric(15, 2)` default `0.00`).
   - Add `discountAmount: string` to `InvoiceDto`.
   - Update `InvoiceRecord`, `CreateDraftInvoiceInput`, `UpdateDraftInvoiceInput`.
   - Update `invoiceCreateSchema` and `invoiceUpdateSchema`.
2. **Form UI:**
   - In `src/components/forms/invoice-wizard-form.tsx`:
     - Summary section:
       1. Subtotal before VAT: `totals.subtotal`
       2. VAT: `totals.vatAmount`
       3. FIELD OF DISCOUNT: "خصم إضافي على الفاتورة" / "الخصم الإجمالي" (SAR input)
       4. Grand Total: `Math.max(0, subtotal + vatAmount - discountAmount)`
     - Bind field to state and pass in `formData` as `discountAmount`.
3. **Use-Cases & Actions:**
   - In `createDraftInvoiceAction` and `updateDraftInvoiceAction`, parse and persist `discountAmount`.
4. **PDF Templates:**
   - Ensure `SimpleTemplate`, `KenanCompanyTemplate`, and other templates render the invoice discount row when `discountAmount > 0` before the grand total, and compute Tafqeet on the discounted grand total.

## Invariants & Acceptance Criteria
- [x] Discount field appears between VAT and Grand Total in the wizard form.
- [x] Changing discount dynamically updates total and Tafqeet.
- [x] Discount is saved and preserved on edit.
- [x] PDF documents display the discount line and correct arithmetic.
