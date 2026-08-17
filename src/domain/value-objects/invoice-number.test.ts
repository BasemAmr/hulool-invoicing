import { describe, expect, it } from "vitest";

import {
  formatInvoiceNumber,
  isValidInvoiceNumber,
  parseInvoiceNumber,
} from "@/domain/value-objects/invoice-number";
import { ValidationError } from "@/domain/errors";

describe("invoice-number — formatInvoiceNumber", () => {
  it("formats with 5-digit zero-padded sequence", () => {
    expect(formatInvoiceNumber("ACME", 2026, 1)).toBe("ACME-2026-00001");
  });

  it("formats a two-digit sequence", () => {
    expect(formatInvoiceNumber("AB", 2026, 42)).toBe("AB-2026-00042");
  });

  it("formats a large sequence", () => {
    expect(formatInvoiceNumber("ACME", 2026, 99999)).toBe("ACME-2026-99999");
  });

  it("does not truncate sequences beyond 5 digits", () => {
    expect(formatInvoiceNumber("ACME", 2026, 100000)).toBe("ACME-2026-100000");
  });
});

describe("invoice-number — isValidInvoiceNumber", () => {
  it("accepts a well-formed number", () => {
    expect(isValidInvoiceNumber("ACME-2026-00001")).toBe(true);
  });

  it("accepts a 2-char prefix", () => {
    expect(isValidInvoiceNumber("AB-2026-00001")).toBe(true);
  });

  it("accepts a 6-char prefix", () => {
    expect(isValidInvoiceNumber("ABCDEF-2026-00001")).toBe(true);
  });

  it("accepts numeric prefix characters", () => {
    expect(isValidInvoiceNumber("A1-2026-00001")).toBe(true);
  });

  it("rejects lowercase prefix", () => {
    expect(isValidInvoiceNumber("acme-2026-00001")).toBe(false);
  });

  it("rejects a 1-char prefix (too short)", () => {
    expect(isValidInvoiceNumber("A-2026-00001")).toBe(false);
  });

  it("rejects a 7-char prefix (too long)", () => {
    expect(isValidInvoiceNumber("ABCDEFG-2026-00001")).toBe(false);
  });

  it("rejects missing sequence padding", () => {
    expect(isValidInvoiceNumber("ACME-2026-1")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidInvoiceNumber("bad")).toBe(false);
    expect(isValidInvoiceNumber("")).toBe(false);
  });
});

describe("invoice-number — parseInvoiceNumber", () => {
  it("parses a valid number", () => {
    expect(parseInvoiceNumber("ACME-2026-00042")).toEqual({
      prefix: "ACME",
      year: 2026,
      sequence: 42,
    });
  });

  it("parses a minimal prefix", () => {
    expect(parseInvoiceNumber("AB-2026-00001")).toEqual({
      prefix: "AB",
      year: 2026,
      sequence: 1,
    });
  });

  it("throws ValidationError on bad format", () => {
    expect(() => parseInvoiceNumber("bad")).toThrow(ValidationError);
    expect(() => parseInvoiceNumber("acme-2026-00001")).toThrow(ValidationError);
    expect(() => parseInvoiceNumber("ACME-26-00001")).toThrow(ValidationError);
  });
});
