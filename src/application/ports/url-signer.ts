export interface UrlSigner {
  sign(resourceId: string, expiresInSeconds: number): { signature: string; expiresAt: number };
  verify(resourceId: string, signature: string, expiresAt: number): boolean;
}
