import type { InvoiceRepository } from "@/application/ports/invoice-repository";
import type { UrlSigner } from "@/application/ports/url-signer";
import { asInvoiceId } from "@/domain/branding";
import { NotFoundError, InvalidTransitionError } from "@/domain/errors";

export interface SignedInvoiceUrlResult {
  invoiceId: string;
  signature: string;
  expiresAt: number;
  sharePath: string;
  pdfPath: string;
}

export class GenerateSignedInvoiceUrl {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly urlSigner: UrlSigner,
  ) {}

  async execute(
    invoiceId: string,
    expiresInSeconds: number = 7 * 24 * 60 * 60, // 7 days default
  ): Promise<SignedInvoiceUrlResult> {
    const invoice = await this.invoiceRepository.findByIdWithItems(asInvoiceId(invoiceId));
    if (!invoice) {
      throw new NotFoundError(`الفاتورة رقم ${invoiceId} غير موجودة`);
    }

    const { signature, expiresAt } = this.urlSigner.sign(
      invoice.id,
      expiresInSeconds,
    );

    const sharePath = `/share/invoices/${invoice.id}?sig=${signature}&exp=${expiresAt}`;
    const pdfPath = `/api/documents/${invoice.id}/pdf?sig=${signature}&exp=${expiresAt}`;

    return {
      invoiceId: invoice.id,
      signature,
      expiresAt,
      sharePath,
      pdfPath,
    };
  }
}
