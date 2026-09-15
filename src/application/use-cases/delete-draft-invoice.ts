import type { InvoiceRepository } from "../ports/invoice-repository";
import { asInvoiceId } from "@/domain/branding";
import { NotFoundError } from "@/domain/errors";

export class DeleteDraftInvoice {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: { id: string }): Promise<void> {
    // Business rule (2026-09): no draft/published distinction — every
    // invoice is published and can be deleted from the table or preview.
    // Name kept as DeleteDraftInvoice so existing imports keep working.
    const invoiceId = asInvoiceId(input.id);
    const existing = await this.invoiceRepository.findByIdWithItems(invoiceId);
    if (!existing) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    await this.invoiceRepository.deleteDraft(invoiceId);
  }
}
