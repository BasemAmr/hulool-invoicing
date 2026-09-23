import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE, INVOICE_NUMBER_SEQ_PAD } from "@/domain/constants";
import { InvoiceWizardForm } from "@/components/forms/invoice-wizard-form";
import { Button } from "@/components/ui/button";
import { asInvoiceId, type CompanyId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";

import { incrementInvoiceNumber } from "@/domain/value-objects/invoice-number";

const container = createContainer(db);

/** Best-effort next-number preview based on the latest invoice number + 1.
 *  If no invoices exist, formats prefix + 00001. */
async function previewNextInvoiceNumber(companyId: string, prefix: string): Promise<string> {
  try {
    const existing = await container.invoiceRepository.listByCompany(
      companyId as CompanyId,
      { status: null },
      1,
      0,
    );
    const lastInvoice = existing[0];
    return incrementInvoiceNumber(lastInvoice?.invoiceNumber, prefix);
  } catch {
    return incrementInvoiceNumber(null, prefix);
  }
}

import { computeIncrementedIssueTime } from "@/domain/services/invoice-datetime";

async function computeSuggestedIssueTime(companyId: string): Promise<string> {
  try {
    const existing = await container.invoiceRepository.listByCompany(
      companyId as CompanyId,
      { status: "issued" },
      50,
      0,
    );
    if (existing.length === 0) return "09:00";
    
    existing.sort((a, b) => {
      if (a.issueDate !== b.issueDate) return b.issueDate.localeCompare(a.issueDate);
      const timeA = a.issueTime || "00:00";
      const timeB = b.issueTime || "00:00";
      return timeB.localeCompare(timeA);
    });
    
    const lastInvoice = existing[0];
    return computeIncrementedIssueTime(lastInvoice?.issueTime);
  } catch {
    return "09:00";
  }
}

export default async function NewCompanyInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ duplicateFrom?: string; customerId?: string; issueDate?: string; issueTime?: string }>;
}) {
  const { companyId } = await params;
  const query = (await searchParams) ?? {};
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const [customers, products, settings] = await Promise.all([
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
    container.savedProductRepository.list(null, 5000, 0),
    container.companySettingsRepository.getByCompanyId(companyId),
  ]);

  const defaultVatRate = settings?.defaultVatRate ?? 0.15;
  const cPath = `/c/${companyId}`;

  const suggestedInvoiceNumber = await previewNextInvoiceNumber(companyId, company.prefix);
  const suggestedIssueTime = await computeSuggestedIssueTime(companyId);

  // Duplicate flow: ?duplicateFrom=<id>&customerId=<new>&issueDate=<new>
  // Loads the source invoice's lines/notes/terms/template, then applies the
  // dialog-chosen client + date (defaults: same client, today).
  let duplicatePrefill:
    | {
        customerId?: string;
        issueDate?: string;
        issueTime?: string;
        dueDate?: string | null;
        templateId?: string;
        invoiceType?: "standard" | "simplified";
        notes?: string | null;
        terms?: string | null;
        items?: ReturnType<typeof toInvoiceDto>["items"];
      }
    | undefined;
  let isDuplicate = false;
  if (query.duplicateFrom) {
    try {
      const source = await container.invoiceRepository.findByIdWithItems(
        asInvoiceId(query.duplicateFrom),
      );
      if (source) {
        const dto = toInvoiceDto(source);
        isDuplicate = true;
        duplicatePrefill = {
          customerId: query.customerId || dto.customerId,
          issueDate:
            query.issueDate || new Date().toISOString().slice(0, 10),
          // Duplicate carries the dialog-picked time so the wizard + QR
          // round-trip it; falls back to the source time, then midnight.
          issueTime:
            query.issueTime || dto.issueTime || "00:00",
          dueDate: dto.dueDate,
          templateId: dto.templateId,
          invoiceType: dto.invoiceType,
          notes: dto.notes,
          terms: dto.terms,
          items: dto.items,
        };
      }
    } catch {
      // Invalid duplicateFrom: fall through to a blank form.
    }
  }


  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isDuplicate ? "تكرار فاتورة" : "فاتورة جديدة"} — {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isDuplicate
              ? "فاتورة جديدة بنفس بنود الفاتورة الأصلية — راجع العميل والتاريخ ثم أصدرها"
              : "إصدار فاتورة إلكترونية معتمدة للمنشأة"}
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
        duplicatePrefill={duplicatePrefill}
        suggestedInvoiceNumber={suggestedInvoiceNumber}
        suggestedIssueTime={suggestedIssueTime}
        defaultVatRate={defaultVatRate}
        defaultTemplateId={settings?.defaultTemplateId ?? "simple_red"}
      />

    </div>
  );
}

