import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { connection } from "next/server";
import { CustomersTableClient } from "@/components/documents/customers-table-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function CustomersPage() {
  await connection();
  const customers = await container.customerRepository.list(null, 500, 0);

  return (
    <CustomersTableClient
      customers={customers}
      title="العملاء"
    />
  );
}
