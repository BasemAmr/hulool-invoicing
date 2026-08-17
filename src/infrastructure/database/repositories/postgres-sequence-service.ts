import { sql } from "drizzle-orm";

import type { SequencePort } from "@/application/ports/sequence-port";
import type { Tx } from "@/application/tx";
import type { CompanyId } from "@/domain/branding";
import { SequenceError } from "@/domain/errors";
import { formatInvoiceNumber } from "@/domain/value-objects/invoice-number";
import { companySequences } from "../schema";

/**
 * Postgres implementation of SequencePort.
 *
 * Uses a single atomic UPSERT statement:
 *   INSERT INTO company_sequences (company_id, year, last_value)
 *   VALUES ($1, $2, 1)
 *   ON CONFLICT (company_id, year)
 *   DO UPDATE SET last_value = company_sequences.last_value + 1
 *   RETURNING last_value
 *
 * This guarantees gap-free sequence allocation under concurrent access
 * because the UPDATE acquires a row-level lock on the conflicting row.
 */
export class PostgresSequenceService implements SequencePort {
  async nextInvoiceNumber(
    tx: Tx,
    companyId: CompanyId,
    prefix: string,
    year: number,
  ): Promise<string> {
    const result = await tx
      .insert(companySequences)
      .values({
        companyId: companyId,
        year: year,
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
        `Failed to allocate sequence for company ${companyId}, year ${year}`,
      );
    }
    return formatInvoiceNumber(prefix, year, lastValue);
  }
}
