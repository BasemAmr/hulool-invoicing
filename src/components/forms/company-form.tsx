"use client";

import { useActionState } from "react";

import { createCompanyAction } from "@/app/actions/companies";
import { idleState, type ActionState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanyForm() {
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(createCompanyAction, idleState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field label="الاسم (عربي) *" name="nameAr" placeholder="شركة المثال" required />
      <Field label="الاسم (إنجليزي)" name="nameEn" placeholder="Example Co." />
      <Field label="الرقم الضريبي *" name="vatNumber" placeholder="3xxxxxxxxxxxxxx" required hint="15 رقم تبدأ بـ 3" />
      <Field label="بادئة الترقيم *" name="prefix" placeholder="EXA" required hint="2-6 أحرف كبيرة، تُستخدم في أرقام الفواتير" />
      <Field label="السجل التجاري" name="crNumber" />
      <Field label="المدينة" name="addressCity" />
      <Field label="الحي" name="addressDistrict" />
      <Field label="الشارع" name="addressStreet" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="رقم المبنى" name="addressBuildingNumber" />
        <Field label="الرمز البريدي" name="addressPostalCode" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="الرقم الإضافي" name="addressAdditionalNumber" />
      </div>

      {state.status === "error" && (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ الشركة"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} required={required} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
