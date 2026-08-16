import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load local dev environment explicitly (dotenv defaults to .env).
dotenv.config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and configure the connection.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});