import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  ArrowUpRight,
} from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
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
import type { CompanyId, CustomerId } from "@/domain/branding";
import type { InvoiceRecord } from "@/application/ports/invoice-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import { DashboardQuickActions } from "./dashboard-quick-actions";

const container = createContainer(db);

export default async function CompanyDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const [invoices, customers] = await Promise.all([
    container.invoiceRepository.listByCompany(
      companyId as CompanyId,
      { status: null },
      DEFAULT_PAGE_SIZE,
      0
    ),
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
  ]);

  const customerNameById = new Map(
    customers.map((c: CustomerRecord) => [c.id, c.nameAr])
  );
  const cPath = `/c/${companyId}`;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            لوحة تحكم {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            الرقم الضريبي: {company.vatNumber} • بادئة الترقيم: {company.prefix}
          </p>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <DashboardQuickActions companyId={companyId} customers={customers} />


      {/* Recent Invoices Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              أحدث الفواتير
            </h2>
          </div>
          <Link href={`${cPath}/invoices`} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <span>عرض كل الفواتير ({invoices.length})</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-3">
            <p className="font-semibold text-sm">لا توجد فواتير لهذه المنشأة بعد</p>
            <p className="text-xs text-muted-foreground">
              أنشئ أول فاتورة تجريبية لتجربة تسلسل الترقيم وتوليد رمز الاستجابة السريعة
            </p>
            <Link href={`${cPath}/invoices/new`} className="mt-2">
              <Button size="sm">+ إنشاء فاتورة الآن</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">رقم الفاتورة</TableHead>
                <TableHead className="text-start">العميل</TableHead>
                <TableHead className="w-28">التاريخ</TableHead>
                <TableHead className="w-28">الحالة</TableHead>
                <TableHead className="w-36 text-start">الإجمالي</TableHead>
                <TableHead className="w-20">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 5).map((invoice: InvoiceRecord) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono font-semibold tabular-nums text-primary">
                    <Link href={`${cPath}/invoices/${invoice.id}`} className="hover:underline">
                      {invoice.invoiceNumber ?? "مسودة"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start text-xs font-medium">
                    {customerNameById.get(invoice.customerId as CustomerId) ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {formatIsoDate(invoice.issueDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-start tabular-nums font-bold text-foreground text-xs">
                    {formatSar(toDecimalString(invoice.total))}
                  </TableCell>
                  <TableCell>
                    <Link href={`${cPath}/invoices/${invoice.id}`}>
                      <Button variant="outline" size="xs">
                        عرض
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
