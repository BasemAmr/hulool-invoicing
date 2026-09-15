"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useActionState } from "react";
import {
  Plus,
  Trash2,
  Send,
  Loader2,
  Package,
  Search,
  Edit2,
  Settings,
  Printer,
  Download,
  Mail,
  Copy,
  Percent,
  UserPlus,
} from "lucide-react";

import {
  createDraftInvoiceAction,
  updateDraftInvoiceAction,
} from "@/app/actions/invoices";
import { idleState, type ActionState } from "@/app/actions/types";
import type { InvoiceDto } from "@/application/dto";
import { VAT_RATE } from "@/domain/constants";
import {
  fromDecimalString,
  toDecimalString,
  halalas,
  lineSubtotalHalalasExact,
  vatOf,
} from "@/domain/value-objects/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { formatMoney, toWesternDigits } from "@/lib/format";
import {
  formatVatRatePercent,
  isPresetVatRate,
  parseVatPercentToRate,
} from "@/lib/vat-rate";
import { ClientCombobox, type ClientOption } from "./client-combobox";
import { CustomerDrawer } from "@/components/drawers/customer-drawer";
import { TemplateBrowserDrawer, type DraftInvoicePreview } from "@/components/drawers/template-browser-drawer";
import { ProductCombobox } from "./product-combobox";
import {
  TEMPLATES_LIST,
  getTemplateById,
  getTemplateDisplayName,
} from "@/infrastructure/pdf/templates/registry";
import { useToast } from "@/components/ui/toaster";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

export interface CompanyOption {
  id: string;
  nameAr: string;
  prefix: string;
  vatNumber?: string;
  addressCity?: string | null;
  addressStreet?: string | null;
  addressDistrict?: string | null;
  addressBuildingNumber?: string | null;
  addressPostalCode?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface LineItemDraft {
  key: number;
  savedProductId?: string;
  saveToProducts?: boolean;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  vatRate: number;
}

let lineCounter = 1;
const createEmptyLine = (defaultVat = VAT_RATE): LineItemDraft => ({
  key: lineCounter++,
  description: "",
  quantity: "1",
  unitPrice: "",
  discountPercent: "0",
  discountAmount: "0",
  vatRate: defaultVat,
  // New typed lines auto-offer to save into the products catalog (user asked: default checked).
  saveToProducts: true,
});

// InvoiceDto money fields are DECIMAL strings ("175.00"), not halalas
// integers. Parsing them with parseInt ("175.00" -> 175) displayed every
// saved line at 1/100th of its stored price on edit/duplicate open — and a
// save from that state wrote the mangled price back, compounding /100 each
// round-trip. Parse exactly; the numeric branch only guards hypothetical
// non-DTO callers passing raw halalas counts (never guess units from shape).
function dtoDecimalToHalalas(v: string | number | null | undefined): number {
  if (typeof v === "number") {
    return Number.isInteger(v) && v >= 0 ? v : Math.max(0, Math.round(v));
  }
  const s = String(v ?? "0").trim();
  try {
    const h = fromDecimalString(s);
    return h >= 0 ? h : 0;
  } catch {
    return parseInt(s, 10) || 0;
  }
}

/**
 * Compact per-line VAT editor: preset dropdown (0%/5%/15%) + "custom" option
 * that reveals a small percent input. Same h-7/text-xs density as the
 * neighbouring quantity/price inputs; the numeric box is dir="ltr" so digits
 * stay LTR inside the RTL table.
 *
 * Custom typing never writes NaN into line state: invalid/empty text parses
 * (via parseVatPercentToRate) back to the previous valid rate, and blur snaps
 * the visible text back to the committed rate.
 */
function VatRateCell({
  rate,
  onRateChange,
}: {
  rate: number;
  onRateChange: (nextRate: number) => void;
}) {
  const percentDisplay = formatVatRatePercent(rate);
  const selectValue = isPresetVatRate(rate) ? percentDisplay : "custom";
  // Text of the custom box. Seeded from the committed rate and re-synced
  // below whenever the rate changes from outside (preset pick, product
  // select) — unless the user's in-progress text already parses to that
  // rate, so mid-edit typing ("7." while aiming for "7.5") is not clobbered.
  const [customText, setCustomText] = useState(percentDisplay);

  useEffect(() => {
    setCustomText((prev) => {
      const nextDisplay = formatVatRatePercent(rate);
      if (prev === nextDisplay) return prev;
      // Keep in-progress typing that already equals the new rate ("15.0" vs
      // "15") so mid-edit keystrokes are not clobbered. Parsed manually (not
      // via the fallback helper) so garbage text never compares equal just
      // because the fallback happens to match the rate.
      try {
        const norm = toWesternDigits(prev)
          .replace(/[٫]/g, ".")
          .replace(/[٬]/g, "")
          .replace(/,/g, ".")
          .replace(/[٪%]/g, "")
          .trim();
        if (norm !== "") {
          const p = parseFloat(norm);
          if (Number.isFinite(p) && Math.min(100, Math.max(0, p)) / 100 === rate)
            return prev;
        }
      } catch {
        // Deliberate fall-through: unparseable text resets to the display.
      }
      return nextDisplay;
    });
  }, [rate]);

  return (
    <div className="flex flex-col items-stretch gap-1">
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "custom") {
            // Reveal the box seeded with the current percent; the rate itself
            // is untouched until the user types a valid value.
            setCustomText(percentDisplay);
            return;
          }
          // Preset strings are always valid, so this never hits the fallback.
          onRateChange(parseVatPercentToRate(v, rate));
        }}
        aria-label="نسبة الضريبة للبند"
        className="h-7 text-xs bg-background border border-input px-1 font-mono text-center text-foreground"
      >
        <option value="0">0%</option>
        <option value="5">5%</option>
        <option value="15">15%</option>
        <option value="custom">مخصص…</option>
      </select>
      {selectValue === "custom" && (
        <div className="flex items-center justify-center gap-0.5" dir="ltr">
          <Input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={customText}
            onChange={(e) => {
              const nextText = e.target.value;
              setCustomText(nextText);
              // Deliberate no-NaN path: invalid/empty parses back to `rate`
              // (previous valid), so the equality guard below skips the
              // update and line state keeps the last good rate.
              const nextRate = parseVatPercentToRate(nextText, rate);
              if (nextRate !== rate) onRateChange(nextRate);
            }}
            onBlur={() => {
              // Deliberate reset: garbage/empty text snaps back to the
              // committed rate so the box never displays an uncommitted value.
              setCustomText(formatVatRatePercent(rate));
            }}
            placeholder="7.5"
            aria-label="نسبة ضريبة مخصصة (بالمئة)"
            className="h-7 w-14 text-xs font-mono text-center px-1"
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      )}
    </div>
  );
}

