"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Share2, Copy, Check, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareInvoiceModal } from "@/components/documents/share-invoice-modal";
import { DuplicateInvoiceDialog } from "@/components/documents/duplicate-invoice-dialog";
import { useToast } from "@/components/ui/toaster";
import { generateShareLinkAction } from "@/app/actions/auth";

interface InvoiceDetailClientActionsProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    total: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    companyId?: string;
    customerId?: string;
  };
}

export function InvoiceDetailClientActions({
  invoice,
}: InvoiceDetailClientActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const { success, error } = useToast();
  const editHref = invoice.companyId
    ? `/c/${invoice.companyId}/invoices/${invoice.id}/edit`
    : `/invoices/${invoice.id}/edit`;

  async function handleQuickCopy() {
    const res = await generateShareLinkAction(invoice.id);
    if (res.shareUrl) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const fullUrl = `${origin}${res.shareUrl}`;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(fullUrl);
        } else {
          // Fallback for non-focused or non-HTTPS environments
          const textArea = document.createElement("textarea");
          textArea.value = fullUrl;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        setCopied(true);
        success("تم نسخ رابط الفاتورة الآمن والمشفر (صالح لمدة 7 أيام)", "تم النسخ");
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Direct prompt fallback if clipboard permission was denied
        prompt("انسخ رابط المشاركة التالي:", fullUrl);
      }
    } else {
      error(res.error || "تعذر إنشاء رابط المشاركة", "خطأ");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Link href={editHref}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-center text-xs font-semibold"
          >
            <Edit2 className="size-3.5" />
            <span>تعديل</span>
          </Button>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDuplicateOpen(true)}
          className="w-full gap-2 justify-center text-xs font-semibold"
        >
          <Copy className="size-3.5" />
          <span>تكرار</span>
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShareOpen(true)}
        className="w-full gap-2 justify-center text-xs font-semibold"
      >
        <Share2 className="size-3.5" />
        <span>مشاركة وإرسال (واتساب / بريد)</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleQuickCopy}
        className="w-full gap-2 justify-center text-xs text-muted-foreground hover:text-foreground border border-border/70"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
        <span>{copied ? "تم نسخ الرابط" : "نسخ رابط المشاركة الآمن"}</span>
      </Button>

      <ShareInvoiceModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        invoice={invoice}
      />

      <DuplicateInvoiceDialog
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        invoiceId={invoice.id}
        companyId={invoice.companyId}
        defaultCustomerId={invoice.customerId}
        itemName={invoice.invoiceNumber ?? undefined}
      />
    </div>
  );
}
