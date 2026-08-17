import type { CompanyId } from "@/domain/branding";
import type { Tx } from "../tx";

/**
 * Allocates the next invoice number for a company in a given year.
 * MUST run inside the caller's transaction so that sequence allocation,
 * idempotency claim, and invoice update are atomic.
 *
 * Returns the fully formatted invoice number string (`PREFIX-YYYY-nnnnn`).
 */
export interface SequencePort {
  nextInvoiceNumber(
    tx: Tx,
    companyId: CompanyId,
    prefix: string,
    year: number,
  ): Promise<string>;
}
