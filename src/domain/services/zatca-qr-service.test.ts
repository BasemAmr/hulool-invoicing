import { describe, expect, it } from "vitest";

import { buildQrPayload, buildTlvBytes } from "@/domain/services/zatca-qr-service";
import { halalas } from "@/domain/value-objects/money";
import type { QrInput } from "@/domain/services/zatca-qr-service";

const testInput: QrInput = {
  sellerName: "ACME",
  vatNumber: "312345678901234",
  timestampIso: "2026-01-01T00:00:00Z",
  invoiceTotal: halalas(10000), // "100.00"
  vatTotal: halalas(1500), // "15.00"
};

/**
 * Build expected TLV bytes from an explicit [[tag, string]] table.
 * This makes the expectation auditable — you can read the table and
 * manually verify each field's tag, length, and value.
 */
function buildExpectedTlv(fields: Array<[number, string]>): Uint8Array {
  const encoder = new TextEncoder();
  let totalLength = 0;
  for (const [, value] of fields) {
    totalLength += 2 + encoder.encode(value).length;
  }
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const [tag, value] of fields) {
    const bytes = encoder.encode(value);
    out[offset] = tag;
    out[offset + 1] = bytes.length;
    out.set(bytes, offset + 2);
    offset += 2 + bytes.length;
  }
  return out;
}

describe("zatca-qr-service — TLV byte-level correctness", () => {
  it("produces the exact expected TLV bytes", () => {
    // Explicit [[tag, value]] table — the single source of truth for this test.
    const fields: Array<[number, string]> = [
      [1, "ACME"],
      [2, "312345678901234"],
      [3, "2026-01-01T00:00:00Z"],
      [4, "100.00"],
      [5, "15.00"],
    ];
    const expected = buildExpectedTlv(fields);
    const actual = buildTlvBytes(testInput);

    expect(Array.from(actual)).toEqual(Array.from(expected));
  });

  it("uses 1-byte tag and 1-byte length per field", () => {
    const bytes = buildTlvBytes(testInput);
    // First field: tag=1, length=4 ("ACME")
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(4);
    // Second field starts at offset 6: tag=2, length=15
    expect(bytes[6]).toBe(2);
    expect(bytes[7]).toBe(15);
  });
});

describe("zatca-qr-service — Arabic UTF-8 round-trip", () => {
  it("round-trips an Arabic seller name through TLV", () => {
    const arabicInput: QrInput = {
      sellerName: "شركة",
      vatNumber: "312345678901234",
      timestampIso: "2026-01-01T00:00:00Z",
      invoiceTotal: halalas(10000),
      vatTotal: halalas(1500),
    };
    const bytes = buildTlvBytes(arabicInput);

    // Decode the seller name field (first field: tag at 0, length at 1, value at 2)
    const nameLength = bytes[1]!;
    const nameBytes = bytes.slice(2, 2 + nameLength);
    const decoder = new TextDecoder();
    const decodedName = decoder.decode(nameBytes);

    expect(decodedName).toBe("شركة");
  });
});

describe("zatca-qr-service — base64 round-trip", () => {
  it("base64 payload decodes back to the same TLV bytes", () => {
    const payload = buildQrPayload(testInput);
    const decoded = atob(payload);
    const decodedBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      decodedBytes[i] = decoded.charCodeAt(i);
    }
    expect(Array.from(decodedBytes)).toEqual(Array.from(buildTlvBytes(testInput)));
  });

  it("produces a valid base64 string", () => {
    const payload = buildQrPayload(testInput);
    // Valid base64 matches the regex and decodes without error
    expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(() => atob(payload)).not.toThrow();
  });
});
