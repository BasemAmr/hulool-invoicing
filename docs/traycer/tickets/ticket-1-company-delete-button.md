# Ticket 1: Company Table Delete Action Button

## Objective
Add a Delete button (trash icon) to the quick actions cell in `/companies` table, with a confirmation modal, matching the customer table delete action pattern.

## Scope
- File: `src/components/documents/companies-view-client.tsx`
- File: `src/components/documents/company-row-actions.tsx` (if reusable)
- Incorporate `DeleteConfirmDialog`.
- Ensure event propagation is stopped so clicking the delete button or modal does NOT navigate to `/c/[companyId]`.
- On confirmation, trigger `deleteCompanyAction(company.id)`.
- Upon successful deletion, remove the company from local state and display a success toast.

## Invariants & Acceptance Criteria
- [x] Red trash icon button is visible in each row's action cell on `/companies`.
- [x] Clicking it stops row click navigation and opens the confirmation dialog.
- [x] Confirming calls `deleteCompanyAction` and removes company from UI.
- [x] Toast confirms successful deletion.
