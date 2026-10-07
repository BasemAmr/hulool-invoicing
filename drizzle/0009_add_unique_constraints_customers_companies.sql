CREATE UNIQUE INDEX IF NOT EXISTS "companies_name_ar_unique" ON "companies" ("name_ar");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_cr_number_unique" ON "companies" ("cr_number") WHERE "cr_number" IS NOT NULL AND "cr_number" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_name_ar_unique" ON "customers" ("name_ar");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_vat_number_unique" ON "customers" ("vat_number") WHERE "vat_number" IS NOT NULL AND "vat_number" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_unified_number_unique" ON "customers" ("unified_number") WHERE "unified_number" IS NOT NULL AND "unified_number" <> '';
