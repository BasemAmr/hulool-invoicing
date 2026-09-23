import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";

import { createContainer } from "@/application/container";
import { asInvoiceId } from "@/domain/branding";
import { db } from "@/infrastructure/database";
import { toInvoiceDto } from "@/application/dto";
import { InvoiceWizardForm } from "@/components/forms/invoice-wizard-form";
import { Button } from "@/components/ui/button";

const container = createContainer(db);

export default async function EditInvoiceDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await container.invoiceRepository.findByIdWithItems(asInvoiceId(id));

  if (!invoice) {
    notFound();
  }

  // All invoices (draft or published) are editable — only cancelled is locked.
  if (invoice.status === "cancelled") {
    notFound();
  }

  const [companies, customers, products, settings] = await Promise.all([
    container.companyRepository.list(100, 0),
    container.customerRepository.list(null, 100, 0),
    container.savedProductRepository.list(null, 5000, 0),
    // Company VAT/template defaults for the invoice's owning company: blank
    // lines added mid-edit must inherit this (like the new page) instead of
    // the hardcoded 15% fallback inside the wizard.
    container.companySettingsRepository.getByCompanyId(invoice.companyId),
  ]);

  const companyOptions = companies.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    prefix: c.prefix,
    vatNumber: c.vatNumber,
    addressCity: c.addressCity,
  }));

  const customerOptions = customers.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    vatNumber: c.vatNumber,
    phone: c.phone,
    email: c.email,
  }));

  const dto = toInvoiceDto(invoice);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/invoices/${id}`}>
            <Button variant="outline" size="icon-sm" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <span>تعديل الفاتورة</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              تعديل بيانات وبنود المسودة قبل الاعتماد والإصدار
            </p>
          </div>
        </div>
      </div>

      <InvoiceWizardForm
        companies={companyOptions}
        customers={customerOptions}
        products={products}
        initialInvoice={dto}
        defaultVatRate={settings?.defaultVatRate ?? 0.15}
        defaultTemplateId={settings?.defaultTemplateId ?? "simple_red"}
      />
    </div>
  );
}
