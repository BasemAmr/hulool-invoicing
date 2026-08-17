import type { Halalas } from "../branding";
import { toDecimalString } from "../value-objects/money";

/**
 * ZATCA Phase 1 simplified QR code — TLV (Tag-Length-Value) Base64.
 *
 * Each field is encoded as: [1-byte tag][1-byte length][UTF-8 value bytes].
 * The concatenated TLV bytes are then Base64-encoded.
 *
 * Tags (per ZATCA Phase 1 spec):
 *   1 = seller name
 *   2 = VAT number
 *   3 = timestamp (ISO 8601 string)
 *   4 = invoice total (decimal string, 2 places)
 *   5 = VAT total (decimal string, 2 places)
 */

export interface QrInput {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  invoiceTotal: Halalas;
  vatTotal: Halalas;
}

const TAG_SELLER_NAME = 1;
const TAG_VAT_NUMBER = 2;
const TAG_TIMESTAMP = 3;
const TAG_INVOICE_TOTAL = 4;
const TAG_VAT_TOTAL = 5;

function tlvField(tag: number, value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 255) {
    throw new RangeError(
      `TLV field ${tag} exceeds 255 bytes (${bytes.length})`,
    );
  }
  const out = new Uint8Array(2 + bytes.length);
  out[0] = tag;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** Build the raw TLV byte sequence — exposed for byte-level testing. */
export function buildTlvBytes(input: QrInput): Uint8Array {
  return concatBytes(
    tlvField(TAG_SELLER_NAME, input.sellerName),
    tlvField(TAG_VAT_NUMBER, input.vatNumber),
    tlvField(TAG_TIMESTAMP, input.timestampIso),
    tlvField(TAG_INVOICE_TOTAL, toDecimalString(input.invoiceTotal)),
    tlvField(TAG_VAT_TOTAL, toDecimalString(input.vatTotal)),
  );
}

/** Build the Base64-encoded QR payload for ZATCA Phase 1. */
export function buildQrPayload(input: QrInput): string {
  const bytes = buildTlvBytes(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
