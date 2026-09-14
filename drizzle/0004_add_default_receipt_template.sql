ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_receipt_template_id" text DEFAULT 'receipt_standard' NOT NULL;
