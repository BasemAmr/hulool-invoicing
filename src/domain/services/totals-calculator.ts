import type { Halalas } from "../branding";
import { multiplyQuantity, sum, vatOf } from "../value-objects/money";

/**
 * Pure, deterministic totals calculator.
 *
 * For each line:
 *   lineSubtotal = multiplyQuantity(unitPrice, qty)   [round half-up]
 *   lineVat      = vatOf(lineSubtotal, vatRate)        [round half-up]
 *   lineTotal    = lineSubtotal + lineVat
 *
 * Document totals are the sum of all line components.
 */

export interface TotalsInputLine {
  unitPrice: Halalas;
  quantity: number;
  vatRate: number;
}

export interface TotalsOutputLine {
  lineSubtotal: Halalas;
  lineVat: Halalas;
  lineTotal: Halalas;
}

export interface TotalsResult {
  subtotal: Halalas;
  vatTotal: Halalas;
  total: Halalas;
  lines: TotalsOutputLine[];
}

export function calculateTotals(lines: TotalsInputLine[]): TotalsResult {
  const outputLines: TotalsOutputLine[] = lines.map((line) => {
    const lineSubtotal = multiplyQuantity(line.unitPrice, line.quantity);
    const lineVat = vatOf(lineSubtotal, line.vatRate);
    const lineTotal = (lineSubtotal + lineVat) as Halalas;
    return { lineSubtotal, lineVat, lineTotal };
  });

  const subtotal = sum(...outputLines.map((l) => l.lineSubtotal));
  const vatTotal = sum(...outputLines.map((l) => l.lineVat));
  const total = sum(...outputLines.map((l) => l.lineTotal));

  return { subtotal, vatTotal, total, lines: outputLines };
}
