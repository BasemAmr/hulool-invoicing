"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetDrawer } from "./sheet-drawer";
import { createCustomerDirectAction, updateCustomerDirectAction } from "@/app/actions/customers";
import { useToast } from "@/components/ui/toaster";
import type { CustomerRecord } from "@/application/ports/customer-repository";

export interface CustomerDrawerProps {
  open: boolean;
  onClose: () => void;
  customer?: {
    id?: string;
    nameAr?: string;
    nameEn?: string | null;
    vatNumber?: string | null;
    unifiedNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    addressCity?: string | null;
    addressStreet?: string | null;
    addressPostalCode?: string | null;
  } | null;
  onSaved?: (customer: { id: string; nameAr: string; phone?: string | null; vatNumber?: string | null; addressCity?: string | null }) => void;
}

export function CustomerDrawer({
  open,
  onClose,
  customer,
  onSaved,
}: CustomerDrawerProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = Boolean(customer?.id);

  // Form fields
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [unifiedNumber, setUnifiedNumber] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressStreet, setAddressStreet] = useState("");

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (customer) {
        setNameAr(customer.nameAr ?? "");
        setNameEn(customer.nameEn ?? "");
        setVatNumber(customer.vatNumber ?? "");
        setUnifiedNumber(customer.unifiedNumber ?? "");
        setAddressCity(customer.addressCity ?? "");
        setAddressPostalCode(customer.addressPostalCode ?? "");
        setPhone(customer.phone ?? "");
        setEmail(customer.email ?? "");
        setAddressStreet(customer.addressStreet ?? "");
      } else {
        setNameAr("");
        setNameEn("");
        setVatNumber("");
        setUnifiedNumber("");
        setAddressCity("");
        setAddressPostalCode("");
        setPhone("");
        setEmail("");
        setAddressStreet("");
      }
    }
  }, [open, customer]);

  async function handleSave() {
    const trimmedNameAr = nameAr.trim();
    const trimmedVat = vatNumber.trim();
    const trimmedUnified = unifiedNumber.trim();
    const trimmedCity = addressCity.trim();
    const trimmedPostal = addressPostalCode.trim();

    if (!trimmedNameAr) {
      setErrorMessage("اسم العميل بالعربية مطلوب");
      return;
    }
    if (!trimmedVat) {
      setErrorMessage("الرقم الضريبي مطلوب (15 رقم)");
      return;
    }
    if (!trimmedUnified) {
      setErrorMessage("الرقم الموحد (700) مطلوب");
      return;
    }
    if (!trimmedCity) {
      setErrorMessage("المدينة مطلوبة");
      return;
    }
    if (!trimmedPostal) {
      setErrorMessage("الرمز البريدي مطلوب");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (isEdit && customer?.id) {
        const res = await updateCustomerDirectAction({
          id: customer.id,
          nameAr: trimmedNameAr,
          nameEn: nameEn.trim() || undefined,
          vatNumber: trimmedVat,
          unifiedNumber: trimmedUnified,
          addressCity: trimmedCity,
          addressPostalCode: trimmedPostal,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          addressStreet: addressStreet.trim() || undefined,
        });

        if (res.status === "success") {
          success(`تم تحديث بيانات العميل "${trimmedNameAr}" بنجاح`, "تم الحفظ");
          onSaved?.({
            id: customer.id,
            nameAr: trimmedNameAr,
            phone: phone.trim() || null,
            vatNumber: trimmedVat,
            addressCity: trimmedCity,
          });
          onClose();
        } else {
          setErrorMessage(res.message);
          error(res.message, "خطأ في التحديث");
        }
      } else {
        const res = await createCustomerDirectAction({
          nameAr: trimmedNameAr,
          nameEn: nameEn.trim() || undefined,
          vatNumber: trimmedVat,
          unifiedNumber: trimmedUnified,
          addressCity: trimmedCity,
          addressPostalCode: trimmedPostal,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          addressStreet: addressStreet.trim() || undefined,
        });

        if (res.status === "success") {
          success(`تمت إضافة العميل "${trimmedNameAr}" بنجاح`, "تم الإنشاء");
          onSaved?.({
            id: res.customer.id,
            nameAr: res.customer.nameAr,
            phone: phone.trim() || null,
            vatNumber: trimmedVat,
            addressCity: trimmedCity,
          });
          onClose();
        } else {
          setErrorMessage(res.message);
          error(res.message, "خطأ في الإنشاء");
        }
      }
    } catch {
      setErrorMessage("حدث خطأ أثناء حفظ بيانات العميل");
      error("حدث خطأ غير متوقع", "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SheetDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
      description={isEdit ? "تحديث بيانات العميل في السجل العام" : "إضافة عميل جديد للسجل العام المشترك"}
      icon={isEdit ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs">
            إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5 text-xs font-semibold">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isEdit ? "حفظ التعديلات" : "إضافة العميل"}</span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Name AR (Required) */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold">
              اسم العميل (بالعربية) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: شركة الأمل للتجارة والمقاولات"
              className="text-xs h-8"
              required
            />
          </div>

          {/* Name EN (Optional) */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">الاسم بالإنجليزية (اختياري)</Label>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Al-Amal Trading Co."
              dir="ltr"
              className="text-xs h-8"
            />
          </div>

          {/* VAT Number (Required) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">
              الرقم الضريبي (15 رقم) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="300000000000003"
              className="text-xs font-mono h-8"
              dir="ltr"
              required
            />
          </div>

          {/* Unified Number 700 (Required) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">
              الرقم الموحد (700xxxxxxx) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={unifiedNumber}
              onChange={(e) => setUnifiedNumber(e.target.value)}
              placeholder="7001234567"
              className="text-xs font-mono h-8"
              dir="ltr"
              required
            />
          </div>

          {/* City (Required) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">
              المدينة <span className="text-destructive">*</span>
            </Label>
            <Input
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="الرياض، جدة، الدمام..."
              className="text-xs h-8"
              required
            />
          </div>

          {/* Postal Code (Required) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold">
              الرمز البريدي (5 أرقام) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              placeholder="12345"
              className="text-xs font-mono h-8"
              dir="ltr"
              required
            />
          </div>

          {/* Phone (Optional) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">رقم الجوال (اختياري)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="text-xs font-mono h-8"
              dir="ltr"
            />
          </div>

          {/* Email (Optional) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">البريد الإلكتروني (اختياري)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              type="email"
              className="text-xs h-8"
              dir="ltr"
            />
          </div>

          {/* Street (Optional) */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">اسم الشارع والحي (اختياري)</Label>
            <Input
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              placeholder="شارع الملك فهد، حي العليا..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>
    </SheetDrawer>
  );
}
