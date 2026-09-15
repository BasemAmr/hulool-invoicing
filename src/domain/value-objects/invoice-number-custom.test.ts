import { describe, expect, it } from "vitest";

import {
  DUPLICATE_INVOICE_NUMBER_MESSAGE,
  INVOICE_NUMBER_TOO_LONG_MESSAGE,
  MAX_CUSTOM_INVOICE_NUMBER_LENGTH,
  MISSING_INVOICE_NUMBER_MESSAGE,
  extractSequenceForCatchUp,
  isInvoiceNumberUniqueViolation,
  normalizeCustomInvoiceNumber,
} from "@/domain/value-objects/invoice-number";

describe("custom invoice numbers — normalizeCustomInvoiceNumber", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeCustomInvoiceNumber("  INV-00042  ")).toBe("INV-00042");
  });

  it("maps empty/whitespace/missing/non-string input to undefined (no override)", () => {
    expect(normalizeCustomInvoiceNumber("")).toBeUndefined();
    expect(normalizeCustomInvoiceNumber("   ")).toBeUndefined();
    expect(normalizeCustomInvoiceNumber(undefined)).toBeUndefined();
    expect(normalizeCustomInvoiceNumber(null)).toBeUndefined();
    expect(normalizeCustomInvoiceNumber(42)).toBeUndefined();
  });

  it("keeps inner content and permissive charset (Arabic, dashes, spaces)", () => {
    expect(normalizeCustomInvoiceNumber("فاتورة-مخصص-١")).toBe(
      "فاتورة-مخصص-١",
    );
    expect(normalizeCustomInvoiceNumber("INV-2026-001")).toBe("INV-2026-001");
  });
});

describe("custom invoice numbers — extractSequenceForCatchUp", () => {
  it("extracts the sequence from an exact PREFIX-nnnnn number", () => {
    expect(extractSequenceForCatchUp("INV-00042", "INV")).toBe(42);
    expect(extractSequenceForCatchUp("INV-100000", "INV")).toBe(100000);
  });

  it("returns null when the prefix differs (another company's shape)", () => {
    expect(extractSequenceForCatchUp("OTHER-00042", "INV")).toBeNull();
  });

  it("returns null for legacy PREFIX-YYYY-nnnnn (not the auto shape)", () => {
    expect(extractSequenceForCatchUp("INV-2026-00042", "INV")).toBeNull();
  });

  it("returns null for free text, Arabic, and zero sequences", () => {
    expect(extractSequenceForCatchUp("فاتورة-مخصص-١", "INV")).toBeNull();
    expect(extractSequenceForCatchUp("INV-2026-001", "INV")).toBeNull();
    expect(extractSequenceForCatchUp("INV-0", "INV")).toBeNull();
    expect(extractSequenceForCatchUp("", "INV")).toBeNull();
  });
});

describe("custom invoice numbers — isInvoiceNumberUniqueViolation", () => {
  it("detects the constraint via the constraint field", () => {
    const err = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint: "invoices_company_invoice_number_unique",
    });
    expect(isInvoiceNumberUniqueViolation(err)).toBe(true);
  });

  it("detects it via detail/message mentions when constraint is absent", () => {
    const byDetail = Object.assign(new Error("duplicate"), {
      code: "23505",
      detail: "Key (company_id, invoice_number)=(a, b) already exists.",
    });
    expect(isInvoiceNumberUniqueViolation(byDetail)).toBe(true);
    const byMessage = Object.assign(
      new Error('duplicate key "invoices_company_invoice_number_unique"'),
      { code: "23505" },
    );
    expect(isInvoiceNumberUniqueViolation(byMessage)).toBe(true);
  });

  it("follows a nested cause chain", () => {
    const inner = Object.assign(new Error("inner"), {
      code: "23505",
      constraint: "invoices_company_invoice_number_unique",
    });
    expect(
      isInvoiceNumberUniqueViolation(new Error("outer", { cause: inner })),
    ).toBe(true);
  });

  it("rejects other unique violations and non-DB errors", () => {
    const other = Object.assign(new Error("other unique"), {
      code: "23505",
      constraint: "receipt_vouchers_company_voucher_number_unique",
    });
    expect(isInvoiceNumberUniqueViolation(other)).toBe(false);
    expect(isInvoiceNumberUniqueViolation(new Error("boom"))).toBe(false);
    expect(isInvoiceNumberUniqueViolation(null)).toBe(false);
    expect(isInvoiceNumberUniqueViolation(undefined)).toBe(false);
  });
});

describe("custom invoice numbers — messages and limits", () => {
  it("exposes friendly Arabic messages", () => {
    expect(DUPLICATE_INVOICE_NUMBER_MESSAGE).toContain("مستخدم مسبق");
    expect(DUPLICATE_INVOICE_NUMBER_MESSAGE).toContain("الشركة");
    expect(MISSING_INVOICE_NUMBER_MESSAGE).toContain("مطلوب");
    expect(INVOICE_NUMBER_TOO_LONG_MESSAGE).toContain(
      String(MAX_CUSTOM_INVOICE_NUMBER_LENGTH),
    );
  });

  it("caps custom numbers at the documented app-level max", () => {
    expect(MAX_CUSTOM_INVOICE_NUMBER_LENGTH).toBe(64);
  });
});
