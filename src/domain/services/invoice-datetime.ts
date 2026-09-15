/**
 * Invoice wall-time helpers — Asia/Riyadh convention.
 *
 * WHY this file exists: `invoices.issue_date` is a date-only column and the
 * new `issue_time` column stores the wizard's HH:MM wall-time as picked by an
 * Asia/Riyadh user. The ZATCA QR (Tag 3) requires a valid ISO instant, so the
 * picked wall-time must be converted to UTC at QR build time — never emit a
 * floating local time into the QR.
 *
 * Convention (applied in ALL writers/readers): the stored HH:MM is wall-time
 * in Asia/Riyadh, which is DST-free and always UTC+3. Conversion is therefore
 * a fixed -3h shift: `2026-09-15 + 14:30 Riyadh → 2026-09-15T11:30:00.000Z`.
 * `issuedAt` (timestamptz, the system issuance moment) is a DIFFERENT concept
 * and is untouched by this.
 */

/** Strict 24h HH:MM — "00:00".."23:59". */
export const ISSUE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Asia/Riyadh is always UTC+3 (no DST) — fixed offset, no tz database needed. */
export const RIYADH_UTC_OFFSET_MINUTES = 3 * 60;

/** Fallback for legacy rows written before the time picker existed. */
export const DEFAULT_ISSUE_TIME = "00:00";

export function isValidIssueTime(v: unknown): v is string {
  return typeof v === "string" && ISSUE_TIME_PATTERN.test(v);
}

/**
 * Normalize any stored/submitted time to a valid HH:MM.
 * WHY the silent fallback: legacy rows (and any corrupt value) must still
 * yield midnight + a valid QR instead of throwing mid-issuance.
 */
export function normalizeIssueTime(v: unknown): string {
  return isValidIssueTime(v) ? (v as string) : DEFAULT_ISSUE_TIME;
}

/**
 * Combine a YYYY-MM-DD date + HH:MM Riyadh wall-time into a UTC ISO instant
 * for the ZATCA QR Tag 3.
 *
 * `fallbackNow` is the corrupt-data guard: when the stored datetime is
 * missing/unparseable (should never happen on the normal path — writers
 * validate + backfill), fall back to server-now so the QR stays valid
 * instead of throwing. Pass `new Date()` at the call site.
 */
export function invoiceDateTimeToUtcIso(
  issueDate: string,
  issueTime: unknown,
  fallbackNow: Date,
): string {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(issueDate);
  const time = normalizeIssueTime(issueTime);
  if (!dateOk) return fallbackNow.toISOString();
  const [h, m] = time.split(":").map(Number);
  // Interpret wall-time as Riyadh (UTC+3) → shift to UTC.
  const utcMs =
    Date.UTC(
      Number(issueDate.slice(0, 4)),
      Number(issueDate.slice(5, 7)) - 1,
      Number(issueDate.slice(8, 10)),
      (h ?? 0),
      (m ?? 0),
      0,
      0,
    ) - RIYADH_UTC_OFFSET_MINUTES * 60_000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return fallbackNow.toISOString();
  return d.toISOString();
}
