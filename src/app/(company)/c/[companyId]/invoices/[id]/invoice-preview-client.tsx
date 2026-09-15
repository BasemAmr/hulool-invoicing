"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  Receipt,
  Edit2,
  Settings,
  Printer,
  Mail,
  Search,
  Copy,
  Calendar,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
import { IssueInvoiceButton } from "@/components/forms/issue-invoice-button";
import { DeleteConfirmDialog } from "@/components/documents/delete-confirm-dialog";
import { DuplicateInvoiceDialog } from "@/components/documents/duplicate-invoice-dialog";
import { CustomerDrawer } from "@/components/drawers/customer-drawer";
import { TemplateBrowserDrawer } from "@/components/drawers/template-browser-drawer";
import { getTemplateById } from "@/infrastructure/pdf/templates/registry";
import { formatIsoDate, formatMoney } from "@/lib/format";
import { useToast } from "@/components/ui/toaster";
import {
  deleteDraftInvoiceAction,
  updateInvoiceTemplateAction,
} from "@/app/actions/invoices";
import { asCustomerId } from "@/domain/branding";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { ReceiptVoucherRecord } from "@/application/ports/receipt-voucher-repository";

export interface InvoicePreviewClientProps {
  companyId: string;
  invoice: InvoiceDto;
  company: CompanyRecord;
  initialCustomer: CustomerRecord;
  receiptVoucher: ReceiptVoucherRecord | null;
  qrDataUrl: string | null;
}

