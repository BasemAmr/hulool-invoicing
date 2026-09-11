CREATE TYPE "public"."invoice_type" AS ENUM('standard', 'simplified');--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_file_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stamp_file_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "signature_file_id" text;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "discount_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_type" "invoice_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "terms" text;