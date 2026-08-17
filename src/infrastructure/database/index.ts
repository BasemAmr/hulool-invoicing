import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getEnv } from "../config/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: getEnv().DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/**
 * Drizzle transaction handle type.
 * Re-exported here so the application layer can type-import it via
 * `src/application/tx.ts` without importing any Drizzle runtime values.
 */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Run a function inside a database transaction. */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}
