import {
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

// ─── companies ─────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  vatNumber: text("vat_number").notNull().unique(),
  crNumber: text("cr_number"),
  prefix: text("prefix").notNull().unique(),
  logoUrl: text("logo_url"),
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
  phone: text("phone"),
  email: text("email"),
  addressCity: text("address_city"),
  addressStreet: text("address_street"),
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
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("SAR"),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    vatAmount: numeric("vat_amount", { precision: 15, scale: 2 }).notNull(),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
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

// ─── invoice_items ─────────────────────────────────────────────────────

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
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

// ─── receipt_vouchers (سند قبض) — table only, no repo this slice ───────

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
