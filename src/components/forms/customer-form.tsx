"use client";

import { useActionState } from "react";

import { createCustomerAction } from "@/app/actions/customers";
import { idleState, type ActionState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerForm() {
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(createCustomerAction, idleState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field label="الاسم (عربي) *" name="nameAr" placeholder="عميل المثال" required />
      <Field label="الاسم (إنجليزي)" name="nameEn" />
      <Field label="الرقم الضريبي" name="vatNumber" hint="إذا كان العميل مسجلاً ضريبياً" />
      <Field label="الجوال" name="phone" placeholder="05xxxxxxxx" />
      <Field label="البريد الإلكتروني" name="email" type="email" />
      <Field label="المدينة" name="addressCity" />
      <Field label="الشارع" name="addressStreet" />

      {state.status === "error" && (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ العميل"}
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
  type = "text",
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
