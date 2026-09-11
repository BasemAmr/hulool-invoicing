"use client";

import React, { useState } from "react";
import { Download, Link2, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import {
  generateShareLinkAction,
  generateReceiptShareLinkAction,
} from "@/app/actions/auth";

export interface PdfActionButtonsProps {
  documentId: string;
  type: "invoice" | "receipt";
  downloadUrl: string;
  filename?: string;
  itemTitle?: string;
}

export function PdfActionButtons({
  documentId,
  type,
  downloadUrl,
  filename,
  itemTitle,
}: PdfActionButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCopyLink = async () => {
    try {
      setLoading(true);
      const res =
        type === "invoice"
          ? await generateShareLinkAction(documentId)
          : await generateReceiptShareLinkAction(documentId);

      setLoading(false);

      if (res.error || !res.shareUrl) {
        toast({
          title: "تعذر إنشاء الرابط",
          message: res.error || "يرجى المحاولة مرة أخرى لاحقاً.",
        });
        return;
      }

      const fullUrl = `${window.location.origin}${res.shareUrl}`;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
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
      toast({
        title: "تم نسخ الرابط العام",
        message: `تم نسخ رابط المشاركة الآمن والمشفر لـ ${itemTitle ?? "المستند"} (صالح للمعاينة والتحميل بدون تسجيل دخول).`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setLoading(false);
      toast({
        title: "خطأ",
        message: "حدث خطأ أثناء نسخ الرابط.",
      });
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    if (filename) {
      link.download = filename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="inline-flex items-center gap-0.5">
      {/* 1. Direct Download Icon Button */}
      <button
        type="button"
        onClick={handleDownload}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm"
        title="تحميل ملف PDF مباشرة"
      >
        <Download className="size-3.5" />
      </button>

      {/* 2. Shareable Signed Link Icon Button */}
      <button
        type="button"
        onClick={handleCopyLink}
        disabled={loading}
        className={`p-1 transition-colors rounded-sm ${
          copied
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
            : "text-muted-foreground hover:text-primary hover:bg-muted"
        }`}
        title={
          copied
            ? "تم نسخ الرابط"
            : "نسخ رابط المشاركة العام (صالح بدون تسجيل دخول)"
        }
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Link2 className="size-3.5" />
        )}
      </button>
    </div>
  );
}
