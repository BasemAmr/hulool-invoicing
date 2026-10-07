import { describe, expect, it } from "vitest";
import { formatDatabaseError } from "./format-db-error";
import { ValidationError } from "@/domain/errors";

describe("formatDatabaseError", () => {
  describe("Customers duplicate constraints", () => {
    it("formats duplicate customer Arabic name error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "customers_name_ar_unique",
        detail: "Key (name_ar)=(شركة الأمل) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe(
        "اسم العميل مسجل بالفعل لعميل آخر، يرجى اختيار اسم مختلف",
      );
    });

    it("formats duplicate customer Arabic name error (using customer context hint)", () => {
      const pgErr = {
        code: "23505",
        constraint: "",
        detail: "Key (name_ar)=(شركة الأمل) already exists.",
      };
      expect(formatDatabaseError(pgErr, undefined, "customer")).toBe(
        "اسم العميل مسجل بالفعل لعميل آخر، يرجى اختيار اسم مختلف",
      );
    });

    it("formats duplicate customer VAT number error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "customers_vat_number_unique",
        detail: "Key (vat_number)=(300000000000003) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe("الرقم الضريبي مسجل بالفعل لعميل آخر");
    });

    it("formats duplicate customer VAT number error (using customer context hint)", () => {
      const pgErr = {
        code: "23505",
        constraint: "",
        detail: "Key (vat_number)=(300000000000003) already exists.",
      };
      expect(formatDatabaseError(pgErr, undefined, "customer")).toBe(
        "الرقم الضريبي مسجل بالفعل لعميل آخر",
      );
    });

    it("formats duplicate customer unified number error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "customers_unified_number_unique",
        detail: "Key (unified_number)=(7001234567) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe(
        "الرقم الموحد (700) مسجل بالفعل لعميل آخر",
      );
    });
  });

  describe("Companies duplicate constraints", () => {
    it("formats duplicate company Arabic name error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "companies_name_ar_unique",
        detail: "Key (name_ar)=(مؤسسة البركة) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe(
        "اسم المنشأة مسجل بالفعل لمنشأة أخرى، يرجى اختيار اسم مختلف",
      );
    });

    it("formats duplicate company Arabic name error (using company context hint)", () => {
      const pgErr = {
        code: "23505",
        constraint: "",
        detail: "Key (name_ar)=(مؤسسة البركة) already exists.",
      };
      expect(formatDatabaseError(pgErr, undefined, "company")).toBe(
        "اسم المنشأة مسجل بالفعل لمنشأة أخرى، يرجى اختيار اسم مختلف",
      );
    });

    it("formats duplicate company VAT number error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "companies_vat_number_unique",
        detail: "Key (vat_number)=(300000000000003) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe("الرقم الضريبي مسجل بالفعل لمنشأة أخرى");
    });

    it("formats duplicate company CR number error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "companies_cr_number_unique",
        detail: "Key (cr_number)=(1010123456) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe(
        "رقم السجل التجاري مسجل بالفعل لمنشأة أخرى",
      );
    });

    it("formats duplicate company prefix error (constraint name)", () => {
      const pgErr = {
        code: "23505",
        constraint: "companies_prefix_unique",
        detail: "Key (prefix)=(INV) already exists.",
      };
      expect(formatDatabaseError(pgErr)).toBe(
        "بادئة الفواتير (Prefix) مستخدمة بالفعل لمنشأة أخرى، يرجى اختيار بادئة مختلفة",
      );
    });
  });

  describe("Wrapping and fallback behaviors", () => {
    it("unwraps errors nested inside Error.cause", () => {
      const nestedErr = new Error("DB Error");
      (nestedErr as { cause: unknown }).cause = {
        code: "23505",
        constraint: "customers_vat_number_unique",
      };
      expect(formatDatabaseError(nestedErr)).toBe(
        "الرقم الضريبي مسجل بالفعل لعميل آخر",
      );
    });

    it("preserves ValidationError messages directly without alteration", () => {
      const valErr = new ValidationError("رسالة خطأ تحقق خاصة");
      expect(formatDatabaseError(valErr)).toBe("رسالة خطأ تحقق خاصة");
    });

    it("returns friendly fallback on unknown DB errors instead of exposing SQL", () => {
      const rawSqlErr = new Error("Failed query: insert into customers ... syntax error at or near 'foo'");
      expect(formatDatabaseError(rawSqlErr, "فشل الحفظ")).toBe("فشل الحفظ");
    });
  });
});
