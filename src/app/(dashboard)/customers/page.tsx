import { sql } from "drizzle-orm";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { invoices, receiptVouchers } from "@/infrastructure/database/schema";
import { connection } from "next/server";
import { CustomersTableClient } from "@/components/documents/customers-table-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function CustomersPage() {
  await connection();
  const [customers, invCounts, recCounts] = await Promise.all([
    container.customerRepository.list(null, 500, 0),
    db
      .select({ customerId: invoices.customerId, count: sql<number>`count(*)::int` })
      .from(invoices)
      .groupBy(invoices.customerId),
    db
      .select({ customerId: receiptVouchers.customerId, count: sql<number>`count(*)::int` })
      .from(receiptVouchers)
      .groupBy(receiptVouchers.customerId),
  ]);

  const statsMap: Record<string, { invoicesCount: number; receiptsCount: number }> = {};
  for (const row of invCounts) {
    if (row.customerId) {
      statsMap[row.customerId] = { invoicesCount: row.count, receiptsCount: 0 };
    }
  }
  for (const row of recCounts) {
    if (row.customerId) {
      if (!statsMap[row.customerId]) {
        statsMap[row.customerId] = { invoicesCount: 0, receiptsCount: row.count };
      } else {
        statsMap[row.customerId]!.receiptsCount = row.count;
      }
    }
  }

  return (
    <CustomersTableClient
      customers={customers}
      title="العملاء"
      statsMap={statsMap}
    />
  );
}
