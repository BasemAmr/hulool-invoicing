/**
 * Production-safe migration entrypoint.
 *
 * This script replaces the old `npx drizzle-kit push --force` approach with
 * proper file-based migrations (`drizzle-orm/node-postgres/migrator`).
 *
 * THE ONE-TIME BOOTSTRAP PROBLEM:
 * The production DB was originally created with `drizzle-kit push`, which
 * applies schema changes directly but does NOT create the `drizzle.__drizzle_migrations`
 * tracking table. If we just run `migrate()`, it tries to replay ALL migrations
 * from 0000, which crashes on "type already exists" / "table already exists".
 *
 * SOLUTION:
 * On the first run, detect that the DB has tables (from push) but no tracking
 * table. Create the tracking table and seed it with a synthetic record whose
 * `created_at` matches the last migration that was already applied via push.
 * Drizzle's migrator only checks `SELECT ... ORDER BY created_at DESC LIMIT 1`
 * and skips any migration whose `folderMillis <= lastApplied.created_at`.
 * So seeding with the timestamp of migration 0006 makes migrate() skip 0000–0006
 * and only apply 0007+.
 *
 * FUTURE DEPLOYS:
 * The tracking table already exists with correct state, so migrate() runs
 * normally and applies only new migrations. No manual intervention needed.
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

// Load environment variables from .env files if they exist (local dev).
// In production (Docker), DATABASE_URL comes from the container environment
// and these files don't exist — that's expected and fine.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv") as typeof import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  // dotenv not available (pruned in prod) — env vars must come from the host
}

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

// ─── Configuration ─────────────────────────────────────────────────────────
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Migrations 0000–0006 were applied to production via `drizzle-kit push`.
 * They already exist in the DB but are NOT tracked in __drizzle_migrations.
 * We seed the tracking table with the LAST of these so drizzle skips them all.
 *
 * The timestamp (1787260000000) comes from _journal.json entry for 0006.
 * Drizzle's migrate() does: `WHERE created_at > lastApplied.created_at`,
 * so anything with folderMillis <= 1787260000000 is skipped.
 */
const LAST_PUSH_MIGRATION_TAG = "0006_add_organization_type";
const LAST_PUSH_MIGRATION_TIMESTAMP = 1787260000000;

