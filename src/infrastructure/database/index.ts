import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../config/env";
import * as schema from "./schema";

// 1. إعداد الـ Singleton لضمان عدم إعادة إنشاء الـ Pool تحت أي ظرف مع Turbopack
const DATABASE_SINGLETON_KEY = "__HULOOL_DB_POOL__";
const DRIZZLE_SINGLETON_KEY = "__HULOOL_DRIZZLE_DB__";

const g = globalThis as any;

if (!g[DATABASE_SINGLETON_KEY]) {
  g[DATABASE_SINGLETON_KEY] = new Pool({
    connectionString: getEnv().DATABASE_URL,
    max: 2,                  // تقليص الاتصالات بحد أقصى اتصالين للمطور المحلي
    idleTimeoutMillis: 1000, // إغلاق الاتصال فوراً بعد ثانية واحدة من الخمول
    connectionTimeoutMillis: 5000,
  });

  g[DATABASE_SINGLETON_KEY].on("error", (err: any) => {
    if (err.code === 'ECONNRESET') return;
    console.error("Unexpected pg pool client error:", err);
  });
}

if (!g[DRIZZLE_SINGLETON_KEY]) {
  g[DRIZZLE_SINGLETON_KEY] = drizzle(g[DATABASE_SINGLETON_KEY], { schema });
}

// 2. تصدير المتغيرات الثابتة المستقرة
export const pool = g[DATABASE_SINGLETON_KEY] as Pool;
export const db = g[DRIZZLE_SINGLETON_KEY] as ReturnType<typeof drizzle<typeof schema>>;

export type Database = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}
