import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import type { CompanyId } from "@/domain/branding";
import { InvoicesFilterView } from "./invoices-filter-view";

const container = createContainer(db);

export default async function CompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const [invoices, customers] = await Promise.all([
    container.invoiceRepository.listByCompany(companyId as CompanyId, { status: null }, 500, 0),
    container.customerRepository.list(null, 500, 0),
  ]);

  return (
    <InvoicesFilterView
      invoices={invoices}
      customers={customers}
      company={{
        id: company.id,
        nameAr: company.nameAr,
        prefix: company.prefix,
        vatNumber: company.vatNumber,
        addressCity: company.addressCity,
      }}
      companyId={companyId}
    />
  );
}
