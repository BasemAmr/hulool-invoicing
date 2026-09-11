CREATE TABLE IF NOT EXISTS "saved_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"description" text,
	"unit_price" numeric(15, 2),
	"vat_rate" numeric(5, 4) DEFAULT '0.1500' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"number_format" text DEFAULT 'en' NOT NULL,
	"date_format" text DEFAULT 'YYYY-MM-DD' NOT NULL,
	"currency_code" text DEFAULT 'SAR' NOT NULL,
	"currency_position" text DEFAULT 'after' NOT NULL,
	"thousands_separator" text DEFAULT ',' NOT NULL,
	"decimal_separator" text DEFAULT '.' NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"default_vat_rate" numeric(5, 4) DEFAULT '0.1500' NOT NULL,
	"paper_size" text DEFAULT 'A4' NOT NULL,
	"paper_orientation" text DEFAULT 'portrait' NOT NULL,
	"default_template_id" text DEFAULT 'simple_red' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "saved_product_id" uuid;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "template_id" text DEFAULT 'simple_red' NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "overall_discount_rate" numeric(5, 4);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "overall_tax_rate" numeric(5, 4);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "background_file_id" text;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "footer_text" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "unified_number" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_postal_code" text;
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL;
