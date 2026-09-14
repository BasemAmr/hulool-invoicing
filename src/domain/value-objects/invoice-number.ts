import { INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_SEQ_PAD } from "../constants";
import { ValidationError } from "../errors";

export interface ParsedInvoiceNumber {
  prefix: string;
  year?: number;
  sequence: number;
}

/**
 * Format an invoice number started by the company prefix:
 * `PREFIX-nnnnn` (no year date, single dash, unique sequential number).
 */
export function formatInvoiceNumber(
  prefix: string,
  yearOrSeq: number,
  maybeSeq?: number,
): string {
  const sequence = maybeSeq !== undefined ? maybeSeq : yearOrSeq;
  return `${prefix}-${String(sequence).padStart(
    INVOICE_NUMBER_SEQ_PAD,
    "0",
  )}`;
}

export function isValidInvoiceNumber(s: string): boolean {
  return INVOICE_NUMBER_PATTERN.test(s);
}

/**
 * Parse an invoice number into its components.
 * Supports both `PREFIX-nnnnn` and legacy `PREFIX-YYYY-nnnnn`.
 * Throws ValidationError on malformed input.
 */
export function parseInvoiceNumber(s: string): ParsedInvoiceNumber {
  if (!INVOICE_NUMBER_PATTERN.test(s)) {
    throw new ValidationError(`Invalid invoice number: "${s}"`);
  }
  const parts = s.split("-");
  if (parts.length === 3) {
    return {
      prefix: parts[0]!,
      year: parseInt(parts[1]!, 10),
      sequence: parseInt(parts[2]!, 10),
    };
  }
  if (parts.length === 2) {
    return {
      prefix: parts[0]!,
      sequence: parseInt(parts[1]!, 10),
    };
  }
  throw new ValidationError(`Invalid invoice number: "${s}"`);
}
