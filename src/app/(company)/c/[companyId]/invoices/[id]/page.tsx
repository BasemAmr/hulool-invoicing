import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";
import { InvoicePreviewClient } from "./invoice-preview-client";

const container = createContainer(db);

export default async function CompanyInvoiceDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; id: string }>;
}) {
  const { companyId, id } = await params;

  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id)
  );
  if (!invoice) {
    notFound();
  }

  const [company, customer, receiptVoucher] = await Promise.all([
    container.companyRepository.findById(invoice.companyId),
    container.customerRepository.findById(invoice.customerId),
    container.receiptVoucherRepository.findByInvoiceId(invoice.id),
  ]);

  if (!company || !customer) {
    notFound();
  }

  const dto = toInvoiceDto(invoice);
  const qrDataUrl = dto.qrPayload
    ? await QRCode.toDataURL(dto.qrPayload, { margin: 1, width: 180 })
    : null;

  return (
    <InvoicePreviewClient
      companyId={companyId}
      invoice={dto}
      company={company}
      initialCustomer={customer}
      receiptVoucher={receiptVoucher}
      qrDataUrl={qrDataUrl}
    />
  );
}