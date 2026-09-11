import type { SessionRepository, SessionWithUser } from "@/application/ports/session-repository";

export class ValidateSession {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string): Promise<SessionWithUser | null> {
    if (!sessionId || typeof sessionId !== "string") {
      return null;
    }
    return this.sessionRepository.validateSession(sessionId);
  }
}
