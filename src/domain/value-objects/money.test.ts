import { describe, expect, it } from "vitest";

import {
  add,
  fromDecimalString,
  halalas,
  multiplyQuantity,
  sum,
  toDecimalString,
  vatOf,
} from "@/domain/value-objects/money";

describe("money — decimal string round-trip", () => {
  it("round-trips 100.00", () => {
    const h = fromDecimalString("100.00");
    expect(h).toBe(halalas(10000));
    expect(toDecimalString(h)).toBe("100.00");
  });

  it("round-trips 0.01", () => {
    const h = fromDecimalString("0.01");
    expect(h).toBe(halalas(1));
    expect(toDecimalString(h)).toBe("0.01");
  });

  it("round-trips a large value (9999999999999.99)", () => {
    const h = fromDecimalString("9999999999999.99");
    expect(toDecimalString(h)).toBe("9999999999999.99");
  });

  it("handles integer input (no decimal point)", () => {
    const h = fromDecimalString("42");
    expect(toDecimalString(h)).toBe("42.00");
  });

  it("handles single decimal place", () => {
    const h = fromDecimalString("12.5");
    expect(toDecimalString(h)).toBe("12.50");
  });

  it("throws on invalid input", () => {
    expect(() => fromDecimalString("abc")).toThrow(RangeError);
    expect(() => fromDecimalString("")).toThrow(RangeError);
  });
});

describe("money — multiplyQuantity", () => {
  it("multiplies 10.00 × 2.5 = 25.00", () => {
    const result = multiplyQuantity(halalas(1000), 2.5);
    expect(toDecimalString(result)).toBe("25.00");
  });

  it("multiplies 10.00 × 1 = 10.00", () => {
    const result = multiplyQuantity(halalas(1000), 1);
    expect(toDecimalString(result)).toBe("10.00");
  });

  it("handles 4-decimal quantity (1.0001 × 1000.00 = 1000.10)", () => {
    const result = multiplyQuantity(halalas(100000), 1.0001);
    // 100000 halalas * 10001 bp / 10000 = 100010 halalas = 1000.10
    expect(toDecimalString(result)).toBe("1000.10");
  });

  it("throws on negative unit price", () => {
    expect(() => multiplyQuantity(halalas(-1), 1)).toThrow(RangeError);
  });

  it("throws on non-integer halalas", () => {
    expect(() => halalas(1.5)).toThrow(RangeError);
  });
});

describe("money — vatOf rounding", () => {
  it("100.00 × 15% = 15.00", () => {
    const result = vatOf(halalas(10000), 0.15);
    expect(toDecimalString(result)).toBe("15.00");
  });

  it("0.33 × 15% = 0.05 (round half-up of 4.95 → 5)", () => {
    const result = vatOf(halalas(33), 0.15);
    expect(toDecimalString(result)).toBe("0.05");
  });

  it("0.20 × 15% = 0.03 (3 halalas)", () => {
    const result = vatOf(halalas(20), 0.15);
    // 20 * 0.15 = 3.0 halalas → 3
    expect(toDecimalString(result)).toBe("0.03");
  });

  it("handles zero rate", () => {
    const result = vatOf(halalas(10000), 0);
    expect(toDecimalString(result)).toBe("0.00");
  });

  it("handles 5% rate", () => {
    const result = vatOf(halalas(2000), 0.05);
    // 2000 * 0.05 = 100 halalas = 1.00
    expect(toDecimalString(result)).toBe("1.00");
  });
});

describe("money — add and sum", () => {
  it("adds two amounts", () => {
    const result = add(halalas(100), halalas(200));
    expect(toDecimalString(result)).toBe("3.00");
  });

  it("sums multiple amounts", () => {
    const result = sum(halalas(100), halalas(200), halalas(300));
    expect(toDecimalString(result)).toBe("6.00");
  });

  it("sums zero amounts", () => {
    const result = sum();
    expect(toDecimalString(result)).toBe("0.00");
  });
});
