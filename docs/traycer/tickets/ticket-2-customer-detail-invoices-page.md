# Ticket 2: Customer Detail Page with Cross-Company Invoices & Infinite Scroll

## Objective
Create `/customers/[id]` and `/customer/[id]` page displaying customer title/details and a table of all invoices issued to this customer across any company, with 50-item batches and infinite scroll on load more.

## Scope
1. **Repository & Port:**
   - In `InvoiceRepository`, add `listByCustomer(customerId, limit, offset)` and `countByCustomer(customerId)`.
2. **API Endpoint / Server Action:**
   - `/api/customers/[id]/invoices` supporting `limit=50&offset=...`.
3. **Pages & Components:**
   - Page route `src/app/(dashboard)/customers/[id]/page.tsx`.
   - Page route `src/app/customer/[id]/page.tsx` (redirects to `/customers/[id]`).
   - Customer Header: Name (Arabic & English), VAT number, phone, email, address.
   - Infinite scroll table component with IntersectionObserver / scroll detection.
   - Rows show: Invoice number, company name (with badge/link), issue date, total, status, preview link.

## Invariants & Acceptance Criteria
- [x] Accessing `/customers/:id` or `/customer/:id` renders the customer details.
- [x] Invoices from ALL companies belonging to this customer are listed.
- [x] Initial load is 50 items.
- [x] Scrolling to the bottom automatically fetches the next 50 items until all are displayed.
