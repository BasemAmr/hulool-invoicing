import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileDown, ShieldAlert, CheckCircle2, Building, Calendar } from "lucide-react";
import QRCode from "qrcode";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
import { formatIsoDate, formatMoney } from "@/lib/format";
import { ValidateSignedInvoiceUrl } from "@/application/use-cases/validate-signed-invoice-url";
import { ForbiddenError } from "@/domain/errors";

const container = createContainer(db);

export const metadata: Metadata = {
  title: "معاينة الفاتورة الضريبية",
};

export default async function PublicSharedInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sParams = await searchParams;

  const sig = typeof sParams.sig === "string" ? sParams.sig : "";
  const exp = typeof sParams.exp === "string" ? parseInt(sParams.exp, 10) : 0;

  // 1. Validate signed URL token
  const validator = new ValidateSignedInvoiceUrl(container.urlSigner);
  let isAuthorized = false;
  try {
    isAuthorized = validator.execute(id, sig, exp);
  } catch (err) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <div className="max-w-md w-full bg-card border border-border p-6 text-center flex flex-col items-center gap-3 shadow-xs">
          <div className="size-12 bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-base font-bold text-foreground">
            رابط الفاتورة غير صالح أو منتهي الصلاحية
          </h1>
          <p className="text-xs text-muted-foreground">
            هذا الرابط الأمني مخصص لمشاهدة فاتورة محددة لفترة محدودة. يرجى طلب رابط جديد من الجهة المُصدرة للفاتورة.
          </p>
        </div>
      </div>
    );
  }

  // 2. Fetch invoice and parties
  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id),
  );
  if (!invoice) {
    notFound();
  }

  const [company, customer] = await Promise.all([
    container.companyRepository.findById(invoice.companyId),
    container.customerRepository.findById(invoice.customerId),
  ]);

  const dto = toInvoiceDto(invoice);
  const qrDataUrl = dto.qrPayload
    ? await QRCode.toDataURL(dto.qrPayload, { margin: 1, width: 180 })
    : null;

  const isSimplified = dto.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";
  const titleEn = isSimplified ? "SIMPLIFIED TAX INVOICE" : "TAX INVOICE";

  const pdfDownloadUrl = `/api/documents/${dto.id}/pdf?sig=${sig}&exp=${exp}`;

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        
        {/* Top Header & Download Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 shadow-xs">
          <div className="flex items-center gap-2">
            {dto.status === "issued" ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : null}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-foreground">
                  {dto.invoiceNumber ?? "مسودة فاتورة"}
                </span>
                <StatusBadge status={dto.status} />
              </div>
            </div>
          </div>

          {dto.status === "issued" && (
            <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-2 font-semibold text-xs bg-primary text-primary-foreground">
                <FileDown className="size-4" />
                <span>تحميل الفاتورة PDF</span>
              </Button>
            </a>
          )}
        </div>

        {/* Compact Invoice Document Card */}
        <div className="w-full bg-card border border-border p-6 sm:p-8 text-foreground flex flex-col relative shadow-xs">
          {/* Top Bar Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

          {/* Header */}
          <div className="flex justify-between items-start mb-6 mt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-lg sm:text-xl font-bold text-primary">{titleAr}</span>
              <span className="text-[11px] font-bold text-muted-foreground tracking-wider">{titleEn}</span>
              <span className="text-sm font-mono font-bold mt-1 text-foreground">
                {dto.invoiceNumber}
              </span>
            </div>

            <div className="flex flex-col items-end gap-0.5 text-right text-xs">
              <span className="font-bold text-sm text-foreground">{company?.nameAr}</span>
              {company?.nameEn && <span className="text-muted-foreground">{company.nameEn}</span>}
              {company?.vatNumber && <span className="text-muted-foreground font-mono">الرقم الضريبي: {company.vatNumber}</span>}
              {company?.phone && <span className="text-muted-foreground font-mono">{company.phone}</span>}
            </div>
          </div>

          <div className="h-px w-full bg-border mb-6" />

          {/* Parties Meta Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-xs bg-muted/20 p-3 border border-border">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-primary">العميل:</span>
              <span className="font-bold">{customer?.nameAr}</span>
              {customer?.vatNumber && (
                <span className="text-muted-foreground font-mono">الرقم الضريبي: {customer.vatNumber}</span>
              )}
            </div>

            <div className="flex flex-col gap-1 text-end">
              <span className="font-semibold text-primary">التواريخ:</span>
              <span>تاريخ الإصدار: <span className="font-mono">{formatIsoDate(dto.issueDate)}</span></span>
              {dto.dueDate && (
                <span>تاريخ الاستحقاق: <span className="font-mono">{formatIsoDate(dto.dueDate)}</span></span>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6 overflow-x-auto border border-border">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-muted text-foreground border-b border-border font-semibold">
                  <th className="p-2 w-8 border-l border-border">#</th>
                  <th className="p-2 text-start border-l border-border">الوصف</th>
                  <th className="p-2 w-14 border-l border-border">الكمية</th>
                  <th className="p-2 w-20 border-l border-border">السعر</th>
                  <th className="p-2 w-20 border-l border-border">الضريبة</th>
                  <th className="p-2 w-24">المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dto.items.map((item) => (
                  <tr key={item.position} className="hover:bg-muted/30">
                    <td className="p-2 text-muted-foreground border-l border-border">{item.position}</td>
                    <td className="p-2 text-start font-medium text-foreground border-l border-border">{item.description}</td>
                    <td className="p-2 text-muted-foreground font-mono border-l border-border">{item.quantity}</td>
                    <td className="p-2 text-muted-foreground font-mono border-l border-border">{formatMoney(item.unitPrice)}</td>
                    <td className="p-2 text-muted-foreground font-mono border-l border-border">{formatMoney(item.lineVat)}</td>
                    <td className="p-2 font-bold font-mono text-foreground">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & QR */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-border mt-auto">
            <div>
              {qrDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="QR Code" className="size-28 border border-border p-1 bg-white" />
              )}
            </div>

            <div className="w-full sm:w-64 border border-border p-3 flex flex-col gap-2 text-xs bg-muted/10">
              <div className="flex justify-between text-muted-foreground">
                <span>قبل الضريبة:</span>
                <span className="font-mono">{dto.subtotal} SAR</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>الضريبة (15%):</span>
                <span className="font-mono">{dto.vatAmount} SAR</span>
              </div>
              <div className="h-px bg-border my-0.5" />
              <div className="flex justify-between font-bold text-sm text-foreground">
                <span>الإجمالي:</span>
                <span className="font-mono text-primary">{dto.total} SAR</span>
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          {(dto.notes || dto.terms) && (
            <div className="flex flex-col gap-2 text-xs text-muted-foreground bg-muted/20 p-3 border border-border mt-4">
              {dto.notes && (
                <div>
                  <span className="font-semibold text-foreground block mb-0.5">ملاحظات:</span>
                  {dto.notes}
                </div>
              )}
              {dto.terms && (
                <div>
                  <span className="font-semibold text-foreground block mb-0.5">الشروط والأحكام:</span>
                  {dto.terms}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
