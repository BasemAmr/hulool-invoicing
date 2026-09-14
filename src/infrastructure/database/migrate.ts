import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  console.log(`[Migrate] Running migrations from ${migrationsFolder}...`);
  
  await migrate(db, { migrationsFolder });
  
  console.log("[Migrate] Migrations applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Migrate] Migration failed!", err);
  process.exit(1);
});
