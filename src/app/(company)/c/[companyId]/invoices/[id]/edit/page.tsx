import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";
import { InvoiceWizardForm } from "@/components/forms/invoice-wizard-form";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";

const container = createContainer(db);

export default async function CompanyInvoiceEditPage({
  params,
}: {
  params: Promise<{ companyId: string; id: string }>;
}) {
  const { companyId, id } = await params;

  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id)
  );
  if (!invoice) {
    notFound();
  }

  // All invoices (draft or published) are editable — no redirect.
  // Only cancelled invoices are locked.
  if (invoice.status === "cancelled") {
    notFound();
  }

  const [company, customers, products, settings] = await Promise.all([
    container.companyRepository.findById(invoice.companyId),
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
    container.savedProductRepository.list(null, 5000, 0),
    // Company VAT/template defaults: blank lines added mid-edit must inherit
    // the company setting (like the new page) instead of the hardcoded 15%.
    container.companySettingsRepository.getByCompanyId(companyId),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div className="border-b border-border pb-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          تعديل الفاتورة {invoice.invoiceNumber ? `— ${invoice.invoiceNumber}` : ""} — {company.nameAr}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          قم بتعديل بيانات العميل أو البنود والأسعار وحفظ التغييرات
        </p>
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
        initialInvoice={toInvoiceDto(invoice)}
        defaultVatRate={settings?.defaultVatRate ?? 0.15}
        defaultTemplateId={settings?.defaultTemplateId ?? "simple_red"}
      />

    </div>
  );
}