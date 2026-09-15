import type { Halalas } from "../branding";
import {
  halalas,
  lineSubtotalHalalasExact,
  multiplyQuantity,
  sum,
  vatOf,
} from "../value-objects/money";

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
  discountAmount?: Halalas;
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
    const rawSubtotal = multiplyQuantity(line.unitPrice, line.quantity);
    const discount = line.discountAmount ?? 0;
    const lineSubtotal = Math.max(0, rawSubtotal - discount) as Halalas;
    const lineVat = vatOf(lineSubtotal, line.vatRate);
    const lineTotal = (lineSubtotal + lineVat) as Halalas;
    return { lineSubtotal, lineVat, lineTotal };
  });

  const subtotal = sum(...outputLines.map((l) => l.lineSubtotal));
  const vatTotal = sum(...outputLines.map((l) => l.lineVat));
  const total = sum(...outputLines.map((l) => l.lineTotal));

  return { subtotal, vatTotal, total, lines: outputLines };
}

/**
 * Exact-precision variant of calculateTotals.
 *
 * WHY: unit prices may carry 3+ decimals (e.g. "17.95319") that cannot be
 * represented as integer halalas. Rounding the price to halalas BEFORE
 * multiplying by quantity loses `qty x fraction` (17.95319 x 260 truncated
 * to 17.95 x 260 = 4667.00 instead of 4667.83 — the 5368-vs-5367.05 bug).
 * This variant takes the SAME full-precision decimal strings the wizard
 * display path uses and rounds ONCE per line (inside
 * lineSubtotalHalalasExact), so display math and save math agree exactly.
 * VAT + summation reuse vatOf/sum — no forked math, same per-line
 * semantics as calculateTotals (discount clamped at 0, VAT per line).
 */
export interface ExactTotalsInputLine {
  /** Full-precision SAR decimal string, e.g. "17.95319". */
  unitPrice: string;
  /** Quantity as the raw decimal string or a number (up to 4 decimals). */
  quantity: string | number;
  discountAmount?: Halalas;
  vatRate: number;
}

export function calculateTotalsExact(
  lines: ExactTotalsInputLine[],
): TotalsResult {
  const outputLines: TotalsOutputLine[] = lines.map((line) => {
    const qtyStr =
      typeof line.quantity === "number"
        ? String(line.quantity)
        : line.quantity;
    const lineSubtotal = lineSubtotalHalalasExact(
      line.unitPrice,
      qtyStr,
      line.discountAmount ?? halalas(0),
    );
    const lineVat = vatOf(lineSubtotal, line.vatRate);
    const lineTotal = (lineSubtotal + lineVat) as Halalas;
    return { lineSubtotal, lineVat, lineTotal };
  });

  const subtotal = sum(...outputLines.map((l) => l.lineSubtotal));
  const vatTotal = sum(...outputLines.map((l) => l.lineVat));
  const total = sum(...outputLines.map((l) => l.lineTotal));

  return { subtotal, vatTotal, total, lines: outputLines };
}
