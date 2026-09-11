import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyWithSettings,
  formatSar,
  toEasternArabicDigits,
  toWesternDigits,
} from "./format";


describe("formatMoneyWithSettings", () => {
  it("formats standard Western digits with defaults", () => {
    expect(formatMoneyWithSettings("1150.00")).toBe("1,150.00 SAR");
    expect(formatMoneyWithSettings(1150)).toBe("1,150.00 SAR");
  });

  it("handles negative amounts correctly", () => {
    expect(formatMoneyWithSettings("-1234.56")).toBe("-1,234.56 SAR");
    expect(formatMoneyWithSettings(-500.5)).toBe("-500.50 SAR");
  });

  it("supports currencyPosition 'before'", () => {
    expect(
      formatMoneyWithSettings(2500, {
        currencyCode: "SAR",
        currencyPosition: "before",
      })
    ).toBe("SAR 2,500.00");
  });

  it("supports custom separators", () => {
    expect(
      formatMoneyWithSettings("1234567.89", {
        thousandsSeparator: " ",
        decimalSeparator: ",",
      })
    ).toBe("1 234 567,89 SAR");
  });

  it("supports custom decimal places", () => {
    expect(
      formatMoneyWithSettings("100", {
        decimalPlaces: 0,
      })
    ).toBe("100 SAR");

    expect(
      formatMoneyWithSettings("100.5", {
        decimalPlaces: 3,
      })
    ).toBe("100.500 SAR");
  });

  it("supports Eastern Arabic numerals when numberFormat is 'ar'", () => {
    const formatted = formatMoneyWithSettings("1234.50", {
      numberFormat: "ar",
      currencyCode: "ر.س",
      currencyPosition: "after",
    });
    expect(formatted).toBe("١,٢٣٤.٥٠ ر.س");
  });

  it("handles null/undefined settings gracefully", () => {
    expect(formatMoneyWithSettings("500", null)).toBe("500.00 SAR");
    expect(formatMoneyWithSettings("500", undefined)).toBe("500.00 SAR");
  });
});

describe("toEasternArabicDigits", () => {
  it("converts 0123456789 to ٠١٢٣٤٥٦٧٨٩", () => {
    expect(toEasternArabicDigits("0123456789")).toBe("٠١٢٣٤٥٦٧٨٩");
    expect(toEasternArabicDigits("Invoice #123")).toBe("Invoice #١٢٣");
  });
});

describe("toWesternDigits", () => {
  it("converts ٠١٢٣٤٥٦٧٨٩ to 0123456789", () => {
    expect(toWesternDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toWesternDigits("٥٥٥.٠")).toBe("555.0");
  });
});

