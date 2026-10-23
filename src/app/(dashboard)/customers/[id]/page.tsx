import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { toDecimalString } from "@/domain/value-objects/money";
import type { CustomerId } from "@/domain/branding";
import {
  CustomerInvoicesClient,
  type EnrichedCustomerInvoice,
  type EnrichedCustomerReceipt,
} from "./customer-invoices-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await container.customerRepository.findById(id as CustomerId);
  if (!customer) notFound();

  const [initialInvoices, totalCount, initialReceipts, receiptsCount, allCompanies] = await Promise.all([
    container.invoiceRepository.listByCustomer(id as CustomerId, 50, 0),
    container.invoiceRepository.countByCustomer(id as CustomerId),
    container.receiptVoucherRepository.listByCustomer(id as CustomerId, 50, 0),
    container.receiptVoucherRepository.countByCustomer(id as CustomerId),
    container.companyRepository.list(200, 0),
  ]);

  const companyMap = new Map<string, string>(
    allCompanies.map((c) => [c.id as string, c.nameAr])
  );

  const enrichedInvoices: EnrichedCustomerInvoice[] = initialInvoices.map((inv) => ({
    id: inv.id,
    companyId: inv.companyId,
    companyNameAr: companyMap.get(inv.companyId as string) || "منشأة غير معروفة",
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    invoiceType: inv.invoiceType,
    issueDate: inv.issueDate,
    issueTime: inv.issueTime || "00:00",
    subtotal: toDecimalString(inv.subtotal),
    vatAmount: toDecimalString(inv.vatAmount),
    total: toDecimalString(inv.total),
    currency: inv.currency,
  }));

  const enrichedReceipts: EnrichedCustomerReceipt[] = initialReceipts.map((rec) => ({
    id: rec.id,
    companyId: rec.companyId,
    companyNameAr: companyMap.get(rec.companyId) || "منشأة غير معروفة",
    voucherNumber: rec.voucherNumber,
    voucherDate: rec.voucherDate,
    amount: (rec.amount / 100).toFixed(2),
    paymentMethod: rec.paymentMethod,
    reference: rec.reference,
    notes: rec.notes,
    invoiceId: rec.invoiceId,
  }));

  return (
    <CustomerInvoicesClient
      customer={customer}
      initialInvoices={enrichedInvoices}
      initialTotalCount={totalCount}
      initialReceipts={enrichedReceipts}
      initialReceiptsCount={receiptsCount}
    />
  );
}
