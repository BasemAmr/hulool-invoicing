import type { CompanyId } from "@/domain/branding";
import type { Tx } from "../tx";

/**
 * Allocates the next invoice number for a company (global per company).
 * MUST run inside the caller's transaction so that sequence allocation,
 * idempotency claim, and invoice update are atomic.
 *
 * The `year` argument is legacy/ignored: numbers are `PREFIX-nnnnn`
 * with no year segment, so the counter never resets per year.
 * Returns the fully formatted invoice number string (`PREFIX-nnnnn`).
 */
export interface SequencePort {
  nextInvoiceNumber(
    tx: Tx,
    companyId: CompanyId,
    prefix: string,
    year: number,
  ): Promise<string>;
}
