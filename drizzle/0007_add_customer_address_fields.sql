ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_district" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_building_number" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_additional_number" text;