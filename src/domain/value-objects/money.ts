import type { Halalas } from "../branding";
import {
  HALALAS_PER_RIYAL,
  QUANTITY_BASIS_POINTS,
  VAT_RATE_BASIS,
} from "../constants";

/**
 * Money value object — all arithmetic in integer halalas.
 *
 * Clean Code G26: never float money. 1 SAR = 100 halalas.
 * Decimal strings are the I/O boundary; internally everything is integer
 * halalas and basis points so IEEE 754 cannot corrupt a total.
 */

/** Construct Halalas from a raw integer halala count. Throws on non-integer. */
export function halalas(amount: number): Halalas {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`halalas() requires an integer; got ${amount}`);
  }
  return amount as Halalas;
}

/**
 * Parse a decimal string ("100.00") into halalas (10000) without float error.
 * Handles optional leading minus and 0-2 decimal places.
 */
export function fromDecimalString(s: string): Halalas {
  const trimmed = s.trim();
  const neg = trimmed.startsWith("-");
  const clean = neg ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new RangeError(`Invalid decimal string: "${s}"`);
  }
  const dotIndex = clean.indexOf(".");
  let whole: string;
  let frac: string;
  if (dotIndex === -1) {
    whole = clean;
    frac = "00";
  } else {
    whole = clean.slice(0, dotIndex);
    frac = (clean.slice(dotIndex + 1) + "00").slice(0, 2);
  }
  const value = parseInt(whole + frac, 10);
  return (neg ? -value : value) as Halalas;
}

