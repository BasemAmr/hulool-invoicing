"use client";

import React, { useActionState, use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, Receipt } from "lucide-react";

import { createReceiptVoucherAction } from "@/app/actions/receipts";
import { idleState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Label } from "@/components/ui/label";


export default function NewReceiptVoucherPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createReceiptVoucherAction,
    idleState
  );

  const [customers, setCustomers] = useState<{ id: string; nameAr: string }[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  React.useEffect(() => {
    // Fetch global customers list for selection
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false));
  }, []);

  React.useEffect(() => {
    if (state.status === "ok") {
      router.push(`/c/${companyId}/receipts`);
    }
  }, [state.status, companyId, router]);

  const cPath = `/c/${companyId}`;
  const today = new Date().toISOString().slice(0, 10);
  const [voucherDate, setVoucherDate] = useState(today);


  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Receipt className="size-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            إنشاء سند قبض جديد
          </h1>
        </div>
        <Link href={`${cPath}/receipts`}>
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowRight className="size-4" />
            <span>رجوع</span>
          </Button>
        </Link>
      </div>

      {state.status === "error" && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {state.message}
        </div>
      )}

      {/* Form */}
      <form action={formAction} className="flex flex-col gap-5 bg-card border border-border p-6 shadow-2xs">
        <input type="hidden" name="companyId" value={companyId} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customerId" className="text-xs font-semibold">
            العميل المستلم منه *
          </Label>
          <select
            id="customerId"
            name="customerId"
            required
            className="w-full px-3 py-2 text-xs border border-border bg-background text-foreground"
            defaultValue=""
          >
            <option value="" disabled>
              {loadingCustomers ? "جاري تحميل العملاء..." : "-- اختر العميل --"}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount" className="text-xs font-semibold">
              المبلغ المستلم (ر.س) *
            </Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voucherDate" className="text-xs font-semibold">
              تاريخ الاستلام *
            </Label>
            <DatePickerInput
              id="voucherDate"
              name="voucherDate"
              value={voucherDate}
              onChange={setVoucherDate}
              required
            />
          </div>
        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentMethod" className="text-xs font-semibold">
              طريقة الاستلام *
            </Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue="bank_transfer"
              className="w-full px-3 py-2 text-xs border border-border bg-background text-foreground"
            >
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="cash">نقداً</option>
              <option value="other">أخرى / شيك</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference" className="text-xs font-semibold">
              رقم المرجع / الحوالة (اختياري)
            </Label>
            <Input
              id="reference"
              name="reference"
              placeholder="مثال: رقم العملية البنكية..."
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes" className="text-xs font-semibold">
            البيان / ملاحظات (اختياري)
          </Label>
          <Input
            id="notes"
            name="notes"
            placeholder="دفعة سداد فاتورة رقم... أو مقابل خدمات..."
          />
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
          <Link href={`${cPath}/receipts`}>
            <Button type="button" variant="outline" size="sm">
              إلغاء
            </Button>
          </Link>
          <Button type="submit" size="sm" disabled={pending} className="gap-1.5 font-semibold">
            <Save className="size-4" />
            <span>{pending ? "جاري الحفظ..." : "حفظ وإصدار السند"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
