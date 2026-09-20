/**
 * All magic values for the invoicing domain live here.
 * Clean Code G28: never float a hard-coded constant in logic.
 */

export const VAT_RATE = 0.15;
export const CURRENCY = "SAR";

export const INVOICE_NUMBER_SEQ_PAD = 5;
export const INVOICE_NUMBER_PREFIX_MIN = 2;
export const INVOICE_NUMBER_PREFIX_MAX = 12;

/** Standard invoice number: `PREFIXnnnnn` (no hyphen), `PREFIX-nnnnn`, or legacy `PREFIX-YYYY-nnnnn`. */
export const INVOICE_NUMBER_PATTERN = /^[A-Z0-9]{2,12}(-\d{4})?-?\d{5,}$/;

/** Saudi VAT number: 15 digits starting with '3'. */
export const VAT_NUMBER_PATTERN = /^3\d{14}$/;

/** Company invoice-number prefix: 2-12 uppercase alphanumerics. */
export const COMPANY_PREFIX_PATTERN = /^[A-Z0-9]{2,12}$/;

export const INVOICE_STATUSES = ["draft", "issued", "cancelled"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "other"] as const;

export const HALALAS_PER_RIYAL = 100;
export const QUANTITY_DECIMAL_PLACES = 4;
export const QUANTITY_BASIS_POINTS = 10_000;
export const VAT_RATE_BASIS = 1_000_000;

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;
