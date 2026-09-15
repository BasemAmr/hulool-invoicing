import { VAT_RATE } from "@/domain/constants";
import { toWesternDigits } from "./format";

/**
 * Per-line VAT percent ↔ rate helpers for the invoice wizard.
 *
 * The wizard stores VAT as a rate 0..1 (`LineItemDraft.vatRate`) but edits it
 * as a percent 0..100 ("15" for 15%). These helpers are the single seam for
 * that conversion so it can be unit-tested (Arabic-Indic digits, clamping,
 * never-NaN fallback).
 */

/** Preset percent options shown in the VAT dropdown. */
export const VAT_PRESET_PERCENTS = [0, 5, 15] as const;

/**
 * Format a 0..1 rate as a trimmed percent string ("0.15" → "15", 0.075 → "7.5").
 * Rounds to 2 decimals first so float artefacts (0.15*100 = 15.000...2) never
 * leak into the UI or into preset comparisons.
 */
export function formatVatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) return "15";
  const pct = Math.round(rate * 10000) / 100;
  return String(pct);
}

/** True when a rate matches one of the 0/5/15 presets (epsilon-safe). */
export function isPresetVatRate(rate: number): boolean {
  if (!Number.isFinite(rate)) return false;
  const pct = Math.round(rate * 10000) / 100;
  return (VAT_PRESET_PERCENTS as readonly number[]).includes(pct);
}

/**
 * Parse a user-typed percent string ("15", "٧٫٥") into a 0..1 rate.
 *
 * - Normalizes Eastern Arabic/Persian digits via the shared `toWesternDigits`
 *   helper so Arabic-Indic input works like the quantity/price fields.
 * - Normalizes the Arabic decimal separator "٫" (U+066B) to "." —
 *   `toWesternDigits` only maps digits, so "٧٫٥" would otherwise stay "7٫5"
 *   and parse as NaN. Persian thousands "٬" is stripped; a comma is treated
 *   as a decimal separator ("7,5" → 7.5) since VAT percents never need
 *   thousands grouping. "%"/"٪" and whitespace are ignored.
 * - Clamps to 0..100 before dividing by 100, so ">100" → 1 and negatives → 0.
 * - Empty/garbage input returns `fallbackRate` (the line's previous valid
 *   rate) — never NaN — so clearing the box mid-edit keeps the last good
 *   value instead of poisoning totals. If the fallback itself is not finite
 *   (should never happen; line state is always valid), falls back to the
 *   domain default VAT_RATE rather than returning NaN.
 */
export function parseVatPercentToRate(
  raw: string | null | undefined,
  fallbackRate: number,
): number {
  const safeFallback =
    Number.isFinite(fallbackRate) && fallbackRate >= 0 && fallbackRate <= 1
      ? fallbackRate
      : VAT_RATE;
  if (raw === null || raw === undefined) return safeFallback;
  const western = toWesternDigits(String(raw));
  const normalized = western
    .replace(/[٫]/g, ".")
    .replace(/[٬]/g, "")
    .replace(/,/g, ".")
    .replace(/[٪%]/g, "")
    .trim();
  if (normalized === "") return safeFallback;
  const parsed = parseFloat(normalized);
  // Deliberate fallback: garbage ("abc", "--", ".") keeps the previous valid
  // rate so totals never see NaN; the cell resets its text on blur.
  if (!Number.isFinite(parsed)) return safeFallback;
  const clamped = Math.min(100, Math.max(0, parsed));
  return clamped / 100;
}
