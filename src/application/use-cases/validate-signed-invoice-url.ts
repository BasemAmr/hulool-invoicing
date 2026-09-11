import type { UrlSigner } from "@/application/ports/url-signer";
import { ForbiddenError } from "@/domain/errors";

export class ValidateSignedInvoiceUrl {
  constructor(private readonly urlSigner: UrlSigner) {}

  execute(invoiceId: string, signature: string, expiresAt: number): boolean {
    const isValid = this.urlSigner.verify(invoiceId, signature, expiresAt);
    if (!isValid) {
      throw new ForbiddenError("رابط الفاتورة غير صالح أو منتهي الصلاحية");
    }
    return true;
  }
}
