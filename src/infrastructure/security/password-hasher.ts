import crypto from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHasher } from "@/application/ports/password-hasher";

const scryptAsync = promisify(crypto.scrypt);

/**
 * Production-grade password hasher using Node.js scrypt with per-password 16-byte random salt.
 * Formats hash as `salt:derivedKeyHex`.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(plain, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;

    const derivedKey = (await scryptAsync(plain, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(key, "hex");

    if (derivedKey.length !== keyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  }
}
