import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { InvoiceWizardForm } from "@/components/forms/invoice-wizard-form";
import { Button } from "@/components/ui/button";
import type { CompanyId } from "@/domain/branding";

const container = createContainer(db);

export default async function NewCompanyInvoicePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const [customers, products, settings] = await Promise.all([
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
    container.savedProductRepository.list(null, 200, 0),
    container.companySettingsRepository.getByCompanyId(companyId),
  ]);

  const defaultVatRate = settings?.defaultVatRate ?? 0.15;
  const cPath = `/c/${companyId}`;


  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            فاتورة جديدة — {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إصدار فاتورة إلكترونية معتمدة للمنشأة
          </p>
        </div>
        <Link href={`${cPath}/invoices`}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <ArrowRight className="size-3.5" />
            <span>قائمة الفواتير</span>
          </Button>
        </Link>
      </div>

      <InvoiceWizardForm
        companies={[
          {
            id: company.id,
            nameAr: company.nameAr,
            prefix: company.prefix,
            vatNumber: company.vatNumber,
            addressCity: company.addressCity,
            addressStreet: company.addressStreet,
            addressDistrict: company.addressDistrict,
            addressBuildingNumber: company.addressBuildingNumber,
            addressPostalCode: company.addressPostalCode,
            email: company.email,
            phone: company.phone,
          },
        ]}
        customers={customers}
        products={products}
        scopedCompanyId={company.id}
        defaultVatRate={defaultVatRate}
        defaultTemplateId={settings?.defaultTemplateId ?? "simple_red"}
      />

    </div>
  );
}

