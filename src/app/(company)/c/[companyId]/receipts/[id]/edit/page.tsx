import { notFound, redirect } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import type { CompanyId } from "@/domain/branding";
import { EditReceiptVoucherForm } from "./edit-receipt-form";

const container = createContainer(db);

export default async function EditReceiptVoucherPage({
  params,
}: {
  params: Promise<{ companyId: string; id: string }>;
}) {
  const { companyId, id } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const receipt = await container.receiptVoucherRepository.findById(id);
  if (!receipt) notFound();

  // Guard: Auto-generated invoice-linked receipts cannot be manually edited
  if (receipt.invoiceId) {
    redirect(`/c/${companyId}/receipts`);
  }

  return <EditReceiptVoucherForm companyId={companyId} receipt={receipt} />;
}
