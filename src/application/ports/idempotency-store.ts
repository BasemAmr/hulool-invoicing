import type { InvoiceId } from "@/domain/branding";
import type { Tx } from "../tx";

export interface IdempotencyStore {
  /**
   * Attempt to claim an idempotency key for an invoice.
   * If the key already exists, returns `claimed: false` with the
   * `existingInvoiceId` (which may be null if the key was claimed but
   * no invoice was ever associated).
   *
   * MUST run inside the caller's transaction.
   */
  tryClaim(
    key: string,
    invoiceId: InvoiceId,
    tx: Tx,
  ): Promise<{ claimed: boolean; existingInvoiceId: InvoiceId | null }>;
}
