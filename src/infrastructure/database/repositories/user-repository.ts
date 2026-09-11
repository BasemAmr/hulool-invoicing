import { count, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database";
import { users } from "@/infrastructure/database/schema";
import type {
  UserRecord,
  UserRepository,
} from "@/application/ports/user-repository";
import { asUserId, type UserId } from "@/domain/branding";

export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: UserId): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const first = rows[0];
    if (!first) return null;
    return this.mapToRecord(first);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const first = rows[0];
    if (!first) return null;
    return this.mapToRecord(first);
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: string;
  }): Promise<UserRecord> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const [inserted] = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert user");
    }

    return this.mapToRecord(inserted);
  }

  async countUsers(): Promise<number> {
    const result = await this.db.select({ count: count() }).from(users);
    return Number(result[0]?.count ?? 0);
  }

  private mapToRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      id: asUserId(row.id),
      email: row.email,
      passwordHash: row.passwordHash,
      fullName: row.fullName,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
