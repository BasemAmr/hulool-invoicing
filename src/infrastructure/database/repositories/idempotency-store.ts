import { eq } from "drizzle-orm";

import type { IdempotencyStore } from "@/application/ports/idempotency-store";
import type { Tx } from "@/application/tx";
import { asInvoiceId } from "@/domain/branding";
import type { InvoiceId } from "@/domain/branding";
import { idempotencyKeys } from "../schema";

/**
 * Postgres implementation of IdempotencyStore.
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING to atomically claim a key.
 * If the insert succeeds (row returned), the key is claimed.
 * If it fails (no row), we SELECT the existing invoice_id to determine
 * whether this is a replay of a previous request.
 */
export class IdempotencyStoreImpl implements IdempotencyStore {
  async tryClaim(
    key: string,
    invoiceId: InvoiceId,
    tx: Tx,
  ): Promise<{ claimed: boolean; existingInvoiceId: InvoiceId | null }> {
    const inserted = await tx
      .insert(idempotencyKeys)
      .values({ key, invoiceId })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (inserted.length > 0) {
      return { claimed: true, existingInvoiceId: null };
    }

    // Key already exists — look up the associated invoice
    const [existing] = await tx
      .select({ invoiceId: idempotencyKeys.invoiceId })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key));

    return {
      claimed: false,
      existingInvoiceId:
        existing?.invoiceId !== null && existing?.invoiceId !== undefined
          ? asInvoiceId(existing.invoiceId)
          : null,
    };
  }
}