export function InvoicePreviewClient({
  companyId,
  invoice,
  company,
  initialCustomer,
  receiptVoucher,
  qrDataUrl,
}: InvoicePreviewClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerRecord>(initialCustomer);
  const [templateId, setTemplateId] = useState<string>(
    invoice.templateId || "simple_red"
  );
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cPath = `/c/${companyId}`;
  const pdfPreviewUrl = `/api/documents/${invoice.id}/pdf?preview=true&template=${templateId}${
    refreshKey > 0 ? `&t=${refreshKey}` : ""
  }`;
  const pdfDownloadUrl = `/api/documents/${invoice.id}/pdf?download=true&template=${templateId}`;

  const activeTemplateDef = getTemplateById(templateId);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = pdfDownloadUrl;
    link.download = `فاتورة ضريبية رقم ${invoice.invoiceNumber ?? invoice.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReceipt = () => {
    if (!receiptVoucher) return;
    const link = document.createElement("a");
    link.href = `/api/documents/receipts/${receiptVoucher.id}/pdf?download=true`;
    link.download = `سند القبض فاتورة رقم ${invoice.invoiceNumber ?? receiptVoucher.voucherNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEmail = () => {
    if (customer.email) {
      window.location.href = `mailto:${customer.email}?subject=فاتورة ${invoice.invoiceNumber || ""}&body=مرفق لكم الفاتورة الخاصة بكم`;
    } else {
      toast({
        title: "البريد غير متوفر",
        message: "العميل الحالي لا يملك بريداً إلكترونياً مسجلاً.",
      });
    }
  };

  const handleCopyInvoice = () => {
    // Open the duplicate dialog (client + date, defaults: same client/today);
    // confirming navigates to the create page prefilled with this invoice.
    setDuplicateOpen(true);
    setGearOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 max-w-7xl mx-auto">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Link href={`${cPath}/invoices`}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="size-3" />
              <span>قائمة الفواتير</span>
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-mono font-bold text-foreground">
            {invoice.invoiceNumber ?? "فاتورة جديدة"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} />
          {/* Every invoice is published and fully editable/deletable. */}
          <Link href={`${cPath}/invoices/${invoice.id}/edit`}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs font-semibold"
            >
              <Edit2 className="size-3" />
              <span>تعديل الفاتورة</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateOpen(true)}
            className="h-7 gap-1.5 text-xs font-semibold"
          >
            <Copy className="size-3" />
            <span>تكرار</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="h-7 gap-1.5 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3" />
            <span>حذف</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* ─── SIDE PANEL (Compact Metadata, Actions & Customer Card) ──── */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          {/* Metadata & Actions Card */}
          <div className="bg-card border border-border p-3 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-mono font-bold text-xs text-foreground">
                {invoice.invoiceNumber ?? "بانتظار الترقيم"}
              </span>
              <span className="text-xs font-bold text-primary font-mono">
                {formatMoney(invoice.total)} SAR
              </span>
            </div>

            {/* Timestamps */}
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground border-b border-border pb-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3 text-muted-foreground" />
                  <span>تاريخ الإصدار:</span>
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatIsoDate(invoice.issueDate)}
                  {/* Wall-time beside the date (HH:MM Riyadh); tables/lists keep date-only. */}
                  <span className="text-muted-foreground"> · {invoice.issueTime ?? "00:00"}</span>
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>تاريخ الاستحقاق:</span>
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {formatIsoDate(invoice.dueDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Sleek Button Group Actions */}
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <div className="inline-flex items-center rounded-sm border border-border bg-muted/20 p-0.5 divide-x divide-border/60">
                {/* 1. Template Magnifier */}
                <button
                  type="button"
                  onClick={() => setTemplateDrawerOpen(true)}
                  className="p-1 text-primary hover:bg-primary/10 transition-colors"
                  title="استعراض وتغيير القالب"
                >
                  <Search className="size-3.5" />
                </button>

                {/* 2. Print */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="طباعة الفاتورة"
                >
                  <Printer className="size-3.5" />
                </button>

                {/* 3. Download PDF Direct */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="تحميل ملف PDF مباشرة"
                >
                  <Download className="size-3.5" />
                </button>

                {/* 4. Email */}
                <button
                  type="button"
                  onClick={handleEmail}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="إرسال بريد"
                >
                  <Mail className="size-3.5" />
                </button>

                {/* 5. Settings Gear */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGearOpen((p) => !p)}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="خيارات إضافية"
                  >
                    <Settings className="size-3.5" />
                  </button>

                  {gearOpen && (
                    <div className="absolute top-8 left-0 w-48 bg-popover border border-border shadow-md z-30 flex flex-col p-1 text-xs">
                      <button
                        type="button"
                        onClick={handleCopyInvoice}
                        className="flex items-center gap-2 p-2 hover:bg-muted text-start text-foreground"
                      >
                        <Copy className="size-3.5" />
                        <span>تكرار الفاتورة...</span>
                      </button>
                      <Link
                        href={`${cPath}/invoices/${invoice.id}/edit`}
                        className="flex items-center gap-2 p-2 hover:bg-muted text-start text-foreground border-t border-border"
                      >
                        <Edit2 className="size-3.5" />
                        <span>تعديل الفاتورة</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setGearOpen(false);
                          setDeleteOpen(true);
                        }}
                        className="flex items-center gap-2 p-2 hover:bg-destructive/10 text-start text-destructive border-t border-border"
                      >
                        <Trash2 className="size-3.5" />
                        <span>حذف الفاتورة</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Label Badge */}
              <button
                type="button"
                onClick={() => setTemplateDrawerOpen(true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {activeTemplateDef.nameAr}
              </button>
            </div>

            {/* Direct Download Buttons */}
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                onClick={handleDownloadPdf}
                variant="outline"
                size="sm"
                className="w-full gap-1.5 justify-center text-xs font-semibold h-7"
              >
                <Download className="size-3.5" />
                <span>تحميل الفاتورة PDF مباشرة</span>
              </Button>

              {receiptVoucher && (
                <Button
                  type="button"
                  onClick={handleDownloadReceipt}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 justify-center text-xs font-semibold h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Receipt className="size-3.5" />
                  <span>تحميل سند القبض PDF مباشرة</span>
                </Button>
              )}
            </div>

            {/* Legacy drafts (created before always-published) can still be issued. */}
            {invoice.status === "draft" && (
              <div className="pt-0.5">
                <IssueInvoiceButton invoiceId={invoice.id} />
              </div>
            )}

            <DuplicateInvoiceDialog
              open={duplicateOpen}
              onClose={() => setDuplicateOpen(false)}
              invoiceId={invoice.id}
              companyId={companyId}
              defaultCustomerId={invoice.customerId}
              itemName={invoice.invoiceNumber ?? undefined}
            />

            <DeleteConfirmDialog
              open={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              title="تأكيد حذف الفاتورة"
              description="هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ سيتم حذف سند القبض المرتبط بها أيضاً."
              itemName={invoice.invoiceNumber ?? `فاتورة #${invoice.id.slice(0, 8)}`}
              onConfirm={() => deleteDraftInvoiceAction(invoice.id, companyId)}
              onSuccess={() => router.push(`${cPath}/invoices`)}
            />
          </div>

          {/* Client Details Card with Quick Action Pen Icon */}
          <div className="bg-card border border-border p-3 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-xs font-bold text-foreground">
                بيانات العميل (المشتري)
              </span>
              <button
                type="button"
                onClick={() => setCustomerDrawerOpen(true)}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                title="تعديل بيانات العميل فوراً"
              >
                <Edit2 className="size-3" />
                <span>تعديل</span>
              </button>
            </div>

            <div className="flex flex-col gap-0.5 text-xs text-start">
              <span className="font-bold text-foreground text-xs">
                {customer.nameAr}
              </span>
              {customer.nameEn && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {customer.nameEn}
                </span>
              )}
              {customer.vatNumber && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  الرقم الضريبي: {customer.vatNumber}
                </span>
              )}
              {customer.unifiedNumber && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  الرقم الموحد: {customer.unifiedNumber}
                </span>
              )}
              {customer.phone && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  الهاتف: {customer.phone}
                </span>
              )}
              {customer.addressCity && (
                <span className="text-[10px] text-muted-foreground">
                  المدينة: {customer.addressCity}
                </span>
              )}
            </div>
          </div>

          {/* ZATCA QR Code Preview (if issued) */}
          {qrDataUrl && (
            <div className="bg-card border border-border p-3 flex flex-col items-center gap-1.5 text-center shadow-2xs">
              <span className="text-[10px] font-semibold text-muted-foreground">
                رمز الاستجابة السريعة (ZATCA QR)
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="ZATCA QR Code"
                className="size-28 border border-border p-1 bg-white"
              />
              <span className="text-[9px] text-muted-foreground">
                معتمد ومطابق لاشتراطات هيئة الزكاة والضريبة والجمارك
              </span>
            </div>
          )}
        </div>

        {/* ─── MAIN COLUMN: EXACT PDF TEMPLATE LIVE PREVIEW ─────────────── */}
        <div className="lg:col-span-8 bg-card border border-border shadow-xs flex flex-col overflow-hidden min-h-[750px]">
          <div className="flex items-center justify-between p-2 bg-muted/40 border-b border-border text-xs">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: activeTemplateDef.primaryColor }}
              />
              <span className="font-bold text-foreground text-xs">
                معاينة حية: {activeTemplateDef.nameAr}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({activeTemplateDef.nameEn})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setTemplateDrawerOpen(true)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Search className="size-3" />
              <span>تغيير القالب</span>
            </button>
          </div>

          {/* Embedded Live PDF Document Iframe */}
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-2 sm:p-3">
            <iframe
              src={pdfPreviewUrl}
              title={`Invoice Preview ${invoice.invoiceNumber ?? "Draft"}`}
              className="w-full h-[750px] border border-border bg-white shadow-md"
            />
          </div>
        </div>
      </div>

      {/* ─── DRAWERS ─────────────────────────────────────────────────── */}
      <CustomerDrawer
        open={customerDrawerOpen}
        onClose={() => setCustomerDrawerOpen(false)}
        customer={customer}
        onSaved={(updatedCustomer) => {
          setCustomer((prev) => ({
            ...prev,
            ...updatedCustomer,
            id: asCustomerId(updatedCustomer.id),
            nameAr: updatedCustomer.nameAr,
            phone: updatedCustomer.phone ?? prev.phone,
            vatNumber: updatedCustomer.vatNumber ?? prev.vatNumber,
            addressCity: updatedCustomer.addressCity ?? prev.addressCity,
          }));
          setRefreshKey(Date.now()); // Trigger smooth PDF refresh
          toast({
            title: "تم تحديث العميل",
            message: `تم تحديث بيانات "${updatedCustomer.nameAr}" وانعكاسها على الفاتورة.`,
          });
        }}
      />

      <TemplateBrowserDrawer
        open={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        selectedTemplateId={templateId}
        companyId={companyId}
        invoiceId={invoice.id}
        onSelectTemplate={async (newTemplateId) => {
          if (newTemplateId === templateId) return;
          const previousTemplateId = templateId;
          // Optimistic preview while the choice is persisted.
          setTemplateId(newTemplateId);
          setRefreshKey(Date.now());
          const result = await updateInvoiceTemplateAction(
            invoice.id,
            newTemplateId,
            companyId,
          );
          if (result.status === "error") {
            setTemplateId(previousTemplateId);
            setRefreshKey(Date.now());
            toast({
              title: "تعذر حفظ القالب",
              message: result.message,
            });
          } else {
            router.refresh();
            toast({
              title: "تم حفظ القالب",
              message: `تم اعتماد قالب "${getTemplateById(newTemplateId).nameAr}" وحفظه لهذه الفاتورة.`,
            });
          }
        }}
      />
    </div>
  );
}
