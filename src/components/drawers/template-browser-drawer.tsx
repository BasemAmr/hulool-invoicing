"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Check,
  X,
  LayoutTemplate,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Edit2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TEMPLATES_LIST,
  getTemplateById,
  getTemplateDisplayName,
  RECEIPT_TEMPLATES_LIST,
  getReceiptTemplateById,
  PARENT_CATEGORY_LABELS,
  groupTemplatesByParentCategory,
} from "@/infrastructure/pdf/templates/registry";
import {
  resolveTemplateName,
  applyTemplateNames,
  type TemplateOverridesMap,
} from "@/infrastructure/pdf/templates/template-names";
import {
  getCompanyTemplateOverridesAction,
  updateTemplateNameAction,
  resetTemplateNameAction,
} from "@/app/actions/template-names";

export interface DraftInvoicePreviewItem {
  description: string;
  // Raw decimal strings (full precision) or legacy numbers — the preview
  // route sanitizes both and runs exact multiply-then-round-once math.
  quantity: number | string;
  unitPrice: number | string;
  discountAmount?: number | string;
  vatRate?: number;
}

export interface DraftInvoicePreview {
  items: DraftInvoicePreviewItem[];
  notes?: string;
  terms?: string;
  issueDate?: string;
  /** HH:MM wall-time for live preview display. */
  issueTime?: string;
  dueDate?: string;
}

export interface TemplateBrowserDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  companyId?: string;
  invoiceId?: string;
  customerId?: string;
  draftInvoice?: DraftInvoicePreview | null;
  mode?: "invoice" | "receipt";
  initialOverrides?: TemplateOverridesMap;
  onOverridesChange?: (overrides: TemplateOverridesMap) => void;
}

