import { describe, expect, it } from "vitest";
import { customerCreateSchema } from "./index";

/**
 * R3: Customer Schema — Add Required Fields
 * - required: nameAr, vatNumber, unifiedNumber, addressCity, addressPostalCode
 * - optional: nameEn, phone, email (valid or empty string), addressStreet
 */

export const targetCustomerCreateSchema = customerCreateSchema;

describe("R3: Customer Schema Validation & Required Fields", () => {
  const validCustomerInput = {
    nameAr: "شركة الحلول المتقدمة",
    vatNumber: "300000000000003",
    unifiedNumber: "7001234567",
    addressCity: "الرياض",
    addressPostalCode: "12345",
  };

  describe("Tier 1: Feature Coverage (Happy Path)", () => {
    it("accepts valid customer with only required fields", () => {
      const result = targetCustomerCreateSchema.safeParse(validCustomerInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nameAr).toBe("شركة الحلول المتقدمة");
        expect(result.data.unifiedNumber).toBe("7001234567");
        expect(result.data.addressPostalCode).toBe("12345");
      }
    });

    it("accepts valid customer with all required and optional fields populated", () => {
      const fullInput = {
        ...validCustomerInput,
        nameEn: "Advanced Solutions Co.",
        phone: "0501234567",
        email: "info@solutions.sa",
        addressStreet: "شارع الملك فهد",
      };
      const result = targetCustomerCreateSchema.safeParse(fullInput);
      expect(result.success).toBe(true);
    });
  });

  describe("Tier 2: Boundary & Corner Cases", () => {
    it("rejects missing nameAr", () => {
      const { nameAr, ...rest } = validCustomerInput;
      const result = targetCustomerCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing vatNumber", () => {
      const { vatNumber, ...rest } = validCustomerInput;
      const result = targetCustomerCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing unifiedNumber (700)", () => {
      const { unifiedNumber, ...rest } = validCustomerInput;
      const result = targetCustomerCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing addressCity", () => {
      const { addressCity, ...rest } = validCustomerInput;
      const result = targetCustomerCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing addressPostalCode", () => {
      const { addressPostalCode, ...rest } = validCustomerInput;
      const result = targetCustomerCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects empty strings for required fields", () => {
      expect(
        targetCustomerCreateSchema.safeParse({ ...validCustomerInput, nameAr: "" }).success,
      ).toBe(false);
      expect(
        targetCustomerCreateSchema.safeParse({ ...validCustomerInput, vatNumber: "" }).success,
      ).toBe(false);
      expect(
        targetCustomerCreateSchema.safeParse({ ...validCustomerInput, unifiedNumber: "" }).success,
      ).toBe(false);
      expect(
        targetCustomerCreateSchema.safeParse({ ...validCustomerInput, addressCity: "" }).success,
      ).toBe(false);
      expect(
        targetCustomerCreateSchema.safeParse({ ...validCustomerInput, addressPostalCode: "" }).success,
      ).toBe(false);
    });

    it("accepts empty string for optional email", () => {
      const result = targetCustomerCreateSchema.safeParse({
        ...validCustomerInput,
        email: "",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email formats when email is non-empty", () => {
      const result = targetCustomerCreateSchema.safeParse({
        ...validCustomerInput,
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Tier 3: PDF Presentation Contract", () => {
    it("helper omits null and empty optional fields for clean PDF rendering", () => {
      const customerRecord = {
        nameAr: "مؤسسة الوفاق",
        nameEn: null,
        vatNumber: "311111111111113",
        unifiedNumber: "7009876543",
        phone: null,
        email: "",
        addressCity: "جدة",
        addressStreet: null,
        addressPostalCode: "21451",
      };

      // Extract only non-empty display entries
      const displayFields = [
        { label: "الرقم الضريبي", value: customerRecord.vatNumber },
        { label: "الرقم الموحد", value: customerRecord.unifiedNumber },
        { label: "الهاتف", value: customerRecord.phone },
        { label: "البريد", value: customerRecord.email },
        { label: "المدينة", value: customerRecord.addressCity },
        { label: "الشارع", value: customerRecord.addressStreet },
        { label: "الرمز البريدي", value: customerRecord.addressPostalCode },
      ].filter((f) => f.value && f.value.trim().length > 0);

      expect(displayFields.map((f) => f.label)).toEqual([
        "الرقم الضريبي",
        "الرقم الموحد",
        "المدينة",
        "الرمز البريدي",
      ]);
      expect(displayFields.find((f) => f.label === "الهاتف")).toBeUndefined();
      expect(displayFields.find((f) => f.label === "البريد")).toBeUndefined();
      expect(displayFields.find((f) => f.label === "الشارع")).toBeUndefined();
    });
  });
});
