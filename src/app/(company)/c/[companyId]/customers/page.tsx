import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import type { CompanyId } from "@/domain/branding";
import { CustomersTableClient } from "@/components/documents/customers-table-client";

const container = createContainer(db);

export default async function CompanyCustomersPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const customers = await container.customerRepository.list(null, 500, 0);

  return (
    <CustomersTableClient
      customers={customers}
      title="العملاء"
    />
  );
}