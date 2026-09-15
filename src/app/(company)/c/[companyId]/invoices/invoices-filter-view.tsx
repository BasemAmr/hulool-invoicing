"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  X,
  RotateCcw,
  FileText,
  Building,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/documents/status-badge";
import { InvoiceTableActions } from "@/components/documents/invoice-table-actions";
import { formatIsoDate, formatSar, formatMoney } from "@/lib/format";
import { toDecimalString } from "@/domain/value-objects/money";
import type { InvoiceRecord } from "@/application/ports/invoice-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanyRecord } from "@/application/ports/company-repository";

export interface InvoicesFilterViewProps {
  company: {
    id: string;
    nameAr: string;
    prefix: string;
    vatNumber?: string;
    addressCity?: string | null;
  };
  invoices: InvoiceRecord[];
  customers: CustomerRecord[];
  companyId?: string;
}

export function InvoicesFilterView({
  company,
  invoices,
  customers,
}: InvoicesFilterViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const cPath = `/c/${company.id}`;

  const customerMap = useMemo(() => {
    return new Map<string, CustomerRecord>(customers.map((c) => [c.id, c]));
  }, [customers]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // 1. Status Filter
      if (statusFilter !== "all" && invoice.status !== statusFilter) {
        return false;
      }

      // 2. Date From Filter
      if (dateFrom && invoice.issueDate < dateFrom) {
        return false;
      }

      // 3. Date To Filter
      if (dateTo && invoice.issueDate > dateTo) {
        return false;
      }

      // 4. Free-text Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const numberMatch =
          invoice.invoiceNumber?.toLowerCase().includes(query) ?? false;
        const customer = customerMap.get(invoice.customerId);
        const nameArMatch =
          customer?.nameAr?.toLowerCase().includes(query) ?? false;
        const nameEnMatch =
          customer?.nameEn?.toLowerCase().includes(query) ?? false;
        const phoneMatch = customer?.phone?.includes(query) ?? false;

        return numberMatch || nameArMatch || nameEnMatch || phoneMatch;
      }

      return true;
    });
  }, [invoices, statusFilter, dateFrom, dateTo, searchTerm, customerMap]);

  // Totals for filtered invoices
  const filteredTotalHalalas = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (inv.total as number), 0);
  }, [filteredInvoices]);

  const hasActiveFilters =
    searchTerm !== "" || statusFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-7xl mx-auto py-1">
      {/* ─── Unified Single-Row Header & Controls Bar (Compacted like /companies) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 bg-card p-2 shadow-2xs">
        {/* Right: Title & Count & Total Sum */}
        <div className="flex items-center gap-2 shrink-0">
          <FileText className="size-4 text-primary" />
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            فواتير {company.nameAr}
          </h1>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-muted text-muted-foreground border border-border">
            {filteredInvoices.length === invoices.length
              ? `${invoices.length} فواتير`
              : `${filteredInvoices.length} / ${invoices.length}`}
          </span>
          <span className="hidden md:inline-flex text-[11px] font-mono font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
            {formatMoney((filteredTotalHalalas / 100).toFixed(2))} SAR
          </span>
        </div>

        {/* Left: Inline Filter Controls & New Invoice Button */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم، عميل، جوال..."
              className="pl-7 pr-2 text-xs h-7 w-36 sm:w-48 bg-background"
            />
            <Search className="size-3 absolute left-2 top-2 text-muted-foreground pointer-events-none" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                aria-label="مسح البحث"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border bg-background px-1.5 h-7 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="تصفية حسب الحالة (كل الفواتير الجديدة معتمدة ومصدرة)"
          >
            <option value="all">جميع الحالات</option>
            <option value="issued">معتمدة ومصدرة</option>
            <option value="cancelled">ملغاة (Cancelled)</option>
            <option value="draft">مسودة قديمة</option>
          </select>

          {/* Date Range Inputs */}
          <DatePickerInput
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="من تاريخ"
            className="h-7 w-24 text-[11px]"
          />
          <DatePickerInput
            value={dateTo}
            onChange={setDateTo}
            placeholder="إلى تاريخ"
            className="h-7 w-24 text-[11px]"
          />

          {/* Reset Filters Icon */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleResetFilters}
              className="text-muted-foreground hover:text-destructive text-xs h-7 px-1.5"
              title="إعادة ضبط الفلاتر"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}

          {/* New Invoice Button */}
          <Link href={`${cPath}/invoices/new`}>
            <Button
              size="sm"
              className="gap-1 font-semibold text-xs h-7 px-2.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>فاتورة جديدة</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Data Table */}
      {filteredInvoices.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
          <FileText className="size-8 text-muted-foreground" />
          <div>
            <p className="font-semibold text-xs">
              {hasActiveFilters
                ? "لا توجد فواتير مطابقة لمعايير البحث والتصفية"
                : "لا توجد فواتير لهذه المنشأة بعد"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hasActiveFilters
                ? "جرب تغيير مصطلح البحث أو مسح تصفية التواريخ والحالة"
                : "ابدأ بإنشاء أول فاتورة إلكترونية معتمدة"}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetFilters}
              className="text-xs gap-1 mt-1"
            >
              <RotateCcw className="size-3.5" />
              <span>مسح الفلاتر</span>
            </Button>
          ) : (
            <Link href={`${cPath}/invoices/new`}>
              <Button size="sm" className="text-xs mt-1">
                + إنشاء فاتورة الآن
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-32">رقم الفاتورة</TableHead>
                <TableHead className="text-start">العميل المستلم</TableHead>
                <TableHead className="w-28">تاريخ الإصدار</TableHead>
                <TableHead className="w-24 text-center">الحالة</TableHead>
                <TableHead className="w-36 text-end">المبلغ الإجمالي</TableHead>
                <TableHead className="w-28 text-end">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice: InvoiceRecord) => {
                const customer = customerMap.get(invoice.customerId);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-bold tabular-nums text-primary py-2">
                      <Link
                        href={`${cPath}/invoices/${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.invoiceNumber ?? "بانتظار الترقيم"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start py-2">
                      <div className="font-medium text-foreground text-xs">
                        {customer?.nameAr ?? "—"}
                      </div>
                      {customer?.phone && (
                        <span className="block text-[10px] font-mono text-muted-foreground">
                          {customer.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground py-2 text-xs">
                      {formatIsoDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-bold text-foreground font-mono py-2 text-xs">
                      {formatSar(toDecimalString(invoice.total))}
                    </TableCell>
                    <TableCell className="text-end py-2">
                      <InvoiceTableActions
                        invoice={{
                          id: invoice.id,
                          invoiceNumber: invoice.invoiceNumber,
                          status: invoice.status,
                          companyId: company.id,
                          customerId: invoice.customerId,
                        }}
                        companyId={company.id}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
