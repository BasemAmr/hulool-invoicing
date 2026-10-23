# Core Flows: Invoicing Platform Workflows

## Flow 1: Deleting a Company
1. **Entry:** Operator navigates to `/companies`.
2. **Action:** Clicks the red trash icon in the actions column of a company row.
3. **Guard / Confirmation:** A modal dialog appears titled "تأكيد حذف المنشأة" showing the company name.
4. **Outcome on Confirm:**
   - The company deletion executes.
   - The row disappears immediately from the table.
   - A success toast confirms deletion.
   - Clicking anywhere else on the row still opens `/c/[companyId]`.

## Flow 2: Viewing Customer Invoices Across Any Company
1. **Entry:** Operator navigates to `/customers/[id]` (or `/customer/[id]`).
2. **Display:**
   - Header shows customer name (Arabic and English), VAT number, phone, email, and address.
   - Below is a unified table of all invoices ever issued to this customer across any registered company.
   - Each row displays: Invoice Number, Company Name (with badge), Issue Date, Subtotal, VAT, Total, Status, and action buttons (View, Print PDF).
3. **Scroll & Pagination:**
   - Initial 50 invoices are displayed.
   - When scrolling near the bottom of the list, a loading spinner appears and the next 50 invoices load seamlessly without page reload.
   - When all invoices are loaded, the list displays "تم عرض جميع الفواتير".

## Flow 3: Applying an Overall Invoice Discount
1. **Entry:** Operator opens `/c/[companyId]/invoices/new` or edit page `/c/[companyId]/invoices/[id]/edit`.
2. **Interaction in Financial Summary:**
   - The summary displays:
     - المجموع الفرعي قبل الضريبة
     - ضريبة القيمة المضافة (15%)
     - FIELD OF DISCOUNT ("خصم إضافي على الفاتورة") with an SAR input field
     - الإجمالي الكلي
   - Entering an amount (e.g. `50.00`) dynamically subtracts from the total.
   - Grand total and Tafqeet words update in real time.
3. **Outcome:**
   - Saving persists the invoice with the overall discount amount.
   - PDF preview and generated documents show the discount row and exact balanced totals.

## Flow 4: Editing Manually Created Receipts
1. **Entry:** Operator navigates to `/c/[companyId]/receipts`.
2. **Distinction in Table:**
   - **Auto receipts** (generated upon invoice issuance): Show only View/Download PDF buttons; no edit icon.
   - **Manual receipts** (created via "+ سند قبض جديد"): Show an Edit icon button in the actions cell.
3. **Edit Interaction:**
   - Clicking Edit opens `/c/[companyId]/receipts/[id]/edit`.
   - The form contains customer selection, amount, receipt date, payment method, reference, and notes.
   - Saving updates the voucher and redirects back to `/receipts` with a success message.

## Flow 5: Global Invoice Number Uniqueness Guarding
1. **UI Live Validation:**
   - Operator types a custom invoice number in the invoice form.
   - If that number already belongs to ANY invoice in ANY company:
     - Red validation text appears: "رقم الفاتورة مستخدم بالفعل في النظام، يرجى اختيار رقم آخر".
     - Submit button is disabled.
2. **Server Enforcement:**
   - If a request arrives bypassing UI validation, the server action and use case check global uniqueness across all companies.
   - If duplicated, the save is rejected, returning an explicit error message with no partial or corrupt state created.
