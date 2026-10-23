import { sql } from "drizzle-orm";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { invoices, receiptVouchers } from "@/infrastructure/database/schema";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { connection } from "next/server";
import { CompaniesViewClient } from "@/components/documents/companies-view-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function CompanySelectorPage() {
  await connection();
  const [companies, invCounts, recCounts] = await Promise.all([
    container.companyRepository.list(DEFAULT_PAGE_SIZE, 0),
    db
      .select({ companyId: invoices.companyId, count: sql<number>`count(*)::int` })
      .from(invoices)
      .groupBy(invoices.companyId),
    db
      .select({ companyId: receiptVouchers.companyId, count: sql<number>`count(*)::int` })
      .from(receiptVouchers)
      .groupBy(receiptVouchers.companyId),
  ]);

  const statsMap: Record<string, { invoicesCount: number; receiptsCount: number }> = {};
  for (const row of invCounts) {
    if (row.companyId) {
      statsMap[row.companyId] = { invoicesCount: row.count, receiptsCount: 0 };
    }
  }
  for (const row of recCounts) {
    if (row.companyId) {
      if (!statsMap[row.companyId]) {
        statsMap[row.companyId] = { invoicesCount: 0, receiptsCount: row.count };
      } else {
        statsMap[row.companyId]!.receiptsCount = row.count;
      }
    }
  }

  return (
    <CompaniesViewClient
      initialCompanies={companies}
      statsMap={statsMap}
    />
  );
}