import type { UserRepository } from "@/application/ports/user-repository";
import type { SessionRepository, SessionRecord } from "@/application/ports/session-repository";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import { AuthenticationError } from "@/domain/errors";
import { loginInputSchema, type LoginInput } from "@/domain/contracts";

export interface AuthenticateUserResult {
  session: SessionRecord;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export class AuthenticateUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: LoginInput): Promise<AuthenticateUserResult> {
    const validated = loginInputSchema.parse(input);
    const user = await this.userRepository.findByEmail(validated.email);

    if (!user) {
      throw new AuthenticationError("بيانات الدخول غير صحيحة");
    }

    const isValid = await this.passwordHasher.verify(
      user.passwordHash,
      validated.password,
    );

    if (!isValid) {
      throw new AuthenticationError("بيانات الدخول غير صحيحة");
    }

    // Default 30 days session
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.sessionRepository.createSession(user.id, expiresAt);

    return {
      session,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
