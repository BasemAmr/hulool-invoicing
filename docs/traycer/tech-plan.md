# Tech Plan: Invoicing Platform Core Capabilities & Hardening

## 1. Company Deletion in Table Actions (`/companies`)
### Component & Data Flow
- **UI File:** `src/components/documents/companies-view-client.tsx`
- **Action:** `deleteCompanyAction(id: string)` in `src/app/actions/companies.ts` (already handles domain deletion and `revalidatePath('/companies')`).
- **Interaction:**
  - Add a Delete button (`Trash2` icon) in the actions cell of each row in `CompaniesViewClient`.
  - Must call `e.stopPropagation()` and `e.preventDefault()` to prevent row click from navigating to `/c/[companyId]`.
  - Triggers `DeleteConfirmDialog` with company name.
  - On confirm, calls `deleteCompanyAction(company.id)`. Upon success, optimistically removes the company from the client's `companies` state and shows a success toast.

## 2. Customer Profile & Cross-Company Invoices View (`/customers/[id]` and `/customer/[id]`)
### Architecture & Routing
- Create route `src/app/(dashboard)/customers/[id]/page.tsx` inside the dashboard layout.
- Create route `src/app/customer/[id]/page.tsx` that redirects or renders the customer page to handle `/customer/:id` URLs.
- In `src/application/ports/invoice-repository.ts` and `src/infrastructure/database/repositories/invoice-repository.ts`:
  - Add `listByCustomer(customerId: CustomerId, limit: number, offset: number): Promise<InvoiceRecord[]>`.
  - Add `countByCustomer(customerId: CustomerId): Promise<number>`.
- Cross-Company Enrichment:
  - Query all companies or batch-resolve company records by ID so each invoice row displays the issuing company's Arabic name (`company.nameAr`) with a badge/link.
- Pagination & Infinite Scroll:
  - Initial 50 invoices loaded server-side.
  - Create client component `CustomerInvoicesInfiniteTable` with an `IntersectionObserver` on a bottom sentinel element.
  - An API endpoint or server action `/api/customers/[id]/invoices?offset=50&limit=50` returns subsequent 50-item batches until exhausted.

## 3. Invoice-Level Discount
### Data Model & Arithmetic
- **Database Schema:** Add `discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).default("0.00").notNull()` to `invoices` table in `src/infrastructure/database/schema.ts`.
- **Contracts & DTOs:**
  - Update `InvoiceDto` to include `discountAmount: string`.
  - Update `invoiceCreateSchema` and `invoiceUpdateSchema` in `src/domain/contracts/index.ts` to accept optional `discountAmount?: number | string`.
  - Update `InvoiceRecord` and `CreateDraftInvoiceInput` / `UpdateDraftInvoiceInput` in `src/application/ports/invoice-repository.ts`.
  - Update `createDraftInvoiceAction` and `updateDraftInvoiceAction` to parse `discountAmount` from `formData`.
- **Math Specification:**
  - `subtotal` = sum of line subtotals (before VAT).
  - `vatAmount` = sum of line VATs.
  - `discountAmount` = invoice-level discount (clamped to `[0, subtotal + vatAmount]`).
  - `total` = `Math.max(0, subtotal + vatAmount - discountAmount)`.
- **Wizard Form UI (`invoice-wizard-form.tsx`):**
  - In the Financial Summary block, render:
    1. المجموع الفرعي (قبل الضريبة)
    2. ضريبة القيمة المضافة (15%)
    3. FIELD OF DISCOUNT: "خصم إضافي على الفاتورة" with input field for SAR amount
    4. الإجمالي الكلي
  - Live recalculation updates `totals.total` and Tafqeet immediately.
- **Templates:**
  - Update PDF templates (and shared helpers/dispatcher) so that if `discountAmount > 0`, a distinct discount line "خصم الفاتورة / Invoice Discount" is displayed in the summary table before the Grand Total, and grand total / Tafqeet match `invoice.total`.

## 4. Manual Receipt Voucher Editing (`/receipts`)
### Separation of Manual vs. Auto Receipts
- In `src/app/(company)/c/[companyId]/receipts/page.tsx`:
  - Check `receipt.invoiceId`:
    - If `receipt.invoiceId == null` (custom/manual): render an Edit button icon (`Edit2` from `lucide-react`) linking to `/c/[companyId]/receipts/[receipt.id]/edit`.
    - If `receipt.invoiceId != null` (auto-generated from invoice): do NOT render the edit icon.
- Create edit page `src/app/(company)/c/[companyId]/receipts/[id]/edit/page.tsx`:
  - Pre-populates receipt details (customer, amount, date, payment method, reference, notes).
  - Protects against editing auto receipts (redirects with error if `receipt.invoiceId != null`).
- Server Action & Repository:
  - Add `updateReceiptVoucherAction(prevState, formData)` in `src/app/actions/receipts.ts`.
  - Add `update(id: string, input: Partial<ReceiptVoucherRecord>)` to `ReceiptVoucherRepository`.

## 5. Global Duplicate Invoice Number Guard
### Invariants & Protection Layers
- **Database Layer:**
  - In `src/infrastructure/database/schema.ts`, add index/constraint ensuring `invoice_number` is unique across all non-null entries in `invoices`.
- **Repository & Port Layer:**
  - Add `findByGlobalNumber(invoiceNumber: string, excludeInvoiceId?: string): Promise<InvoiceRecord | null>` to `InvoiceRepository`.
- **Use-Case & Action Layer:**
  - In `IssueInvoice` and `UpdateDraftInvoice` use cases, and in `createDraftInvoiceAction` / `updateDraftInvoiceAction`:
    - Before setting or allocating an invoice number, check `findByGlobalNumber`.
    - If any invoice across *any* company already has this number, reject immediately with `DUPLICATE_INVOICE_NUMBER_MESSAGE` ("رقم الفاتورة مستخدم بالفعل، يرجى اختيار رقم آخر").
- **UI Layer (`invoice-wizard-form.tsx`):**
  - Add a debounced live check API endpoint `/api/invoices/check-number?number=XYZ&excludeId=ABC`.
  - When the user types a custom invoice number in `/invoices/new` or `/invoices/[id]/edit`, run the check on change/blur.
  - If a clash is detected, display a prominent inline red warning below the input field and disable the submit button.
