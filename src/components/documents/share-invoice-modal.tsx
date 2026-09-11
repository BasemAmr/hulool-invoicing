"use client";

import React, { useState } from "react";
import { MessageCircle, Mail, Copy, Check, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

import { generateShareLinkAction } from "@/app/actions/auth";

interface ShareInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    total: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
  };
}

export function ShareInvoiceModal({
  open,
  onClose,
  invoice,
}: ShareInvoiceModalProps) {
  const { success, info, error } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<"none" | "whatsapp" | "email">("none");
  const [copied, setCopied] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [sharePath, setSharePath] = useState<string>("");
  const [pdfPath, setPdfPath] = useState<string>("");

  React.useEffect(() => {
    if (open && invoice.id) {
      setLoadingLink(true);
      generateShareLinkAction(invoice.id).then((res) => {
        setLoadingLink(false);
        if (res.shareUrl && res.pdfUrl) {
          setSharePath(res.shareUrl);
          setPdfPath(res.pdfUrl);
        } else if (res.error) {
          error(res.error, "تنبيه");
        }
      });
    }
  }, [open, invoice.id]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicShareUrl = sharePath ? `${origin}${sharePath}` : "";
  const publicPdfUrl = pdfPath ? `${origin}${pdfPath}` : "";

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم ${invoice.customerName}،\nمرفق فاتورتكم رقم ${invoice.invoiceNumber || ""} بقيمة إجمالية ${invoice.total} ر.س.\nيمكنكم معاينة وتحميل الفاتورة مباشرة عبر الرابط المعتمد:\n${publicShareUrl}`
  );

  const cleanPhone = (invoice.customerPhone || "").replace(/[^0-9]/g, "");
  // Saudi phone format helper: 05xxxx -> 9665xxxx
  const formattedPhone = cleanPhone.startsWith("05")
    ? `966${cleanPhone.slice(1)}`
    : cleanPhone.startsWith("5")
    ? `966${cleanPhone}`
    : cleanPhone;

  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${whatsappMessage}`;

  const emailSubject = encodeURIComponent(`فاتورة ضريبية رقم ${invoice.invoiceNumber || invoice.id}`);
  const emailBody = encodeURIComponent(
    `عزيزي العميل ${invoice.customerName}،\n\nتجدون مرفقاً الفاتورة الضريبية الصادرة لكم:\n- رقم الفاتورة: ${invoice.invoiceNumber || "—"}\n- المبلغ الإجمالي: ${invoice.total} SAR\n- رابط معاينة وتحميل الفاتورة:\n${publicShareUrl}\n\nشكراً لتعاملكم معنا.`
  );
  const mailtoUrl = `mailto:${invoice.customerEmail || ""}?subject=${emailSubject}&body=${emailBody}`;

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(publicShareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = publicShareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      success("تم نسخ رابط المشاركة الآمن إلى الحافظة", "تم النسخ");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("انسخ رابط المشاركة التالي:", publicShareUrl);
    }
  }

  function handleExecuteSend() {
    if (selectedChannel === "whatsapp") {
      window.open(whatsappUrl, "_blank");
      success("جاري فتح تطبيق واتساب...", "إرسال واتساب");
    } else if (selectedChannel === "email") {
      window.open(mailtoUrl, "_blank");
      success("جاري فتح تطبيق البريد...", "إرسال بريد");
    } else {
      info("تم الاحتفاظ بالفاتورة دون إرسال تلقائي", "تأكيد");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md border border-border bg-card shadow-2xl p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <Share2 className="size-4 text-primary" />
            <span>مشاركة وإرسال الفاتورة</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-3 border border-border bg-muted/20 text-xs flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">رقم الفاتورة:</span>
              <span className="font-semibold tabular-nums">{invoice.invoiceNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">العميل المستلم:</span>
              <span className="font-medium">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي:</span>
              <span className="font-bold text-primary">{invoice.total} SAR</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground">
              اختر طريقة الإرسال والمشاركة:
            </label>

            {/* Option 1: WhatsApp */}
            <label
              onClick={() => setSelectedChannel("whatsapp")}
              className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                selectedChannel === "whatsapp"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                  : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="sendChannel"
                checked={selectedChannel === "whatsapp"}
                onChange={() => setSelectedChannel("whatsapp")}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                  <MessageCircle className="size-4" />
                  <span>إرسال عبر واتساب (WhatsApp)</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {invoice.customerPhone
                    ? `إرسال إلى ${invoice.customerPhone} مباشرة مع رابط الـ PDF`
                    : "فتح واتساب مع الرسالة الجاهزة ورابط الـ PDF"}
                </div>
              </div>
            </label>

            {/* Option 2: Email */}
            <label
              onClick={() => setSelectedChannel("email")}
              className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                selectedChannel === "email"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="sendChannel"
                checked={selectedChannel === "email"}
                onChange={() => setSelectedChannel("email")}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Mail className="size-4" />
                  <span>إرسال عبر البريد الإلكتروني</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {invoice.customerEmail
                    ? `إرسال إلى ${invoice.customerEmail}`
                    : "فتح برنامج البريد بمسودة رسالة كاملة"}
                </div>
              </div>
            </label>

            {/* Option 3: None (Default safe) */}
            <label
              onClick={() => setSelectedChannel("none")}
              className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                selectedChannel === "none"
                  ? "border-slate-400 bg-muted text-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="sendChannel"
                checked={selectedChannel === "none"}
                onChange={() => setSelectedChannel("none")}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-semibold text-xs">بدون إرسال الآن</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  حفظ الفاتورة فقط وتخطي الإرسال التلقائي
                </div>
              </div>
            </label>
          </div>

          {/* Quick Copy Link */}
          <div className="flex items-center justify-between p-2.5 border border-border bg-muted/40 text-xs">
            <span className="truncate text-muted-foreground text-[11px] max-w-[240px]">
              {loadingLink ? "جاري إنشاء رابط مشفر آمن..." : (publicShareUrl || "—")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleCopy}
              disabled={loadingLink || !publicShareUrl}
              className="gap-1"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? "تم النسخ" : "نسخ الرابط"}</span>
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              إغلاق
            </Button>
            <Button type="button" size="sm" onClick={handleExecuteSend}>
              {selectedChannel === "none" ? "تم وإنهاء" : "تنفيذ الإرسال"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