/** Format halalas as a 2-decimal string ("100.00"). Always 2 places. */
export function toDecimalString(h: Halalas): string {
  const neg = h < 0;
  const abs = Math.abs(h);
  const whole = Math.floor(abs / HALALAS_PER_RIYAL);
  const frac = abs % HALALAS_PER_RIYAL;
  const fracStr = String(frac).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${fracStr}`;
}

/** Integer addition of two halalas amounts. */
export function add(a: Halalas, b: Halalas): Halalas {
  return (a + b) as Halalas;
}

/**
 * Round half-up for non-negative integer numerator / denominator.
 * `floor((num + floor(den / 2)) / den)` produces round-half-up for even den.
 */
function roundHalfUpInt(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Multiply unit price (halalas) by a quantity (up to 4 decimal places).
 * The quantity is converted to integer basis-points first, so the entire
 * computation is integer × integer ÷ integer with a single round-half-up.
 */
export function multiplyQuantity(unitPrice: Halalas, qty: number): Halalas {
  if (unitPrice < 0) throw new RangeError("unitPrice must be non-negative");
  if (qty < 0) throw new RangeError("quantity must be non-negative");
  const qtyBp = Math.round(qty * QUANTITY_BASIS_POINTS);
  const raw = unitPrice * qtyBp;
  return roundHalfUpInt(raw, QUANTITY_BASIS_POINTS) as Halalas;
}

/**
 * Compute VAT on a halalas amount at a given rate (e.g. 0.15).
 * Rate is converted to parts-per-million integer to avoid float error,
 * then a single round-half-up is applied.
 */
export function vatOf(amount: Halalas, rate: number): Halalas {
  if (amount < 0) throw new RangeError("amount must be non-negative");
  if (rate < 0) throw new RangeError("rate must be non-negative");
  const ratePpm = Math.round(rate * VAT_RATE_BASIS);
  const raw = amount * ratePpm;
  return roundHalfUpInt(raw, VAT_RATE_BASIS) as Halalas;
}

/** Sum a variadic list of halalas amounts. */
export function sum(...amounts: Halalas[]): Halalas {
  let total = 0;
  for (const a of amounts) total += a;
  return total as Halalas;
}

/**
 * Parse an arbitrary-precision decimal string exactly (no floats).
 * Returns integer numerator + base-10 scale: value = int / 10^scale.
 * Accepts up to any number of decimals — BigInt keeps it exact.
 */
function parseDecimalExact(s: string): { int: bigint; scale: number } {
  const trimmed = s.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return { int: BigInt(0), scale: 0 };
  }
  const neg = trimmed.startsWith("-");
  const clean = neg ? trimmed.slice(1) : trimmed;
  if (!/^\d*(\.\d*)?$/.test(clean)) {
    throw new RangeError(`Invalid decimal string: "${s}"`);
  }
  const dot = clean.indexOf(".");
  let digits: string;
  let scale: number;
  if (dot === -1) {
    digits = clean || "0";
    scale = 0;
  } else {
    const whole = clean.slice(0, dot) || "0";
    const frac = clean.slice(dot + 1) || "";
    digits = (whole + frac).replace(/^0+(?=\d)/, "") || "0";
    scale = frac.length;
  }
  const int = BigInt(digits);
  return { int: neg ? -int : int, scale };
}

function pow10(n: number): bigint {
  return BigInt(10) ** BigInt(n);
}

/**
 * Round a full-precision SAR decimal string to integer halalas (half-up).
 *
 * WHY: unit prices may carry 3+ decimals (e.g. "17.95319") which cannot be
 * represented as integer halalas. The line SUBTOTAL must still be computed
 * from the full-precision string via lineSubtotalHalalasExact() (round once,
 * after multiply). This helper is ONLY for the storage/display boundary —
 * invoice_items.unit_price is numeric(15,2), so the persisted unit price is
 * the half-up-rounded halala value while totals stay exact.
 */
export function priceStringToHalalas(priceStr: string): Halalas {
  const price = parseDecimalExact(priceStr || "0");
  const ZERO = BigInt(0);
  if (price.int < ZERO) {
    throw new RangeError("price must be non-negative");
  }
  // halalas = round(price * 100) half-up in one BigInt step:
  // (int * 100 + den/2) / den, where den = 10^scale.
  const numerator = price.int * BigInt(100);
  const denominator = pow10(price.scale);
  const rounded = (numerator + denominator / BigInt(2)) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("price exceeds safe integer range");
  }
  return Number(rounded) as Halalas;
}

/**
 * Exact line subtotal in halalas from full-precision price/qty strings.
 *
 * WHY this exists: the old wizard did `parseFloat(price).toFixed(2)` BEFORE
 * multiplying, so 17.95319 x 260 became 17.95 x 260 = 4667.00 while the row
 * (which multiplied full floats) showed 5368.00. Truncating/rounding the unit
 * price before quantity multiplication loses `qty x fraction` (here 0.83 SAR).
 *
 * Correct order: multiply exact decimals first, round ONCE to halala at the
 * end (half-up). Intermediate math is BigInt-exact, no IEEE 754 involved.
 * Final SAR display is still 2 decimals (halala is the legal tender unit +
 * ZATCA/DB numeric(15,2) constraint) — but it is rounded once, not twice.
 */
export function lineSubtotalHalalasExact(
  priceStr: string,
  qtyStr: string,
  discountHalalas?: Halalas,
): Halalas {
  const price = parseDecimalExact(priceStr || "0");
  const qty = parseDecimalExact(qtyStr || "0");
  const ZERO = BigInt(0);
  if (price.int < ZERO || qty.int < ZERO) {
    throw new RangeError("price and quantity must be non-negative");
  }
  // gross SAR = (price.int * qty.int) / 10^(price.scale + qty.scale)
  // gross halalas = gross SAR * 100, rounded half-up in one step.
  const totalScale = price.scale + qty.scale;
  const product = price.int * qty.int; // exact, arbitrary precision
  const numerator = product * BigInt(100);
  const denominator = pow10(totalScale);
  const gross =
    totalScale === 0
      ? numerator
      : (numerator + denominator / BigInt(2)) / denominator;
  const discount = BigInt(discountHalalas ?? 0);
  const net = gross - discount;
  const clamped = net < ZERO ? ZERO : net;
  if (clamped > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("line subtotal exceeds safe integer range");
  }
  return Number(clamped) as Halalas;
}
