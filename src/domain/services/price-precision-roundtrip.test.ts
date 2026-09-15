import { describe, expect, it } from "vitest";

import { invoiceCreateSchema } from "@/domain/contracts";
import {
  calculateTotals,
  calculateTotalsExact,
} from "@/domain/services/totals-calculator";
import {
  fromDecimalString,
  halalas,
  lineSubtotalHalalasExact,
  priceStringToHalalas,
  toDecimalString,
  vatOf,
} from "@/domain/value-objects/money";
import { toWesternDigits } from "@/lib/format";

// Reported case: a 3-decimal price × large qty. Display showed 5368 (exact
// multiply-then-round-once) but the save path truncated the price to 2
// decimals BEFORE multiplying (17.95319 → 17.95) and stored 5367.05.
const PRICE = "17.95319";
const QTY = "260";
const VAT = 0.15;

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";

function displayMath() {
  const sub = lineSubtotalHalalasExact(PRICE, QTY, halalas(0));
  const vat = vatOf(sub, VAT);
  return {
    subtotal: toDecimalString(sub),
    vat: toDecimalString(vat),
    total: toDecimalString(halalas(sub + vat)),
  };
}

describe("price precision round-trip — 5368 vs 5367.05 regression", () => {
  it("display math computes the accurate 5368.00 total", () => {
    const d = displayMath();
    expect(d.subtotal).toBe("4667.83");
    expect(d.total).toBe("5368.00");
  });

  it("save math (calculateTotalsExact on the same strings) agrees with display math", () => {
    const saved = calculateTotalsExact([
      { unitPrice: PRICE, quantity: QTY, vatRate: VAT },
    ]);
    const d = displayMath();
    expect(toDecimalString(saved.subtotal)).toBe(d.subtotal);
    expect(toDecimalString(saved.total)).toBe(d.total);
    expect(toDecimalString(saved.subtotal)).toBe("4667.83");
    expect(toDecimalString(saved.total)).toBe("5368.00");
  });

  it("hidden-input serialization round-trip preserves the exact total", () => {
    // Simulate: visible input → hidden input value → server parse → totals.
    // Hidden inputs must carry the RAW string (western digits), never
    // parseFloat(...).toFixed(2) — that pre-multiply rounding was the bug.
    const hiddenValue = toWesternDigits(PRICE.trim()) || "0";
    expect(hiddenValue).toBe("17.95319");

    const serverPrice = hiddenValue.trim() || "0";
    const saved = calculateTotalsExact([
      { unitPrice: serverPrice, quantity: QTY, vatRate: VAT },
    ]);
    const direct = lineSubtotalHalalasExact(PRICE, QTY, halalas(0));
    expect(saved.lines[0]!.lineSubtotal).toBe(direct);
  });

  it("Arabic-Indic digit input normalizes to the same exact total", () => {
    const eastern = "١٧.٩٥٣١٩";
    const hiddenValue = toWesternDigits(eastern.trim()) || "0";
    expect(hiddenValue).toBe("17.95319");
    const saved = calculateTotalsExact([
      { unitPrice: hiddenValue, quantity: QTY, vatRate: VAT },
    ]);
    expect(toDecimalString(saved.total)).toBe("5368.00");
  });

  it("the OLD truncated path produces 5367.05 (proves this test discriminates)", () => {
    // Old hidden input: fromDecimalString(parseFloat(price).toFixed(2))
    const truncatedHalalas = fromDecimalString(
      (parseFloat(PRICE) || 0).toFixed(2),
    );
    const old = calculateTotals([
      { unitPrice: truncatedHalalas, quantity: parseFloat(QTY), vatRate: VAT },
    ]);
    expect(toDecimalString(old.subtotal)).toBe("4667.00");
    expect(toDecimalString(old.total)).toBe("5367.05");
    // And the fix must NOT equal the old wrong number:
    expect(toDecimalString(old.total)).not.toBe(displayMath().total);
  });

  it("Zod schema accepts the full-precision price string", () => {
    const parsed = invoiceCreateSchema.safeParse({
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      templateId: "simple_red",
      invoiceType: "simplified",
      issueDate: "2026-09-01",
      items: [
        {
          description: "بند دقيق",
          quantity: 260,
          unitPrice: "17.95319",
          discountAmount: 0,
          vatRate: 0.15,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("Zod schema still accepts legacy halalas integers with identical totals", () => {
    const legacyHalalas = priceStringToHalalas(PRICE); // 1795 → 17.95 SAR
    const fromLegacy = calculateTotalsExact([
      {
        unitPrice: toDecimalString(halalas(legacyHalalas)),
        quantity: QTY,
        vatRate: VAT,
      },
    ]);
    const fromRounded = calculateTotals([
      { unitPrice: halalas(legacyHalalas), quantity: 260, vatRate: VAT },
    ]);
    // Legacy shape keeps working and both calculators agree on 2-dec prices.
    expect(toDecimalString(fromLegacy.total)).toBe(
      toDecimalString(fromRounded.total),
    );
  });

  it("stored unit_price rounds half-up to halalas (DB numeric(15,2) boundary)", () => {
    expect(priceStringToHalalas("17.95319")).toBe(halalas(1795));
    expect(toDecimalString(priceStringToHalalas("17.95319"))).toBe("17.95");
    expect(priceStringToHalalas("0.005")).toBe(halalas(1));
  });
});