// ─── Helpers ───────────────────────────────────────────────────────────────
function log(emoji: string, message: string) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${emoji} ${message}`);
}

function logError(emoji: string, message: string, err?: unknown) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${emoji} ${message}`);
  if (err instanceof Error) {
    console.error(`   └─ ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split("\n").slice(1, 4);
      lines.forEach((l) => console.error(`      ${l.trim()}`));
    }
  }
}

/**
 * Compute the SHA-256 hash of a migration SQL file, matching drizzle-orm's
 * internal algorithm exactly (see drizzle-orm/migrator.cjs line 56).
 */
function hashMigrationFile(filePath: string): string {
  const content = fs.readFileSync(filePath).toString();
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    logError("❌", "DATABASE_URL is not set. Cannot run migrations.");
    process.exit(1);
  }

  log("🔌", "Connecting to database...");

  // Use a dedicated pool for migration (not the app's globalThis singleton)
  // so the connection is released cleanly when the script finishes.
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Quick connectivity check — fail fast with a clear message
    const client = await pool.connect();
    const dbNameResult = await client.query("SELECT current_database() AS db");
    const dbName = dbNameResult.rows[0]?.db ?? "unknown";
    client.release();
    log("✅", `Connected to database: ${dbName}`);
  } catch (err) {
    logError("❌", "Failed to connect to database", err);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const db = drizzle(pool);

  // ─── Step 1: Detect whether this is a fresh migration setup ───────────
  log("🔍", "Checking if migration tracking table exists...");

  let trackingTableExists = false;
  let trackingHasRecords = false;

  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = ${MIGRATIONS_SCHEMA}
          AND table_name = ${MIGRATIONS_TABLE}
      ) AS "exists"
    `);
    trackingTableExists = result.rows[0]?.exists === true;

    if (trackingTableExists) {
      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM "drizzle"."__drizzle_migrations"
      `);
      trackingHasRecords = Number(countResult.rows[0]?.cnt ?? 0) > 0;
    }
  } catch (err) {
    logError("⚠️", "Error checking migration tracking state", err);
    // Non-fatal: if we can't check, we'll let migrate() handle table creation
  }

  if (trackingTableExists && trackingHasRecords) {
    log("✅", "Migration tracking table exists with records. Normal migration path.");
  } else {
    // ─── Step 2: One-time baseline seed ─────────────────────────────────
    log("🔄", "First-time migration setup detected (DB was created via 'push').");
    log("📋", `Baselining: marking migrations through ${LAST_PUSH_MIGRATION_TAG} as already applied...`);

    try {
      // Verify the DB actually has tables from push (sanity check)
      const tablesExist = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'companies'
        ) AS "exists"
      `);

      if (!tablesExist.rows[0]?.exists) {
        log("🆕", "No existing tables found — this is a brand new database. Running all migrations from scratch.");
        // Don't seed anything; let migrate() apply everything from 0000
      } else {
        log("📊", "Existing tables confirmed. Seeding migration tracking...");

        // Create the schema and tracking table (same DDL drizzle uses)
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `);

        // Compute the hash of the last already-applied migration SQL file
        const migrationFilePath = path.join(
          MIGRATIONS_FOLDER,
          `${LAST_PUSH_MIGRATION_TAG}.sql`
        );

        if (!fs.existsSync(migrationFilePath)) {
          logError("❌", `Baseline migration file not found: ${migrationFilePath}`);
          await pool.end().catch(() => {});
          process.exit(1);
        }

        const hash = hashMigrationFile(migrationFilePath);
        log("🔑", `Computed hash for ${LAST_PUSH_MIGRATION_TAG}: ${hash.slice(0, 16)}...`);

        // Check if baseline was already seeded (idempotent re-runs)
        const existing = await db.execute(sql`
          SELECT id FROM "drizzle"."__drizzle_migrations"
          WHERE created_at = ${LAST_PUSH_MIGRATION_TIMESTAMP}
        `);

        if (existing.rows.length > 0) {
          log("✅", "Baseline record already exists. Skipping seed.");
        } else {
          await db.execute(sql`
            INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
            VALUES (${hash}, ${LAST_PUSH_MIGRATION_TIMESTAMP})
          `);
          log("✅", `Baseline seeded: migrations 0000–0006 marked as applied (timestamp: ${LAST_PUSH_MIGRATION_TIMESTAMP}).`);
        }
      }
    } catch (err) {
      logError("❌", "Failed to seed baseline migration tracking", err);
      await pool.end().catch(() => {});
      process.exit(1);
    }
  }

  // ─── Step 3: Run migrations ────────────────────────────────────────────
  log("🚀", `Running migrations from ${MIGRATIONS_FOLDER}...`);

  try {
    await migrate(db, {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsTable: MIGRATIONS_TABLE,
      migrationsSchema: MIGRATIONS_SCHEMA,
    });
    log("✅", "All migrations applied successfully!");
  } catch (err) {
    logError("❌", "Migration failed!", err);

    // Provide diagnostic context
    try {
      const applied = await db.execute(sql`
        SELECT hash, created_at FROM "drizzle"."__drizzle_migrations"
        ORDER BY created_at ASC
      `);
      log("📋", `Applied migrations in tracking table: ${applied.rows.length}`);
      for (const row of applied.rows) {
        const hash = String(row.hash).slice(0, 16);
        log("   ", `  hash=${hash}... created_at=${row.created_at}`);
      }
    } catch {
      // Diagnostics failed — not critical
    }

    await pool.end().catch(() => {});
    process.exit(1);
  }

  // ─── Step 4: Final verification ────────────────────────────────────────
  try {
    const final = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM "drizzle"."__drizzle_migrations"
    `);
    const applied = Number(final.rows[0]?.cnt ?? 0);

    // Read journal to know total expected
    const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const total = journal.entries.length;

    log("📊", `Migration tracking: ${applied} record(s) in tracking table, ${total} migration(s) in journal.`);

    // Verify the customers table has the new address columns (specific to this deploy)
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name IN ('address_district', 'address_building_number', 'address_additional_number')
      ORDER BY column_name
    `);
    const newCols = colCheck.rows.map((r) => r.column_name);
    if (newCols.length === 3) {
      log("✅", `Verified: customers table has new columns: ${newCols.join(", ")}`);
    } else {
      logError("⚠️", `Expected 3 new columns, found ${newCols.length}: ${newCols.join(", ")}`);
    }
  } catch (err) {
    logError("⚠️", "Post-migration verification failed (non-fatal)", err);
  }

  await pool.end();
  log("🏁", "Migration entrypoint complete.");
  process.exit(0);
}

main().catch((err) => {
  logError("💥", "Unexpected top-level error in migration entrypoint", err);
  process.exit(1);
});
