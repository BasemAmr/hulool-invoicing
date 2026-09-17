import type { Halalas } from "../branding";
import { ValidationError } from "../errors";
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

/**
 * Normalize any parseable ISO instant to the ZATCA Phase 1 Tag 3 shape:
 * seconds-precision UTC `YYYY-MM-DDTHH:mm:ssZ` (no fractional seconds).
 *
 * WHY parse-then-re-emit instead of string-slicing the input: the input may
 * carry an offset (e.g. `...+03:00`). Slicing the raw string would write a
 * lying instant; `new Date()` converts the offset to the true UTC moment
 * first, and the slice below applies to `toISOString()` output (always UTC
 * `...ss.sssZ`), so the emitted instant is honest.
 *
 * WHY throw: the previous behavior embedded `timestampIso` verbatim with no
 * validation, so garbage input silently produced a corrupt QR. Throwing
 * ValidationError keeps it loud — the issue/edit callers already map
 * ValidationError (a DomainError) to friendly user messages.
 */
export function normalizeQrTimestamp(timestampIso: string): string {
  if (typeof timestampIso !== "string" || timestampIso.length === 0) {
    throw new ValidationError(`Invalid QR timestamp: "${timestampIso}"`);
  }
  const d = new Date(timestampIso);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`Invalid QR timestamp: "${timestampIso}"`);
  }
  // toISOString() always emits UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; dropping the
  // `.sss` yields the required seconds-precision shape with `Z` suffix.
  return `${d.toISOString().slice(0, 19)}Z`;
}

/** Build the raw TLV byte sequence — exposed for byte-level testing. */
export function buildTlvBytes(input: QrInput): Uint8Array {
  return concatBytes(
    tlvField(TAG_SELLER_NAME, input.sellerName),
    tlvField(TAG_VAT_NUMBER, input.vatNumber),
    // Choke point: every caller flows through here, so normalizing here
    // fixes all present and future Tag 3 writers in one place.
    tlvField(TAG_TIMESTAMP, normalizeQrTimestamp(input.timestampIso)),
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

/**
 * Decode a stored Base64 QR payload into ordered [tag, value] fields.
 *
 * WHY exposed: repair tooling + read-time safety nets need to inspect and
 * re-emit historical payloads without trusting their Tag 3 shape. Throws
 * ValidationError on corrupt base64 / truncated TLV so callers stay loud.
 */
export function decodeTlvFields(payload: string): Array<[number, string]> {
  let binary: string;
  try {
    // `atob` exists in Node 16+ and edge runtimes; Buffer fallback keeps
    // scripts/tests on older harnesses working.
    binary =
      typeof atob === "function"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("binary");
  } catch {
    throw new ValidationError("Invalid QR payload: not valid base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  const fields: Array<[number, string]> = [];
  let offset = 0;
  while (offset + 2 <= bytes.length) {
    const tag = bytes[offset]!;
    const len = bytes[offset + 1]!;
    if (offset + 2 + len > bytes.length) {
      throw new ValidationError("Invalid QR payload: truncated TLV field");
    }
    fields.push([tag, decoder.decode(bytes.slice(offset + 2, offset + 2 + len))]);
    offset += 2 + len;
  }
  if (fields.length === 0) {
    throw new ValidationError("Invalid QR payload: empty TLV");
  }
  return fields;
}

/** Read Tag 3 (timestamp) from a stored payload — for diagnostics/repair. */
export function decodeStoredQrTimestamp(payload: string): string {
  const fields = decodeTlvFields(payload);
  const found = fields.find(([tag]) => tag === TAG_TIMESTAMP);
  if (!found) throw new ValidationError("Invalid QR payload: Tag 3 missing");
  return found[1];
}

/**
 * Repair a HISTORICAL stored payload whose Tag 3 carries fractional seconds
 * (e.g. `2026-09-11T16:16:07.799Z` from the pre-normalization writer).
 *
 * Re-emits the same fields in the same order, with ONLY Tag 3 normalized via
 * `normalizeQrTimestamp` (truncate to seconds-precision UTC, same instant).
 * Tags 1/2/4/5 round-trip byte-identically (UTF-8 decode → re-encode).
 *
 * Returns the original string untouched when Tag 3 is already clean, so the
 * repair script is idempotent and already-fixed rows are byte-identical.
 */
export function normalizeStoredQrPayload(payload: string): string {
  const fields = decodeTlvFields(payload);
  let changed = false;
  const fixed: Array<[number, string]> = fields.map(([tag, value]) => {
    if (tag !== TAG_TIMESTAMP) return [tag, value] as [number, string];
    const clean = normalizeQrTimestamp(value);
    if (clean !== value) changed = true;
    return [tag, clean] as [number, string];
  });
  if (!changed) return payload;
  const encoder = new TextEncoder();
  let total = 0;
  for (const [, value] of fixed) total += 2 + encoder.encode(value).length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const [tag, value] of fixed) {
    const valueBytes = encoder.encode(value);
    out[offset] = tag;
    out[offset + 1] = valueBytes.length;
    out.set(valueBytes, offset + 2);
    offset += 2 + valueBytes.length;
  }
  let binary = "";
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]!);
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}
