import { z } from "zod";

import {
  COMPANY_PREFIX_PATTERN,
  VAT_NUMBER_PATTERN,
  VAT_RATE,
} from "../constants";

/**
 * Zod contracts — single source of truth for both server-side validation
 * and (later) client-side form validation. Inferred TS types are the
 * canonical input shapes for use cases.
 */

const addressFields = {
  addressBuildingNumber: z.string().optional(),
  addressStreet: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressAdditionalNumber: z.string().optional(),
} as const;

export const companyCreateSchema = z.object({
  nameAr: z.string().min(1, "nameAr is required"),
  nameEn: z.string().optional(),
  vatNumber: z
    .string()
    .regex(VAT_NUMBER_PATTERN, "vatNumber must be 15 digits starting with '3'"),
  prefix: z
    .string()
    .regex(
      COMPANY_PREFIX_PATTERN,
      "prefix must be 2-6 uppercase alphanumerics",
    ),
  crNumber: z.string().optional(),
  logoUrl: z.string().optional(),
  ...addressFields,
});
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;

export const customerCreateSchema = z.object({
  nameAr: z.string().min(1, "nameAr is required"),
  nameEn: z.string().optional(),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressCity: z.string().optional(),
  addressStreet: z.string().optional(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

const quantitySchema = z.number().refine(
  (n) =>
    n > 0 &&
    Number.isFinite(n) &&
    Math.abs(n * 10_000 - Math.round(n * 10_000)) < 1e-6,
  "quantity must be positive with at most 4 decimal places",
);

const invoiceItemSchema = z.object({
  description: z.string().min(1, "description is required"),
  quantity: quantitySchema,
  unitPrice: z.number().int().positive("unitPrice must be a positive integer (halalas)"),
  vatRate: z.number().min(0).max(1).default(VAT_RATE),
});

export const invoiceCreateSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  items: z.array(invoiceItemSchema).min(1, "at least one item is required"),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
