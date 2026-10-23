# Epic Brief: Invoicing Platform Core Capabilities & Data Integrity Hardening

## Overview & Background
Hulool Invoicing is a multi-company Saudi tax invoicing and receipt management platform compliant with ZATCA Phase 1 & 2 e-invoicing requirements.
This initiative addresses five critical workflow, financial, and data integrity capabilities demanded for day-to-day operations:
1. Safe deletion of registered companies directly from the companies registry view.
2. Cross-company customer intelligence via a dedicated customer profile page showing all invoices issued to a customer across any company in the bureau, paginated at 50 items with infinite scroll.
3. Invoice-level lump-sum discount support in invoice creation and editing (`/invoices/new` and `/invoices/[id]/edit`), calculating between subtotal, VAT, discount, and grand total, seamlessly reflected in PDF invoice templates.
4. Editing capabilities for manually created receipt vouchers on `/receipts`, while preserving immutable audit trails for automated invoice-linked receipts.
5. Strict, proactive UI and server-level guards preventing duplicate invoice numbers globally across all companies.

## Who / What Is Affected
- **Bureau Operators & Accountants:** Need frictionless company management, cross-company customer invoice aggregation, manual receipt editing, and invoice-level discounting.
- **Customers & Debtors:** Receive invoices reflecting overall commercial discounts with exact arithmetic and compliant QR codes.
- **Platform Invariants & ZATCA Integrity:** Invoice numbers must be strictly unique to prevent collision, duplicate filing, and accounting confusion.

## Broad Scope
1. **Company Deletion UI:** Add a delete action icon with confirmation dialog to the company data table on `/companies`, matching the customer table delete action pattern.
2. **Customer Detail Page (`/customers/[id]` and `/customer/[id]`):** Displays customer details and an infinite-scrolling / paginated (50 per batch) list of invoices issued to this customer across all companies.
3. **Invoice Overall Discount:** Provide an input field for invoice-level discount in the summary block (Subtotal -> VAT -> Discount -> Grand Total), persist it in the database and DTOs, and propagate it accurately to PDF rendering and totals displays.
4. **Manual Receipt Voucher Editing:** Enable edit actions in `/receipts` for manual receipts (`invoiceId == null`), providing a dedicated edit view and update mutation, while omitting the edit action for auto-generated invoice-linked receipts.
5. **Universal Invoice Number Uniqueness Guard:** Ensure invoice numbers cannot be duplicated across any company, with live validation in the UI wizard and atomic verification in the server action, use case, and database constraint.

## Out of Scope
- Modifying historical published invoice PDFs unless explicitly edited.
- Breaking backwards compatibility for existing line-item discounts.
