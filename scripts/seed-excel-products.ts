import path from "node:path";
import fs from "node:fs";
import * as xlsx from "xlsx";
import pg from "pg";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { savedProducts } from "../src/infrastructure/database/schema";

// Load local environment files if running standalone
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv") as typeof import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  // Environment already populated from container host
}

const SEED_FLAG_KEY = "seed_products_al_makhzan_v1";
const EXCEL_FILENAME = "بيانات الاصناف المنتجات.xlsx";
const BATCH_SIZE = 100;

function log(emoji: string, message: string) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${emoji} ${message}`);
}

function logError(emoji: string, message: string, err?: unknown) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${emoji} ${message}`);
  if (err instanceof Error) {
    console.error(`   └─ ${err.message}`);
  }
}

/**
 * Executes the one-time Excel product seed if not already recorded in __app_seed_history.
 * Can be passed an existing pg.Pool or Drizzle db, or will instantiate its own connection.
 */
export async function runExcelProductSeed(
  poolOrDb?: pg.Pool | NodePgDatabase<Record<string, unknown>>
): Promise<{ insertedCount: number; skippedCount: number }> {
  let localPool: pg.Pool | null = null;
  let db: NodePgDatabase<Record<string, unknown>>;

  if (!poolOrDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Cannot run product seed.");
    }
    localPool = new pg.Pool({ connectionString: url, max: 1 });
    db = drizzle(localPool);
  } else if ("query" in poolOrDb && typeof poolOrDb.query === "function" && "connect" in poolOrDb) {
    // poolOrDb is a pg.Pool
    db = drizzle(poolOrDb as pg.Pool);
  } else {
    // poolOrDb is already a Drizzle Database instance
    db = poolOrDb as NodePgDatabase<Record<string, unknown>>;
  }

  try {
    // 1. Ensure __app_seed_history tracking table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "__app_seed_history" (
        "key" text PRIMARY KEY,
        "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
        "details" text
      )
    `);

    // 2. Check if this seed has already been applied
    const existingSeed = await db.execute(sql`
      SELECT "key" FROM "__app_seed_history" WHERE "key" = ${SEED_FLAG_KEY}
    `);

    if (existingSeed.rows.length > 0) {
      log("⏭️", `[Seed] '${SEED_FLAG_KEY}' already applied. Skipping.`);
      return { insertedCount: 0, skippedCount: 0 };
    }

    log("🌱", `[Seed] Applying '${SEED_FLAG_KEY}' from ${EXCEL_FILENAME}...`);

    // 3. Locate the Excel file
    const filePath = path.resolve(process.cwd(), "scripts", "data", EXCEL_FILENAME);
    if (!fs.existsSync(filePath)) {
      logError("⚠️", `[Seed] Excel file not found at ${filePath}. Skipping seed.`);
      return { insertedCount: 0, skippedCount: 0 };
    }

    // 4. Read Excel workbook and parse rows
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames.includes("المخزن")
      ? "المخزن"
      : workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error(`[Seed] No sheets found in ${filePath}`);
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`[Seed] Sheet '${sheetName}' could not be read`);
    }

    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
    log("📊", `[Seed] Read ${rows.length} rows from sheet '${sheetName}'.`);

    // 5. Query existing product names to prevent duplicates
    const existingDbProducts = await db.execute(sql`
      SELECT name_ar FROM saved_products
    `);
    const existingNames = new Set<string>(
      existingDbProducts.rows.map((r) => String(r.name_ar).trim())
    );

    // 6. Deduplicate in-memory and prepare batch insert payload
    const seenInExcel = new Set<string>();
    const toInsert: Array<{
      nameAr: string;
      unitPrice: string;
      vatRate: string;
      isActive: boolean;
    }> = [];

    let duplicateInExcelCount = 0;
    let alreadyInDbCount = 0;

    for (const row of rows) {
      const nameRaw = (row["اسم المنتج"] ?? "").toString().trim();
      if (!nameRaw) continue;

      if (seenInExcel.has(nameRaw)) {
        duplicateInExcelCount++;
        continue;
      }
      seenInExcel.add(nameRaw);

      if (existingNames.has(nameRaw)) {
        alreadyInDbCount++;
        continue;
      }

      const priceRaw = Number(row["السعر"] ?? 0);
      const unitPrice = isNaN(priceRaw) || priceRaw < 0 ? "0.00" : priceRaw.toFixed(2);

      toInsert.push({
        nameAr: nameRaw,
        unitPrice,
        vatRate: "0.1500",
        isActive: true,
      });
    }

    log(
      "🔍",
      `[Seed] Deduplicated: ${toInsert.length} new products to insert (${alreadyInDbCount} already in DB, ${duplicateInExcelCount} duplicates in Excel).`
    );

    // 7. Insert in batches of BATCH_SIZE
    let insertedCount = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(savedProducts).values(batch);
      insertedCount += batch.length;
    }

    // 8. Record completion in __app_seed_history
    const details = JSON.stringify({
      insertedCount,
      alreadyInDbCount,
      duplicateInExcelCount,
      totalRows: rows.length,
      appliedAt: new Date().toISOString(),
    });

    await db.execute(sql`
      INSERT INTO "__app_seed_history" ("key", "applied_at", "details")
      VALUES (${SEED_FLAG_KEY}, now(), ${details})
      ON CONFLICT ("key") DO NOTHING
    `);

    log(
      "✅",
      `[Seed] Finished successfully! Inserted ${insertedCount} products. Flag '${SEED_FLAG_KEY}' recorded.`
    );

    return { insertedCount, skippedCount: alreadyInDbCount + duplicateInExcelCount };
  } finally {
    if (localPool) {
      await localPool.end().catch(() => {});
    }
  }
}

// Standalone execution entrypoint
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runExcelProductSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      logError("💥", "[Seed] Standalone seed run failed", err);
      process.exit(1);
    });
}
