import { describe, expect, it } from "vitest";

import { calculateTotals } from "@/domain/services/totals-calculator";
import { halalas } from "@/domain/value-objects/money";
import { toDecimalString } from "@/domain/value-objects/money";

describe("totals-calculator — single line", () => {
  it("computes a simple 15% line", () => {
    const result = calculateTotals([
      { unitPrice: halalas(10000), quantity: 1, vatRate: 0.15 },
    ]);
    expect(toDecimalString(result.subtotal)).toBe("100.00");
    expect(toDecimalString(result.vatTotal)).toBe("15.00");
    expect(toDecimalString(result.total)).toBe("115.00");
    expect(result.lines).toHaveLength(1);
    expect(toDecimalString(result.lines[0]!.lineSubtotal)).toBe("100.00");
    expect(toDecimalString(result.lines[0]!.lineVat)).toBe("15.00");
    expect(toDecimalString(result.lines[0]!.lineTotal)).toBe("115.00");
  });
});

describe("totals-calculator — mixed VAT rates", () => {
  it("sums lines with different rates correctly", () => {
    const result = calculateTotals([
      { unitPrice: halalas(10000), quantity: 1, vatRate: 0.15 }, // 100.00 + 15.00 = 115.00
      { unitPrice: halalas(20000), quantity: 1, vatRate: 0.05 }, // 200.00 + 10.00 = 210.00
    ]);
    expect(toDecimalString(result.subtotal)).toBe("300.00");
    expect(toDecimalString(result.vatTotal)).toBe("25.00");
    expect(toDecimalString(result.total)).toBe("325.00");
  });
});

describe("totals-calculator — rounding half-up edge", () => {
  it("rounds 0.33 × 15% = 0.05 (4.95 → 5)", () => {
    const result = calculateTotals([
      { unitPrice: halalas(33), quantity: 1, vatRate: 0.15 },
    ]);
    expect(toDecimalString(result.lines[0]!.lineSubtotal)).toBe("0.33");
    expect(toDecimalString(result.lines[0]!.lineVat)).toBe("0.05");
    expect(toDecimalString(result.lines[0]!.lineTotal)).toBe("0.38");
    expect(toDecimalString(result.vatTotal)).toBe("0.05");
    expect(toDecimalString(result.total)).toBe("0.38");
  });
});

describe("totals-calculator — zero-rate line", () => {
  it("produces zero VAT on a 0% line", () => {
    const result = calculateTotals([
      { unitPrice: halalas(10000), quantity: 1, vatRate: 0 },
    ]);
    expect(toDecimalString(result.lines[0]!.lineVat)).toBe("0.00");
    expect(toDecimalString(result.lines[0]!.lineTotal)).toBe("100.00");
    expect(toDecimalString(result.vatTotal)).toBe("0.00");
    expect(toDecimalString(result.total)).toBe("100.00");
  });
});

describe("totals-calculator — quantity with 4 decimals", () => {
  it("multiplies 10.00 × 2.5 correctly", () => {
    const result = calculateTotals([
      { unitPrice: halalas(1000), quantity: 2.5, vatRate: 0.15 },
    ]);
    expect(toDecimalString(result.lines[0]!.lineSubtotal)).toBe("25.00");
    expect(toDecimalString(result.lines[0]!.lineVat)).toBe("3.75");
    expect(toDecimalString(result.lines[0]!.lineTotal)).toBe("28.75");
    expect(toDecimalString(result.subtotal)).toBe("25.00");
    expect(toDecimalString(result.total)).toBe("28.75");
  });

  it("multiplies 1.0001 × 1000.00 correctly", () => {
    const result = calculateTotals([
      { unitPrice: halalas(100000), quantity: 1.0001, vatRate: 0.15 },
    ]);
    // subtotal = 100000 * 10001 / 10000 = 100010 halalas = 1000.10
    expect(toDecimalString(result.lines[0]!.lineSubtotal)).toBe("1000.10");
  });
});

describe("totals-calculator — empty input", () => {
  it("returns zero totals for no lines", () => {
    const result = calculateTotals([]);
    expect(toDecimalString(result.subtotal)).toBe("0.00");
    expect(toDecimalString(result.vatTotal)).toBe("0.00");
    expect(toDecimalString(result.total)).toBe("0.00");
    expect(result.lines).toHaveLength(0);
  });
});
