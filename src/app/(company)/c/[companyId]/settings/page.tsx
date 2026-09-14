import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { Button } from "@/components/ui/button";
import type { CompanyId } from "@/domain/branding";
import { CompanySettingsForm } from "@/components/forms/company-settings-form";

const container = createContainer(db);

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const settings = await container.companySettingsRepository.getByCompanyId(companyId);

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            إعدادات المنشأة — {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تخصيص تنسيقات الأرقام، التواريخ، العملة، واختيار قوالب الفواتير وسندات القبض
          </p>
        </div>
        <Link href={`/companies/${companyId}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Building2 className="size-3.5" />
            <span>تعديل السجل والشعار والختم</span>
          </Button>
        </Link>
      </div>

      <CompanySettingsForm companyId={companyId} settings={settings} />
    </div>
  );
}