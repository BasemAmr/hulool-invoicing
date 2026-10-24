import type { CompanyRepository } from "../ports/company-repository";
import { asCompanyId } from "@/domain/branding";
import { DomainError, NotFoundError } from "@/domain/errors";

export class DeleteCompany {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: { id: string }): Promise<void> {
    const companyId = asCompanyId(input.id);
    const existing = await this.companyRepository.findById(companyId);
    if (!existing) {
      throw new NotFoundError("المنشأة غير موجودة");
    }

    const invoiceCount = await this.companyRepository.countInvoices(companyId);
    if (invoiceCount > 0) {
      throw new DomainError(
        `لا يمكن حذف المنشأة «${existing.nameAr}» لوجود ${invoiceCount} فاتورة مرتبطة بها.`,
      );
    }

    const receiptCount = await this.companyRepository.countReceiptVouchers(companyId);
    if (receiptCount > 0) {
      throw new DomainError(
        `لا يمكن حذف المنشأة «${existing.nameAr}» لوجود ${receiptCount} سند قبض مرتبط بها.`,
      );
    }

    await this.companyRepository.delete(companyId);
  }
}
