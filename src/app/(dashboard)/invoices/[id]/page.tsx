import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import QRCode from "qrcode";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemsTable } from "@/components/documents/items-table";
import { StatusBadge } from "@/components/documents/status-badge";
import { IssueInvoiceButton } from "@/components/forms/issue-invoice-button";
import { formatIsoDate } from "@/lib/format";

const container = createContainer(db);

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/invoices/[id]">) {
  const { id } = await params;

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
    ? await QRCode.toDataURL(dto.qrPayload, { margin: 1, width: 220 })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="icon" aria-label="رجوع">
              <ArrowRight />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold tabular-nums">
            {dto.invoiceNumber ?? "فاتورة غير مُصدرَة"}
          </h1>
          <StatusBadge status={dto.status} />
        </div>
        {dto.status === "draft" && <IssueInvoiceButton invoiceId={dto.id} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>بيانات الفاتورة</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <Info label="الشركة" value={company?.nameAr ?? "—"} />
              <Info label="العميل" value={customer?.nameAr ?? "—"} />
              <Info label="تاريخ الإصدار" value={formatIsoDate(dto.issueDate)} />
              <Info label="تاريخ الاستحقاق" value={dto.dueDate ? formatIsoDate(dto.dueDate) : "—"} />
              <Info label="العملة" value={dto.currency} />
              <Info label="تاريخ الإصدار الفعلي" value={dto.issuedAt ? formatIsoDate(dto.issuedAt) : "—"} />
              {dto.notes && <Info label="ملاحظات" value={dto.notes} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>البنود</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemsTable items={dto.items} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>الإجماليات</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <TotalRow label="الإجمالي قبل الضريبة" value={dto.subtotal} />
              <TotalRow label="الضريبة" value={dto.vatAmount} />
              <TotalRow label="الإجمالي" value={dto.total} strong />
            </CardContent>
          </Card>

          {qrDataUrl && (
            <Card>
              <CardHeader>
                <CardTitle>رمز الاستجابة السريعة (ZATCA)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="ZATCA QR" className="size-52" />
                <p className="text-xs text-muted-foreground">
                  يمسح عبر تطبيق فاتورة أو أي قارئ متوافق
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold" : ""}`}>
        {value} SAR
      </span>
    </div>
  );
}
