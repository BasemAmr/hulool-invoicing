import Link from "next/link";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIsoDate, formatSar } from "@/lib/format";
import { toDecimalString } from "@/domain/value-objects/money";
import type { CompanyId } from "@/domain/branding";
import { deleteReceiptVoucherAction } from "@/app/actions/receipts";
import { PdfActionButtons } from "@/components/documents/pdf-action-buttons";

const container = createContainer(db);

const paymentMethodLabels: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة دفع",
  check: "شيك",
  other: "أخرى",
};

export default async function ReceiptVouchersPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const [receipts, customers] = await Promise.all([
    container.receiptVoucherRepository.listByCompany(companyId, 50, 0),
    container.customerRepository.list(null, 50, 0),
  ]);

  const customerNameById = new Map<string, string>(
    customers.map((c) => [c.id as string, c.nameAr])
  );
  const cPath = `/c/${companyId}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            سندات القبض — {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            توثيق وإصدار إيصالات استلام الدفعات النقدية والتحويلات البنكية من العملاء
          </p>
        </div>
        <Link href={`${cPath}/receipts/new`}>
          <Button size="sm" className="gap-1.5 font-semibold">
            <Plus className="size-4" />
            <span>+ سند قبض جديد</span>
          </Button>
        </Link>
      </div>

      {/* Table */}
      {receipts.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-muted text-muted-foreground">
            <Receipt className="size-6" />
          </div>
          <div>
            <p className="font-semibold text-sm">لا توجد سندات قبض مسجلة بعد</p>
            <p className="text-xs text-muted-foreground mt-1">
              أصدر سندات قبض وتوثيق مبالغ السداد المستلمة من عملائك
            </p>
          </div>
          <Link href={`${cPath}/receipts/new`}>
            <Button size="sm" className="mt-2">
              + إنشاء أول سند قبض
            </Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">رقم السند</TableHead>
              <TableHead className="text-start">العميل</TableHead>
              <TableHead className="w-28">تاريخ السند</TableHead>
              <TableHead className="w-32">طريقة الدفع</TableHead>
              <TableHead className="w-36 text-start">المبلغ المستلم</TableHead>
              <TableHead className="text-start">المرجع / ملاحظات</TableHead>
              <TableHead className="w-28 text-end">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((receipt) => {
              const downloadUrl = `/api/documents/receipts/${receipt.id}/pdf?download=true`;
              const filename = `سند القبض فاتورة رقم ${receipt.voucherNumber}.pdf`;

              return (
                <TableRow key={receipt.id}>
                  <TableCell className="font-mono font-semibold tabular-nums text-primary">
                    <a
                      href={`/api/documents/receipts/${receipt.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {receipt.voucherNumber}
                    </a>
                  </TableCell>
                  <TableCell className="text-start text-xs font-medium">
                    {customerNameById.get(receipt.customerId) ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {formatIsoDate(receipt.voucherDate)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="px-2 py-0.5 bg-muted border border-border">
                      {paymentMethodLabels[receipt.paymentMethod] ?? receipt.paymentMethod}
                    </span>
                  </TableCell>
                  <TableCell className="text-start tabular-nums font-bold text-foreground text-xs sm:text-sm">
                    {formatSar(toDecimalString(receipt.amount))}
                  </TableCell>
                  <TableCell className="text-start text-xs text-muted-foreground max-w-xs truncate">
                    {receipt.reference || receipt.notes || "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {/* Direct Download & Share Signed Link Icons */}
                      <PdfActionButtons
                        documentId={receipt.id}
                        type="receipt"
                        downloadUrl={downloadUrl}
                        filename={filename}
                        itemTitle={`سند القبض ${receipt.voucherNumber}`}
                      />

                      {/* Delete Action */}
                      <form
                        action={async () => {
                          "use server";
                          await deleteReceiptVoucherAction(receipt.id, companyId);
                        }}
                        className="inline"
                      >
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-destructive hover:bg-destructive/10 p-1 h-auto"
                          type="submit"
                          title="حذف السند"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
