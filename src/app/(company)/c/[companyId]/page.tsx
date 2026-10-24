import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import {
  FileText,
  ArrowUpRight,
  FileCheck2,
  MapPin,
  Building,
} from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { invoices as invoicesTable, receiptVouchers } from "@/infrastructure/database/schema";
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

  const [invoices, customers, [invoicesCount, receiptsCount]] = await Promise.all([
    container.invoiceRepository.listByCompany(
      companyId as CompanyId,
      { status: null },
      DEFAULT_PAGE_SIZE,
      0
    ),
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
    Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoicesTable)
        .where(eq(invoicesTable.companyId, companyId as CompanyId))
        .then((res) => res[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(receiptVouchers)
        .where(eq(receiptVouchers.companyId, companyId as CompanyId))
        .then((res) => res[0]?.count ?? 0),
    ]),
  ]);

  const customerNameById = new Map(
    customers.map((c: CustomerRecord) => [c.id, c.nameAr])
  );
  const cPath = `/c/${companyId}`;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header — Single compact horizontal row */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap bg-card border border-border px-4 py-3 shadow-2xs text-xs overflow-x-auto whitespace-nowrap">
        {/* Company Title */}
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            لوحة تحكم {company.nameAr}
          </h1>
          {company.nameEn && (
            <span className="text-xs font-mono text-muted-foreground" dir="ltr">
              ({company.nameEn})
            </span>
          )}
        </div>

        {/* Badge for Prefix */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-muted border border-border text-foreground">
            بادئة الترقيم: {company.prefix}
          </span>
        </div>

        <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

        {/* Invoices / Receipts Count */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 shrink-0">
          <span className="text-[11px] font-semibold text-foreground">عدد الفواتير / السندات:</span>
          <div className="flex items-center justify-center gap-1 font-mono font-bold text-foreground text-xs" dir="ltr">
            <span>{receiptsCount}</span>
            <span className="text-foreground font-normal">/</span>
            <span>{invoicesCount}</span>
          </div>
        </div>

        {/* Tax Number */}
        {company.vatNumber && (
          <div className="flex items-center gap-1.5 shrink-0">
            <FileCheck2 className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">الرقم الضريبي:</span>
            <span className="font-mono font-semibold text-foreground">{company.vatNumber}</span>
          </div>
        )}

        {/* Organization Type */}
        {company.organizationType && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Building className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">نوع المنشأة:</span>
            <span className="font-medium text-foreground">{company.organizationType}</span>
          </div>
        )}

        {/* City */}
        {company.addressCity && (
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">المدينة:</span>
            <span className="text-foreground">{company.addressCity}</span>
          </div>
        )}
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
