import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface AlEntajAlMutamakkinTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

// ─── Safe Arabic Tafqeet (Zero-Undefined Guaranteed) ──────────────────────────

const AR_ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
];

const AR_TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const AR_TENS = [
  "",
  "عشرة",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const AR_HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertGroupAr(n: number): string {
  const safe = Math.max(0, Math.min(999, Math.floor(Number.isFinite(n) ? n : 0)));
  if (safe === 0) return "";

  const h = Math.floor(safe / 100);
  const rem = safe % 100;
  const parts: string[] = [];

  const hundredWord = AR_HUNDREDS[h] ?? "";
  if (h > 0 && hundredWord) {
    parts.push(hundredWord);
  }

  if (rem > 0) {
    if (rem <= 10) {
      const w = AR_ONES[rem] ?? "";
      if (w) parts.push(w);
    } else if (rem < 20) {
      const w = AR_TEENS[rem - 10] ?? "";
      if (w) parts.push(w);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const onesWord = AR_ONES[u] ?? "";
      const tensWord = AR_TENS[t] ?? "";
      if (onesWord && tensWord) {
        parts.push(`${onesWord} و ${tensWord}`);
      } else if (tensWord) {
        parts.push(tensWord);
      } else if (onesWord) {
        parts.push(onesWord);
      }
    }
  }

  return parts.join(" و ");
}

function numberToArabicWords(num: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(num) ? num : 0));
  if (safe === 0) return "صفر";

  const billions = Math.floor(safe / 1_000_000_000);
  const millions = Math.floor((safe % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((safe % 1_000_000) / 1_000);
  const remainder = safe % 1_000;

  const segments: string[] = [];

  if (billions > 0) {
    if (billions === 1) segments.push("مليار");
    else if (billions === 2) segments.push("ملياران");
    else if (billions >= 3 && billions <= 10) {
      segments.push(`${convertGroupAr(billions)} مليارات`);
    } else {
      segments.push(`${convertGroupAr(billions)} مليار`);
    }
  }

  if (millions > 0) {
    if (millions === 1) segments.push("مليون");
    else if (millions === 2) segments.push("مليونان");
    else if (millions >= 3 && millions <= 10) {
      segments.push(`${convertGroupAr(millions)} ملايين`);
    } else {
      segments.push(`${convertGroupAr(millions)} مليون`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) segments.push("ألف");
    else if (thousands === 2) segments.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) {
      segments.push(`${convertGroupAr(thousands)} آلاف`);
    } else {
      segments.push(`${convertGroupAr(thousands)} ألف`);
    }
  }

  if (remainder > 0) {
    const remWords = convertGroupAr(remainder);
    if (remWords) segments.push(remWords);
  }

  return segments.length > 0 ? segments.join(" و ") : "صفر";
}

function tafqeetAr(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (!Number.isFinite(num) || num <= 0) {
    return "صفر ريال فقط لا غير";
  }

  const totalHalalas = Math.round(num * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;

  let text = "";
  if (riyals > 0) {
    text = `${numberToArabicWords(riyals)} ريال`;
  }
  if (halalas > 0) {
    const halalaText = `${numberToArabicWords(halalas)} هللة`;
    text = text ? `${text} و ${halalaText}` : halalaText;
  }

  return text ? `${text} فقط لا غير` : "صفر ريال فقط لا غير";
}

// ─── Safe English Number-to-Words (Zero-Undefined Guaranteed) ─────────────────

const EN_ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const EN_TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertGroupEn(n: number): string {
  const safe = Math.max(0, Math.min(999, Math.floor(Number.isFinite(n) ? n : 0)));
  if (safe === 0) return "";

  const h = Math.floor(safe / 100);
  const rem = safe % 100;
  const parts: string[] = [];

  const hundredWord = EN_ONES[h] ?? "";
  if (h > 0 && hundredWord) {
    parts.push(`${hundredWord} Hundred`);
  }

  if (rem > 0) {
    if (rem < 20) {
      const w = EN_ONES[rem] ?? "";
      if (w) parts.push(w);
    } else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      const tensWord = EN_TENS[t] ?? "";
      const onesWord = EN_ONES[u] ?? "";
      if (tensWord && onesWord) {
        parts.push(`${tensWord}-${onesWord}`);
      } else if (tensWord) {
        parts.push(tensWord);
      } else if (onesWord) {
        parts.push(onesWord);
      }
    }
  }

  return parts.join(" ");
}

function numberToEnglishWords(num: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(num) ? num : 0));
  if (safe === 0) return "Zero";

  const billions = Math.floor(safe / 1_000_000_000);
  const millions = Math.floor((safe % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((safe % 1_000_000) / 1_000);
  const remainder = safe % 1_000;

  const parts: string[] = [];
  if (billions > 0) parts.push(`${convertGroupEn(billions)} Billion`);
  if (millions > 0) parts.push(`${convertGroupEn(millions)} Million`);
  if (thousands > 0) parts.push(`${convertGroupEn(thousands)} Thousand`);
  if (remainder > 0) parts.push(convertGroupEn(remainder));

  return parts.length > 0 ? parts.join(" ") : "Zero";
}

function tafqeetEn(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (!Number.isFinite(num) || num <= 0) {
    return "Zero Riyals only";
  }

  const totalHalalas = Math.round(num * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;

  let text = "";
  if (riyals > 0) {
    text = `${numberToEnglishWords(riyals)} Riyals`;
  }
  if (halalas > 0) {
    const halalaWords = `${numberToEnglishWords(halalas)} Halalas`;
    text = text ? `${text} and ${halalaWords}` : halalaWords;
  }

  return text ? `${text} only` : "Zero Riyals only";
}

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  let str: string;
  if (typeof val === "number") {
    str = Number.isFinite(val) ? String(Number(val.toFixed(10))) : "0.00";
  } else {
    str = String(val).trim();
  }
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1];
  if (decPart === undefined) {
    decPart = "00";
  } else if (decPart.length === 1) {
    decPart = `${decPart}0`;
  }
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = `${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

function formatQtyClean(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0";
  if (Number.isInteger(num)) return String(num);
  return String(Math.round(num * 10000) / 10000);
}

function formatIsoDateTime12h(
  dateStr?: string | null,
  timeStr?: string | null
): string {
  if (!dateStr) return "";
  const cleanDate = dateStr.slice(0, 10);
  if (!timeStr || !timeStr.trim() || timeStr.trim() === "00:00") {
    return cleanDate;
  }
  const parts = timeStr.trim().split(":");
  const rawHour = parseInt(parts[0] || "0", 10);
  const mins = (parts[1] || "00").padStart(2, "0");
  if (!Number.isFinite(rawHour)) {
    return `${cleanDate} ${timeStr.trim()}`;
  }
  const period = rawHour >= 12 ? "PM" : "AM";
  const h12 = rawHour % 12 || 12;
  return `${cleanDate} ${String(h12).padStart(2, "0")}:${mins} ${period}`;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlEntajAlMutamakkinTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: AlEntajAlMutamakkinTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Dynamic Company Fields
  const companyNameAr = company.nameAr || company.nameEn || "";
  const companyActivityAr = company.organizationType || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";

  // Footer address & mobile line (strictly dynamic)
  const addressParts = [
    company.addressCity,
    company.addressDistrict,
    company.addressStreet,
    company.addressBuildingNumber,
    company.addressPostalCode,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));
  const companyAddressStr = addressParts.join("- ");
  const companyMobileStr = company.phone || "";

  // Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateTimeStr = formatIsoDateTime12h(
    invoice.issueDate,
    invoice.issueTime
  );
  const isSimplified = invoice.invoiceType === "simplified";
  const mainTitleText = isSimplified
    ? "Simplified Tax Invoice فاتورة ضريبية مبسطة"
    : "Tax Invoice فاتورة ضريبية";
  const invoiceTypeValText = isSimplified ? "نقدي / Cash" : "آجل / Credit";

  // Customer Fields
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerMobile = customer.phone || "";
  const customerVat = customer.vatNumber || "";
  const customerDistrict = customer.addressDistrict || "";
  const customerCity = customer.addressCity || "";
  const customerPostal = customer.addressPostalCode || "";
  const customerBuilding = customer.addressBuildingNumber || "";

  // Line Items & Financial Calculations
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal =
      item.lineSubtotal !== undefined &&
      item.lineSubtotal !== null &&
      item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Math.max(0, gross - lineDiscount);

    const vatPct =
      item.vatRate !== undefined && item.vatRate !== null
        ? normalizeVatRatePercent(toNumber(item.vatRate))
        : 15;

    const lineVat =
      item.lineVat !== undefined &&
      item.lineVat !== null &&
      item.lineVat !== ""
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatPct / 100);

    const lineTotal =
      item.lineTotal !== undefined &&
      item.lineTotal !== null &&
      item.lineTotal !== ""
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;

    const discountPct = gross > 0 ? (lineDiscount / gross) * 100 : 0;
    const unit = (item as { unit?: string }).unit || "وحدة";
    const subDescription =
      (item as { productDescription?: string }).productDescription || "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      subDesc: subDescription,
      qty,
      unit,
      unitPrice,
      lineDiscount,
      discountPct,
      taxableSubtotal,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null &&
    invoice.subtotal !== undefined &&
    invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null &&
    invoice.vatAmount !== undefined &&
    invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);

  const grandTotal =
    invoice.total !== null &&
    invoice.total !== undefined &&
    invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const arabicWordsText = tafqeetAr(grandTotal);
  const englishWordsText = tafqeetEn(grandTotal);

  // Dynamic Terms & Notes from code/invoice
  const dynamicTermsLines = invoice.terms
    ? invoice.terms
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  const dynamicNotesText = invoice.notes?.trim() || "";

  // Single-page dynamic height calculation
  const extraItemsCount = Math.max(0, rows.length - 6);
  let extraHeight = extraItemsCount * 28;
  if (dynamicTermsLines.length > 0) {
    extraHeight += dynamicTermsLines.length * 14;
  }
  if (dynamicNotesText) {
    extraHeight += 20;
  }
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={companyNameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Al-Entaj Al-Mutamakkin"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Outer Thin Black Border Enclosing the Entire Page */}
        <View style={styles.outerPageBox}>
          {/* ─── 1. TOP HEADER (LOGO LEFT | ZATCA QR CENTER | COMPANY INFO RIGHT) ─── */}
          <View style={styles.topHeaderRow}>
            {/* Left: Company Logo (conditional — no placeholder) */}
            <View style={styles.headerLogoCol}>
              {logoSource ? (
                <Image src={logoSource} style={styles.logoImage} />
              ) : null}
            </View>

            {/* Center: ZATCA QR Code */}
            <View style={styles.headerQrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>

            {/* Right: Company Arabic Name, Activity, VAT No., CR No. */}
            <View style={styles.headerCompanyCol}>
              {companyNameAr ? (
                <Text style={styles.companyNameAr}>{companyNameAr}</Text>
              ) : null}

              {companyActivityAr ? (
                <Text style={styles.companyActivityAr}>{companyActivityAr}</Text>
              ) : null}

              {companyVat ? (
                <View style={styles.companyRegRow}>
                  <Text style={styles.companyRegText}>{companyVat}</Text>
                  <Text style={styles.companyRegText}> </Text>
                  <Text style={styles.companyRegText}>الرقم الضريبي</Text>
                </View>
              ) : null}

              {companyCr ? (
                <View style={styles.companyRegRow}>
                  <Text style={styles.companyRegText}>{companyCr}</Text>
                  <Text style={styles.companyRegText}> </Text>
                  <Text style={styles.companyRegText}>س.ت</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── 2. BILINGUAL DOCUMENT TITLE ─── */}
          <View style={styles.titleRow}>
            <Text style={styles.mainTitleText}>{mainTitleText}</Text>
          </View>

          {/* ─── 3. INVOICE METADATA TABLE (3 ROWS) ─── */}
          <View style={styles.metaTable}>
            {/* Row 1: Invoice No */}
            <View style={styles.gridRow}>
              <View style={styles.metaColLeft}>
                <Text style={styles.cellBoldLeft}>Invoice No:</Text>
              </View>
              <View style={styles.metaColCenter}>
                <Text style={styles.cellBoldCenter}>{invoiceNumber}</Text>
              </View>
              <View style={[styles.metaColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم الفاتورة:</Text>
              </View>
            </View>

            {/* Row 2: Issue Date */}
            <View style={styles.gridRow}>
              <View style={styles.metaColLeft}>
                <Text style={styles.cellBoldLeft}>Issue Date:</Text>
              </View>
              <View style={styles.metaColCenter}>
                <Text style={styles.cellBoldCenter}>{issueDateTimeStr}</Text>
              </View>
              <View style={[styles.metaColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>تاريخ الاصدار:</Text>
              </View>
            </View>

            {/* Row 3: Invoice Type */}
            <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.metaColLeft}>
                <Text style={styles.cellBoldLeft}>Invoice Type:</Text>
              </View>
              <View style={styles.metaColCenter}>
                <Text style={styles.cellBoldCenter}>{invoiceTypeValText}</Text>
              </View>
              <View style={[styles.metaColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>نوع الفاتورة:</Text>
              </View>
            </View>
          </View>

          {/* ─── 4. CLIENT DETAILS SECTION ─── */}
          <View style={styles.clientDetailsTable}>
            {/* Section Title Header Row */}
            <View style={styles.clientSectionHeaderRow}>
              <Text style={styles.navyHeaderEn}>Client Details</Text>
              <Text style={styles.navyHeaderAr}>تفاصيل العميل</Text>
            </View>

            {/* Row 1: Client */}
            <View style={styles.gridRow}>
              <View style={styles.clientColLeft}>
                <Text style={styles.cellBoldLeft}>Client</Text>
              </View>
              <View style={styles.clientColCenter}>
                <Text style={styles.cellBoldCenter}>{customerName}</Text>
              </View>
              <View style={[styles.clientColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>العميل</Text>
              </View>
            </View>

            {/* Row 2: Mobile */}
            <View style={styles.gridRow}>
              <View style={styles.clientColLeft}>
                <Text style={styles.cellBoldLeft}>Mobile</Text>
              </View>
              <View style={styles.clientColCenter}>
                <Text style={styles.cellBoldCenter}>{customerMobile}</Text>
              </View>
              <View style={[styles.clientColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الجوال</Text>
              </View>
            </View>

            {/* Row 3: VAT Number */}
            <View style={styles.gridRow}>
              <View style={styles.clientColLeft}>
                <Text style={styles.cellBoldLeft}>VAT Number</Text>
              </View>
              <View style={styles.clientColCenter}>
                <Text style={styles.cellBoldCenter}>{customerVat}</Text>
              </View>
              <View style={[styles.clientColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرقم الضريبي</Text>
              </View>
            </View>

            {/* Row 4: District & City (6-Column Aligned Split) */}
            <View style={styles.gridRow}>
              <View style={styles.subCol1LabelEn}>
                <Text style={styles.cellBoldLeft}>District</Text>
              </View>
              <View style={styles.subCol2Val}>
                <Text style={styles.cellBoldCenter}>{customerDistrict}</Text>
              </View>
              <View style={styles.subCol3LabelAr}>
                <Text style={styles.cellBoldRight}>الحي</Text>
              </View>
              <View style={styles.subCol4LabelEn}>
                <Text style={styles.cellBoldLeft}>City</Text>
              </View>
              <View style={styles.subCol5Val}>
                <Text style={styles.cellBoldCenter}>{customerCity}</Text>
              </View>
              <View style={[styles.subCol6LabelAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>المدينة</Text>
              </View>
            </View>

            {/* Row 5: Postal Code & Building No. (6-Column Aligned Split) */}
            <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.subCol1LabelEn}>
                <Text style={styles.cellBoldLeft}>Postal Code</Text>
              </View>
              <View style={styles.subCol2Val}>
                <Text style={styles.cellBoldCenter}>{customerPostal}</Text>
              </View>
              <View style={styles.subCol3LabelAr}>
                <Text style={styles.cellBoldRight}>الرمز البريدي</Text>
              </View>
              <View style={styles.subCol4LabelEn}>
                <Text style={styles.cellBoldLeft}>Building No.</Text>
              </View>
              <View style={styles.subCol5Val}>
                <Text style={styles.cellBoldCenter}>{customerBuilding}</Text>
              </View>
              <View style={[styles.subCol6LabelAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم المبنى</Text>
              </View>
            </View>
          </View>

          {/* ─── 5. LINE ITEMS TABLE (8 COLUMNS, LEFT-TO-RIGHT) ─── */}
          <View style={styles.itemsTable}>
            {/* Header Row (Medium Gray Shaded) */}
            <View style={styles.itemsHeaderRow}>
              {/* 1. Net Amount / الاجمالي */}
              <View style={[styles.thCell, styles.colNet]}>
                <Text style={styles.thAr}>الاجمالي</Text>
                <Text style={styles.thEn}>Net Amount</Text>
              </View>

              {/* 2. VAT / الضريبة */}
              <View style={[styles.thCell, styles.colVat]}>
                <Text style={styles.thAr}>الضريبة</Text>
                <Text style={styles.thEn}>VAT</Text>
              </View>

              {/* 3. Subtotal / المجموع */}
              <View style={[styles.thCell, styles.colSubtotal]}>
                <Text style={styles.thAr}>المجموع</Text>
                <Text style={styles.thEn}>Subtotal</Text>
              </View>

              {/* 4. unit Discount / خصم الوحدة */}
              <View style={[styles.thCell, styles.colDiscount]}>
                <Text style={styles.thAr}>خصم الوحدة</Text>
                <Text style={styles.thEn}>unit Discount</Text>
              </View>

              {/* 5. Unit Price / سعر الوحدة */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thAr}>سعر الوحدة</Text>
                <Text style={styles.thEn}>Unit Price</Text>
              </View>

              {/* 6. Quantity / الكمية */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Quantity</Text>
              </View>

              {/* 7. Item / الصنف/الخدمة */}
              <View style={[styles.thCell, styles.colItem]}>
                <Text style={styles.thAr}>الصنف/الخدمة</Text>
                <Text style={styles.thEn}>Item</Text>
              </View>

              {/* 8. S.No. / # */}
              <View style={[styles.thCell, styles.colNo, { borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>#</Text>
                <Text style={styles.thEn}>S.No.</Text>
              </View>
            </View>

            {/* Table Data Rows */}
            {rows.map((row) => (
              <View key={row.key} style={styles.itemsDataRow} wrap={false}>
                {/* 1. Net Amount */}
                <View style={[styles.tdCell, styles.colNet]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.lineTotal)}
                  </Text>
                </View>

                {/* 2. VAT */}
                <View style={[styles.tdCell, styles.colVat]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.lineVat)}
                  </Text>
                </View>

                {/* 3. Subtotal */}
                <View style={[styles.tdCell, styles.colSubtotal]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.taxableSubtotal)}
                  </Text>
                </View>

                {/* 4. unit Discount */}
                <View style={[styles.tdCell, styles.colDiscount]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.lineDiscount)} ={" "}
                    {row.discountPct.toFixed(2)}%
                  </Text>
                </View>

                {/* 5. Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.unitPrice)}
                  </Text>
                </View>

                {/* 6. Quantity & Generic Unit */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <View style={styles.qtyUnitRow}>
                    <Text style={styles.tdCenterBold}>{row.unit}</Text>
                    <Text style={styles.tdCenterBold}> </Text>
                    <Text style={styles.tdCenterBold}>
                      {formatQtyClean(row.qty)}
                    </Text>
                  </View>
                </View>

                {/* 7. Item / Product Description */}
                <View style={[styles.tdCell, styles.colItem]}>
                  <Text style={styles.tdItemTitle}>{row.desc}</Text>
                  {row.subDesc ? (
                    <Text style={styles.tdItemSub}>{row.subDesc}</Text>
                  ) : null}
                </View>

                {/* 8. S.No. */}
                <View style={[styles.tdCell, styles.colNo, { borderRightWidth: 0 }]}>
                  <Text style={styles.tdCenterBold}>{row.index}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 6. TOTALS & BILINGUAL TAFQEET TABLE ─── */}
          <View style={styles.totalsTable} wrap={false}>
            {/* Row 1: Total (Excluding VAT) */}
            <View style={styles.gridRow}>
              <View style={styles.totColLeft}>
                <Text style={styles.cellBoldLeft}>Total (Excluding VAT)</Text>
              </View>
              <View style={styles.totColCenter}>
                <Text style={styles.cellBoldCenter}>
                  {formatExactAmount(taxableAmount)}
                </Text>
              </View>
              <View style={[styles.totColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>
                  المجموع (غير شامل ضريبة القيمة المضافة)
                </Text>
              </View>
            </View>

            {/* Optional Invoice Discount Row */}
            {invoiceDiscount > 0 ? (
              <View style={styles.gridRow}>
                <View style={styles.totColLeft}>
                  <Text style={styles.cellBoldLeft}>Invoice Discount</Text>
                </View>
                <View style={styles.totColCenter}>
                  <Text style={styles.cellBoldCenter}>
                    -{formatExactAmount(invoiceDiscount)}
                  </Text>
                </View>
                <View style={[styles.totColRight, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>خصم الفاتورة</Text>
                </View>
              </View>
            ) : null}

            {/* Row 2: Total VAT (15%) */}
            <View style={styles.gridRow}>
              <View style={styles.totColLeft}>
                <Text style={styles.cellBoldLeft}>Total VAT (15%)</Text>
              </View>
              <View style={styles.totColCenter}>
                <Text style={styles.cellBoldCenter}>
                  {formatExactAmount(totalVat)}
                </Text>
              </View>
              <View style={[styles.totColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>
                  مجموع ضريبة القيمة المضافة (15%)
                </Text>
              </View>
            </View>

            {/* Row 3: Net Amount (Including VAT) */}
            <View style={styles.gridRow}>
              <View style={styles.totColLeft}>
                <Text style={styles.cellBoldLeft}>
                  Net Amount (Including VAT)
                </Text>
              </View>
              <View style={styles.totColCenter}>
                <Text style={styles.cellBoldCenter}>
                  {formatExactAmount(grandTotal)}
                </Text>
              </View>
              <View style={[styles.totColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>
                  الإجمالي (شامل ضريبة القيمة المضافة)
                </Text>
              </View>
            </View>

            {/* Row 4: Paid Cash / Balance Due */}
            <View style={styles.gridRow}>
              <View style={styles.totColLeft}>
                <Text style={styles.cellBoldLeft}>
                  {isSimplified ? "Paid Cash" : "Balance Due"}
                </Text>
              </View>
              <View style={styles.totColCenter}>
                <Text style={styles.cellBoldCenter}>
                  {formatExactAmount(grandTotal)}
                </Text>
              </View>
              <View style={[styles.totColRight, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>
                  {isSimplified ? "المدفوع نقداً" : "الرصيد المستحق"}
                </Text>
              </View>
            </View>

            {/* Row 5: Full-Width Arabic Tafqeet */}
            <View style={styles.tafqeetArRow}>
              <Text style={styles.tafqeetArText}>{arabicWordsText}</Text>
            </View>

            {/* Row 6: Full-Width English Tafqeet */}
            <View style={[styles.tafqeetEnRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.tafqeetEnText}>{englishWordsText}</Text>
            </View>
          </View>

          {/* ─── 7. DYNAMIC TERMS & NOTES SECTION (FROM invoice.terms / invoice.notes) ─── */}
          {(dynamicTermsLines.length > 0 || dynamicNotesText) ? (
            <View style={styles.termsSection} wrap={false}>
              {dynamicTermsLines.map((line, idx) => (
                <Text key={idx} style={styles.termsLineText}>
                  {line}
                </Text>
              ))}
              {dynamicNotesText ? (
                <Text style={[styles.termsLineText, { marginTop: 4 }]}>
                  {dynamicNotesText}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* ─── 8. FOOTER: PAGE 1 OF 1 (LEFT) & COMPANY ADDRESS / MOBILE (RIGHT) ─── */}
          <View style={styles.footerRow} wrap={false}>
            <Text style={styles.pageIndicatorText}>Page 1 of 1</Text>

            {(companyAddressStr || companyMobileStr) ? (
              <View style={styles.footerCompanyInfo}>
                {companyMobileStr ? (
                  <View style={styles.footerInlineGroup}>
                    <Text style={styles.footerTextBold}>{companyMobileStr}</Text>
                    <Text style={styles.footerTextBold}> : </Text>
                    <Text style={styles.footerTextBold}>الجوال</Text>
                  </View>
                ) : null}

                {companyAddressStr && companyMobileStr ? (
                  <Text style={styles.footerTextBold}> _ </Text>
                ) : null}

                {companyAddressStr ? (
                  <View style={styles.footerInlineGroup}>
                    <Text style={styles.footerTextBold}>{companyAddressStr}</Text>
                    <Text style={styles.footerTextBold}> : </Text>
                    <Text style={styles.footerTextBold}>العنوان</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES (PIXEL-PERFECT TAJAWAL TYPOGRAPHY) ────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    padding: 22,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  outerPageBox: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: "#333333",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
    flexDirection: "column",
  },

  // 1. Top Header
  topHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  headerLogoCol: {
    width: "32%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logoImage: {
    width: 118,
    height: 76,
    objectFit: "contain",
  },
  headerQrCol: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 92,
    height: 92,
  },
  qrPlaceholder: {
    width: 92,
    height: 92,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  headerCompanyCol: {
    width: "36%",
    alignItems: "center",
    justifyContent: "center",
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 11.5,
    color: "#000000",
    textAlign: "center",
    marginBottom: 2,
  },
  companyActivityAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
    textAlign: "center",
    marginBottom: 3,
  },
  companyRegRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  companyRegText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
    textAlign: "center",
  },

  // 2. Main Document Title
  titleRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 6,
  },
  mainTitleText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#000000",
    textAlign: "center",
  },

  // 3. Invoice Metadata Table
  metaTable: {
    width: "100%",
    borderWidth: 0.7,
    borderColor: "#BFBFBF",
    marginBottom: 6,
  },
  gridRow: {
    width: "100%",
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderColor: "#BFBFBF",
    minHeight: 16.5,
    alignItems: "center",
  },
  metaColLeft: {
    width: "36%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  metaColCenter: {
    width: "29%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  metaColRight: {
    width: "35%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },

  // 4. Client Details Table
  clientDetailsTable: {
    width: "100%",
    borderWidth: 0.7,
    borderColor: "#BFBFBF",
    marginBottom: 5,
  },
  clientSectionHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.7,
    borderColor: "#BFBFBF",
    minHeight: 17,
    paddingHorizontal: 4,
  },
  navyHeaderEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#1E3A8A",
    textAlign: "left",
  },
  navyHeaderAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#1E3A8A",
    textAlign: "right",
  },
  clientColLeft: {
    width: "22%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  clientColCenter: {
    width: "58%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  clientColRight: {
    width: "20%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },

  // 6-Column Sub-grid for District / City & Postal Code / Building No.
  subCol1LabelEn: {
    width: "22%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  subCol2Val: {
    width: "21%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  subCol3LabelAr: {
    width: "13%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 3,
  },
  subCol4LabelEn: {
    width: "11%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 3,
  },
  subCol5Val: {
    width: "13%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  subCol6LabelAr: {
    width: "20%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },

  cellBoldLeft: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#000000",
    textAlign: "left",
  },
  cellBoldCenter: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#000000",
    textAlign: "center",
  },
  cellBoldRight: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#000000",
    textAlign: "right",
  },

  // 5. Line Items Table (8 Columns)
  itemsTable: {
    width: "100%",
    borderWidth: 0.9,
    borderColor: "#222222",
    marginBottom: 4,
  },
  itemsHeaderRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#C8C8C8",
    borderBottomWidth: 0.9,
    borderColor: "#222222",
    minHeight: 26,
    alignItems: "center",
  },
  itemsDataRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.8,
    borderColor: "#222222",
    minHeight: 19,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.8,
    borderColor: "#222222",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  tdCell: {
    borderRightWidth: 0.8,
    borderColor: "#222222",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.3,
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
    textAlign: "center",
  },
  qtyUnitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tdItemTitle: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
    textAlign: "center",
  },
  tdItemSub: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#333333",
    textAlign: "center",
    marginTop: 1,
  },

  // Column Widths (Sum = 100%)
  colNet: { width: "11%" },
  colVat: { width: "10%" },
  colSubtotal: { width: "11%" },
  colDiscount: { width: "12%" },
  colPrice: { width: "11%" },
  colQty: { width: "9%" },
  colItem: { width: "30%" },
  colNo: { width: "6%" },

  // 6. Totals & Bilingual Tafqeet Table
  totalsTable: {
    width: "100%",
    borderWidth: 0.7,
    borderColor: "#BFBFBF",
    marginBottom: 8,
  },
  totColLeft: {
    width: "36%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  totColCenter: {
    width: "31%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  totColRight: {
    width: "33%",
    borderRightWidth: 0.7,
    borderColor: "#BFBFBF",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  tafqeetArRow: {
    width: "100%",
    borderBottomWidth: 0.7,
    borderColor: "#BFBFBF",
    minHeight: 16.5,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 6,
  },
  tafqeetArText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "right",
  },
  tafqeetEnRow: {
    width: "100%",
    borderBottomWidth: 0.7,
    borderColor: "#BFBFBF",
    minHeight: 16.5,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 6,
  },
  tafqeetEnText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "left",
  },

  // 7. Dynamic Terms & Notes Section
  termsSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  termsLineText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 1.5,
  },

  // 8. Bottom Footer
  footerRow: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  pageIndicatorText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#1E3A8A",
    textAlign: "left",
  },
  footerCompanyInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 32,
  },
  footerInlineGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },
});
