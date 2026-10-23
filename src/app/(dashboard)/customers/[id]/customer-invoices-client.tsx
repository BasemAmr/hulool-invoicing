"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Edit2,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  FileCheck2,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
import { formatIsoDate, formatSar } from "@/lib/format";
import type { CustomerRecord } from "@/application/ports/customer-repository";

export interface EnrichedCustomerInvoice {
  id: string;
  companyId: string;
  companyNameAr: string;
  invoiceNumber: string | null;
  status: "draft" | "issued" | "cancelled";
  invoiceType: "standard" | "simplified";
  issueDate: string;
  issueTime: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  currency: string;
}

export interface EnrichedCustomerReceipt {
  id: string;
  companyId: string;
  companyNameAr: string;
  voucherNumber: string;
  voucherDate: string;
  amount: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  invoiceId: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة دفع",
  check: "شيك",
  other: "أخرى",
};

interface CustomerInvoicesClientProps {
  customer: CustomerRecord;
  initialInvoices: EnrichedCustomerInvoice[];
  initialTotalCount: number;
  initialReceipts?: EnrichedCustomerReceipt[];
  initialReceiptsCount?: number;
}

export function CustomerInvoicesClient({
  customer,
  initialInvoices,
  initialTotalCount,
  initialReceipts = [],
  initialReceiptsCount = 0,
}: CustomerInvoicesClientProps) {
  const [invoices, setInvoices] = useState<EnrichedCustomerInvoice[]>(initialInvoices);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialInvoices.length < initialTotalCount);
  const [loadingMore, setLoadingMore] = useState(false);

  const [receipts, setReceipts] = useState<EnrichedCustomerReceipt[]>(initialReceipts);
  const [receiptsCount, setReceiptsCount] = useState(initialReceiptsCount);
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts">("invoices");

  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/customers/${customer.id}/invoices?offset=${invoices.length}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.invoices)) {
          setInvoices((prev) => [...prev, ...data.invoices]);
          setHasMore(data.hasMore);
          if (typeof data.totalCount === "number") {
            setTotalCount(data.totalCount);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch more customer invoices:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [customer.id, hasMore, invoices.length, loadingMore]);

  // Infinite scroll intersection observer for invoices
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || activeTab !== "invoices") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, activeTab]);

  // Format customer address
  const fullAddress = [
    customer.addressStreet,
    customer.addressDistrict,
    customer.addressCity,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : "",
  ]
    .filter(Boolean)
    .join("، ");

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Link href="/customers">
            <Button variant="ghost" size="xs" className="gap-1 text-xs">
              <ArrowRight className="size-3.5" />
              <span>العملاء</span>
            </Button>
          </Link>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="font-bold text-foreground text-xs">{customer.nameAr}</span>
        </div>

        <Link href={`/customers/${customer.id}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
            <Edit2 className="size-3.5" />
            <span>تعديل بيانات العميل</span>
          </Button>
        </Link>
      </div>

      {/* Customer Profile Card — Single Compact Horizontal Row */}
      <div className="bg-card border border-border px-4 py-3 shadow-2xs flex items-center gap-3 sm:gap-5 text-xs overflow-x-auto whitespace-nowrap">
        {/* اسم العميل */}
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {customer.nameAr}
          </h1>
          {customer.clientEmployee && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
              {customer.clientEmployee}
            </span>
          )}
          {customer.nameEn && (
            <span className="text-xs font-mono text-muted-foreground" dir="ltr">
              ({customer.nameEn})
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* عدد الفواتير / السندات */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 shrink-0">
          <span className="text-[11px] text-muted-foreground font-semibold">عدد الفواتير / السندات:</span>
          <div className="flex items-center justify-center gap-1 font-mono font-bold text-primary text-xs" dir="ltr">
            <span>{receiptsCount}</span>
            <span className="text-muted-foreground font-normal">/</span>
            <span>{totalCount}</span>
          </div>
        </div>

        {/* الرقم الضريبي */}
        {customer.vatNumber ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <FileCheck2 className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">الرقم الضريبي:</span>
            <span className="font-mono font-semibold text-foreground">{customer.vatNumber}</span>
          </div>
        ) : null}

        {/* العنوان */}
        {fullAddress ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">العنوان:</span>
            <span className="text-foreground">{fullAddress}</span>
          </div>
        ) : null}

        {/* رقم الهاتف */}
        {customer.phone ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Phone className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">الهاتف:</span>
            <span className="font-mono font-semibold text-foreground" dir="ltr">{customer.phone}</span>
          </div>
        ) : null}

        {/* البريد الإلكتروني */}
        {customer.email ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Mail className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">البريد:</span>
            <span className="font-mono text-foreground">{customer.email}</span>
          </div>
        ) : null}
      </div>

      {/* Tabs Switcher: Invoices vs Receipts */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "invoices"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          <span>الفواتير الصادرة</span>
          <span className="px-1.5 py-0.2 rounded-xs text-[10px] bg-muted font-mono">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("receipts")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "receipts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="size-4" />
          <span>سندات القبض</span>
          <span className="px-1.5 py-0.2 rounded-xs text-[10px] bg-muted font-mono">
            {receiptsCount}
          </span>
        </button>
      </div>

      {/* TAB 1: Unified Invoices Section */}
      {activeTab === "invoices" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                سجل الفواتير الصادرة للعميل (عبر جميع المنشآت)
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                ({invoices.length} من أصل {totalCount})
              </span>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
              <FileText className="size-7 text-muted-foreground" />
              <p className="font-bold text-xs text-foreground">
                لا توجد فواتير صادرة لهذا العميل بعد
              </p>
              <p className="text-[11px] text-muted-foreground">
                عند إصدار أي فاتورة لهذا العميل من أي منشأة مسجلة، ستظهر تلقائياً هنا.
              </p>
            </div>
          ) : (
            <div className="border border-border bg-card overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-start border-collapse">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[11px]">
                  <tr>
                    <th className="p-2.5 text-start w-32">رقم الفاتورة</th>
                    <th className="p-2.5 text-start min-w-[160px]">المنشأة المصدرة</th>
                    <th className="p-2.5 text-start w-28">تاريخ الإصدار</th>
                    <th className="p-2.5 text-start w-28">المبلغ قبل الضريبة</th>
                    <th className="p-2.5 text-start w-24">الضريبة (15%)</th>
                    <th className="p-2.5 text-start w-28">الإجمالي الكلي</th>
                    <th className="p-2.5 text-start w-20">الحالة</th>
                    <th className="p-2.5 text-end w-24">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      {/* Invoice Number */}
                      <td className="p-2.5 text-start font-mono font-bold text-primary">
                        <Link
                          href={`/c/${inv.companyId}/invoices/${inv.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          <span>{inv.invoiceNumber || "—"}</span>
                        </Link>
                      </td>

                      {/* Issuing Company */}
                      <td className="p-2.5 text-start">
                        <Link
                          href={`/c/${inv.companyId}`}
                          className="hover:underline inline-flex items-center gap-1 text-foreground font-medium"
                        >
                          <Building2 className="size-3 text-muted-foreground" />
                          <span>{inv.companyNameAr}</span>
                        </Link>
                      </td>

                      {/* Issue Date */}
                      <td className="p-2.5 text-start tabular-nums font-mono text-muted-foreground">
                        {formatIsoDate(inv.issueDate)}
                      </td>

                      {/* Subtotal */}
                      <td className="p-2.5 text-start tabular-nums font-mono text-muted-foreground">
                        {formatSar(inv.subtotal)}
                      </td>

                      {/* VAT Amount */}
                      <td className="p-2.5 text-start tabular-nums font-mono text-muted-foreground">
                        {formatSar(inv.vatAmount)}
                      </td>

                      {/* Total */}
                      <td className="p-2.5 text-start tabular-nums font-mono font-bold text-foreground">
                        {formatSar(inv.total)}
                      </td>

                      {/* Status Badge */}
                      <td className="p-2.5 text-start">
                        <StatusBadge status={inv.status} />
                      </td>

                      {/* Action buttons */}
                      <td className="p-2.5 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/c/${inv.companyId}/invoices/${inv.id}`}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="عرض الفاتورة"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <a
                            href={`/api/documents/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="طباعة وتحميل PDF"
                          >
                            <FileText className="size-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Infinite Scroll Sentinel / Loading Status */}
              <div ref={sentinelRef} className="p-3 text-center border-t border-border bg-muted/10">
                {loadingMore ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>جاري تحميل المزيد من الفواتير (50 فاتورة)...</span>
                  </div>
                ) : hasMore ? (
                  <button
                    type="button"
                    onClick={loadMore}
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                  >
                    مرر للأسفل للتحميل التلقائي أو اضغط هنا لتحميل المزيد...
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    تم عرض جميع الفواتير ({invoices.length} فاتورة مسجلة عبر المنشآت)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Customer Receipts Table */}
      {activeTab === "receipts" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                سجل سندات القبض المستلمة من العميل (عبر جميع المنشآت)
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                ({receipts.length} سند قبض مسجل)
              </span>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
              <Receipt className="size-7 text-muted-foreground" />
              <p className="font-bold text-xs text-foreground">
                لا توجد سندات قبض مسجلة لهذا العميل بعد
              </p>
              <p className="text-[11px] text-muted-foreground">
                عند إصدار أو تسجيل أي سند قبض للعميل عبر أي منشأة، سيظهر تلقائياً هنا.
              </p>
            </div>
          ) : (
            <div className="border border-border bg-card overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-start border-collapse">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[11px]">
                  <tr>
                    <th className="p-2.5 text-start w-32">رقم السند</th>
                    <th className="p-2.5 text-start min-w-[160px]">المنشأة المصدرة</th>
                    <th className="p-2.5 text-start w-28">تاريخ السند</th>
                    <th className="p-2.5 text-start w-28">طريقة الدفع</th>
                    <th className="p-2.5 text-start w-32">المبلغ المستلم</th>
                    <th className="p-2.5 text-start min-w-[160px]">المرجع / ملاحظات</th>
                    <th className="p-2.5 text-start w-28">نوع السند</th>
                    <th className="p-2.5 text-end w-24">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                      {/* Voucher Number */}
                      <td className="p-2.5 text-start font-mono font-bold text-primary">
                        <a
                          href={`/api/documents/receipts/${rec.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          <span>{rec.voucherNumber}</span>
                        </a>
                      </td>

                      {/* Issuing Company */}
                      <td className="p-2.5 text-start">
                        <Link
                          href={`/c/${rec.companyId}`}
                          className="hover:underline inline-flex items-center gap-1 text-foreground font-medium"
                        >
                          <Building2 className="size-3 text-muted-foreground" />
                          <span>{rec.companyNameAr}</span>
                        </Link>
                      </td>

                      {/* Voucher Date */}
                      <td className="p-2.5 text-start tabular-nums font-mono text-muted-foreground">
                        {formatIsoDate(rec.voucherDate)}
                      </td>

                      {/* Payment Method */}
                      <td className="p-2.5 text-start">
                        <span className="px-2 py-0.5 bg-muted border border-border text-[11px]">
                          {paymentMethodLabels[rec.paymentMethod] ?? rec.paymentMethod}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="p-2.5 text-start tabular-nums font-mono font-bold text-foreground">
                        {formatSar(rec.amount)}
                      </td>

                      {/* Reference / Notes */}
                      <td className="p-2.5 text-start text-xs text-muted-foreground max-w-xs truncate">
                        {rec.reference || rec.notes || "—"}
                      </td>

                      {/* Type: Auto or Manual */}
                      <td className="p-2.5 text-start text-[11px]">
                        {rec.invoiceId ? (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20">
                            تلقائي (فاتورة)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-muted text-foreground border border-border">
                            يدوي مخصص
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-2.5 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/api/documents/receipts/${rec.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="عرض وتحميل PDF"
                          >
                            <FileText className="size-3.5" />
                          </a>
                          {!rec.invoiceId && (
                            <Link
                              href={`/c/${rec.companyId}/receipts/${rec.id}/edit`}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="تعديل السند اليدوي"
                            >
                              <Edit2 className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
