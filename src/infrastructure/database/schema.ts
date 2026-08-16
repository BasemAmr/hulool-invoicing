import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Minimal proof-of-pipeline schema. The full domain model (invoices, sequences,
 * ZATCA QR data, etc.) is added later — do not extend this file prematurely.
 */
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  vatNumber: text("vat_number").notNull().unique(),
  prefix: text("prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});