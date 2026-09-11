import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings, Save, Building2, Globe, FileText } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { Button } from "@/components/ui/button";
import type { CompanyId } from "@/domain/branding";
import { updateCompanySettingsAction } from "@/app/actions/settings";
import { TEMPLATES_LIST } from "@/infrastructure/pdf/templates/registry";

const container = createContainer(db);

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await container.companyRepository.findById(companyId as CompanyId);
  if (!company) notFound();

  const settings = await container.companySettingsRepository.getByCompanyId(companyId);

  const numberFormat = settings?.numberFormat ?? "en";
  const dateFormat = settings?.dateFormat ?? "YYYY-MM-DD";
  const currencyCode = settings?.currencyCode ?? "SAR";
  const currencyPosition = settings?.currencyPosition ?? "after";
  const thousandsSeparator = settings?.thousandsSeparator ?? ",";
  const decimalSeparator = settings?.decimalSeparator ?? ".";
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const defaultVatRate = settings?.defaultVatRate ? settings.defaultVatRate.toString() : "0.1500";
  const paperSize = settings?.paperSize ?? "A4";
  const paperOrientation = settings?.paperOrientation ?? "portrait";
  const defaultTemplateId = settings?.defaultTemplateId ?? "simple_red";

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            إعدادات المنشأة — {company.nameAr}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تخصيص تنسيقات الأرقام، التواريخ، العملة، وإخراج مستندات PDF
          </p>
        </div>
        <Link href={`/companies/${companyId}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Building2 className="size-3.5" />
            <span>تعديل السجل والشعار والختم</span>
          </Button>
        </Link>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateCompanySettingsAction({ status: "idle" }, formData);
        }}
        className="bg-card border border-border p-5 flex flex-col gap-5 shadow-2xs"
      >
        <input type="hidden" name="companyId" value={companyId} />

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
          </div>
        </div>

        {/* Section 2: Currency & Separators */}
        <div className="flex flex-col gap-2.5 border-b border-border pb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Settings className="size-3.5 text-primary" />
            <span>العملة والفواصل والضريبة</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="currencyCode" className="text-xs font-semibold">
                رمز العملة
              </label>
              <input
                id="currencyCode"
                name="currencyCode"
                defaultValue={currencyCode}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="currencyPosition" className="text-xs font-semibold">
                موضع رمز العملة
              </label>
              <select
                id="currencyPosition"
                name="currencyPosition"
                defaultValue={currencyPosition}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="after">بعد المبلغ (100.00 SAR)</option>
                <option value="before">قبل المبلغ (SAR 100.00)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="defaultVatRate" className="text-xs font-semibold">
                نسبة الضريبة الافتراضية
              </label>
              <select
                id="defaultVatRate"
                name="defaultVatRate"
                defaultValue={defaultVatRate}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value="0.1500">15% (النسبة الأساسية)</option>
                <option value="0.0000">0% (معفى / خاضع للصفر)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="thousandsSeparator" className="text-xs font-medium text-muted-foreground">
                فاصل الآلاف
              </label>
              <input
                id="thousandsSeparator"
                name="thousandsSeparator"
                defaultValue={thousandsSeparator}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="decimalSeparator" className="text-xs font-medium text-muted-foreground">
                العلامة العشرية
              </label>
              <input
                id="decimalSeparator"
                name="decimalSeparator"
                defaultValue={decimalSeparator}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="decimalPlaces" className="text-xs font-medium text-muted-foreground">
                عدد المنازل العشرية
              </label>
              <select
                id="decimalPlaces"
                name="decimalPlaces"
                defaultValue={decimalPlaces}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground focus:outline-none"
              >
                <option value={2}>منزلتان (0.00)</option>
                <option value={0}>بدون كسور (0)</option>
                <option value={3}>3 منازل (0.000)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: PDF Document Output */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <FileText className="size-3.5 text-primary" />
            <span>تصدير مستندات PDF</span>
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

            {/* Default PDF Template */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="defaultTemplateId" className="text-xs font-semibold flex items-center justify-between">
                <span>قالب الفاتورة الافتراضي (Default PDF Template)</span>
                <span className="text-[10px] text-muted-foreground">يُستخدم تلقائياً عند إنشاء الفواتير الجديدة</span>
              </label>
              <select
                id="defaultTemplateId"
                name="defaultTemplateId"
                defaultValue={defaultTemplateId}
                className="w-full px-2.5 h-8 text-xs border border-border bg-background text-foreground font-medium focus:outline-none"
              >
                {TEMPLATES_LIST.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} ({t.nameEn})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="submit" size="sm" className="gap-1.5 text-xs font-semibold">
            <Save className="size-3.5" />
            <span>حفظ الإعدادات</span>
          </Button>
        </div>
      </form>
    </div>
  );
}