"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";

interface CustomerOption {
  id: string;
  nameAr: string;
  phone?: string | null;
}

interface DuplicateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  companyId?: string;
  /** Defaults to the source invoice's client. */
  defaultCustomerId?: string;
  /** Defaults to today. */
  defaultIssueDate?: string;
  /** Defaults to the current local time. */
  defaultIssueTime?: string;
  itemName?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeHm(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/**
 * Duplicate dialog: asks for target client + date (defaults: same client,
 * today), then opens the create page prefilled with the source invoice's
 * lines/notes/terms/template — but with the chosen client + date applied.
 */
import { computeIncrementedIssueTime } from "@/domain/services/invoice-datetime";

export function DuplicateInvoiceDialog({
  open,
  onClose,
  invoiceId,
  companyId,
  defaultCustomerId,
  defaultIssueDate,
  defaultIssueTime,
  itemName,
}: DuplicateInvoiceDialogProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [issueDate, setIssueDate] = useState(defaultIssueDate ?? todayIso());
  // Duplicate defaults to incremented time based on the source invoice time
  const [issueTime, setIssueTime] = useState(() =>
    computeIncrementedIssueTime(defaultIssueTime || "09:00")
  );
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId(defaultCustomerId ?? "");
    setIssueDate(defaultIssueDate ?? todayIso());
    setIssueTime(computeIncrementedIssueTime(defaultIssueTime || "09:00"));
    let cancelled = false;
    async function load() {
      setLoadingCustomers(true);
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CustomerOption[];
        if (!cancelled) {
          setCustomers(data);
          // Keep the same-client default even after the list loads.
          if (defaultCustomerId) setCustomerId(defaultCustomerId);
          else if (data.length > 0 && data[0]) setCustomerId((prev) => prev || data[0]!.id);
        }
      } catch {
        // Leave the list empty; the select still allows retry on reopen.
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, defaultCustomerId, defaultIssueDate, defaultIssueTime]);

  if (!open) return null;

  function handleDuplicate() {
    if (!customerId || !issueDate) return;
    const params = new URLSearchParams({
      duplicateFrom: invoiceId,
      customerId,
      issueDate,
      // Prefill the wizard's time picker on the new page.
      issueTime,
    });
    const target = companyId
      ? `/c/${companyId}/invoices/new?${params.toString()}`
      : `/invoices/new?${params.toString()}`;
    onClose();
    router.push(target);
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 whitespace-normal">
      <div className="w-full max-w-md border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden text-start">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-primary/10 px-5 py-4 text-foreground">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Copy className="size-4 text-primary" />
            <span>تكرار الفاتورة</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs sm:text-sm text-foreground leading-relaxed break-words whitespace-normal">
            سيتم فتح صفحة فاتورة جديدة بنفس بنود وملاحظات الفاتورة الحالية
            {itemName ? (
              <>
                {" "}(<span className="font-mono font-bold">{itemName}</span>)
              </>
            ) : null}
            ، مع العميل والتاريخ الجديدين الذين تختارهما هنا.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-foreground">
              العميل للفاتورة الجديدة
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-8 text-xs bg-background border border-input px-2 text-foreground"
            >
              <option value="">
                {loadingCustomers ? "جارٍ تحميل العملاء..." : "— اختر العميل —"}
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                  {c.phone ? ` (${c.phone})` : ""}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-muted-foreground">
              القيمة الافتراضية: نفس عميل الفاتورة الحالية.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-foreground">
              تاريخ الفاتورة الجديدة
            </label>
            <div className="flex items-center gap-1.5">
              <DatePickerInput
                value={issueDate}
                onChange={(val) => setIssueDate(val)}
                className="text-xs h-8 flex-1"
              />
              {/* Native HH:MM picker beside the date (DatePickerInput is date-only). */}
              <input
                type="time"
                dir="ltr"
                value={issueTime}
                onChange={(e) => setIssueTime(e.target.value)}
                aria-label="وقت الفاتورة الجديدة (HH:MM)"
                className="h-8 text-xs font-mono tabular-nums bg-background border border-input px-1 text-foreground w-[86px]"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              القيمة الافتراضية: تاريخ اليوم.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDuplicate}
            disabled={!customerId || !issueDate}
            className="text-xs gap-1.5 font-semibold"
          >
            <Copy className="size-3.5" />
            <span>تكرار وفتح فاتورة جديدة</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
