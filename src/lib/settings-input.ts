import { toWesternDigits } from "./format";

// NOTE: this is deliberately separate from `vat-rate.ts`'s
// `parseVatPercentToRate`. That helper interprets input as a PERCENT
// ("15" → 0.15) for the invoice-wizard line editor and never returns NaN.
// This helper interprets the settings-form value as a FRACTION first
// ("0.1500" → 0.15, the exact strings the settings <select> posts) and only
// divides by 100 for unambiguous whole-number percents; garbage yields NaN
// so the Zod schema rejects it with a visible error instead of silently
// keeping the old value (which would look like "save doesn't work").

/**
 * Parse the `defaultVatRate` form value into the 0–1 fraction the
 * `companySettingsSchema` expects.
 *
 * WHY this helper exists: the settings form posts a decimal fraction
 * ("0.1500"), but users can paste Arabic-Indic digits ("١٥"), a trailing
 * percent sign ("15%"), or a whole-number percent ("15"). Plain
 * `parseFloat` returns NaN for "١٥" and 15 (out of range) for "15%"/"15",
 * so both inputs failed Zod validation and the save was rejected even
 * though the user's intent was clear. Normalizing here — at the server
 * boundary, with the existing `toWesternDigits` helper — accepts what
 * users type instead of restricting it.
 *
 * Rules:
 * - null/undefined (key missing) → fallback (preserves the old `?? "0.15"` default).
 * - Arabic-Indic/Persian digits → Western; Arabic decimal separator "٫" → ".";
 *   Arabic thousands separator "٬", whitespace/underscores, "%"/"٪" stripped.
 * - Whole-number percents (1, n, 100] → n/100, so "15"/"15%" → 0.15.
 * - Unparseable → NaN so Zod rejects with a validation error (never silently default).
 */
export function parseVatRateInput(
  raw: string | null | undefined,
  fallback = 0.15,
): number {
  if (raw === null || raw === undefined) return fallback;
  let s = toWesternDigits(raw).trim();
  if (s.length === 0) return Number.NaN;
  s = s
    .replace(/[\s_]/g, "")
    .replace(/%/g, "")
    .replace(/٪/g, "")
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return Number.NaN;
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

/**
 * Parse the `decimalPlaces` form value. Same boundary-hardening as VAT:
 * Arabic-Indic digits ("٢") must not become NaN. Unparseable → NaN so
 * Zod (int, min 0, max 4) rejects instead of silently defaulting.
 */
export function parseDecimalPlacesInput(
  raw: string | null | undefined,
  fallback = 2,
): number {
  if (raw === null || raw === undefined) return fallback;
  const s = toWesternDigits(raw).trim();
  if (s.length === 0) return Number.NaN;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Format a stored VAT fraction back to the exact `<option value>` the
 * settings form renders ("0.1500" / "0.0500" / "0.0000").
 *
 * WHY: the DB stores numeric(5,4) strings, the repo maps them with
 * parseFloat (0.05), and the old form did `rate.toString()` → "0.05",
 * which matches NO option value — the select fell back to the first
 * option (15%) on every reload, looking exactly like "save doesn't
 * persist". `toFixed(4)` round-trips: parseFloat("0.0500").toFixed(4)
 * === "0.0500".
 */
export function formatVatRateOptionValue(rate: number): string {
  return rate.toFixed(4);
}
