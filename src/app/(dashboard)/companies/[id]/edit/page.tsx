import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

import { createContainer } from "@/application/container";
import { asCompanyId } from "@/domain/branding";
import { db } from "@/infrastructure/database";
import { CompanyForm } from "@/components/forms/company-form";
import { Button } from "@/components/ui/button";

const container = createContainer(db);

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await container.companyRepository.findById(asCompanyId(id));

  if (!company) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/companies">
            <Button variant="outline" size="icon-sm" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <span>تعديل بيانات المنشأة</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديث بيانات {company.nameAr} ومعلومات التواصل والختم
            </p>
          </div>
        </div>
      </div>

      <CompanyForm initialCompany={company} />
    </div>
  );
}
