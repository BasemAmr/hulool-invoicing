import { INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_SEQ_PAD } from "../constants";
import { ValidationError } from "../errors";

export interface ParsedInvoiceNumber {
  prefix: string;
  year: number;
  sequence: number;
}

/**
 * Format an invoice number as `PREFIX-YYYY-nnnnn`
 * (5-digit zero-padded sequence).
 */
export function formatInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}-${year}-${String(sequence).padStart(
    INVOICE_NUMBER_SEQ_PAD,
    "0",
  )}`;
}

export function isValidInvoiceNumber(s: string): boolean {
  return INVOICE_NUMBER_PATTERN.test(s);
}

/**
 * Parse a `PREFIX-YYYY-nnnnn` string into its components.
 * Throws ValidationError on malformed input.
 */
export function parseInvoiceNumber(s: string): ParsedInvoiceNumber {
  if (!INVOICE_NUMBER_PATTERN.test(s)) {
    throw new ValidationError(`Invalid invoice number: "${s}"`);
  }
  const parts = s.split("-");
  const prefix = parts[0];
  const yearStr = parts[1];
  const seqStr = parts[2];
  if (prefix === undefined || yearStr === undefined || seqStr === undefined) {
    throw new ValidationError(`Invalid invoice number: "${s}"`);
  }
  return {
    prefix,
    year: parseInt(yearStr, 10),
    sequence: parseInt(seqStr, 10),
  };
}