export interface DuplicatePrefill {
  customerId?: string;
  issueDate?: string;
  dueDate?: string | null;
  templateId?: string;
  invoiceType?: "standard" | "simplified";
  notes?: string | null;
  terms?: string | null;
  items?: InvoiceDto["items"];
}

export function InvoiceWizardForm({
  companies,
  customers,
  products = [],
  scopedCompanyId,
  initialInvoice,
  duplicatePrefill,
  suggestedInvoiceNumber,
  defaultVatRate = VAT_RATE,
  defaultTemplateId = "simple_red",
}: {
  companies: CompanyOption[];
  customers: ClientOption[];
  products?: SavedProductRecord[];
  scopedCompanyId?: string;
  initialInvoice?: InvoiceDto;
  /** Prefill for "duplicate invoice" creates (new invoice, no id). */
  duplicatePrefill?: DuplicatePrefill;
  /** Server-computed next number preview (max+1), shown read-only. */
  suggestedInvoiceNumber?: string;
  defaultVatRate?: number;
  defaultTemplateId?: string;
}) {
  const { toast } = useToast();
  const action = initialInvoice
    ? updateDraftInvoiceAction
    : createDraftInvoiceAction;
  const [state, formAction, pending]: [
    ActionState,
    (fd: FormData) => void,
    boolean,
  ] = useActionState(action, idleState);

  const activeCompany =
    companies.find(
      (c) => c.id === (scopedCompanyId || initialInvoice?.companyId)
    ) || companies[0];

  // Client State (duplicate prefill overrides the default customer)
  const [customersList, setCustomersList] = useState<ClientOption[]>(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialInvoice?.customerId ||
      duplicatePrefill?.customerId ||
      customers[0]?.id ||
      ""
  );
  const [customerEditDrawerOpen, setCustomerEditDrawerOpen] = useState(false);
  const [customerAddDrawerOpen, setCustomerAddDrawerOpen] = useState(false);

  useEffect(() => {
    setCustomersList(customers);
    if (!selectedCustomerId && customers.length > 0 && customers[0]) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = useMemo(() => {
    return customersList.find((c) => c.id === selectedCustomerId);
  }, [customersList, selectedCustomerId]);

  // Invoice number is allocated server-side on save (atomic per-company
  // sequence). Never trust a client-side guess: show the server's max+1
  // preview read-only for new invoices, and the real number when editing.
  // The old `${prefix}-00001` simulation always showed ...-00001, which is
  // why new invoices *looked* like they reused the same number.
  const simulatedInvoiceNumber = useMemo(() => {
    if (suggestedInvoiceNumber) return suggestedInvoiceNumber;
    const prefix = activeCompany?.prefix || "INV";
    return `${prefix}- (ترقيم تلقائي عند الحفظ)`;
  }, [activeCompany, suggestedInvoiceNumber]);

  const [invoiceNumber] = useState(
    initialInvoice?.invoiceNumber || simulatedInvoiceNumber
  );

  // Every invoice is published immediately — no draft option.
  const [templateId, setTemplateId] = useState(
    initialInvoice?.templateId ||
      duplicatePrefill?.templateId ||
      defaultTemplateId ||
      "simple_red"
  );
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [isSimplifiedVat, setIsSimplifiedVat] = useState(() => {
    const t = initialInvoice?.invoiceType ?? duplicatePrefill?.invoiceType;
    return t ? t === "simplified" : true;
  });
  const [issueDate, setIssueDate] = useState(
    () =>
      initialInvoice?.issueDate ||
      duplicatePrefill?.issueDate ||
      new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(
    initialInvoice?.dueDate || duplicatePrefill?.dueDate || ""
  );
  const [notes, setNotes] = useState(
    initialInvoice?.notes || duplicatePrefill?.notes || ""
  );
  const [terms, setTerms] = useState(
    initialInvoice?.terms || duplicatePrefill?.terms || ""
  );

  // Settings Gear Dropdown State
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const [overallTaxRate, setOverallTaxRate] = useState<string>("0");
  const [showOverallTax, setShowOverallTax] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(event.target as Node)) {
        setGearOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Products Table Line Items (edit source or duplicate prefill both map the same way)
  const [lines, setLines] = useState<LineItemDraft[]>(() => {
    const sourceItems =
      initialInvoice && initialInvoice.items.length > 0
        ? initialInvoice.items
        : duplicatePrefill?.items && duplicatePrefill.items.length > 0
          ? duplicatePrefill.items
          : null;
    if (sourceItems) {
      return sourceItems.map((item) => {
        const qty = item.quantity || 1;
        // Both sources (initialInvoice.items, duplicatePrefill.items) are
        // InvoiceDto items with decimal-string money — see dtoDecimalToHalalas.
        const priceHalalas = dtoDecimalToHalalas(item.unitPrice);
        const discountHalalas = dtoDecimalToHalalas(item.discountAmount);
        const lineBase = (priceHalalas * qty) / 100;
        const discSar = discountHalalas / 100;
        const discPct =
          lineBase > 0 ? ((discSar / lineBase) * 100).toFixed(2) : "0";

        return {
          key: lineCounter++,
          savedProductId: item.savedProductId ?? undefined,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: (priceHalalas / 100).toFixed(2),
          discountPercent: discPct,
          discountAmount: discSar.toFixed(2),
          vatRate: item.vatRate || defaultVatRate,
          // Editing an existing invoice: pre-check save for free-text lines so they
          // land in the catalog; already-linked catalog lines stay unchecked.
          saveToProducts: item.savedProductId ? false : true,
        };
      });
    }
    return [createEmptyLine(defaultVatRate)];
  });

  // Calculations — exact decimal math, single final rounding to halala.
  // DO NOT toFixed(2) the unit price before multiplying: that was the 5368 vs 5367
  // bug (17.95319 x 260 truncated to 17.95 x 260). We multiply exact strings via
  // lineSubtotalHalalasExact() then VAT once per line, so row + summary agree.
  const totals = useMemo(() => {
    const validLines = lines
      .filter((l) => l.description.trim().length > 0)
      .map((l) => {
        const discSar = parseFloat(l.discountAmount) || 0;

        return {
          description: l.description,
          // Keep raw strings: exact helper parses full precision (e.g. "17.95319").
          qtyStr: l.quantity || "0",
          priceStr: l.unitPrice || "0",
          discountAmount: fromDecimalString(discSar.toFixed(2)),
          vatRate: l.vatRate,
        };
      });

    if (validLines.length === 0) {
      return {
        subtotal: "0.00",
        vatAmount: "0.00",
        total: "0.00",
        calculatedLines: [],
      };
    }

    try {
      const computed = validLines.map((l) => {
        const lineSubtotal = lineSubtotalHalalasExact(
          l.priceStr,
          l.qtyStr,
          l.discountAmount,
        );
        const lineVat = vatOf(lineSubtotal, l.vatRate);
        const lineTotal = halalas(lineSubtotal + lineVat);
        return { lineSubtotal, lineVat, lineTotal };
      });
      let sub = halalas(
        computed.reduce((acc, c) => acc + c.lineSubtotal, 0),
      );
      let vat = halalas(
        computed.reduce((acc, c) => acc + c.lineVat, 0),
      );
      let grand = halalas(
        computed.reduce((acc, c) => acc + c.lineTotal, 0),
      );

      const extraTaxPct = parseFloat(overallTaxRate) || 0;
      if (extraTaxPct > 0) {
        const extraTaxHalalas = halalas(
          Math.round((sub * extraTaxPct) / 100)
        );
        vat = halalas(vat + extraTaxHalalas);
        grand = halalas(sub + vat);
      }

      return {
        subtotal: toDecimalString(sub),
        vatAmount: toDecimalString(vat),
        total: toDecimalString(grand),
        calculatedLines: computed,
      };
    } catch {
      return {
        subtotal: "0.00",
        vatAmount: "0.00",
        total: "0.00",
        calculatedLines: [],
      };
    }
  }, [lines, overallTaxRate]);

  // Line Item Handlers
  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine(defaultVatRate)]);
  };

  const removeLine = (key: number) => {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.key !== key)
    );
  };

  const updateLine = (key: number, patch: Partial<LineItemDraft>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };

        // Auto calculate discount percentage vs amount
        if ("discountPercent" in patch) {
          const qty = parseFloat(next.quantity) || 0;
          const price = parseFloat(next.unitPrice) || 0;
          const pct = parseFloat(next.discountPercent) || 0;
          const base = qty * price;
          next.discountAmount = ((base * pct) / 100).toFixed(2);
        } else if ("discountAmount" in patch) {
          const qty = parseFloat(next.quantity) || 0;
          const price = parseFloat(next.unitPrice) || 0;
          const amount = parseFloat(next.discountAmount) || 0;
          const base = qty * price;
          next.discountPercent =
            base > 0 ? ((amount / base) * 100).toFixed(2) : "0";
        } else if ("quantity" in patch || "unitPrice" in patch) {
          const qty = parseFloat(next.quantity) || 0;
          const price = parseFloat(next.unitPrice) || 0;
          const pct = parseFloat(next.discountPercent) || 0;
          const base = qty * price;
          next.discountAmount = ((base * pct) / 100).toFixed(2);
        }

        return next;
      })
    );
  };

  const handleSelectProduct = (key: number, product: SavedProductRecord) => {
    const priceSar = product.unitPrice
      ? (product.unitPrice / 100).toFixed(2)
      : "0.00";
    updateLine(key, {
      savedProductId: product.id,
      description: product.nameAr,
      unitPrice: priceSar,
      vatRate: product.vatRate,
      saveToProducts: false,
    });
  };

  const handleCopyInvoice = () => {
    // Reset to a fresh numbering + today; the server allocates the real
    // number on save, so we only reset the date here.
    toast({
      title: "نسخ الفاتورة",
      message: "تم نسخ بيانات الفاتورة الحالية لإصدار نسخة جديدة.",
    });
    setIssueDate(new Date().toISOString().slice(0, 10));
    setGearOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (initialInvoice?.id) {
      window.open(
        `/api/documents/${initialInvoice.id}/pdf?download=true`,
        "_blank"
      );
    } else {
      toast({
        title: "تنبيه",
        message: "يرجى حفظ الفاتورة أولاً لتتمكن من تحميل ملف PDF.",
      });
    }
  };

  const handleEmail = () => {
    if (selectedCustomer?.email) {
      window.location.href = `mailto:${selectedCustomer.email}?subject=فاتورة ${invoiceNumber || ""}`;
    } else {
      toast({
        title: "البريد غير متوفر",
        message: "العميل الحالي لا يملك بريداً إلكترونياً مسجلاً.",
      });
    }
  };

  const activeTemplateDef = getTemplateById(templateId);

  // Live preview draft for the template picker: the drawer's POST path renders
  // these real lines/totals instead of the hardcoded sample items. Null when
  // no usable lines exist so the route's sample fallback keeps the picker
  // useful on an empty new form. Prices/quantities travel as RAW decimal
  // strings (already western-digit normalized on input) so the preview route
  // can run the same exact multiply-then-round-once math as display + save —
  // parseFloat here would reintroduce the 5368-vs-5367 truncation.
  const draftPreview: DraftInvoicePreview | null = useMemo(() => {
    const items = lines
      .filter((l) => l.description.trim().length > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: toWesternDigits((l.quantity || "1").trim()) || "1",
        unitPrice: toWesternDigits((l.unitPrice || "0").trim()) || "0",
        discountAmount: toWesternDigits((l.discountAmount || "0").trim()) || "0",
        vatRate: l.vatRate,
      }));
    if (items.length === 0) return null;
    return {
      items,
      notes: notes || undefined,
      terms: terms || undefined,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
    };
  }, [lines, notes, terms, issueDate, dueDate]);

  const formattedCompanyAddress = [
    activeCompany?.addressBuildingNumber,
    activeCompany?.addressStreet,
    activeCompany?.addressDistrict,
    activeCompany?.addressCity,
    activeCompany?.addressPostalCode,
  ]
    .filter(Boolean)
    .join("، ");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {/* Hidden Fields */}
      <input
        type="hidden"
        name="companyId"
        value={activeCompany?.id || scopedCompanyId || ""}
      />
      <input type="hidden" name="customerId" value={selectedCustomerId} />
      <input type="hidden" name="templateId" value={templateId} />
      <input
        type="hidden"
        name="invoiceType"
        value={isSimplifiedVat ? "simplified" : "standard"}
      />
      {/* All invoices are published: always issue on save. */}
      <input type="hidden" name="_action" value="issue" />
      <input type="hidden" name="status" value="issued" />
      {initialInvoice && (
        <input type="hidden" name="id" value={initialInvoice.id} />
      )}

      {state.status === "error" && (
        <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {state.message}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          ROW 1: THREE-COLUMN TOP SECTION
          Column 1: Client Selection & Details
          Column 2: Compact Button Group Actions + Company Details (Start Aligned)
          Column 3: Dense Settings & Status Selector
         ────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        {/* ─── COLUMN 1: Client Selection & Details ─────────────────────── */}
        <div className="bg-card border border-border p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border pb-1">
            <span className="text-xs font-bold text-foreground">
              بيانات العميل (المشتري)
            </span>
            <button
              type="button"
              onClick={() => setCustomerAddDrawerOpen(true)}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <UserPlus className="size-3" />
              <span>عميل جديد</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <ClientCombobox
              customers={customersList}
              selectedId={selectedCustomerId}
              onSelect={(c: ClientOption) => setSelectedCustomerId(c.id)}
            />

            {/* Selected Client Summary Card */}
            {selectedCustomer ? (
              <div className="p-2 bg-muted/20 border border-border/80 flex flex-col gap-0.5 text-xs relative group">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs">
                    {selectedCustomer.nameAr}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomerEditDrawerOpen(true)}
                    className="p-0.5 hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                    title="تعديل بيانات العميل"
                  >
                    <Edit2 className="size-3" />
                  </button>
                </div>

                {selectedCustomer.vatNumber && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    الرقم الضريبي: {selectedCustomer.vatNumber}
                  </span>
                )}
                {selectedCustomer.phone && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    الجوال: {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.addressCity && (
                  <span className="text-[10px] text-muted-foreground">
                    المدينة: {selectedCustomer.addressCity}
                  </span>
                )}
              </div>
            ) : (
              <div className="p-2 bg-muted/10 border border-dashed border-border text-center text-xs text-muted-foreground">
                يرجى اختيار عميل من القائمة
              </div>
            )}
          </div>
        </div>

        {/* ─── COLUMN 2: Sleek Button Group Actions + Company Details (Start Aligned) ─── */}
        <div className="bg-card border border-border p-2.5 flex flex-col justify-between gap-2 shadow-2xs">
          {/* Row 1: Compact Button Group for Actions */}
          <div className="flex items-center justify-start border-b border-border pb-1.5">
            <div className="inline-flex items-center rounded-sm border border-border bg-muted/20 p-0.5 divide-x divide-border/60">
              {/* 1. Settings Gear */}
              <div className="relative" ref={gearRef}>
                <button
                  type="button"
                  onClick={() => setGearOpen((prev) => !prev)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="إعدادات إضافية للفاتورة"
                >
                  <Settings className="size-3.5" />
                </button>

                {gearOpen && (
                  <div className="absolute top-8 right-0 w-56 bg-popover border border-border shadow-md z-30 flex flex-col p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOverallTax((prev) => !prev);
                        setGearOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 hover:bg-muted text-start text-foreground"
                    >
                      <Percent className="size-3.5 text-primary" />
                      <span>
                        {showOverallTax
                          ? "إلغاء الضريبة الكلية"
                          : "إضافة نسبة ضريبة على إجمالي الفاتورة"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyInvoice}
                      className="flex items-center gap-2 p-2 hover:bg-muted text-start text-foreground border-t border-border"
                    >
                      <Copy className="size-3.5 text-foreground" />
                      <span>نسخ الفاتورة الحالية</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Template Magnifier */}
              <button
                type="button"
                onClick={() => setTemplateDrawerOpen(true)}
                className="p-1 text-primary hover:bg-primary/10 transition-colors"
                title="استعراض ومعاينة القوالب (17 قالباً)"
              >
                <Search className="size-3.5" />
              </button>

              {/* 3. Print Icon */}
              <button
                type="button"
                onClick={handlePrint}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="طباعة الفاتورة"
              >
                <Printer className="size-3.5" />
              </button>

              {/* 4. Download PDF Icon */}
              <button
                type="button"
                onClick={handleDownload}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="تحميل ملف PDF مباشرة"
              >
                <Download className="size-3.5" />
              </button>

              {/* 5. Email Icon */}
              <button
                type="button"
                onClick={handleEmail}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="إرسال عبر البريد الإلكتروني"
              >
                <Mail className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Company Details (Aligned to START / Right in RTL) */}
          <div className="flex flex-col gap-0.5 text-xs text-start items-start">
            <span className="font-bold text-xs text-foreground">
              {activeCompany?.nameAr || "المنشأة المصدرة"}
            </span>
            {activeCompany?.vatNumber && (
              <span className="text-[10px] text-muted-foreground font-mono">
                الرقم الضريبي: {activeCompany.vatNumber}
              </span>
            )}
            {formattedCompanyAddress ? (
              <span className="text-[10px] text-muted-foreground">
                العنوان: {formattedCompanyAddress}
              </span>
            ) : null}
            {activeCompany?.email && (
              <span className="text-[10px] text-muted-foreground font-mono">
                البريد: {activeCompany.email}
              </span>
            )}
          </div>
        </div>

        {/* ─── COLUMN 3: Dense Invoice Settings & Status ─────────────── */}
        <div className="bg-card border border-border p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border pb-1">
            <span className="text-xs font-bold text-foreground">
              إعدادات وحالة الفاتورة
            </span>
            <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.2 bg-primary/10">
              {activeCompany?.prefix || "INV"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {/* Invoice Number (read-only preview; server allocates atomically) */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium text-muted-foreground">
                رقم الفاتورة
              </label>
              <Input
                value={invoiceNumber}
                readOnly
                disabled
                placeholder="ترقيم تلقائي"
                title="يُخصَّص رقم الفاتورة تلقائياً عند الحفظ بتسلسل الشركة"
                className="text-xs font-mono h-6.5 px-2 bg-muted/40"
              />
              {!initialInvoice && (
                <span className="text-[9px] text-muted-foreground">
                  ترقيم تلقائي متسلسل — الرقم النهائي يُحجز عند الحفظ.
                </span>
              )}
            </div>

            {/* Template Selector Dropdown */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                <span>القالب</span>
                <button
                  type="button"
                  onClick={() => setTemplateDrawerOpen(true)}
                  className="text-primary hover:underline text-[9px]"
                >
                  معاينة
                </button>
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="h-6.5 text-[11px] bg-background border border-input px-1 text-foreground font-medium"
              >
                {TEMPLATES_LIST.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTemplateDisplayName(t)}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium text-muted-foreground">
                تاريخ الإصدار *
              </label>
              <DatePickerInput
                name="issueDate"
                value={issueDate}
                onChange={(val) => setIssueDate(val)}
                className="text-xs h-6.5"
              />
            </div>

            {/* Due Date */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium text-muted-foreground">
                تاريخ الاستحقاق
              </label>
              <DatePickerInput
                name="dueDate"
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                placeholder="اختياري"
                className="text-xs h-6.5"
              />
            </div>

            {/* All invoices are published immediately — no draft option. */}
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/60">
              <span className="text-[10px] font-medium text-muted-foreground">
                حالة الحفظ
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold border bg-emerald-600 text-white border-emerald-600">
                معتمدة ومصدرة
              </span>
            </div>

            {/* Invoice Type Toggle */}
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/60">
              <span className="text-[10px] font-medium text-muted-foreground">
                نوع الفاتورة
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSimplifiedVat(true)}
                  className={`px-2 py-0.5 text-[10px] font-semibold border ${
                    isSimplifiedVat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  مبسطة (B2C)
                </button>
                <button
                  type="button"
                  onClick={() => setIsSimplifiedVat(false)}
                  className={`px-2 py-0.5 text-[10px] font-semibold border ${
                    !isSimplifiedVat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  معتمدة (B2B)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          ROW 2: PRODUCTS ENTRIES LINE ITEMS TABLE (RTL)
         ────────────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border p-2.5 flex flex-col gap-2 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <div className="flex items-center gap-2">
            <Package className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              بنود وأصناف الفاتورة ({lines.length})
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="gap-1 text-xs h-6 px-2 font-semibold"
          >
            <Plus className="size-3" />
            <span>إضافة بند جديد</span>
          </Button>
        </div>

        {/* Line Items Table */}
        <div className="border border-border overflow-visible">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-1.5 text-center w-8">#</th>
                <th className="p-1.5 text-start min-w-[240px]">الوصف والبيان *</th>
                <th className="p-1.5 text-center w-16">الكمية *</th>
                <th className="p-1.5 text-end w-20">السعر (ر.س) *</th>
                <th className="p-1.5 text-end w-16">الخصم (ر.س)</th>
                <th className="p-1.5 text-center w-24">الضريبة</th>
                <th className="p-1.5 text-end w-24">الإجمالي</th>
                <th className="p-1.5 text-center w-8">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, idx) => {
                // Exact per-row math (same helper as summary) so الإجمالي matches totals.
                // Falls back to 0.00 on bad input instead of throwing mid-render.
                let totalStr = "0.00";
                try {
                  const discHalalas = fromDecimalString(
                    (parseFloat(line.discountAmount) || 0).toFixed(2),
                  );
                  const baseHalalas = lineSubtotalHalalasExact(
                    line.unitPrice || "0",
                    line.quantity || "0",
                    discHalalas,
                  );
                  const vatHalalas = vatOf(baseHalalas, line.vatRate);
                  totalStr = toDecimalString(
                    halalas(baseHalalas + vatHalalas),
                  );
                } catch {
                  totalStr = "0.00";
                }

                return (
                  <tr key={line.key} className="hover:bg-muted/20">
                    <td className="p-1.5 text-center font-mono text-muted-foreground">
                      {idx + 1}
                    </td>

                    {/* Description with ProductCombobox */}
                    <td className="p-1.5">
                      <ProductCombobox
                        value={line.description}
                        onChange={(desc) =>
                          updateLine(line.key, {
                            description: desc,
                            savedProductId: undefined,
                          })
                        }
                        onSelectProduct={(p) => handleSelectProduct(line.key, p)}
                        products={products}
                        saveToProducts={line.saveToProducts}
                        onToggleSaveToProducts={(save) =>
                          updateLine(line.key, { saveToProducts: save })
                        }
                        isSavedProduct={Boolean(line.savedProductId)}
                      />
                    </td>

                    {/* Quantity */}
                    <td className="p-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: toWesternDigits(e.target.value),
                          })
                        }
                        className="text-xs font-mono text-center h-7 px-1"
                        required
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="p-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unitPrice: toWesternDigits(e.target.value),
                          })
                        }
                        placeholder="0.00"
                        className="text-xs font-mono text-end h-7 px-1"
                        required
                      />
                    </td>

                    {/* Discount */}
                    <td className="p-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={line.discountAmount}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discountAmount: toWesternDigits(e.target.value),
                          })
                        }
                        placeholder="0.00"
                        className="text-xs font-mono text-end h-7 px-1"
                      />
                    </td>

                    {/* VAT Rate: preset dropdown + custom percent input.
                        Writes straight into line.vatRate (0..1), so the row
                        total above, the totals useMemo, and the hidden
                        items[idx].vatRate input below all follow with no
                        extra wiring. Product select still sets the product's
                        own rate first; this control only overrides after. */}
                    <td className="p-1.5">
                      <VatRateCell
                        rate={line.vatRate}
                        onRateChange={(nextRate) =>
                          updateLine(line.key, { vatRate: nextRate })
                        }
                      />
                    </td>

                    {/* Line Total */}
                    <td className="p-1.5 text-end font-mono font-bold text-foreground text-xs">
                      {formatMoney(totalStr)} SAR
                    </td>

                    {/* Remove & Hidden inputs for form action inside td */}
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                        title="حذف البند"
                      >
                        <Trash2 className="size-3" />
                      </button>

                      <input
                        type="hidden"
                        name={`items[${idx}].description`}
                        value={line.description}
                      />
                      <input
                        type="hidden"
                        name={`items[${idx}].quantity`}
                        value={toWesternDigits((line.quantity || "1").trim()) || "1"}
                      />
                      <input
                        type="hidden"
                        name={`items[${idx}].unitPrice`}
                        // Full-precision raw price string (western digits):
                        // the server multiplies BEFORE rounding (round once
                        // at the end). NEVER toFixed(2)/parseFloat here —
                        // that pre-multiply truncation was the 5368-vs-5367
                        // bug (17.95319 → 17.95 before ×260).
                        value={toWesternDigits((line.unitPrice || "0").trim()) || "0"}
                      />
                      <input
                        type="hidden"
                        name={`items[${idx}].discountAmount`}
                        value={fromDecimalString(
                          (parseFloat(line.discountAmount) || 0).toFixed(2)
                        ).toString()}
                      />
                      <input
                        type="hidden"
                        name={`items[${idx}].vatRate`}
                        value={line.vatRate.toString()}
                      />
                      {line.savedProductId && (
                        <input
                          type="hidden"
                          name={`items[${idx}].savedProductId`}
                          value={line.savedProductId}
                        />
                      )}
                      {line.saveToProducts && (
                        <input
                          type="hidden"
                          name={`items[${idx}].saveToProducts`}
                          value="true"
                        />
                      )}
                    </td>
                  </tr>

                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          ROW 3: NOTES & TERMS & SINGLE CLEAN SAVE ACTION
         ────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Notes & Terms */}
        <div className="bg-card border border-border p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] font-semibold text-foreground">
              ملاحظات الفاتورة (Notes)
            </label>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي ملاحظات إضافية تظهر للعميل في أسفل الفاتورة..."
              className="text-xs bg-background border border-input p-1.5 rounded-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] font-semibold text-foreground">
              الشروط والأحكام (Terms of Service)
            </label>
            <textarea
              name="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              placeholder="شروط الدفع والتسليم وسياسة الاستبدال..."
              className="text-xs bg-background border border-input p-1.5 rounded-none resize-none"
            />
          </div>
        </div>

        {/* Financial Summary & Single Submit Button */}
        <div className="bg-card border border-border p-2.5 flex flex-col justify-between gap-2.5 shadow-2xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between border-b border-border pb-1 text-xs">
              <span className="text-muted-foreground">المجموع الفرعي (قبل الضريبة):</span>
              <span className="font-mono font-medium text-foreground">
                {formatMoney(totals.subtotal)} SAR
              </span>
            </div>

            {/* Overall Tax if enabled */}
            {showOverallTax && (
              <div className="flex items-center justify-between border-b border-border pb-1 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">نسبة ضريبة إضافية (%):</span>
                  <input
                    type="number"
                    value={overallTaxRate}
                    onChange={(e) => setOverallTaxRate(e.target.value)}
                    className="w-10 h-5 text-xs text-center border border-input font-mono"
                    min={0}
                    max={100}
                  />
                </div>
                <span className="font-mono text-primary font-semibold">
                  {overallTaxRate}%
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-border pb-1 text-xs">
              <span className="text-muted-foreground">
                ضريبة القيمة المضافة (15%):
              </span>
              <span className="font-mono font-medium text-foreground">
                {formatMoney(totals.vatAmount)} SAR
              </span>
            </div>

            <div className="flex items-center justify-between pt-0.5 font-bold text-sm text-foreground">
              <span>الإجمالي الكلي:</span>
              <span className="font-mono text-base text-primary">
                {formatMoney(totals.total)} SAR
              </span>
            </div>
          </div>

          {/* Single Clear Submit Button */}
          <div className="flex items-center justify-end pt-2 border-t border-border">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="gap-2 text-xs font-semibold px-5 h-8"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>
                {initialInvoice
                  ? "حفظ التعديلات"
                  : "إصدار واعتماد الفاتورة فوراً"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          DRAWERS: Customer Drawer & Template Browser Drawer
         ────────────────────────────────────────────────────────────────── */}
      <CustomerDrawer
        open={customerEditDrawerOpen}
        onClose={() => setCustomerEditDrawerOpen(false)}
        customer={selectedCustomer}
        onSaved={(saved) => {
          setCustomersList((prev) =>
            prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c))
          );
          toast({
            title: "تم تحديث العميل",
            message: `تم تعديل بيانات "${saved.nameAr}" بنجاح.`,
          });
        }}
      />

      <CustomerDrawer
        open={customerAddDrawerOpen}
        onClose={() => setCustomerAddDrawerOpen(false)}
        onSaved={(created) => {
          setCustomersList((prev) => [created, ...prev]);
          setSelectedCustomerId(created.id);
          toast({
            title: "تمت إضافة العميل",
            message: `تم حفظ واختيار العميل "${created.nameAr}" بنجاح.`,
          });
        }}
      />

      <TemplateBrowserDrawer
        open={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        selectedTemplateId={templateId}
        companyId={activeCompany?.id}
        invoiceId={initialInvoice?.id}
        customerId={selectedCustomerId || undefined}
        draftInvoice={draftPreview}
        onSelectTemplate={(id) => {
          setTemplateId(id);
          toast({
            title: "تم اعتماد القالب",
            message: `تم تفعيل قالب "${getTemplateById(id).nameAr}" للفاتورة بنجاح.`,
          });
        }}
      />
    </form>
  );
}