import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CustomersTableClient } from "@/components/documents/customers-table-client";

const container = createContainer(db);

export default async function CustomersPage() {
  const customers = await container.customerRepository.list(null, 500, 0);

  return (
    <CustomersTableClient
      customers={customers}
      title="العملاء"
    />
  );
}
