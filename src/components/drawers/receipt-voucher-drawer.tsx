"use client";

import React, { useState, useEffect } from "react";
import { Receipt, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Label } from "@/components/ui/label";

import { SheetDrawer } from "./sheet-drawer";
import { createReceiptVoucherDirectAction } from "@/app/actions/receipts";
import { useToast } from "@/components/ui/toaster";
import type { ClientOption } from "@/components/forms/client-combobox";
import { ClientCombobox } from "@/components/forms/client-combobox";

export interface ReceiptVoucherDrawerProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  customers: ClientOption[];
  defaultCustomerId?: string;
  defaultInvoiceId?: string;
  defaultAmount?: string;
  onSaved?: (voucher: { id: string; voucherNumber: string }) => void;
}

export function ReceiptVoucherDrawer({
  open,
  onClose,
  companyId,
  customers,
  defaultCustomerId = "",
  defaultInvoiceId,
  defaultAmount = "",
  onSaved,
}: ReceiptVoucherDrawerProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(defaultAmount);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "other">("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setCustomerId(defaultCustomerId || customers[0]?.id || "");
      setVoucherDate(new Date().toISOString().slice(0, 10));
      setAmount(defaultAmount);
      setPaymentMethod("bank_transfer");
      setReference("");
      setNotes("");
    }
  }, [open, defaultCustomerId, defaultAmount, customers]);

  async function handleSave() {
    if (!customerId) {
      setErrorMessage("يرجى اختيار العميل");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }
    if (!voucherDate) {
      setErrorMessage("تاريخ السند مطلوب");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const amountHalalas = Math.round(numAmount * 100);

    try {
      const res = await createReceiptVoucherDirectAction({
        companyId,
        customerId,
        invoiceId: defaultInvoiceId,
        voucherDate,
        amount: amountHalalas,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.status === "success") {
        success(`تم إنشاء سند القبض "${res.voucher.voucherNumber}" بنجاح`, "تم الإنشاء");
        onSaved?.(res.voucher);
        onClose();
      } else {
        setErrorMessage(res.message);
        error(res.message, "خطأ في إنشاء السند");
      }
    } catch {
      setErrorMessage("حدث خطأ أثناء حفظ سند القبض");
      error("حدث خطأ غير متوقع", "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SheetDrawer
      open={open}
      onClose={onClose}
      title="إصدار سند قبض جديد"
      description="توثيق استلام دفعة مالية أو حوالة بنكية من العميل"
      icon={<Receipt className="size-4" />}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs">
            إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5 text-xs font-semibold">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            <span>حفظ وإصدار السند</span>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Customer */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">
              العميل المستلم منه <span className="text-destructive">*</span>
            </Label>
            <ClientCombobox
              customers={customers}
              selectedId={customerId}
              onSelect={(c) => setCustomerId(c.id)}
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                المبلغ المستلم (ر.س) <span className="text-destructive">*</span>
              </Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="text-xs font-mono font-bold h-8"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                تاريخ السند <span className="text-destructive">*</span>
              </Label>
              <DatePickerInput
                value={voucherDate}
                onChange={setVoucherDate}
                required
                className="h-8"
              />
            </div>

          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">طريقة الاستلام</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="border border-border bg-background px-2.5 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="bank_transfer">تحويل بنكي (Bank Transfer)</option>
                <option value="cash">نقداً (Cash)</option>
                <option value="other">شيك / أخرى (Other)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">رقم الحوالة / المرجع (اختياري)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="مثال: رقم الحوالة، رقم الشيك..."
                className="text-xs h-8"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">ملاحظات إضافية (اختياري)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي تفاصيل أو ملاحظات عن السند..."
              className="border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </SheetDrawer>
  );
}
