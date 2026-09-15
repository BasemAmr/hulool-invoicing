import { describe, expect, it } from "vitest";

import {
  formatVatRateOptionValue,
  parseDecimalPlacesInput,
  parseVatRateInput,
} from "./settings-input";
import { companySettingsSchema } from "@/domain/contracts";

describe("parseVatRateInput", () => {
  it("parses the exact option values the settings form posts", () => {
    expect(parseVatRateInput("0.1500")).toBeCloseTo(0.15);
    expect(parseVatRateInput("0.0500")).toBeCloseTo(0.05);
    expect(parseVatRateInput("0.0000")).toBe(0);
  });

  it("accepts Arabic-Indic digits (١٥ → 0.15)", () => {
    expect(parseVatRateInput("١٥")).toBeCloseTo(0.15);
    expect(parseVatRateInput("٥")).toBeCloseTo(0.05);
    // Arabic-Indic fraction with Arabic decimal separator
    expect(parseVatRateInput("٠٫١٥")).toBeCloseTo(0.15);
  });

  it("accepts Persian digits and a trailing percent sign", () => {
    expect(parseVatRateInput("۱۵")).toBeCloseTo(0.15);
    expect(parseVatRateInput("15%")).toBeCloseTo(0.15);
    expect(parseVatRateInput("15 ٪")).toBeCloseTo(0.15);
    expect(parseVatRateInput("5%")).toBeCloseTo(0.05);
  });

  it("treats whole-number percents as percents, fractions as fractions", () => {
    expect(parseVatRateInput("15")).toBeCloseTo(0.15);
    expect(parseVatRateInput("0.15")).toBeCloseTo(0.15);
  });

  it("falls back only when the key is missing; garbage becomes NaN so Zod rejects", () => {
    expect(parseVatRateInput(null)).toBeCloseTo(0.15);
    expect(parseVatRateInput(undefined)).toBeCloseTo(0.15);
    expect(parseVatRateInput("abc")).toBeNaN();
    expect(parseVatRateInput("")).toBeNaN();
  });

  it("feeds values the Zod schema accepts (min 0, max 1)", () => {
    for (const raw of ["0.1500", "١٥", "15%", "0.05", "0"]) {
      const parsed = companySettingsSchema.safeParse({
        companyId: "00000000-0000-0000-0000-000000000001",
        defaultVatRate: parseVatRateInput(raw),
      });
      expect(parsed.success).toBe(true);
    }
    const bad = companySettingsSchema.safeParse({
      companyId: "00000000-0000-0000-0000-000000000001",
      defaultVatRate: parseVatRateInput("abc"),
    });
    expect(bad.success).toBe(false);
  });
});

describe("VAT display round-trip (the reported bug)", () => {
  it("formats every stored rate back to its exact <option value>", () => {
    // DB stores numeric(5,4) strings; repo maps with parseFloat.
    for (const stored of ["0.1500", "0.0500", "0.0000"]) {
      expect(formatVatRateOptionValue(parseFloat(stored))).toBe(stored);
    }
  });

  it("handles 0 without falsy-fallback bugs (0 must stay 0.0000, not 0.1500)", () => {
    expect(formatVatRateOptionValue(0)).toBe("0.0000");
  });
});

describe("parseDecimalPlacesInput", () => {
  it("parses Western and Arabic-Indic digits", () => {
    expect(parseDecimalPlacesInput("2")).toBe(2);
    expect(parseDecimalPlacesInput("٢")).toBe(2);
    expect(parseDecimalPlacesInput("0")).toBe(0);
  });

  it("falls back only when missing; garbage becomes NaN so Zod rejects", () => {
    expect(parseDecimalPlacesInput(null)).toBe(2);
    expect(parseDecimalPlacesInput("xyz")).toBeNaN();
  });
});
