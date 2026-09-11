import crypto from "node:crypto";
import type { UrlSigner } from "@/application/ports/url-signer";

/**
 * Production-grade HMAC-SHA256 URL Signer with expiration and timingSafeEqual verification.
 */
export class HmacUrlSigner implements UrlSigner {
  private readonly secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.AUTH_SECRET || "hulool-invoicing-app-signed-url-secret-salt-2026";
  }

  sign(resourceId: string, expiresInSeconds: number): { signature: string; expiresAt: number } {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${resourceId}:${expiresAt}`;
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(payload)
      .digest("hex");

    return { signature, expiresAt };
  }

  verify(resourceId: string, signature: string, expiresAt: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt < now) {
      return false; // Expired
    }

    const payload = `${resourceId}:${expiresAt}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.secret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }
}
