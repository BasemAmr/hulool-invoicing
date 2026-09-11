"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { updateSavedProductAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/app/actions/types";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

const idleState: ActionState = { status: "idle" };

export function EditProductForm({ product }: { product: SavedProductRecord }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await updateSavedProductAction(prevState, formData);
      if (result.status === "ok") {
        router.push("/products");
      }
      return result;
    },
    idleState
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Link href="/products">
          <Button variant="ghost" size="xs" className="gap-1 text-xs">
            <ArrowRight className="size-3.5" />
            <span>المنتجات</span>
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-bold text-foreground">تعديل: {product.nameAr}</h1>
      </div>

      <form action={formAction} className="bg-card border border-border p-5 flex flex-col gap-4 shadow-2xs">
        <input type="hidden" name="id" value={product.id} />

        {state.status === "error" && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {state.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold">
              اسم البند / الخدمة (بالعربية) <span className="text-destructive">*</span>
            </label>
            <Input
              name="nameAr"
              defaultValue={product.nameAr}
              required
              className="text-xs h-8"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">الاسم بالإنجليزية (اختياري)</label>
            <Input
              name="nameEn"
              defaultValue={product.nameEn ?? ""}
              dir="ltr"
              className="text-xs h-8"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">الوصف الافتراضي للبند</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={product.description ?? ""}
              className="border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">السعر الافتراضي للوحدة (ر.س)</label>
            <Input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.unitPrice !== null ? (product.unitPrice / 100).toFixed(2) : ""}
              className="text-xs font-mono h-8"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">نسبة ضريبة القيمة المضافة</label>
            <select
              name="vatRate"
              defaultValue={product.vatRate.toFixed(2)}
              className="border border-border bg-background px-2.5 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="0.15">15% (النسبة الأساسية)</option>
              <option value="0.00">0% (معفى أو خاضع للصفر)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 pt-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={product.isActive}
              id="isActive"
              className="size-4 text-primary"
            />
            <label htmlFor="isActive" className="text-xs font-medium cursor-pointer">
              البند نشط ومتاح في قائمة اختيار الفواتير
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Link href="/products">
            <Button variant="outline" size="sm" type="button" className="text-xs">
              إلغاء
            </Button>
          </Link>
          <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 text-xs font-semibold">
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>حفظ التعديلات</span>
          </Button>
        </div>
      </form>
    </div>
  );
}