import { INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_SEQ_PAD } from "../constants";
import { ValidationError } from "../errors";

export interface ParsedInvoiceNumber {
  prefix: string;
  year?: number;
  sequence: number;
}

/**
 * Format an invoice number started by the company prefix:
 * `PREFIXnnnnn` (no hyphens, unique sequential number).
 */
export function formatInvoiceNumber(
  prefix: string,
  yearOrSeq: number,
  maybeSeq?: number,
): string {
  const sequence = maybeSeq !== undefined ? maybeSeq : yearOrSeq;
  return `${prefix}${String(sequence).padStart(
    INVOICE_NUMBER_SEQ_PAD,
    "0",
  )}`;
}

/**
 * Increment the last invoice number by 1.
 * Finds the trailing digits, increments them by 1, preserving padding (minimum 5 digits).
 * If no invoice number exists, returns `${prefix}00001`.
 */
export function incrementInvoiceNumber(lastInvoiceNumber: string | null | undefined, prefix: string): string {
  if (!lastInvoiceNumber || !lastInvoiceNumber.trim()) {
    return formatInvoiceNumber(prefix, 1);
  }

  const trimmed = lastInvoiceNumber.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);

  if (!match || match[2] === undefined) {
    // If no trailing digits found in the string, append 00001
    return `${trimmed}00001`;
  }

  const basePrefix = match[1] ?? "";
  const digitsStr = match[2];
  const nextNum = (BigInt(digitsStr) + BigInt(1)).toString();
  const minPad = Math.max(digitsStr.length, INVOICE_NUMBER_SEQ_PAD);
  const paddedNext = nextNum.padStart(minPad, "0");

  return `${basePrefix}${paddedNext}`;
}

export function isValidInvoiceNumber(s: string): boolean {
  return INVOICE_NUMBER_PATTERN.test(s);
}

/**
 * Parse an invoice number into its components.
 * Supports `PREFIXnnnnn`, `PREFIX-nnnnn` and legacy `PREFIX-YYYY-nnnnn`.
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
  
  // Format without hyphen: PREFIXnnnnn (where sequence is at least INVOICE_NUMBER_SEQ_PAD digits)
  const match = s.match(/^([A-Z0-9]+?)(\d{5,})$/);
  if (match) {
    return {
      prefix: match[1]!,
      sequence: parseInt(match[2]!, 10),
    };
  }

  throw new ValidationError(`Invalid invoice number: "${s}"`);
}

// ─── user-editable custom numbers ─────────────────────────────────────
//
// The DB column is `text` with NO length limit (see schema.ts
// `invoiceNumber: text("invoice_number")` + drizzle/0000: `"invoice_number"
// text`), so the cap below is an application-level guard, not a DB mirror:
// generous enough for `INV-2026-001`, Arabic free text, etc., while bounding
// stored length for the voucher `reference`/`notes` that embed the number.
// Charset is deliberately permissive — the auto `PREFIX-nnnnn` pattern is
// NEVER forced on custom input; only trim + non-empty + max length apply.

/** Application-level max length for a user-typed invoice number. */
export const MAX_CUSTOM_INVOICE_NUMBER_LENGTH = 64;

/** Exact DB unique-constraint name backing per-company uniqueness. */
export const INVOICE_NUMBER_UNIQUE_CONSTRAINT =
  "invoices_company_invoice_number_unique";

export const DUPLICATE_INVOICE_NUMBER_MESSAGE =
  "رقم الفاتورة مستخدم مسبقاً في هذه الشركة — اختر رقماً آخر";

export const MISSING_INVOICE_NUMBER_MESSAGE =
  "رقم الفاتورة مطلوب — لا يمكن حفظ الفاتورة بدون رقم";

export const INVOICE_NUMBER_TOO_LONG_MESSAGE = `رقم الفاتورة طويل جداً — الحد الأقصى ${MAX_CUSTOM_INVOICE_NUMBER_LENGTH} حرفاً`;

/**
 * Normalize raw client input to a trimmed number string.
 * Returns undefined for missing/empty/whitespace/non-string input so
 * callers can distinguish "no override" (auto/preserve) from a value.
 * Never throws — validation (length, duplicates) happens server-side in
 * the use cases, which own the friendly Arabic messages.
 */
export function normalizeCustomInvoiceNumber(
  raw: unknown,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extract the trailing sequence for sentinel catch-up.
 * Returns the sequence when the custom number matches the auto-generated
 * form for THIS company's prefix (`PREFIXnnnnn` or `PREFIX-nnnnn`).
 * Anything else (free text, Arabic, `PREFIX-YYYY-nnnnn` legacy shape,
 * other company's prefix) returns null → caller skips catch-up but still
 * enforces uniqueness. A later auto-allocation can only collide with a
 * custom number that looks like an auto number, so only that shape needs
 * the sentinel advanced past it.
 */
export function extractSequenceForCatchUp(
  customNumber: string,
  companyPrefix: string,
): number | null {
  // Prefix comes from our own companies table, but escape anyway: it is
  // interpolated into a RegExp and must never act as a pattern.
  const escaped = companyPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = new RegExp(`^${escaped}(\\d+)$`).exec(customNumber.trim());
  if (!m) {
    m = new RegExp(`^${escaped}-(\\d+)$`).exec(customNumber.trim());
  }
  if (!m) return null;
  const seq = parseInt(m[1]!, 10);
  return Number.isFinite(seq) && seq > 0 ? seq : null;
}

/**
 * Detect the per-company invoice-number unique violation in a driver error.
 * node-postgres surfaces `{ code: "23505", constraint, detail }`; Drizzle
 * rethrows the driver error unwrapped, but walk `cause` defensively in case
 * a future wrapper nests it. Requires the 23505 code AND a mention of our
 * constraint/column so a different unique violation is never misreported
 * as "number already used".
 */
export function isInvoiceNumberUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  // Bounded walk: error-cause chains are short; never loop forever on a
  // self-referential `cause`.
  for (let i = 0; i < 5 && cur !== null && cur !== undefined; i++) {
    const rec = cur as {
      code?: unknown;
      constraint?: unknown;
      detail?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (rec.code === "23505") {
      const constraint = String(rec.constraint ?? "");
      const detail = String(rec.detail ?? "");
      const message = String(rec.message ?? "");
      if (
        constraint.includes(INVOICE_NUMBER_UNIQUE_CONSTRAINT) ||
        detail.includes(INVOICE_NUMBER_UNIQUE_CONSTRAINT) ||
        message.includes(INVOICE_NUMBER_UNIQUE_CONSTRAINT) ||
        constraint.includes("invoice_number") ||
        detail.includes("invoice_number") ||
        message.includes("invoice_number")
      ) {
        return true;
      }
      return false;
    }
    cur = rec.cause;
  }
  return false;
}
