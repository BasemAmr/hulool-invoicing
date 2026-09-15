/**
 * Display formatters. Presentation-only — domain math stays in value-objects.
 */

const EASTERN_ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Convert Western digits (0-9) to Eastern Arabic digits (٠-٩). */
export function toEasternArabicDigits(str: string): string {
  return str.replace(/\d/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d);
}

/** Convert Eastern Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to Western standard digits (0-9). */
export function toWesternDigits(str: string): string {
  if (!str) return str;
  return str
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
}


export interface MoneyFormatSettings {
  numberFormat?: "ar" | "en" | string | null;
  currencyCode?: string | null;
  currencyPosition?: "before" | "after" | string | null;
  thousandsSeparator?: string | null;
  decimalSeparator?: string | null;
  decimalPlaces?: number | null;
}

/**
 * Format monetary amount according to company settings:
 * currency code & position, thousands/decimal separators, decimal places, and digit system.
 */
export function formatMoneyWithSettings(
  amount: string | number,
  settings?: MoneyFormatSettings | null,
): string {
  const numberFormat = settings?.numberFormat ?? "en";
  const currencyCode = settings?.currencyCode !== undefined ? settings.currencyCode : "SAR";
  const currencyPosition = settings?.currencyPosition ?? "after";
  const thousandsSeparator = settings?.thousandsSeparator ?? ",";
  const decimalSeparator = settings?.decimalSeparator ?? ".";
  const decimalPlaces =
    settings?.decimalPlaces !== undefined && settings?.decimalPlaces !== null
      ? settings.decimalPlaces
      : 2;

  let numStr: string;
  if (typeof amount === "number") {
    numStr = Number.isFinite(amount) ? amount.toFixed(decimalPlaces) : "0.00";
  } else {
    const parsed = parseFloat(amount);
    numStr = Number.isFinite(parsed) ? parsed.toFixed(decimalPlaces) : "0.00";
  }

  const isNegative = numStr.startsWith("-");
  const rawAbs = isNegative ? numStr.slice(1) : numStr;
  const [wholeRaw = "0", fracRaw = ""] = rawAbs.split(".");

  // Group thousands
  const groupedWhole = wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

  let formattedNumber = groupedWhole;
  if (decimalPlaces > 0) {
    const padFrac = fracRaw.padEnd(decimalPlaces, "0").slice(0, decimalPlaces);
    formattedNumber = `${groupedWhole}${decimalSeparator}${padFrac}`;
  }

  if (isNegative) {
    formattedNumber = `-${formattedNumber}`;
  }

  if (numberFormat === "ar") {
    formattedNumber = toEasternArabicDigits(formattedNumber);
  }

  if (!currencyCode) {
    return formattedNumber;
  }

  return currencyPosition === "before"
    ? `${currencyCode} ${formattedNumber}`
    : `${formattedNumber} ${currencyCode}`;
}

/** "1150.00" -> "1,150.00" (Latin digits — accounting convention). */
export function formatMoney(val: string | number): string {
  const decimalString = typeof val === "number" ? val.toFixed(2) : val;
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

/** Generate default random company prefix in format INV###### (e.g. INV742391). */
// INV (3 chars) + 6 random digits = 9 chars, well within the 12-char prefix limit.
// 6 digits (not 3) to reduce collision chance when many companies are created.
export function generateDefaultCompanyPrefix(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `INV${num}`;
}
