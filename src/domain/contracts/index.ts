import { z } from "zod";

import {
  COMPANY_PREFIX_PATTERN,
  VAT_NUMBER_PATTERN,
  VAT_RATE,
} from "../constants";

/**
 * Zod contracts â€” single source of truth for both server-side validation
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
      "prefix must be 2-12 uppercase alphanumerics",
    ),
  crNumber: z.string().optional(),
  clientEmployee: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  logoFileId: z.string().uuid().optional(),
  backgroundFileId: z.string().uuid().optional(),
  signatureFileId: z.string().uuid().optional(),
  footerText: z.string().optional(),
  ...addressFields,
});
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export const companyUpdateSchema = companyCreateSchema.partial().extend({
  id: z.string().uuid(),
  nameAr: z.string().min(1, "nameAr is required"),
  vatNumber: z
    .string()
    .regex(VAT_NUMBER_PATTERN, "vatNumber must be 15 digits starting with '3'"),
  prefix: z
    .string()
    .regex(
      COMPANY_PREFIX_PATTERN,
      "prefix must be 2-12 uppercase alphanumerics",
    ),
});
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

export const customerCreateSchema = z.object({
  nameAr: z.string().min(1, "اسم العميل مطلوب"),
  nameEn: z.string().optional(),
  vatNumber: z.string().min(1, "الرقم الضريبي مطلوب"),
  unifiedNumber: z.string().min(1, "الرقم الموحد مطلوب"),
  phone: z.string().optional(),
  email: z.string().email("البريد الإلكتروني غير صالح").optional().or(z.literal("")),
  addressCity: z.string().min(1, "المدينة مطلوبة"),
  addressStreet: z.string().optional(),
  addressPostalCode: z.string().min(1, "الرمز البريدي مطلوب"),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export const customerUpdateSchema = customerCreateSchema.extend({
  id: z.string().uuid(),
});
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

const quantitySchema = z.number().refine(
  (n) =>
    n > 0 &&
    Number.isFinite(n) &&
    Math.abs(n * 10_000 - Math.round(n * 10_000)) < 1e-6,
  "quantity must be positive with at most 4 decimal places",
);

const invoiceItemSchema = z.object({
  savedProductId: z.string().uuid().optional(),
  saveToProducts: z.boolean().optional(),
  description: z.string().min(1, "description is required"),
  quantity: quantitySchema,
  unitPrice: z.number().int().positive("unitPrice must be a positive integer (halalas)"),
  discountAmount: z.number().int().min(0).default(0),
  vatRate: z.number().min(0).max(1).default(VAT_RATE),
});

export const invoiceCreateSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  templateId: z.string().default("simple_red"),
  invoiceType: z.enum(['standard', 'simplified']).default('standard'),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .optional(),
  overallDiscountRate: z.number().min(0).max(1).optional(),
  overallTaxRate: z.number().min(0).max(1).optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  items: z.array(invoiceItemSchema).min(1, "at least one item is required"),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export const invoiceUpdateSchema = invoiceCreateSchema.extend({
  id: z.string().uuid(),
});
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;


// ─── saved product contracts ──────────────────────────────────────────

export const savedProductCreateSchema = z.object({
  nameAr: z.string().min(1, "اسم المنتج بالعربية مطلوب"),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.number().int().positive().optional(), // In halalas
  vatRate: z.number().min(0).max(1).default(VAT_RATE),
  isActive: z.boolean().default(true),
});
export type SavedProductCreateInput = z.infer<typeof savedProductCreateSchema>;

export const savedProductUpdateSchema = savedProductCreateSchema.extend({
  id: z.string().uuid(),
});
export type SavedProductUpdateInput = z.infer<typeof savedProductUpdateSchema>;

// ─── company settings contracts ───────────────────────────────────────

export const companySettingsSchema = z.object({
  companyId: z.string().uuid(),
  numberFormat: z.enum(["ar", "en"]).default("en"),
  dateFormat: z.string().default("YYYY-MM-DD"),
  currencyCode: z.string().default("SAR"),
  currencyPosition: z.enum(["before", "after"]).default("after"),
  thousandsSeparator: z.string().default(","),
  decimalSeparator: z.string().default("."),
  decimalPlaces: z.number().int().min(0).max(4).default(2),
  defaultVatRate: z.number().min(0).max(1).default(VAT_RATE),
  paperSize: z.enum(["A4", "Letter"]).default("A4"),
  paperOrientation: z.enum(["portrait", "landscape"]).default("portrait"),
  defaultTemplateId: z.string().default("simple_red"),
  defaultReceiptTemplateId: z.string().default("receipt_standard"),
});
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

// ─── receipt voucher contracts (سند قبض) ─────────────────────────────

export const receiptVoucherCreateSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  voucherNumber: z.string().optional(), // Auto-generated if not provided
  voucherDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "voucherDate must be YYYY-MM-DD"),
  amount: z.number().int().positive("المبلغ يجب أن يكون أكبر من صفر"), // In halalas
  paymentMethod: z.enum(["cash", "bank_transfer", "other"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
export type ReceiptVoucherCreateInput = z.infer<typeof receiptVoucherCreateSchema>;

/** Per-company parametric PDF template config (JSON in companies.template_config). */
export const documentTemplateConfigSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be #RRGGBB")
    .default("#0F766E"),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "accentColor must be #RRGGBB")
    .default("#134E4A"),
  showLogo: z.boolean().default(true),
  footerNoteAr: z.string().max(200).default("شكراً لتعاملكم معنا"),
  footerNoteEn: z.string().max(200).default("Thank you for your business"),
  titleAr: z.string().max(80).default("فاتورة ضريبية"),
  titleEn: z.string().max(80).default("TAX INVOICE"),
});
export type DocumentTemplateConfig = z.infer<typeof documentTemplateConfigSchema>;

// ─── auth contracts ───────────────────────────────────────────────────

export const loginInputSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 خانات"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const userCreateSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن لا تقل عن 8 خانات"),
  fullName: z.string().min(2, "الاسم الكامل مطلوب"),
  role: z.enum(["admin", "member"]).default("admin"),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const signedUrlQuerySchema = z.object({
  sig: z.string().min(1, "التوقيع الأمني مطلوب"),
  exp: z.coerce.number().positive("تاريخ الانتهاء غير صالح"),
});
export type SignedUrlQuery = z.infer<typeof signedUrlQuerySchema>;