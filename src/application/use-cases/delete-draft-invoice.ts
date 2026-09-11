import type { InvoiceRepository } from "../ports/invoice-repository";
import { asInvoiceId } from "@/domain/branding";
import { InvalidTransitionError, NotFoundError } from "@/domain/errors";

export class DeleteDraftInvoice {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: { id: string }): Promise<void> {
    const invoiceId = asInvoiceId(input.id);
    const existing = await this.invoiceRepository.findByIdWithItems(invoiceId);
    if (!existing) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }
    if (existing.status !== "draft") {
      throw new InvalidTransitionError(
        "لا يمكن حذف الفاتورة بعد اعتمادها وإصدارها وفقاً لاشتراطات هيئة الزكاة والضريبة والجمارك",
      );
    }

    await this.invoiceRepository.deleteDraft(invoiceId);
  }
}
