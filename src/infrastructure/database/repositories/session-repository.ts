import crypto from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Database } from "@/infrastructure/database";
import { sessions, users } from "@/infrastructure/database/schema";
import type {
  SessionRecord,
  SessionRepository,
  SessionWithUser,
} from "@/application/ports/session-repository";
import { asUserId, type UserId } from "@/domain/branding";

export class SessionRepositoryImpl implements SessionRepository {
  constructor(private readonly db: Database) {}

  async createSession(userId: UserId, expiresAt: Date): Promise<SessionRecord> {
    const sessionId = crypto.randomBytes(32).toString("hex");

    const [inserted] = await this.db
      .insert(sessions)
      .values({
        id: sessionId,
        userId,
        expiresAt,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert session");
    }

    return {
      id: inserted.id,
      userId: asUserId(inserted.userId),
      expiresAt: inserted.expiresAt,
      createdAt: inserted.createdAt,
    };
  }

  async validateSession(sessionId: string): Promise<SessionWithUser | null> {
    const rows = await this.db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    const first = rows[0];
    if (!first) return null;

    const { session, user } = first;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      session: {
        id: session.id,
        userId: asUserId(session.userId),
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      user: {
        id: asUserId(user.id),
        email: user.email,
        passwordHash: user.passwordHash,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }
}
