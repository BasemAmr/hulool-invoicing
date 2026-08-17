"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";

import { createDraftInvoiceAction } from "@/app/actions/invoices";
import { idleState, type ActionState } from "@/app/actions/types";
import { VAT_RATE } from "@/domain/constants";
import { calculateTotals } from "@/domain/services/totals-calculator";
import { fromDecimalString, toDecimalString } from "@/domain/value-objects/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";

export interface CompanyOption {
  id: string;
  nameAr: string;
  prefix: string;
}

export interface CustomerOption {
  id: string;
  nameAr: string;
}

interface LineDraft {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

let nextKey = 1;
const emptyLine = (): LineDraft => ({ key: nextKey++, description: "", quantity: "1", unitPrice: "" });

export function InvoiceForm({
  companies,
  customers,
}: {
  companies: CompanyOption[];
  customers: CustomerOption[];
}) {
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(createDraftInvoiceAction, idleState);

  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const totals = useMemo(() => {
    const valid = lines
      .filter(
        (line) =>
          line.description.trim().length > 0 &&
          Number(line.quantity) > 0 &&
          /^\d+(\.\d{1,2})?$/.test(line.unitPrice.trim()),
      )
      .map((line) => ({
        unitPrice: fromDecimalString(line.unitPrice.trim()),
        quantity: Number(line.quantity),
        vatRate: VAT_RATE,
      }));
    if (valid.length === 0) return null;
    return calculateTotals(valid);
  }, [lines]);

  const serializedItems = useMemo(
    () =>
      JSON.stringify(
        lines
          .filter(
            (line) =>
              line.description.trim().length > 0 &&
              Number(line.quantity) > 0 &&
              /^\d+(\.\d{1,2})?$/.test(line.unitPrice.trim()),
          )
          .map((line) => ({
            description: line.description.trim(),
            quantity: Number(line.quantity),
            unitPrice: fromDecimalString(line.unitPrice.trim()),
            vatRate: VAT_RATE,
          })),
      ),
    [lines],
  );

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid max-w-3xl grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyId">الشركة *</Label>
          <select
            id="companyId"
            name="companyId"
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {companies.length === 0 && <option value="">— أنشئ شركة أولاً —</option>}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nameAr} ({company.prefix})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customerId">العميل *</Label>
          <select
            id="customerId"
            name="customerId"
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {customers.length === 0 && <option value="">— أنشئ عميلاً أولاً —</option>}
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issueDate">تاريخ الإصدار *</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">بنود الفاتورة</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + إضافة بند
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[2fr_100px_140px_40px] gap-2 px-1 text-xs text-muted-foreground">
            <span>الوصف</span>
            <span>الكمية</span>
            <span>سعر الوحدة (SAR)</span>
            <span />
          </div>
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[2fr_100px_140px_40px] gap-2">
              <Input
                value={line.description}
                onChange={(e) => updateLine(line.key, { description: e.target.value })}
                placeholder="وصف البند"
              />
              <Input
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                inputMode="decimal"
              />
              <Input
                value={line.unitPrice}
                onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                inputMode="decimal"
                placeholder="0.00"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف البند"
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((prev) =>
                    prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev,
                  )
                }
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">ملاحظات</Label>
          <Input id="notes" name="notes" />
        </div>
      </div>

      {totals && (
        <div className="flex max-w-3xl justify-end">
          <div className="w-64 rounded-lg border bg-card p-4 text-sm">
            <Row label="الإجمالي قبل الضريبة" value={formatMoney(toDecimalString(totals.subtotal))} />
            <Row label={`الضريبة (${Math.round(VAT_RATE * 100)}%)`} value={formatMoney(toDecimalString(totals.vatTotal))} />
            <Row label="الإجمالي" value={formatMoney(toDecimalString(totals.total))} strong />
          </div>
        </div>
      )}

      <input type="hidden" name="items" value={serializedItems} />

      {state.status === "error" && (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending || companies.length === 0 || customers.length === 0}>
          {pending ? "جارٍ الإنشاء..." : "إنشاء مسودة الفاتورة"}
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold" : ""}`}>
        {value} SAR
      </span>
    </div>
  );
}
