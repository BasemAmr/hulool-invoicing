import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { connection } from "next/server";
import { CompaniesViewClient } from "@/components/documents/companies-view-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function CompanySelectorPage() {
  await connection();
  const companies = await container.companyRepository.list(DEFAULT_PAGE_SIZE, 0);

  return <CompaniesViewClient initialCompanies={companies} />;
}