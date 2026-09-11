import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CompanySidebar, CompanyMobileNav } from "@/components/layout/company-sidebar";
import type { CompanyId } from "@/domain/branding";

const container = createContainer(db);

export default async function CompanyScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);

  if (!company) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Mobile Top Navigation */}
      <CompanyMobileNav company={company} />

      {/* Desktop Company-Scoped Sidebar */}
      <CompanySidebar company={company} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
