"use client";

import { useActionState } from "react";

import { createCompanyAction, updateCompanyAction } from "@/app/actions/companies";
import { idleState, type ActionState } from "@/app/actions/types";
import type { CompanyRecord } from "@/application/ports/company-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateDefaultCompanyPrefix } from "@/lib/format";

import { ImageUploadInput } from "./image-upload-input";

export function CompanyForm({
  initialCompany,
}: {
  initialCompany?: CompanyRecord;
}) {
  const action = initialCompany ? updateCompanyAction : createCompanyAction;
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(action, idleState);

  return (
    <form action={formAction} className="bg-card border border-border p-5 flex flex-col gap-4 shadow-2xs">
      {initialCompany && (
        <input type="hidden" name="id" value={initialCompany.id} />
      )}

      {state.status === "error" && (
        <p aria-live="polite" className="bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
          {state.message}
        </p>
      )}

      {/* Basic Data */}
      <div className="flex flex-col gap-2.5 border-b border-border pb-3">
        <h3 className="text-xs font-bold text-foreground">البيانات الأساسية</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="اسم المنشأة (عربي) *"
            name="nameAr"
            defaultValue={initialCompany?.nameAr}
            required
          />
          <Field
            label="الاسم (إنجليزي - اختياري)"
            name="nameEn"
            defaultValue={initialCompany?.nameEn ?? ""}
            dir="ltr"
          />
          <Field
            label="الرقم الضريبي (15 رقم) *"
            name="vatNumber"
            defaultValue={initialCompany?.vatNumber}
            placeholder="300000000000003"
            required
            hint="15 رقم يبدأ وينتهي بـ 3"
          />
          <Field
            label="بادئة الترقيم *"
            name="prefix"
            defaultValue={initialCompany?.prefix ?? generateDefaultCompanyPrefix()}
            placeholder="INV"
            required
            hint="2-12 أحرف كبيرة، تظهر في أرقام الفواتير"
          />
          <Field
            label="رقم السجل التجاري (اختياري)"
            name="crNumber"
            defaultValue={initialCompany?.crNumber ?? ""}
            placeholder="1010xxxxxx"
          />
          <Field
            label="تابع للعميل"
            name="clientEmployee"
            defaultValue={initialCompany?.clientEmployee ?? ""}
            placeholder="تابع للعميل"
          />
          <Field
            label="نوع المنشأة"
            name="organizationType"
            defaultValue={initialCompany?.organizationType ?? ""}
          />
        </div>
      </div>

      {/* Contact Info */}
      <div className="flex flex-col gap-2.5 border-b border-border pb-3">
        <h3 className="text-xs font-bold text-foreground">معلومات التواصل (تظهر في الفاتورة)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label="الهاتف / الجوال"
            name="phone"
            defaultValue={initialCompany?.phone ?? ""}
            placeholder="011xxxxxxx"
            type="tel"
          />
          <Field
            label="البريد الإلكتروني"
            name="email"
            defaultValue={initialCompany?.email ?? ""}
            placeholder="info@company.sa"
            type="email"
          />
          <Field
            label="الموقع الإلكتروني"
            name="website"
            defaultValue={initialCompany?.website ?? ""}
            placeholder="www.company.sa"
            type="url"
          />
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-2.5 border-b border-border pb-3">
        <h3 className="text-xs font-bold text-foreground">العنوان الوطني</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label="المدينة"
            name="addressCity"
            defaultValue={initialCompany?.addressCity ?? ""}
            placeholder="الرياض"
          />
          <Field
            label="الحي"
            name="addressDistrict"
            defaultValue={initialCompany?.addressDistrict ?? ""}
            placeholder="الملز"
          />
          <Field
            label="الشارع"
            name="addressStreet"
            defaultValue={initialCompany?.addressStreet ?? ""}
          />
          <Field
            label="رقم المبنى"
            name="addressBuildingNumber"
            defaultValue={initialCompany?.addressBuildingNumber ?? ""}
            placeholder="1234"
          />
          <Field
            label="الرمز البريدي"
            name="addressPostalCode"
            defaultValue={initialCompany?.addressPostalCode ?? ""}
            placeholder="12345"
          />
          <Field
            label="الرقم الإضافي"
            name="addressAdditionalNumber"
            defaultValue={initialCompany?.addressAdditionalNumber ?? ""}
            placeholder="6789"
          />
        </div>
      </div>

      {/* Images & Background */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-bold text-foreground">الصور والخلفية والتوقيع (اختياري)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ImageUploadInput
            label="شعار الشركة"
            name="logoFileId"
            hint="الشعار الرسمي للمنشأة"
            initialFileId={initialCompany?.logoFileId}
          />
          <ImageUploadInput
            label="الصورة الخلفية (علامة مائية)"
            name="backgroundFileId"
            hint="صورة خلفية كاملة للفواتير"
            initialFileId={initialCompany?.backgroundFileId}
          />
          <ImageUploadInput
            label="التوقيع المعتمد"
            name="signatureFileId"
            hint="توقيع المفوض المعتمد"
            initialFileId={initialCompany?.signatureFileId}
          />
        </div>
      </div>

      {/* Footer Text */}
      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        <h3 className="text-xs font-bold text-foreground">نص التذييل للفواتير والسندات (اختياري)</h3>
        <Field
          label="نص التذييل (Footer Text)"
          name="footerText"
          defaultValue={initialCompany?.footerText ?? ""}
          placeholder="مثال: شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا وفق الشروط"
          hint="يظهر أسفل كافة الفواتير وسندات القبض المطبوعة لهذه المنشأة"
        />
      </div>


      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
        <Button type="submit" size="sm" disabled={pending} className="gap-1 text-xs font-semibold">
          {pending
            ? "جارٍ الحفظ..."
            : initialCompany
            ? "حفظ التعديلات"
            : "حفظ المنشأة"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  hint,
  dir,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  dir?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        dir={dir}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