export function TemplateBrowserDrawer({
  open,
  onClose,
  selectedTemplateId,
  onSelectTemplate,
  companyId,
  invoiceId,
  customerId,
  draftInvoice,
  mode = "invoice",
  initialOverrides,
  onOverridesChange,
}: TemplateBrowserDrawerProps) {
  const isReceipt = mode === "receipt";
  const baseTemplatesList = isReceipt ? RECEIPT_TEMPLATES_LIST : TEMPLATES_LIST;
  const defaultFallbackId = isReceipt ? "receipt_standard" : "simple_red";

  const [currentTemplateId, setCurrentTemplateId] = useState<string>(
    selectedTemplateId || defaultFallbackId
  );
  const [loading, setLoading] = useState(false);
  const [draftPdfUrl, setDraftPdfUrl] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<TemplateOverridesMap>(
    initialOverrides || {}
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Sync initialOverrides if provided from parent
  useEffect(() => {
    if (initialOverrides) {
      setOverrides(initialOverrides);
    }
  }, [initialOverrides]);

  // Load overrides if companyId is present and no overrides provided yet
  useEffect(() => {
    if (open && companyId && (!initialOverrides || Object.keys(initialOverrides).length === 0)) {
      getCompanyTemplateOverridesAction(companyId).then((loaded) => {
        if (loaded && Object.keys(loaded).length > 0) {
          setOverrides(loaded);
          onOverridesChange?.(loaded);
        }
      });
    }
  }, [open, companyId, initialOverrides, onOverridesChange]);

  useEffect(() => {
    if (selectedTemplateId) {
      setCurrentTemplateId(selectedTemplateId);
    } else {
      setCurrentTemplateId(defaultFallbackId);
    }
  }, [selectedTemplateId, open, defaultFallbackId]);

  const templatesList = useMemo(() => {
    return applyTemplateNames(baseTemplatesList, overrides);
  }, [baseTemplatesList, overrides]);

  const currentIndex = useMemo(() => {
    const idx = templatesList.findIndex((t) => t.id === currentTemplateId);
    return idx >= 0 ? idx : 0;
  }, [currentTemplateId, templatesList]);

  const activeDef = useMemo(() => {
    const rawDef = isReceipt
      ? getReceiptTemplateById(currentTemplateId)
      : getTemplateById(currentTemplateId);
    const resolved = resolveTemplateName(rawDef, overrides);
    return {
      ...rawDef,
      nameAr: resolved.nameAr,
      nameEn: resolved.nameEn,
      isOverridden: resolved.isOverridden,
    };
  }, [currentTemplateId, isReceipt, overrides]);

  // Live-preview signals (invoice mode only; receipt mode is always sample).
  // invoiceId path already resolves its own customer server-side, so customerId
  // / draft only matter when there is no invoiceId.
  const hasLiveDraft =
    !isReceipt &&
    !invoiceId &&
    !!draftInvoice &&
    Array.isArray(draftInvoice.items) &&
    draftInvoice.items.length > 0;
  const hasLiveCustomer = !isReceipt && !invoiceId && !!customerId;
  const isLivePreview = !isReceipt && (!!invoiceId || hasLiveDraft || hasLiveCustomer);

  // Stable key for the draft payload: the wizard builds a fresh object every
  // render, and depending on it directly would refetch the PDF in a loop.
  const draftKey = useMemo(
    () => (draftInvoice ? JSON.stringify(draftInvoice) : ""),
    [draftInvoice]
  );

  const pdfPreviewUrl = isReceipt
    ? `/api/documents/preview/pdf?type=receipt&templateId=${encodeURIComponent(currentTemplateId)}${
        companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""
      }`
    : `/api/documents/preview/pdf?templateId=${encodeURIComponent(currentTemplateId)}${
        companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""
      }${invoiceId ? `&invoiceId=${encodeURIComponent(invoiceId)}` : ""}${
        !invoiceId && customerId ? `&customerId=${encodeURIComponent(customerId)}` : ""
      }`;

  // When live wizard items exist (unsaved invoice), render them via POST so the
  // preview shows the real lines/totals instead of the hardcoded sample items.
  // On any POST failure we clear the blob URL and fall back to the GET URL —
  // the frame must never go blank.
  useEffect(() => {
    if (!open || isReceipt || invoiceId || !hasLiveDraft) {
      setDraftPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    fetch("/api/documents/preview/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: currentTemplateId,
        companyId,
        customerId,
        draft: draftInvoice,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`preview POST failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setDraftPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      })
      .catch(() => {
        // Fall back to the GET sample/customer URL (never a blank frame).
        if (!cancelled) {
          setDraftPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // draftKey (not draftInvoice) keeps this from refetching every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentTemplateId, companyId, customerId, draftKey, invoiceId, isReceipt, hasLiveDraft]);

  // Revoke the blob URL on unmount so repeated picker opens don't leak memory.
  useEffect(() => {
    return () => {
      setDraftPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  if (!open) return null;

  const iframeSrc = draftPdfUrl ?? pdfPreviewUrl;

  const handleApply = () => {
    onSelectTemplate(currentTemplateId);
    onClose();
  };

  const handlePrev = () => {
    const prevIdx =
      currentIndex > 0 ? currentIndex - 1 : templatesList.length - 1;
    const prevItem = templatesList[prevIdx];
    if (prevItem) {
      setLoading(true);
      setCurrentTemplateId(prevItem.id);
      setIsEditingName(false);
    }
  };

  const handleNext = () => {
    const nextIdx =
      currentIndex < templatesList.length - 1 ? currentIndex + 1 : 0;
    const nextItem = templatesList[nextIdx];
    if (nextItem) {
      setLoading(true);
      setCurrentTemplateId(nextItem.id);
      setIsEditingName(false);
    }
  };

  const handleStartRename = () => {
    setEditNameAr(activeDef.nameAr);
    setEditNameEn(activeDef.nameEn);
    setIsEditingName(true);
  };

  const handleSaveRename = async () => {
    if (!companyId) return;
    setIsSavingName(true);
    try {
      const res = await updateTemplateNameAction(
        companyId,
        currentTemplateId,
        editNameAr,
        editNameEn
      );
      if (res.success && res.overrides) {
        setOverrides(res.overrides);
        onOverridesChange?.(res.overrides);
        setIsEditingName(false);
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const handleResetRename = async () => {
    if (!companyId) return;
    setIsSavingName(true);
    try {
      const res = await resetTemplateNameAction(companyId, currentTemplateId);
      if (res.success && res.overrides) {
        setOverrides(res.overrides);
        onOverridesChange?.(res.overrides);
        setIsEditingName(false);
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const grouped = groupTemplatesByParentCategory(templatesList);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-card border border-border shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* ─── Ultra-Compact Single-Row Header Toolbar ─── */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40 shrink-0">
          {/* Title & Active Color Indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate className="size-4 text-primary shrink-0" />
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-xs sm:text-sm text-foreground">
                {isReceipt ? "معاينة قوالب سند القبض" : "معاينة قوالب الفواتير"}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                ({currentIndex + 1}/{templatesList.length})
              </span>
              <span
                className="size-2.5 rounded-full inline-block border border-black/20"
                style={{ backgroundColor: activeDef.primaryColor }}
                title={`اللون الرئيسي: ${activeDef.primaryColor}`}
              />
              <span className="px-1.5 py-0.2 rounded-xs text-[9px] font-semibold border border-primary/25 bg-primary/10 text-primary">
                {PARENT_CATEGORY_LABELS[activeDef.parentCategory]?.badgeAr || "قالب نظام معتمد"}
              </span>
              {/* Preview-source badge: real invoice/live draft vs sample stub (invoice mode only; receipt mode always uses a sample voucher) */}
              {!isReceipt && (
                <span
                  className={`px-1.5 py-0.2 rounded-xs text-[9px] font-semibold border ${
                    isLivePreview
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                  }`}
                  title={isLivePreview ? "تُعاين بيانات الفاتورة الحالية" : "لا توجد فاتورة — تُعاين بيانات تجريبية"}
                >
                  {isLivePreview ? "معاينة الفاتورة الحالية" : "بيانات تجريبية"}
                </span>
              )}
              {activeDef.isOverridden && (
                <span className="px-1.5 py-0.2 rounded-xs text-[9px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  مسمى مخصص
                </span>
              )}
              {companyId && (
                <button
                  type="button"
                  onClick={handleStartRename}
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-primary transition-colors rounded-xs"
                  title="تعديل مسمى هذا القالب لمنشأتك"
                >
                  <Edit2 className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Arrows, Select & Apply Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Cycle Arrows */}
            <div className="inline-flex items-center border border-input bg-background rounded-sm">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="القالب السابق (السهم الأيمن)"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border-r border-input"
                title="القالب التالي (السهم الأيسر)"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            </div>

            {/* Template Select Dropdown without titled category optgroups */}
            <select
              value={currentTemplateId}
              onChange={(e) => {
                setLoading(true);
                setCurrentTemplateId(e.target.value);
                setIsEditingName(false);
              }}
              className="h-7.5 bg-background border border-input px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[170px] sm:min-w-[220px]"
            >
              {templatesList.map((t) => (
                <option key={t.id} value={t.id}>
                  {getTemplateDisplayName(t)}
                </option>
              ))}
            </select>

            {/* Save / Apply Button */}
            <Button
              size="sm"
              onClick={handleApply}
              className="h-7.5 gap-1 text-xs font-bold px-3 bg-primary text-primary-foreground shadow-xs"
            >
              <Check className="size-3.5" />
              <span>اعتماد القالب</span>
            </Button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm"
              title="إغلاق"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ─── Client Template Rename Bar (Expandable) ─── */}
        {isEditingName && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-primary/5 border-b border-border text-xs">
            <div className="flex items-center gap-1.5 text-foreground font-semibold">
              <Edit2 className="size-3.5 text-primary" />
              <span>تخصيص مسمى القالب لمنشأتك:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <input
                type="text"
                value={editNameAr}
                onChange={(e) => setEditNameAr(e.target.value)}
                placeholder="الاسم بالعربية (مثال: نموذج شركة كنان)"
                className="h-7 px-2 border border-input rounded-sm text-xs bg-background flex-1 text-right focus:outline-none focus:ring-1 focus:ring-primary"
                dir="rtl"
              />
              <input
                type="text"
                value={editNameEn}
                onChange={(e) => setEditNameEn(e.target.value)}
                placeholder="English Name (Optional)"
                className="h-7 px-2 border border-input rounded-sm text-xs bg-background flex-1 text-left focus:outline-none focus:ring-1 focus:ring-primary"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                disabled={isSavingName}
                onClick={handleSaveRename}
                className="h-7 text-xs px-2.5 gap-1 font-bold"
              >
                {isSavingName ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Save className="size-3" />
                )}
                <span>حفظ التسمية</span>
              </Button>
              {activeDef.isOverridden && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSavingName}
                  onClick={handleResetRename}
                  className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                  title="استعادة الاسم الأصلي للنظام"
                >
                  <RotateCcw className="size-3" />
                  <span>استعادة الافتراضي</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={isSavingName}
                onClick={() => setIsEditingName(false)}
                className="h-7 text-xs px-2 text-muted-foreground"
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {/* ─── Live Actual Rendered PDF Preview ─── */}
        <div className="flex-1 w-full bg-slate-950/10 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-background/90 border border-border px-3 py-1 text-[11px] font-medium text-foreground flex items-center gap-1.5 shadow-md z-20">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>جاري تحميل {getTemplateDisplayName(activeDef)}...</span>
            </div>
          )}

          <iframe
            key={currentTemplateId}
            src={iframeSrc}
            title="معاينة قالب الفاتورة الفعلي"
            onLoad={() => setLoading(false)}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
