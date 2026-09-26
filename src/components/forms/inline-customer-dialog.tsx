"use client";

import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomerDirectAction } from "@/app/actions/customers";
import { useToast } from "@/components/ui/toaster";

interface InlineCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: { id: string; nameAr: string }) => void;
}

export function InlineCustomerDialog({
  open,
  onClose,
  onCustomerCreated,
}: InlineCustomerDialogProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states (managed as state instead of inner <form> to prevent nested form HTML errors)
  const [nameAr, setNameAr] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [unifiedNumber, setUnifiedNumber] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressBuildingNumber, setAddressBuildingNumber] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressAdditionalNumber, setAddressAdditionalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  if (!open) return null;

  async function handleSave() {
    const trimmedName = nameAr.trim();
    if (!trimmedName) {
      setErrorMessage("اسم العميل مطلوب");
      return;
    }
    if (!vatNumber.trim()) {
      setErrorMessage("الرقم الضريبي مطلوب");
      return;
    }
    if (!unifiedNumber.trim()) {
      setErrorMessage("الرقم الموحد مطلوب");
      return;
    }
    if (!addressCity.trim()) {
      setErrorMessage("المدينة مطلوبة");
      return;
    }
    if (!addressPostalCode.trim()) {
      setErrorMessage("الرمز البريدي مطلوب");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await createCustomerDirectAction({
        nameAr: trimmedName,
        vatNumber: vatNumber.trim(),
        unifiedNumber: unifiedNumber.trim(),
        addressCity: addressCity.trim(),
        addressDistrict: addressDistrict.trim() || undefined,
        addressStreet: addressStreet.trim() || undefined,
        addressBuildingNumber: addressBuildingNumber.trim() || undefined,
        addressPostalCode: addressPostalCode.trim(),
        addressAdditionalNumber: addressAdditionalNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (res.status === "success") {
        success(`تمت إضافة العميل "${res.customer.nameAr}" بنجاح`, "تم الإنشاء");
        onCustomerCreated(res.customer);
        // Reset
        setNameAr("");
        setVatNumber("");
        setUnifiedNumber("");
        setAddressCity("");
        setAddressDistrict("");
        setAddressStreet("");
        setAddressBuildingNumber("");
        setAddressPostalCode("");
        setAddressAdditionalNumber("");
        setPhone("");
        setEmail("");
        onClose();
      } else {
        setErrorMessage(res.message);
        error(res.message, "خطأ في الإنشاء");
      }
    } catch {
      setErrorMessage("حدث خطأ أثناء حفظ بيانات العميل");
      error("حدث خطأ غير متوقع", "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg border border-border bg-card shadow-2xl p-5 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <UserPlus className="size-4 text-primary" />
            <span>إضافة عميل جديد</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground border border-transparent hover:border-border cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form container as div to avoid nested <form> hydration error */}
        <div
          className="flex flex-col gap-3.5"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inline_nameAr" className="text-xs">
              اسم العميل (عربي) *
            </Label>
            <Input
              id="inline_nameAr"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
              autoFocus
              placeholder="مثال: شركة الأفق للتجارة"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_vat" className="text-xs">
                الرقم الضريبي *
              </Label>
              <Input
                id="inline_vat"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="300000000000003"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_unifiedNumber" className="text-xs">
                الرقم الموحد (700) *
              </Label>
              <Input
                id="inline_unifiedNumber"
                value={unifiedNumber}
                onChange={(e) => setUnifiedNumber(e.target.value)}
                placeholder="7001234567"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_city" className="text-xs">
                المدينة *
              </Label>
              <Input
                id="inline_city"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="الرياض"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_district" className="text-xs">
                الحي (اختياري)
              </Label>
              <Input
                id="inline_district"
                value={addressDistrict}
                onChange={(e) => setAddressDistrict(e.target.value)}
                placeholder="الملز"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_street" className="text-xs">
                الشارع (اختياري)
              </Label>
              <Input
                id="inline_street"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="طريق الملك فهد"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_buildingNumber" className="text-xs">
                رقم المبنى (اختياري)
              </Label>
              <Input
                id="inline_buildingNumber"
                value={addressBuildingNumber}
                onChange={(e) => setAddressBuildingNumber(e.target.value)}
                placeholder="1234"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_postal" className="text-xs">
                الرمز البريدي *
              </Label>
              <Input
                id="inline_postal"
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                placeholder="12345"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_additionalNumber" className="text-xs">
                الرقم الإضافي (اختياري)
              </Label>
              <Input
                id="inline_additionalNumber"
                value={addressAdditionalNumber}
                onChange={(e) => setAddressAdditionalNumber(e.target.value)}
                placeholder="6789"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_phone" className="text-xs">
                رقم الجوال
              </Label>
              <Input
                id="inline_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                inputMode="tel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline_email" className="text-xs">
                البريد الإلكتروني
              </Label>
              <Input
                id="inline_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-2 border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "جارٍ الحفظ..." : "حفظ واختيار العميل"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
