import path from "node:path";
import dotenv from "dotenv";

// Load Next.js env files: .env.local, .env.development, .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { count, eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { ScryptPasswordHasher } from "../security/password-hasher";

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL || "admin@hulool.sa";
  const password = process.env.ADMIN_SEED_PASSWORD || "Admin@123456";
  const fullName = "المدير العام";

  console.log(`[Seed Admin] Checking existing users...`);
  const hasher = new ScryptPasswordHasher();
  const passwordHash = await hasher.hash(password);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const firstExisting = existing[0];
  if (firstExisting) {
    console.log(`[Seed Admin] Updating existing admin password for ${email}...`);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, firstExisting.id));
    console.log(`[Seed Admin] Admin account updated successfully!`);
  } else {
    console.log(`[Seed Admin] Creating new admin account for ${email}...`);
    await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role: "admin",
    });
    console.log(`[Seed Admin] Admin account created successfully!`);
  }

  console.log(`----------------------------------------`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`----------------------------------------`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed Admin] Error:", err);
  process.exit(1);
});
