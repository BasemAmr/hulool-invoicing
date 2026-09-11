"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  itemName?: string;
  onConfirm: () => Promise<{ status: "success" } | { status: "error"; message: string }>;
  onSuccess?: () => void;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  title,
  description,
  itemName,
  onConfirm,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await onConfirm();
      if (res.status === "success") {
        success("تمت عملية الحذف بنجاح", "تم الحذف");
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message);
        error(res.message, "فشل الحذف");
      }
    } catch {
      const msg = "حدث خطأ غير متوقع أثناء الحذف";
      setErrorMessage(msg);
      error(msg, "فشل الحذف");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-destructive/10 px-5 py-4 text-destructive">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="size-4.5" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            {description}
          </p>

          {itemName && (
            <div className="p-3 bg-muted/50 border border-border text-xs font-semibold text-foreground">
              «{itemName}»
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="text-xs gap-1.5 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>جارٍ الحذف...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>تأكيد الحذف</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
