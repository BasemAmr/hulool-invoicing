import {
  boolean,
  customType,
  date,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Postgres bytea column — used for uploaded_files.data.
 * node-postgres returns bytea as Buffer; we expose Uint8Array at the edge.
 */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value: Uint8Array) => Buffer.from(value),
  fromDriver: (value: Buffer) => new Uint8Array(value),
});

/**
 * ZATCA Phase 1 — Saudi multi-company invoicing schema.
 *
 * Conventions:
 * - Explicit snake_case column names.
 * - Timestamps use `timestamp with time zone`.
 * - Money uses `numeric(15,2)` (stored as string, converted to Halalas in repos).
 * - Closed sets use `pgEnum`.
 * - UUIDs are server-generated via `defaultRandom`.
 */

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "other",
]);

export const invoiceTypeEnum = pgEnum("invoice_type", [
  "standard",
  "simplified",
]);

// ─── companies ─────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  vatNumber: text("vat_number").notNull().unique(),
  crNumber: text("cr_number"),
  prefix: text("prefix").notNull().unique(),
  /** @deprecated — use logoFileId instead. Kept for backward compat. */
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  /** References uploaded_files.id — company logo image. */
  logoFileId: text("logo_file_id"),
  /** References uploaded_files.id — company background/watermark image. */
  backgroundFileId: text("background_file_id"),
  /** References uploaded_files.id — authorized signature image. */
  signatureFileId: text("signature_file_id"),
  footerText: text("footer_text"),
  templateConfig: jsonb("template_config"),
  addressBuildingNumber: text("address_building_number"),
  addressStreet: text("address_street"),
  addressDistrict: text("address_district"),
  addressCity: text("address_city"),
  addressPostalCode: text("address_postal_code"),
  addressAdditionalNumber: text("address_additional_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── customers (bureau-wide — no company_id) ───────────────────────────

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  vatNumber: text("vat_number"),
  unifiedNumber: text("unified_number"),
  phone: text("phone"),
  email: text("email"),
  addressCity: text("address_city"),
  addressStreet: text("address_street"),
  addressPostalCode: text("address_postal_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── company_sequences (atomic invoice numbering) ──────────────────────

export const companySequences = pgTable(
  "company_sequences",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    year: integer("year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.year] })],
);

// ─── invoices ──────────────────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    invoiceNumber: text("invoice_number"),
    templateId: text("template_id").notNull().default("simple_red"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    invoiceType: invoiceTypeEnum("invoice_type").notNull().default("standard"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("SAR"),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    vatAmount: numeric("vat_amount", { precision: 15, scale: 2 }).notNull(),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),
    overallDiscountRate: numeric("overall_discount_rate", { precision: 5, scale: 4 }),
    overallTaxRate: numeric("overall_tax_rate", { precision: 5, scale: 4 }),
    notes: text("notes"),
    terms: text("terms"),
    qrPayload: text("qr_payload"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("invoices_company_invoice_number_unique").on(
      t.companyId,
      t.invoiceNumber,
    ),
  ],
);

// ─── saved_products (bureau-wide line-item catalog) ───────────────────────

export const savedProducts = pgTable("saved_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0.1500"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── company_settings (scoped formatting, currency, and PDF template defaults) ──

export const companySettings = pgTable("company_settings", {
  companyId: uuid("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  numberFormat: text("number_format").notNull().default("en"), // 'ar' (٠١٢٣) | 'en' (0123)
  dateFormat: text("date_format").notNull().default("YYYY-MM-DD"),
  currencyCode: text("currency_code").notNull().default("SAR"),
  currencyPosition: text("currency_position").notNull().default("after"), // 'before' | 'after'
  thousandsSeparator: text("thousands_separator").notNull().default(","),
  decimalSeparator: text("decimal_separator").notNull().default("."),
  decimalPlaces: integer("decimal_places").notNull().default(2),
  defaultVatRate: numeric("default_vat_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0.1500"),
  paperSize: text("paper_size").notNull().default("A4"),
  paperOrientation: text("paper_orientation").notNull().default("portrait"),
  defaultTemplateId: text("default_template_id").notNull().default("simple_red"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── invoice_items ─────────────────────────────────────────────────────

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    savedProductId: uuid("saved_product_id").references(() => savedProducts.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.1500"),
    lineSubtotal: numeric("line_subtotal", { precision: 15, scale: 2 }).notNull(),
    lineVat: numeric("line_vat", { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.invoiceId],
      foreignColumns: [invoices.id],
    }),
  ],
);

// ─── uploaded_files (logo/stamp/signature — bytea, no external storage) ─

export const uploadedFiles = pgTable("uploaded_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── receipt_vouchers (سند قبض) ─────────────────────────────────────────

export const receiptVouchers = pgTable(
  "receipt_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    voucherNumber: text("voucher_number").notNull(),
    voucherDate: date("voucher_date").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    qrPayload: text("qr_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("receipt_vouchers_company_voucher_number_unique").on(
      t.companyId,
      t.voucherNumber,
    ),
  ],
);

// ─── payment_vouchers (سند صرف) — table only, no repo this slice ───────

export const paymentVouchers = pgTable(
  "payment_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    voucherNumber: text("voucher_number").notNull(),
    voucherDate: date("voucher_date").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    qrPayload: text("qr_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("payment_vouchers_company_voucher_number_unique").on(
      t.companyId,
      t.voucherNumber,
    ),
  ],
);

// ─── idempotency_keys ──────────────────────────────────────────────────

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  invoiceId: uuid("invoice_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── users ─────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── sessions ──────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // Session token hash
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

