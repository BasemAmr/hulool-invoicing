import type { UserId } from "@/domain/branding";
import type { UserRecord } from "./user-repository";

export interface SessionRecord {
  id: string;
  userId: UserId;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionWithUser {
  session: SessionRecord;
  user: UserRecord;
}

export interface SessionRepository {
  createSession(userId: UserId, expiresAt: Date): Promise<SessionRecord>;
  validateSession(sessionId: string): Promise<SessionWithUser | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}
