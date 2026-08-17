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
