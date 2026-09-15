import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileDown, Building, User, Edit } from "lucide-react";
import QRCode from "qrcode";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
import { IssueInvoiceButton } from "@/components/forms/issue-invoice-button";
import { InvoiceDraftActions } from "@/components/documents/invoice-draft-actions";
import { formatIsoDate, formatMoney } from "@/lib/format";
import { InvoiceDetailClientActions } from "../invoice-detail-client";

const container = createContainer(db);

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id)
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto items-start">
      
      {/* Right Column in RTL = Left Column visually in Arabic (Actions & General Details Sidebar) */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 order-2 lg:order-1">
        {/* Actions Card */}
        <div className="border border-border bg-card p-4 flex flex-col gap-3">
          <Link href={`/invoices/${id}`}>
            <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground gap-2 text-xs">
              <ArrowRight className="size-3.5" /> تفاصيل الفاتورة
            </Button>
          </Link>

          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-mono font-bold text-sm text-foreground">
              {dto.invoiceNumber ?? "بانتظار الترقيم"}
            </span>
            <StatusBadge status={dto.status} />
          </div>

          <div className="flex flex-col gap-2">
            {dto.status === "draft" && (
              <IssueInvoiceButton invoiceId={dto.id} />
            )}

            {/* Every invoice is published and fully editable/deletable. */}
            <InvoiceDraftActions
              invoice={{
                id: dto.id,
                invoiceNumber: dto.invoiceNumber,
                status: dto.status,
              }}
              redirectAfterDelete
            />

            {dto.status === "issued" && (
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2 justify-center text-xs font-semibold"
                render={
                  <a
                    href={`/api/documents/${dto.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <FileDown className="size-4" />
                <span>تحميل PDF</span>
              </Button>
            )}

            <InvoiceDetailClientActions
              invoice={{
                id: dto.id,
                invoiceNumber: dto.invoiceNumber,
                total: dto.total,
                customerName: customer?.nameAr || "العميل",
                customerPhone: customer?.phone,
                customerEmail: customer?.email,
                companyId: dto.companyId,
                customerId: dto.customerId,
              }}
            />
          </div>
        </div>

        {/* General Details Summary Card */}
        <div className="border border-border bg-card p-4 flex flex-col gap-3 text-xs">
          <span className="font-semibold text-foreground border-b border-border pb-2">
            بيانات عامة
          </span>

          <div className="flex justify-between">
            <span className="text-muted-foreground">نوع الفاتورة:</span>
            <span className="font-medium">{titleAr}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">تاريخ الإصدار:</span>
            <span className="font-medium tabular-nums">{formatIsoDate(dto.issueDate)}</span>
          </div>

          {dto.dueDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">تاريخ الاستحقاق:</span>
              <span className="font-medium tabular-nums">{formatIsoDate(dto.dueDate)}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">المبلغ قبل الضريبة:</span>
            <span className="font-mono tabular-nums">{dto.subtotal} SAR</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">ضريبة القيمة المضافة:</span>
            <span className="font-mono tabular-nums text-primary">{dto.vatAmount} SAR</span>
          </div>

          <div className="flex justify-between border-t border-border pt-2 font-bold text-sm text-primary">
            <span>الإجمالي:</span>
            <span className="font-mono tabular-nums">{dto.total} SAR</span>
          </div>
        </div>
      </div>

      {/* Main Invoice Preview Column (Compacted A4 Document Column) */}
      <div className="flex-1 w-full flex justify-center bg-muted/20 border border-border p-4 sm:p-6 overflow-auto order-1 lg:order-2">
        <div className="w-full max-w-2xl bg-card border border-border p-6 sm:p-8 text-foreground flex flex-col relative shadow-xs">
          
          {/* Top Bar Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

          {/* Header */}
          <div className="flex justify-between items-start mb-6 mt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-lg sm:text-xl font-bold text-primary">{titleAr}</span>
              <span className="text-[11px] font-bold text-muted-foreground tracking-wider">{titleEn}</span>
              <span className="text-sm font-mono font-bold mt-1 text-foreground">
                {dto.invoiceNumber ?? "—"}
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
              {customer?.phone && (
                <span className="text-muted-foreground font-mono">{customer.phone}</span>
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
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="QR Code" className="size-28 border border-border p-1 bg-white" />
              ) : (
                <div className="size-28 border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
                  بانتظار الإصدار
                </div>
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
