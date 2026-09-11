import type { UserId } from "@/domain/branding";

export interface UserRecord {
  id: UserId;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findById(id: UserId): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: string;
  }): Promise<UserRecord>;
  countUsers(): Promise<number>;
}
