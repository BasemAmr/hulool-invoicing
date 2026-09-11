import type { CustomerRepository } from "../ports/customer-repository";
import { asCustomerId } from "@/domain/branding";
import { DomainError, NotFoundError } from "@/domain/errors";

export class DeleteCustomer {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: { id: string }): Promise<void> {
    const customerId = asCustomerId(input.id);
    const existing = await this.customerRepository.findById(customerId);
    if (!existing) {
      throw new NotFoundError("العميل غير موجود");
    }

    const invoiceCount = await this.customerRepository.countInvoices(customerId);
    if (invoiceCount > 0) {
      throw new DomainError(
        `لا يمكن حذف العميل «${existing.nameAr}» لوجود ${invoiceCount} فاتورة مرتبطة به.`,
      );
    }

    await this.customerRepository.delete(customerId);
  }
}
