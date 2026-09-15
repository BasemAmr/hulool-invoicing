import { describe, expect, it } from "vitest";
import {
  formatVatRatePercent,
  isPresetVatRate,
  parseVatPercentToRate,
} from "./vat-rate";

describe("parseVatPercentToRate", () => {
  it('"15" → 0.15', () => {
    expect(parseVatPercentToRate("15", 0.15)).toBeCloseTo(0.15, 10);
  });

  it('"٧٫٥" (Arabic-Indic digits + Arabic decimal sep) → 0.075', () => {
    expect(parseVatPercentToRate("٧٫٥", 0.15)).toBeCloseTo(0.075, 10);
  });

  it('empty/garbage falls back to the previous rate, never NaN', () => {
    expect(parseVatPercentToRate("", 0.05)).toBe(0.05);
    expect(parseVatPercentToRate("   ", 0.05)).toBe(0.05);
    expect(parseVatPercentToRate("abc", 0.05)).toBe(0.05);
    expect(parseVatPercentToRate(null, 0.05)).toBe(0.05);
    expect(parseVatPercentToRate(undefined, 0.05)).toBe(0.05);
    for (const v of ["", "abc", null, undefined]) {
      const r = parseVatPercentToRate(v as string, 0.05);
      expect(Number.isNaN(r)).toBe(false);
    }
  });

  it('">100" clamps to 1', () => {
    expect(parseVatPercentToRate("150", 0.15)).toBe(1);
    expect(parseVatPercentToRate("100", 0.15)).toBe(1);
  });

  it("clamps negatives to 0 and keeps 0 valid", () => {
    expect(parseVatPercentToRate("-5", 0.15)).toBe(0);
    expect(parseVatPercentToRate("0", 0.15)).toBe(0);
    expect(parseVatPercentToRate("5", 0.15)).toBeCloseTo(0.05, 10);
  });
});

describe("formatVatRatePercent / isPresetVatRate", () => {
  it("formats rates without float artefacts", () => {
    expect(formatVatRatePercent(0.15)).toBe("15");
    expect(formatVatRatePercent(0.075)).toBe("7.5");
    expect(formatVatRatePercent(0)).toBe("0");
  });

  it("detects presets", () => {
    expect(isPresetVatRate(0.15)).toBe(true);
    expect(isPresetVatRate(0.05)).toBe(true);
    expect(isPresetVatRate(0)).toBe(true);
    expect(isPresetVatRate(0.075)).toBe(false);
  });
});
