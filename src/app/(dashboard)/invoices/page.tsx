import Link from "next/link";
import { Plus } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import { isDocumentStatus } from "@/domain/value-objects/document-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/documents/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIsoDate, formatSar } from "@/lib/format";
import { toDecimalString } from "@/domain/value-objects/money";

const container = createContainer(db);

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/invoices">) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : null;
  const status: DocumentStatus | null = isDocumentStatus(statusParam)
    ? statusParam
    : null;

  const [invoices, companies, customers] = await Promise.all([
    container.invoiceRepository.listAll({ status }, DEFAULT_PAGE_SIZE, 0),
    container.companyRepository.list(DEFAULT_PAGE_SIZE, 0),
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
  ]);

  const companyNameById = new Map(companies.map((c) => [c.id, c.nameAr]));
  const customerNameById = new Map(customers.map((c) => [c.id, c.nameAr]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">الفواتير</h1>
        <Link href="/invoices/new">
          <Button>
            <Plus data-icon="inline-start" /> فاتورة جديدة
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <FilterLink href="/invoices" active={status === null} label="الكل" />
        <FilterLink href="/invoices?status=draft" active={status === "draft"} label="مسودة" />
        <FilterLink href="/invoices?status=issued" active={status === "issued"} label="صادرة" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الفواتير ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد فواتير بعد. أنشئ المسودة الأولى.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium tabular-nums text-primary hover:underline"
                      >
                        {invoice.invoiceNumber ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{companyNameById.get(invoice.companyId) ?? "—"}</TableCell>
                    <TableCell>{customerNameById.get(invoice.customerId) ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatIsoDate(invoice.issueDate)}</TableCell>
                    <TableCell><StatusBadge status={invoice.status} /></TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {formatSar(toDecimalString(invoice.total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-primary/10 px-3 py-1 font-medium text-primary"
          : "rounded-full px-3 py-1 text-muted-foreground hover:bg-muted"
      }
    >
      {label}
    </Link>
  );
}
