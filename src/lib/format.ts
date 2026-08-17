/**
 * Display formatters. Presentation-only — domain math stays in value-objects.
 */

/** "1150.00" -> "1,150.00" (Latin digits — accounting convention). */
export function formatMoney(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const digits = negative ? decimalString.slice(1) : decimalString;
  const [whole, frac] = digits.split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withFraction = frac !== undefined ? `${grouped}.${frac}` : `${grouped}.00`;
  return negative ? `-${withFraction}` : withFraction;
}

/** Money + SAR label, e.g. "1,150.00 SAR". */
export function formatSar(decimalString: string): string {
  return `${formatMoney(decimalString)} SAR`;
}

/** ISO "2026-08-17" stays as-is; used verbatim in lists and details. */
export function formatIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Arabic status labels. */
export const STATUS_LABELS_AR = {
  draft: "مسودة",
  issued: "صادرة",
  cancelled: "ملغاة",
} as const;

export const PAYMENT_METHOD_LABELS_AR = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  other: "أخرى",
} as const;
