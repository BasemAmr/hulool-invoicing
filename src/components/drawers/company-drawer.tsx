"use client";

import React, { useState, useEffect } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetDrawer } from "./sheet-drawer";
import { createCompanyDirectAction, updateCompanyDirectAction } from "@/app/actions/companies";
import { useToast } from "@/components/ui/toaster";
import { toWesternDigits, generateDefaultCompanyPrefix } from "@/lib/format";
import { ImageUploadInput } from "../forms/image-upload-input";
import type { CompanyRecord } from "@/application/ports/company-repository";



export interface CompanyDrawerProps {
  open: boolean;
  onClose: () => void;
  company?: CompanyRecord | null;
  onSaved?: (company: CompanyRecord) => void;
}

export function CompanyDrawer({
  open,
  onClose,
  company,
  onSaved,
}: CompanyDrawerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [prefix, setPrefix] = useState(() => generateDefaultCompanyPrefix());
  const [clientEmployee, setClientEmployee] = useState("");
  const [addressBuildingNumber, setAddressBuildingNumber] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressCity, setAddressCity] = useState("الرياض");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressAdditionalNumber, setAddressAdditionalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFileId, setLogoFileId] = useState<string | undefined>(undefined);
  const [backgroundFileId, setBackgroundFileId] = useState<string | undefined>(undefined);
  const [signatureFileId, setSignatureFileId] = useState<string | undefined>(undefined);
  const [footerText, setFooterText] = useState("");

  const isEditing = !!company;

  useEffect(() => {
    if (company) {
      setNameAr(company.nameAr || "");
      setNameEn(company.nameEn || "");
      setVatNumber(company.vatNumber || "");
      setCrNumber(company.crNumber || "");
      setPrefix(company.prefix || "INV");
      setClientEmployee(company.clientEmployee || "");
      setAddressBuildingNumber(company.addressBuildingNumber || "");
      setAddressStreet(company.addressStreet || "");
      setAddressDistrict(company.addressDistrict || "");
      setAddressCity(company.addressCity || "الرياض");
      setAddressPostalCode(company.addressPostalCode || "");
      setAddressAdditionalNumber(company.addressAdditionalNumber || "");
      setPhone(company.phone || "");
      setEmail(company.email || "");
      setWebsite(company.website || "");
      setLogoFileId(company.logoFileId || undefined);
      setBackgroundFileId(company.backgroundFileId || undefined);
      setSignatureFileId(company.signatureFileId || undefined);
      setFooterText(company.footerText || "");
    } else {
      setNameAr("");
      setNameEn("");
      setVatNumber("");
      setCrNumber("");
      setPrefix(generateDefaultCompanyPrefix());
      setClientEmployee("");
      setAddressBuildingNumber("");
      setAddressStreet("");
      setAddressDistrict("");
      setAddressCity("الرياض");
      setAddressPostalCode("");
      setAddressAdditionalNumber("");
      setPhone("");
      setEmail("");
      setWebsite("");
      setLogoFileId(undefined);
      setBackgroundFileId(undefined);
      setSignatureFileId(undefined);
      setFooterText("");
    }
    setError(null);
  }, [company, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      setError("يرجى إدخال اسم المنشأة بالعربية");
      return;
    }
    if (!vatNumber.trim() || vatNumber.trim().length !== 15) {
      setError("الرقم الضريبي يجب أن يتكون من 15 رقماً ويبدأ وينتهي بـ 3");
      return;
    }
    if (!prefix.trim()) {
      setError("يرجى تحديد بادئة الترقيم (مثال: INV)");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || undefined,
      vatNumber: toWesternDigits(vatNumber.trim()),
      crNumber: crNumber.trim() ? toWesternDigits(crNumber.trim()) : undefined,
      prefix: prefix.trim().toUpperCase(),
      clientEmployee: clientEmployee.trim() || undefined,
      addressBuildingNumber: addressBuildingNumber.trim() || undefined,
      addressStreet: addressStreet.trim() || undefined,
      addressDistrict: addressDistrict.trim() || undefined,
      addressCity: addressCity.trim() || undefined,
      addressPostalCode: addressPostalCode.trim() ? toWesternDigits(addressPostalCode.trim()) : undefined,
      addressAdditionalNumber: addressAdditionalNumber.trim() ? toWesternDigits(addressAdditionalNumber.trim()) : undefined,
      phone: phone.trim() ? toWesternDigits(phone.trim()) : undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      logoFileId,
      backgroundFileId,
      signatureFileId,
      footerText: footerText.trim() || undefined,
    };


    try {
      if (isEditing && company) {
        const res = await updateCompanyDirectAction(company.id, payload);
        if (res.status === "success") {
          toast({ title: "تم تحديث المنشأة", message: `تم تعديل بيانات "${payload.nameAr}" بنجاح.` });
          onSaved?.(res.data);
          onClose();
        } else {
          setError(res.message);
        }
      } else {
        const res = await createCompanyDirectAction(payload);
        if (res.status === "success") {
          toast({ title: "تمت إضافة المنشأة", message: `تم حفظ المنشأة "${payload.nameAr}" بنجاح.` });
          onSaved?.(res.data);
          onClose();
        } else {

          setError(res.message);
        }
      }
    } catch {
      setError("حدث خطأ غير متوقع أثناء حفظ المنشأة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SheetDrawer
      open={open}
      onClose={onClose}
      title={isEditing ? `تعديل المنشأة: ${company?.nameAr}` : "إضافة منشأة جديدة"}
      description="أدخل البيانات الضريبية والتجارية للمنشأة لاستخدامها في إصدار الفواتير"
      icon={<Building2 className="size-4" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            {error}
          </div>
        )}

        {/* Section 1: Basic & Tax Info */}
        <div className="flex flex-col gap-2.5 border-b border-border pb-3">
          <h4 className="text-xs font-bold text-foreground">البيانات الأساسية والضريبية</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                اسم المنشأة (عربي) <span className="text-destructive">*</span>
              </Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: شركة حلول التقنية للتجارة"
                className="text-xs h-8"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الاسم (إنجليزي - اختياري)</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Hulool Tech Trading Co."
                dir="ltr"
                className="text-xs h-8 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                الرقم الضريبي (15 رقم) <span className="text-destructive">*</span>
              </Label>
              <Input
                value={vatNumber}
                onChange={(e) => setVatNumber(toWesternDigits(e.target.value))}
                placeholder="300000000000003"
                dir="ltr"
                maxLength={15}
                className="text-xs font-mono tabular-nums h-8"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                بادئة الترقيم <span className="text-destructive">*</span>
              </Label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="INV"
                dir="ltr"
                maxLength={12}
                className="text-xs font-mono font-bold h-8 uppercase"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">رقم السجل التجاري (اختياري)</Label>
              <Input
                value={crNumber}
                onChange={(e) => setCrNumber(toWesternDigits(e.target.value))}
                placeholder="1010xxxxxx"
                dir="ltr"
                maxLength={10}
                className="text-xs font-mono tabular-nums h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">تابع للعميل</Label>
              <Input
                value={clientEmployee}
                onChange={(e) => setClientEmployee(e.target.value)}
                placeholder="تابع للعميل"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Address & Location */}
        <div className="flex flex-col gap-2.5 border-b border-border pb-3">
          <h4 className="text-xs font-bold text-foreground">العنوان الوطني والمدينة</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">
                المدينة <span className="text-destructive">*</span>
              </Label>
              <Input
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="الرياض"
                className="text-xs h-8"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الرمز البريدي</Label>
              <Input
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(toWesternDigits(e.target.value))}
                placeholder="12345"
                dir="ltr"
                maxLength={5}
                className="text-xs font-mono tabular-nums h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الحي</Label>
              <Input
                value={addressDistrict}
                onChange={(e) => setAddressDistrict(e.target.value)}
                placeholder="العليا"
                className="text-xs h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الشارع</Label>
              <Input
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="طريق الملك فهد"
                className="text-xs h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">رقم المبنى</Label>
              <Input
                value={addressBuildingNumber}
                onChange={(e) => setAddressBuildingNumber(toWesternDigits(e.target.value))}
                placeholder="1234"
                dir="ltr"
                maxLength={4}
                className="text-xs font-mono tabular-nums h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الرقم الإضافي</Label>
              <Input
                value={addressAdditionalNumber}
                onChange={(e) => setAddressAdditionalNumber(toWesternDigits(e.target.value))}
                placeholder="5678"
                dir="ltr"
                maxLength={4}
                className="text-xs font-mono tabular-nums h-8"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Contact Channels */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-foreground">بيانات التواصل (اختيارية)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الهاتف / الجوال</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(toWesternDigits(e.target.value))}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="text-xs font-mono tabular-nums h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">البريد الإلكتروني</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@company.sa"
                dir="ltr"
                className="text-xs font-mono h-8"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">الموقع الإلكتروني</Label>
              <Input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.sa"
                dir="ltr"
                className="text-xs font-mono h-8"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Images & Background */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          <h4 className="text-xs font-bold text-foreground">الصور والخلفية والتوقيع (اختياري)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <ImageUploadInput
              label="شعار الشركة"
              name="logoFileId"
              hint="الشعار الرسمي"
              value={logoFileId}
              onFileChange={(id) => setLogoFileId(id || undefined)}
            />
            <ImageUploadInput
              label="الصورة الخلفية"
              name="backgroundFileId"
              hint="علامة مائية للفواتير"
              value={backgroundFileId}
              onFileChange={(id) => setBackgroundFileId(id || undefined)}
            />
            <ImageUploadInput
              label="التوقيع المعتمد"
              name="signatureFileId"
              hint="توقيع المفوض"
              value={signatureFileId}
              onFileChange={(id) => setSignatureFileId(id || undefined)}
            />
          </div>
        </div>

        {/* Section 5: Footer Text */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          <h4 className="text-xs font-bold text-foreground">نص التذييل للفواتير (Footer Text)</h4>
          <div className="flex flex-col gap-1">
            <Input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="مثال: شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا وفق الشروط"
              className="text-xs h-8"
            />
            <span className="text-[11px] text-muted-foreground">
              يظهر كنص تذييل ثابت في أسفل كافة الفواتير وسندات القبض المطبوعة
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span>{isEditing ? "حفظ التعديلات" : "إضافة المنشأة"}</span>
          </Button>
        </div>
      </form>
    </SheetDrawer>
  );
}
