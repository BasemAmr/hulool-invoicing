ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "template_name_overrides" jsonb DEFAULT '{}'::jsonb;
