import path from "node:path";
import dotenv from "dotenv";

// Load Next.js env files: .env.local, .env.development, .env
// (same pattern as src/infrastructure/database/seed-admin.ts).
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { eq } from "drizzle-orm";
import { createContainer } from "../src/application/container";
import { db } from "../src/infrastructure/database";
import { invoices } from "../src/infrastructure/database/schema";

/**
 * Backfill receipt vouchers for ISSUED invoices that have none.
 *
 * WHY this exists: the pre-fix delete flow removed the voucher BEFORE
 * attempting the invoice delete (which then failed on the invoice_items FK),
 * and the pre-fix edit flow deleted + recreated the voucher outside a
 * transaction — both could leave an issued invoice voucher-less. Fixed code
 * is atomic, but rows orphaned before the fix need healing.
 *
 * Idempotent: only touches issued invoices with zero linked vouchers.
 * Dry-run by default; pass --apply to write.
 *
 * Prod usage (Coolify terminal, app container):
 *   node --import=tsx scripts/backfill-missing-vouchers.ts        # dry run
 *   node --import=tsx scripts/backfill-missing-vouchers.ts --apply
 */

const container = createContainer(db);

async function main() {
  const apply = process.argv.includes("--apply");

  const issued = await db.query.invoices.findMany({
    where: (t, { eq }) => eq(t.status, "issued"),
  });
  console.log(`[Backfill] Found ${issued.length} issued invoices.`);

  let missing = 0;
  let created = 0;
  for (const inv of issued) {
    const existing =
      await container.receiptVoucherRepository.findByInvoiceId(inv.id);
    if (existing) continue;
    missing += 1;
    console.log(
      `[Backfill] ${apply ? "Creating" : "Would create"} voucher for ${
        inv.invoiceNumber ?? inv.id
      } (total=${inv.total})`
    );
    if (!apply) continue;
    // Mirror IssueInvoice step 7 exactly: same fields, same semantics.
    await container.receiptVoucherRepository.create({
      companyId: inv.companyId,
      customerId: inv.customerId,
      invoiceId: inv.id,
      voucherDate: inv.issueDate,
      amount: inv.total as unknown as number,
      paymentMethod: "other",
      reference: inv.invoiceNumber ?? undefined,
      notes: `سند قبض للفاتورة رقم ${inv.invoiceNumber ?? ""}`,
    } as never);
    created += 1;
  }

  console.log(
    `[Backfill] Done. Missing=${missing} Created=${created}${
      apply ? "" : " (dry run — re-run with --apply to write)"
    }`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Backfill] FAILED:", err);
    process.exit(1);
  });
