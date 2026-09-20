import { eq, sql } from "drizzle-orm";

import type { SequencePort } from "@/application/ports/sequence-port";
import type { Tx } from "@/application/tx";
import type { CompanyId } from "@/domain/branding";
import { SequenceError } from "@/domain/errors";
import { formatInvoiceNumber } from "@/domain/value-objects/invoice-number";
import { companySequences, invoices } from "../schema";

/**
 * Postgres implementation of SequencePort.
 *
 * Invoice numbers are `PREFIX-nnnnn` with NO year segment, so the counter
 * MUST be global per company. The legacy implementation bucketed by
 * (company_id, year), which restarts at 1 every January and inevitably
 * collides with the unique(company_id, invoice_number) constraint.
 *
 * We now allocate from a single sentinel row per company (year = 0).
 * On first use the sentinel is backfilled to max(existing invoice seq)
 * so pre-existing invoices never collide with newly issued numbers.
 *
 * Allocation itself stays a single atomic UPSERT (row-level lock on the
 * conflicting sentinel row), so concurrent issues cannot get the same
 * number. The `year` argument is kept for interface compatibility but is
 * intentionally ignored — the number format has no year in it.
 */
export const INVOICE_SEQUENCE_SENTINEL_YEAR = 0;

export class PostgresSequenceService implements SequencePort {
  async nextInvoiceNumber(
    tx: Tx,
    companyId: CompanyId,
    prefix: string,
    _year: number,
  ): Promise<string> {
    // Backfill once: seed the sentinel with the highest sequence already
    // stored in invoices for this company (parses trailing digits of
    // `PREFIX-nnnnn` and legacy `PREFIX-YYYY-nnnnn`). Runs as INSERT ...
    // ON CONFLICT DO NOTHING so concurrent first-calls are safe: exactly
    // one wins, the rest keep the existing sentinel value.
    try {
      const existing = await tx
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.companyId, companyId));
      let maxSeq = 0;
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefixRegex = new RegExp(`^${escapedPrefix}-?(\\d+)$`);

      for (const row of existing) {
        const num = row.invoiceNumber;
        if (!num) continue;
        
        // Match prefix first (with or without hyphen)
        const matchWithPrefix = num.match(prefixRegex);
        if (matchWithPrefix && matchWithPrefix[1]) {
          const seq = parseInt(matchWithPrefix[1], 10);
          if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
          continue;
        }

        // Fallback for custom / legacy formats
        const m = num.match(/(\d+)$/);
        if (m && m[1]) {
          const seq = parseInt(m[1], 10);
          if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
      await tx
        .insert(companySequences)
        .values({
          companyId: companyId,
          year: INVOICE_SEQUENCE_SENTINEL_YEAR,
          lastValue: maxSeq,
        })
        .onConflictDoNothing({
          target: [companySequences.companyId, companySequences.year],
        });
    } catch {
      // Backfill is best-effort: if the invoices table is unreachable here,
      // fall through to plain allocation rather than blocking issuance.
    }

    const result = await tx
      .insert(companySequences)
      .values({
        companyId: companyId,
        year: INVOICE_SEQUENCE_SENTINEL_YEAR,
        lastValue: 1,
      })
      .onConflictDoUpdate({
        target: [companySequences.companyId, companySequences.year],
        set: { lastValue: sql`${companySequences.lastValue} + 1` },
      })
      .returning({ lastValue: companySequences.lastValue });

    const lastValue = result[0]?.lastValue;
    if (lastValue === undefined) {
      throw new SequenceError(
        `Failed to allocate sequence for company ${companyId}`,
      );
    }
    return formatInvoiceNumber(prefix, lastValue);
  }

  async ensureSequenceAtLeast(
    tx: Tx,
    companyId: CompanyId,
    seq: number,
  ): Promise<void> {
    // Deliberate no-op guard: seq comes from parsing a user-typed number;
    // non-positive/non-finite values carry nothing to catch up to. NaN would
    // otherwise be sent to Postgres as a bound parameter and fail the query.
    const target = Math.trunc(seq);
    if (!Number.isFinite(target) || target <= 0) return;

    // Single atomic UPSERT on the sentinel row: concurrent catch-ups and
    // allocations serialize on the row lock, and GREATEST keeps the highest
    // value ever seen — a lower custom number can never drag the counter
    // backwards into already-issued numbers.
    await tx
      .insert(companySequences)
      .values({
        companyId: companyId,
        year: INVOICE_SEQUENCE_SENTINEL_YEAR,
        lastValue: target,
      })
      .onConflictDoUpdate({
        target: [companySequences.companyId, companySequences.year],
        set: {
          lastValue: sql`GREATEST(${companySequences.lastValue}, ${target})`,
        },
      });
  }
}
