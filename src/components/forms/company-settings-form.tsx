"use client";

import React, { useState, useTransition } from "react";
import {
  Globe,
  FileText,
  Save,
  Loader2,
  LayoutTemplate,
  Receipt,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { updateCompanySettingsAction } from "@/app/actions/settings";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import {
  TEMPLATES_LIST,
  getTemplateById,
  getTemplateDisplayName,
  RECEIPT_TEMPLATES_LIST,
  getReceiptTemplateById,
  PARENT_CATEGORY_LABELS,
  groupTemplatesByParentCategory,
} from "@/infrastructure/pdf/templates/registry";
import { TemplateBrowserDrawer } from "@/components/drawers/template-browser-drawer";

export interface CompanySettingsFormProps {
  companyId: string;
  settings: CompanySettingsRecord | null;
}

export function CompanySettingsForm({
  companyId,
  settings,
}: CompanySettingsFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Template Picker State
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>(
    settings?.defaultTemplateId || "simple_red"
  );
  const [defaultReceiptTemplateId, setDefaultReceiptTemplateId] = useState<string>(
    settings?.defaultReceiptTemplateId || "receipt_standard"
  );

  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);

  const activeInvoiceTemplate = getTemplateById(defaultTemplateId);
  const activeReceiptTemplate = getReceiptTemplateById(defaultReceiptTemplateId);

  const numberFormat = settings?.numberFormat ?? "en";
  const dateFormat = settings?.dateFormat ?? "YYYY-MM-DD";
  const currencyCode = settings?.currencyCode ?? "SAR";
  const currencyPosition = settings?.currencyPosition ?? "after";
  const thousandsSeparator = settings?.thousandsSeparator ?? ",";
  const decimalSeparator = settings?.decimalSeparator ?? ".";
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  // WHY toFixed(4) + nullish check (not toString() / truthiness):
  // - DB stores numeric(5,4) ("0.0500"); repo maps with parseFloat → 0.05;
  //   toString() gives "0.05", which matches NO <option value> below, so the
  //   select fell back to the first option (15%) on every reload — the save
  //   worked, but the page displayed the old value ("doesn't persist").
  // - A truthiness check (`rate ? ...`) also breaks 0%: 0 is falsy and would
  //   display "0.1500". The nullish check keeps 0 → "0.0000".
  const defaultVatRate =
    settings?.defaultVatRate != null
      ? settings.defaultVatRate.toFixed(4)
      : "0.1500";
  const paperSize = settings?.paperSize ?? "A4";
  const paperOrientation = settings?.paperOrientation ?? "portrait";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("companyId", companyId);
    formData.set("defaultTemplateId", defaultTemplateId);
    formData.set("defaultReceiptTemplateId", defaultReceiptTemplateId);

    startTransition(async () => {
      const result = await updateCompanySettingsAction({ status: "idle" }, formData);
      if (result.status === "ok") {
        toast({
          title: "تم حفظ الإعدادات",
          message: "تم تحديث إعدادات المنشأة والقوالب بنجاح.",
        });
      } else {
        toast({
          title: "خطأ أثناء الحفظ",
          message:
            result.status === "error"
              ? result.message
              : "فشل حفظ الإعدادات. يرجى التحقق من البيانات.",
        });
      }
    });
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border p-5 flex flex-col gap-5 shadow-2xs"
      >
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="defaultTemplateId" value={defaultTemplateId} />
        <input
          type="hidden"
          name="defaultReceiptTemplateId"
          value={defaultReceiptTemplateId}
        />

        {/* Section 1: Number & Date Formatting */}
        <div className="flex flex-col gap-2.5 border-b border-border pb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Globe className="size-3.5 text-primary" />
            <span>التنسيق الإقليمي والأرقام</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="numberFormat" className="text-xs font-semibold">
                شكل الأرقام
              </label>
              <select
                id="numberFormat"
                name="numberFormat"
                defaultValue={numberFormat}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="en">الأرقام الإنجليزية / الغربية (0123456789)</option>
                <option value="ar">الأرقام العربية الشرقية (٠١٢٣٤٥٦٧٨٩)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="dateFormat" className="text-xs font-semibold">
                تنسيق التاريخ
              </label>
              <select
                id="dateFormat"
                name="dateFormat"
                defaultValue={dateFormat}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-21)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (21/08/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (08/21/2026)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="defaultVatRate" className="text-xs font-semibold">
                نسبة ضريبة القيمة المضافة الافتراضية
              </label>
              <select
                id="defaultVatRate"
                name="defaultVatRate"
                defaultValue={defaultVatRate}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="0.1500">15% (الضريبة القياسية في السعودية)</option>
                <option value="0.0500">5%</option>
                <option value="0.0000">0% (معفاة / صفرية)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Currency & Formatting */}
        <div className="flex flex-col gap-2.5 border-b border-border pb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <span className="text-xs font-bold font-mono text-primary">SAR</span>
            <span>العملة والفواصل المحاسبية</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="currencyCode" className="text-xs font-semibold">
                رمز العملة
              </label>
              <input
                id="currencyCode"
                name="currencyCode"
                type="text"
                defaultValue={currencyCode}
                maxLength={5}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="currencyPosition" className="text-xs font-semibold">
                موضع العملة
              </label>
              <select
                id="currencyPosition"
                name="currencyPosition"
                defaultValue={currencyPosition}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="after">بعد المبلغ (100.00 ر.س)</option>
                <option value="before">قبل المبلغ (ر.س 100.00)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="thousandsSeparator" className="text-xs font-medium text-muted-foreground">
                فاصل الآلاف
              </label>
              <select
                id="thousandsSeparator"
                name="thousandsSeparator"
                defaultValue={thousandsSeparator}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value=",">فاصلة عادية ( , ) مثل 1,000</option>
                <option value=" ">مسافة ( ) مثل 1 000</option>
                <option value=".">نقطة ( . ) مثل 1.000</option>
                <option value="">بدون فاصل</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="decimalSeparator" className="text-xs font-medium text-muted-foreground">
                الفاصلة العشرية
              </label>
              <select
                id="decimalSeparator"
                name="decimalSeparator"
                defaultValue={decimalSeparator}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value=".">نقطة ( . ) مثل 10.50</option>
                <option value=",">فاصلة ( , ) مثل 10,50</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="decimalPlaces" className="text-xs font-medium text-muted-foreground">
                عدد المنازل العشرية
              </label>
              <select
                id="decimalPlaces"
                name="decimalPlaces"
                // WHY String(): option values serialize to "2"/"0"/"3" in
                // the DOM; a numeric defaultValue risks matching nothing and
                // falling back to the first option (same class of bug as VAT).
                defaultValue={String(decimalPlaces)}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value={2}>منزلتان (0.00)</option>
                <option value={0}>بدون كسور (0)</option>
                <option value={3}>3 منازل (0.000)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: PDF Document Output & Interactive Template Pickers */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <FileText className="size-3.5 text-primary" />
            <span>تصدير مستندات PDF وقوالب الطباعة</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="paperSize" className="text-xs font-semibold">
                حجم الورقة
              </label>
              <select
                id="paperSize"
                name="paperSize"
                defaultValue={paperSize}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="A4">A4 (القياسي المعتمد)</option>
                <option value="Letter">Letter (أمريكي)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="paperOrientation" className="text-xs font-semibold">
                اتجاه الورقة
              </label>
              <select
                id="paperOrientation"
                name="paperOrientation"
                defaultValue={paperOrientation}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="portrait">عمودي (Portrait)</option>
                <option value="landscape">أفقي (Landscape)</option>
              </select>
            </div>
          </div>

          {/* ─── 1. Default Invoice Template with Template Picker ─── */}
          <div className="p-3 bg-muted/20 border border-border rounded-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LayoutTemplate className="size-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  قالب الفاتورة الافتراضي (Default Invoice Template)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                يُعتمد تلقائياً عند إنشاء الفواتير
              </span>
            </div>

            {/* Template Card & Picker Trigger */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-background border border-border">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-6 rounded-xs shrink-0 border border-black/15 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: activeInvoiceTemplate.primaryColor }}
                >
                  <CheckCircle2 className="size-3.5" />
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {/* Picker selected-value: Arabic-only label, no English "(...)" suffix */}
                    <span className="text-xs font-bold text-foreground">
                      {getTemplateDisplayName(activeInvoiceTemplate)}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                        activeInvoiceTemplate.parentCategory === "company_chosen"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                          : "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-700"
                      }`}
                    >
                      {PARENT_CATEGORY_LABELS[activeInvoiceTemplate.parentCategory]?.badgeAr}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {activeInvoiceTemplate.descriptionAr}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={defaultTemplateId}
                  onChange={(e) => setDefaultTemplateId(e.target.value)}
                  className="h-7.5 px-2 text-xs bg-muted/40 border border-input text-foreground font-medium focus:outline-none"
                >
                  {groupTemplatesByParentCategory(TEMPLATES_LIST).companyChosen.length > 0 && (
                    <optgroup label={PARENT_CATEGORY_LABELS.company_chosen.ar}>
                      {groupTemplatesByParentCategory(TEMPLATES_LIST).companyChosen.map((t) => (
                        <option key={t.id} value={t.id}>
                          ★ {getTemplateDisplayName(t)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={PARENT_CATEGORY_LABELS.system_default.ar}>
                    {groupTemplatesByParentCategory(TEMPLATES_LIST).systemDefault.map((t) => (
                      <option key={t.id} value={t.id}>
                        {getTemplateDisplayName(t)}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicePickerOpen(true)}
                  className="h-7.5 gap-1.5 text-xs font-semibold px-2.5 bg-primary/5 hover:bg-primary/10 text-primary border-primary/30"
                >
                  <Eye className="size-3" />
                  <span>معاينة واختيار القالب</span>
                </Button>
              </div>
            </div>
          </div>

          {/* ─── 2. Default Receipt Voucher Template with Template Picker ─── */}
          <div className="p-3 bg-muted/20 border border-border rounded-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Receipt className="size-4 text-emerald-600" />
                <span className="text-xs font-bold text-foreground">
                  قالب سند القبض الافتراضي (Default Receipt Voucher Template)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                يُعتمد تلقائياً عند إصدار سندات القبض
              </span>
            </div>

            {/* Receipt Template Card & Picker Trigger */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-background border border-border">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-6 rounded-xs shrink-0 border border-black/15 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: activeReceiptTemplate.primaryColor }}
                >
                  <CheckCircle2 className="size-3.5" />
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {/* Picker selected-value: Arabic-only label, no English "(...)" suffix */}
                    <span className="text-xs font-bold text-foreground">
                      {getTemplateDisplayName(activeReceiptTemplate)}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                        activeReceiptTemplate.parentCategory === "company_chosen"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                          : "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
                      }`}
                    >
                      {PARENT_CATEGORY_LABELS[activeReceiptTemplate.parentCategory]?.badgeAr}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {activeReceiptTemplate.descriptionAr}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={defaultReceiptTemplateId}
                  onChange={(e) => setDefaultReceiptTemplateId(e.target.value)}
                  className="h-7.5 px-2 text-xs bg-muted/40 border border-input text-foreground font-medium focus:outline-none"
                >
                  {groupTemplatesByParentCategory(RECEIPT_TEMPLATES_LIST).companyChosen.length > 0 && (
                    <optgroup label={PARENT_CATEGORY_LABELS.company_chosen.ar}>
                      {groupTemplatesByParentCategory(RECEIPT_TEMPLATES_LIST).companyChosen.map((t) => (
                        <option key={t.id} value={t.id}>
                          ★ {getTemplateDisplayName(t)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={PARENT_CATEGORY_LABELS.system_default.ar}>
                    {groupTemplatesByParentCategory(RECEIPT_TEMPLATES_LIST).systemDefault.map((t) => (
                      <option key={t.id} value={t.id}>
                        {getTemplateDisplayName(t)}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptPickerOpen(true)}
                  className="h-7.5 gap-1.5 text-xs font-semibold px-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                >
                  <Eye className="size-3" />
                  <span>معاينة واختيار قالب السند</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="gap-1.5 text-xs font-semibold px-5 h-8"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>{isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</span>
          </Button>
        </div>
      </form>

      {/* Invoice Template Browser Drawer */}
      <TemplateBrowserDrawer
        open={invoicePickerOpen}
        onClose={() => setInvoicePickerOpen(false)}
        selectedTemplateId={defaultTemplateId}
        onSelectTemplate={(tid) => setDefaultTemplateId(tid)}
        companyId={companyId}
        mode="invoice"
      />

      {/* Receipt Template Browser Drawer */}
      <TemplateBrowserDrawer
        open={receiptPickerOpen}
        onClose={() => setReceiptPickerOpen(false)}
        selectedTemplateId={defaultReceiptTemplateId}
        onSelectTemplate={(tid) => setDefaultReceiptTemplateId(tid)}
        companyId={companyId}
        mode="receipt"
      />
    </>
  );
}
