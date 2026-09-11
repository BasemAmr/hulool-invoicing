"use client";

import React, { useState, useEffect } from "react";
import { PackagePlus, PackageCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetDrawer } from "./sheet-drawer";
import { createSavedProductDirectAction, updateSavedProductDirectAction } from "@/app/actions/products";
import { useToast } from "@/components/ui/toaster";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

export interface ProductDrawerProps {
  open: boolean;
  onClose: () => void;
  product?: SavedProductRecord | null;
  onSaved?: (product: { id: string; nameAr: string; unitPrice: number | null; vatRate: number; description: string | null }) => void;
}

export function ProductDrawer({
  open,
  onClose,
  product,
  onSaved,
}: ProductDrawerProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = Boolean(product?.id);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [vatRate, setVatRate] = useState("0.15");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (product) {
        setNameAr(product.nameAr ?? "");
        setNameEn(product.nameEn ?? "");
        setDescription(product.description ?? "");
        setUnitPrice(product.unitPrice !== null ? (product.unitPrice / 100).toFixed(2) : "");
        setVatRate(product.vatRate ? product.vatRate.toFixed(2) : "0.15");
        setIsActive(product.isActive ?? true);
      } else {
        setNameAr("");
        setNameEn("");
        setDescription("");
        setUnitPrice("");
        setVatRate("0.15");
        setIsActive(true);
      }
    }
  }, [open, product]);

  async function handleSave() {
    const trimmedNameAr = nameAr.trim();
    if (!trimmedNameAr) {
      setErrorMessage("اسم البند أو الخدمة مطلوب");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const priceHalalas = unitPrice.trim() ? Math.round(parseFloat(unitPrice.trim()) * 100) : undefined;
    const rateNum = parseFloat(vatRate) || 0.15;

    try {
      if (isEdit && product?.id) {
        const res = await updateSavedProductDirectAction({
          id: product.id,
          nameAr: trimmedNameAr,
          nameEn: nameEn.trim() || undefined,
          description: description.trim() || undefined,
          unitPrice: priceHalalas,
          vatRate: rateNum,
          isActive,
        });

        if (res.status === "success") {
          success(`تم تحديث بيانات البند "${trimmedNameAr}" بنجاح`, "تم الحفظ");
          onSaved?.({
            id: product.id,
            nameAr: trimmedNameAr,
            unitPrice: priceHalalas ?? null,
            vatRate: rateNum,
            description: description.trim() || null,
          });
          onClose();
        } else {
          setErrorMessage(res.message);
          error(res.message, "خطأ في التحديث");
        }
      } else {
        const res = await createSavedProductDirectAction({
          nameAr: trimmedNameAr,
          nameEn: nameEn.trim() || undefined,
          description: description.trim() || undefined,
          unitPrice: priceHalalas,
          vatRate: rateNum,
          isActive,
        });

        if (res.status === "success") {
          success(`تمت إضافة البند "${trimmedNameAr}" بنجاح`, "تم الحفظ في الدليل");
          onSaved?.(res.product);
          onClose();
        } else {
          setErrorMessage(res.message);
          error(res.message, "خطأ في الحفظ");
        }
      }
    } catch {
      setErrorMessage("حدث خطأ أثناء حفظ البند");
      error("حدث خطأ غير متوقع", "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SheetDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "تعديل بند / منتج" : "إضافة بند أو منتج جديد"}
      description={isEdit ? "تعديل بيانات البند في الدليل العام" : "إضافة بند أو خدمة جديدة للدليل العام المشترك"}
      icon={isEdit ? <PackageCheck className="size-4" /> : <PackagePlus className="size-4" />}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs">
            إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5 text-xs font-semibold">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isEdit ? "حفظ التعديلات" : "حفظ في الدليل"}</span>
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
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-semibold">
              اسم البند / الخدمة (بالعربية) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: استشارات تقنية، توريد أجهزة..."
              className="text-xs h-8"
              required
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">الاسم بالإنجليزية (اختياري)</Label>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. IT Consulting"
              dir="ltr"
              className="text-xs h-8"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">الوصف الافتراضي للبند</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="وصف تفصيلي اختياري يظهر تلقائياً في الفاتورة..."
              className="border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">السعر الافتراضي للوحدة (ر.س)</Label>
            <Input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="text-xs font-mono h-8"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">نسبة الضريبة</Label>
            <select
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="border border-border bg-background px-2.5 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="0.15">15% (النسبة الأساسية)</option>
              <option value="0.00">0% (معفى / خاضع للصفر)</option>
            </select>
          </div>

          {isEdit && (
            <div className="flex items-center gap-2 sm:col-span-2 pt-2">
              <input
                type="checkbox"
                id="drawerProductActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 text-primary"
              />
              <Label htmlFor="drawerProductActive" className="text-xs font-medium cursor-pointer">
                البند نشط ومتاح في قائمة اختيار الفواتير
              </Label>
            </div>
          )}
        </div>
      </div>
    </SheetDrawer>
  );
}
