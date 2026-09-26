"use client";

import { useActionState } from "react";

import { createCustomerAction, updateCustomerAction } from "@/app/actions/customers";
import { idleState, type ActionState } from "@/app/actions/types";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerForm({
  initialCustomer,
}: {
  initialCustomer?: CustomerRecord;
}) {
  const action = initialCustomer ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(action, idleState);

  return (
    <form action={formAction} className="bg-card border border-border p-5 flex flex-col gap-4 shadow-2xs">
      {initialCustomer && (
        <input type="hidden" name="id" value={initialCustomer.id} />
      )}

      {state.status === "error" && (
        <p aria-live="polite" className="bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field
            label="اسم العميل (عربي) *"
            name="nameAr"
            defaultValue={initialCustomer?.nameAr}
            placeholder="شركة المثال للتجارة..."
            required
          />
        </div>

        <div className="sm:col-span-2">
          <Field
            label="الاسم (إنجليزي - اختياري)"
            name="nameEn"
            defaultValue={initialCustomer?.nameEn ?? ""}
            placeholder="Al-Mithal Trading Co."
            dir="ltr"
          />
        </div>

        <Field
          label="الرقم الضريبي (15 رقم) *"
          name="vatNumber"
          defaultValue={initialCustomer?.vatNumber ?? ""}
          placeholder="300000000000003"
          required
        />

        <Field
          label="الرقم الموحد (700) *"
          name="unifiedNumber"
          defaultValue={initialCustomer?.unifiedNumber ?? ""}
          placeholder="7001234567"
          required
        />

        <Field
          label="المدينة *"
          name="addressCity"
          defaultValue={initialCustomer?.addressCity ?? ""}
          placeholder="الرياض"
          required
        />

        <Field
          label="الحي (اختياري)"
          name="addressDistrict"
          defaultValue={initialCustomer?.addressDistrict ?? ""}
          placeholder="الملز"
        />

        <Field
          label="الشارع (اختياري)"
          name="addressStreet"
          defaultValue={initialCustomer?.addressStreet ?? ""}
          placeholder="طريق الملك فهد"
        />

        <Field
          label="رقم المبنى (اختياري)"
          name="addressBuildingNumber"
          defaultValue={initialCustomer?.addressBuildingNumber ?? ""}
          placeholder="1234"
        />

        <Field
          label="الرمز البريدي *"
          name="addressPostalCode"
          defaultValue={initialCustomer?.addressPostalCode ?? ""}
          placeholder="12345"
          required
        />

        <Field
          label="الرقم الإضافي (اختياري)"
          name="addressAdditionalNumber"
          defaultValue={initialCustomer?.addressAdditionalNumber ?? ""}
          placeholder="6789"
        />

        <Field
          label="رقم الجوال (اختياري)"
          name="phone"
          defaultValue={initialCustomer?.phone ?? ""}
          placeholder="05xxxxxxxx"
          type="tel"
        />

        <div className="sm:col-span-2">
          <Field
            label="البريد الإلكتروني (اختياري)"
            name="email"
            defaultValue={initialCustomer?.email ?? ""}
            placeholder="client@example.com"
            type="email"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
        <Button type="submit" size="sm" disabled={pending} className="gap-1 text-xs font-semibold">
          {pending
            ? "جارٍ الحفظ..."
            : initialCustomer
            ? "حفظ التعديلات"
            : "حفظ العميل"}
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
  type?: string;
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

