import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load Next.js environment files for standalone/CLI scripts
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Environment validation — lazy, fail fast with a clear message.
 *
 * Validation happens on first `getEnv()` call, NOT at import time, so that
 * builds and tests that never touch the database are not broken by a
 * missing DATABASE_URL.
 */

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validate and cache environment variables on first use. */
export function getEnv(): Env {
  if (cached === null) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Environment validation failed:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
