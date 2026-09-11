import type { SessionRepository } from "@/application/ports/session-repository";

export class LogoutUser {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string): Promise<void> {
    if (sessionId) {
      await this.sessionRepository.deleteSession(sessionId);
    }
  }
}
