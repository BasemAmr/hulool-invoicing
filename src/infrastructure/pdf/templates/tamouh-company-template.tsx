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

export interface TamouhCompanyTemplateProps {
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
  "اربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
];

const AR_TEENS = [
  "عشرة",
  "احد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "اربعة عشر",
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
  "اربعون",
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
  "اربعمائة",
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
        parts.push(`${onesWord} و${tensWord}`);
      } else if (tensWord) {
        parts.push(tensWord);
      } else if (onesWord) {
        parts.push(onesWord);
      }
    }
  }

  return parts.join(" و");
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

  return segments.length > 0 ? segments.join(" و") : "صفر";
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
    text = text ? `${text} و${halalaText}` : halalaText;
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
        parts.push(`${tensWord} ${onesWord}`);
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
    return "Zero Riyals";
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

  return text || "Zero Riyals";
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
  // Regex literals need one escape; doubled escapes match literal backslashes.
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = `${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

function formatQty(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateISO(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatArabic12hTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (!trimmed || trimmed === "00:00") return "";
  const parts = trimmed.split(":");
  const rawHour = parseInt(parts[0] || "0", 10);
  const mins = (parts[1] || "00").padStart(2, "0");
  if (!Number.isFinite(rawHour)) return trimmed;
  const isPm = rawHour >= 12;
  const h12 = rawHour % 12 || 12;
  const period = isPm ? "م" : "ص";
  return `${String(h12).padStart(2, "0")}:${mins} ${period}`;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TamouhCompanyTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: TamouhCompanyTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Dynamic Company Fields
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || company.nameAr || "";
  const companyActivityAr = company.organizationType || "";
  const companyActivityEn =
    (company as { activityEn?: string }).activityEn || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyPhone = company.phone || "";
  const companyMobile =
    (company as { mobile?: string }).mobile || "";

  // Footer address line (strictly dynamic)
  const footerAddressParts = [
    company.addressCity,
    company.addressDistrict
      ? `حي ${company.addressDistrict.replace(/^حي\s+/, "")}`
      : null,
    company.addressStreet
      ? `شارع ${company.addressStreet.replace(/^شارع\s+/, "")}`
      : null,
    company.addressBuildingNumber
      ? `مبنى ${company.addressBuildingNumber}`
      : null,
    company.addressPostalCode,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));
  const footerAddressLine = footerAddressParts.join(" - ");

  // Dynamic Customer Fields
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerAddressParts = [
    customer.addressCity,
    customer.addressDistrict,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressPostalCode,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));
  const customerAddress = customerAddressParts.join(" - ");

  // Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateISO(invoice.issueDate);
  const issueTimeStr = formatArabic12hTime(invoice.issueTime);
  const isCash = invoice.invoiceType === "simplified";
  const paymentKindLabel = isCash ? "نقدية  Cash" : "آجل  Credit";
  const invoiceDetailsNote =
    invoice.notes?.trim() ||
    (invoiceNumber ? `فاتورة ضريبية برقم ${invoiceNumber}` : "");

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

    const unit = (item as { unit?: string }).unit || "وحدة";
    const itemSubDesc =
      (item as { productDescription?: string }).productDescription || "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      itemName: item.description || "",
      itemDesc: itemSubDesc,
      unit,
      qty,
      unitPrice,
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
  const totalDiscountVal = computedDiscount + invoiceDiscount;
  const taxableAfterDiscount = Math.max(0, taxableAmount - invoiceDiscount);

  const grandTotal =
    invoice.total !== null &&
    invoice.total !== undefined &&
    invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const paidCashAmount = isCash ? grandTotal : 0;
  const remainingAmount = isCash ? 0 : grandTotal;

  const arabicWordsText = tafqeetAr(grandTotal);
  const englishWordsText = tafqeetEn(grandTotal);


  // Single-page dynamic height calculation
  const extraItemsCount = Math.max(0, rows.length - 6);
  const extraHeight = extraItemsCount * 24;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={companyNameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Tamouh Company"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Outer Page Frame */}
        <View style={styles.outerPageFrame}>
          {/* ─── 1. TOP COMPANY HEADER (EN LEFT | LOGO CENTER | AR RIGHT) ─── */}
          <View style={styles.headerRow}>
            {/* Left: English Company Block (LTR) */}
            <View style={styles.headerLeftCol}>
              {companyNameEn ? (
                <Text style={styles.companyNameEn}>{companyNameEn}</Text>
              ) : null}

              {companyActivityEn ? (
                <Text style={styles.activityEnText}>{companyActivityEn}</Text>
              ) : null}

              {companyVat ? (
                <View style={styles.enMetaLine}>
                  <Text style={styles.enMetaLabel}>VAT No.</Text>
                  <Text style={styles.enMetaVal}>{companyVat}</Text>
                </View>
              ) : null}

              {companyCr ? (
                <View style={styles.enMetaLine}>
                  <Text style={styles.enMetaLabel}>C.R</Text>
                  <Text style={styles.enMetaVal}>{companyCr}</Text>
                </View>
              ) : null}

              {companyPhone ? (
                <View style={styles.enMetaLine}>
                  <Text style={styles.enMetaLabel}>Tel</Text>
                  <Text style={styles.enMetaVal}>{companyPhone}</Text>
                </View>
              ) : null}

              {companyMobile ? (
                <View style={styles.enMetaLine}>
                  <Text style={styles.enMetaLabel}>Mobile</Text>
                  <Text style={styles.enMetaVal}>{companyMobile}</Text>
                </View>
              ) : null}
            </View>

            {/* Center: Company Logo (conditional — no placeholder when absent) */}
            <View style={styles.headerCenterCol}>
              {logoSource ? (
                <Image src={logoSource} style={styles.logoImage} />
              ) : null}
            </View>

            {/* Right: Arabic Company Block (RTL) */}
            <View style={styles.headerRightCol}>
              {companyNameAr ? (
                <Text style={styles.companyNameAr}>{companyNameAr}</Text>
              ) : null}

              {companyActivityAr ? (
                <Text style={styles.activityArText}>{companyActivityAr}</Text>
              ) : null}

              {companyVat ? (
                <View style={styles.arMetaLine}>
                  <Text style={styles.arMetaVal}>{companyVat}</Text>
                  <Text style={styles.arMetaColon}> : </Text>
                  <Text style={styles.arMetaLabel}>الرقم الضريبي</Text>
                </View>
              ) : null}

              {companyCr ? (
                <View style={styles.arMetaLine}>
                  <Text style={styles.arMetaVal}>{companyCr}</Text>
                  <Text style={styles.arMetaColon}> : </Text>
                  <Text style={styles.arMetaLabel}>السجل التجاري</Text>
                </View>
              ) : null}

              {companyPhone ? (
                <View style={styles.arMetaLine}>
                  <Text style={styles.arMetaVal}>{companyPhone}</Text>
                  <Text style={styles.arMetaColon}> : </Text>
                  <Text style={styles.arMetaLabel}>هاتف</Text>
                </View>
              ) : null}

              {companyMobile ? (
                <View style={styles.arMetaLine}>
                  <Text style={styles.arMetaVal}>{companyMobile}</Text>
                  <Text style={styles.arMetaColon}> : </Text>
                  <Text style={styles.arMetaLabel}>جوال</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Horizontal Divider Line */}
          <View style={styles.topDividerLine} />

          {/* ─── 2. MAIN DOCUMENT TITLE ─── */}
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitleAr}>فاتورة ضريبية</Text>
          </View>

          {/* ─── 3. TWO SIDE-BY-SIDE GRID TABLES (CUSTOMER LEFT | INVOICE META RIGHT) ─── */}
          <View style={styles.dualGridRow}>
            {/* Left Table: Customer Details */}
            <View style={styles.customerTable}>
              {/* Row 1: Customer Name */}
              <View style={styles.gridTableRow}>
                <View style={styles.custColEn}>
                  <Text style={styles.gridLabelText}>Coustmer Name</Text>
                </View>
                <View style={styles.custColVal}>
                  <Text style={styles.gridValTextBold}>{customerName}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>اسم العميل  :</Text>
                </View>
              </View>

              {/* Row 2: Customer VAT No. */}
              <View style={styles.gridTableRow}>
                <View style={styles.custColEn}>
                  <Text style={styles.gridLabelText}>Coustmer NO.</Text>
                </View>
                <View style={styles.custColVal}>
                  <Text style={styles.gridValTextBold}>{customerVat}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>الرقم الضريبي:</Text>
                </View>
              </View>

              {/* Row 3: Customer Mobile */}
              <View style={styles.gridTableRow}>
                <View style={styles.custColEn}>
                  <Text style={styles.gridLabelText}>customer mobile</Text>
                </View>
                <View style={styles.custColVal}>
                  <Text style={styles.gridValTextBold}>{customerPhone}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>جوال العميل:</Text>
                </View>
              </View>

              {/* Row 4: Customer Address */}
              <View style={[styles.gridTableRow, { borderBottomWidth: 0 }]}>
                <View style={styles.custColAddrVal}>
                  <Text style={styles.gridValText}>{customerAddress}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>عنوان العميل :</Text>
                </View>
              </View>
            </View>

            {/* Right Table: Invoice Metadata */}
            <View style={styles.metaTable}>
              {/* Row 1: Invoice No. */}
              <View style={styles.gridTableRow}>
                <View style={styles.metaColEn}>
                  <Text style={styles.gridLabelText}>Invoice No.</Text>
                </View>
                <View style={styles.metaColVal}>
                  <Text style={styles.gridValTextBold}>{invoiceNumber}</Text>
                </View>
                <View style={[styles.metaColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>رقم الفاتورة:</Text>
                </View>
              </View>

              {/* Row 2: Invoice Date & Time */}
              <View style={styles.gridTableRow}>
                <View style={styles.metaColEn}>
                  <Text style={styles.gridLabelText}>Invoice Date</Text>
                </View>
                <View style={styles.metaColValSplit}>
                  <View style={styles.metaTimeSubCell}>
                    <Text style={styles.gridValTextBold}>{issueTimeStr}</Text>
                  </View>
                  <View style={styles.metaDateSubCell}>
                    <Text style={styles.gridValTextBold}>{issueDateStr}</Text>
                  </View>
                </View>
                <View style={[styles.metaColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>التاريخ :</Text>
                </View>
              </View>

              {/* Row 3: Payment Kind */}
              <View style={styles.gridTableRow}>
                <View style={styles.metaColEn}>
                  <Text style={styles.gridLabelText}>payment Kind</Text>
                </View>
                <View style={styles.metaColVal}>
                  <Text style={styles.gridValTextBold}>{paymentKindLabel}</Text>
                </View>
                <View style={[styles.metaColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>طريقة الدفع:</Text>
                </View>
              </View>

              {/* Row 4: Invoice Notes / Details */}
              <View style={[styles.gridTableRow, { borderBottomWidth: 0 }]}>
                <View style={styles.metaDetailsValCell}>
                  <Text style={styles.gridValTextBold}>{invoiceDetailsNote}</Text>
                </View>
                <View style={[styles.metaDetailsLabelCell, { borderRightWidth: 0 }]}>
                  <Text style={styles.gridLabelText}>ملاحظات الفاتورة Details</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── 4. ITEMS TABLE (9 COLUMNS, LEFT-TO-RIGHT AS IN REFERENCE) ─── */}
          <View style={styles.itemsTable}>
            {/* Header Row */}
            <View style={styles.itemsHeaderRow}>
              {/* 1. NET / الصافي */}
              <View style={[styles.thCell, styles.colNet]}>
                <Text style={styles.thAr}>الصافي</Text>
                <Text style={styles.thEn}>NET</Text>
              </View>

              {/* 2. VAT / الضريبة */}
              <View style={[styles.thCell, styles.colVat]}>
                <Text style={styles.thAr}>الضريبة</Text>
                <Text style={styles.thEn}>VAT</Text>
              </View>

              {/* 3. TOTAL / الاجمالي */}
              <View style={[styles.thCell, styles.colTotal]}>
                <Text style={styles.thAr}>الاجمالي</Text>
                <Text style={styles.thEn}>TOTAL</Text>
              </View>

              {/* 4. UNIT PRICE / سعر الوحدة */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thAr}>سعر الوحدة</Text>
                <Text style={styles.thEn}>UNIT PRICE</Text>
              </View>

              {/* 5. Quantity / الكمية */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Quantity</Text>
              </View>

              {/* 6. Unit / الوحدة */}
              <View style={[styles.thCell, styles.colUnit]}>
                <Text style={styles.thAr}>الوحدة</Text>
                <Text style={styles.thEn}>Unit</Text>
              </View>

              {/* 7. DESCRIPTION / الوصف */}
              <View style={[styles.thCell, styles.colDesc]}>
                <Text style={styles.thAr}>الوصف</Text>
                <Text style={styles.thEn}>DESCRIPTION</Text>
              </View>

              {/* 8. ITEM / الصنف */}
              <View style={[styles.thCell, styles.colItem]}>
                <Text style={styles.thAr}>الصنف</Text>
                <Text style={styles.thEn}>ITEM</Text>
              </View>

              {/* 9. NO / م */}
              <View style={[styles.thCell, styles.colNo, { borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>م</Text>
                <Text style={styles.thEn}>NO</Text>
              </View>
            </View>

            {/* Data Rows */}
            {rows.map((row) => (
              <View key={row.key} style={styles.itemsDataRow} wrap={false}>
                {/* 1. NET */}
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

                {/* 3. TOTAL (Before VAT) */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.taxableSubtotal)}
                  </Text>
                </View>

                {/* 4. UNIT PRICE */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.unitPrice)}
                  </Text>
                </View>

                {/* 5. Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdCenterBold}>{formatQty(row.qty)}</Text>
                </View>

                {/* 6. Unit */}
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.tdCenterText}>{row.unit}</Text>
                </View>

                {/* 7. DESCRIPTION */}
                <View style={[styles.tdCell, styles.colDesc]}>
                  <Text style={styles.tdRightText}>{row.itemDesc}</Text>
                </View>

                {/* 8. ITEM */}
                <View style={[styles.tdCell, styles.colItem]}>
                  <Text style={styles.tdCenterText}>{row.itemName}</Text>
                </View>

                {/* 9. NO */}
                <View style={[styles.tdCell, styles.colNo, { borderRightWidth: 0 }]}>
                  <Text style={styles.tdCenterBold}>{row.index}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 5. TOTALS + PAYMENT BREAKDOWN (LEFT) & ZATCA QR CODE (RIGHT) ─── */}
          <View style={styles.totalsAndQrSection} wrap={false}>
            {/* Left Boxed Tables: 5 Totals Rows + 2 Payment Rows */}
            <View style={styles.totalsAndPaymentCol}>
              {/* 5 Totals Rows */}
              <View style={styles.totalsBox}>
                {/* Row 1: SUB TOTAL */}
                <View style={styles.totRow}>
                  <View style={styles.totEnCell}>
                    <Text style={styles.totEnText}>SUB TOTAL</Text>
                  </View>
                  <View style={styles.totValCell}>
                    <Text style={styles.totValText}>
                      {formatExactAmount(taxableAmount)}
                    </Text>
                  </View>
                  <View style={[styles.totArCell, { borderRightWidth: 0 }]}>
                    <Text style={styles.totArText}>المجموع</Text>
                  </View>
                </View>

                {/* Row 2: DISCOUNT */}
                <View style={styles.totRow}>
                  <View style={styles.totEnCell}>
                    <Text style={styles.totEnText}>DISCOUNT</Text>
                  </View>
                  <View style={styles.totValCell}>
                    <Text style={styles.totValText}>
                      {formatExactAmount(totalDiscountVal)}
                    </Text>
                  </View>
                  <View style={[styles.totArCell, { borderRightWidth: 0 }]}>
                    <Text style={styles.totArText}>الخصم</Text>
                  </View>
                </View>

                {/* Row 3: TOTAL AMOUNT (After Discount) */}
                <View style={styles.totRow}>
                  <View style={styles.totEnCell}>
                    <Text style={styles.totEnText}>TOTAL AMOUNT</Text>
                  </View>
                  <View style={styles.totValCell}>
                    <Text style={styles.totValText}>
                      {formatExactAmount(taxableAfterDiscount)}
                    </Text>
                  </View>
                  <View style={[styles.totArCell, { borderRightWidth: 0 }]}>
                    <Text style={styles.totArText}>بعد الخصم</Text>
                  </View>
                </View>

                {/* Row 4: VAT AMOUNT 15% */}
                <View style={styles.totRow}>
                  <View style={styles.totEnCell}>
                    <Text style={styles.totEnText}>VAT AMOUNT 15%</Text>
                  </View>
                  <View style={styles.totValCell}>
                    <Text style={styles.totValText}>
                      {formatExactAmount(totalVat)}
                    </Text>
                  </View>
                  <View style={[styles.totArCell, { borderRightWidth: 0 }]}>
                    <Text style={styles.totArText}>ضريبة مضافة 15%</Text>
                  </View>
                </View>

                {/* Row 5: NET TOTAL */}
                <View style={[styles.totRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.totEnCell}>
                    <Text style={styles.totEnText}>NET TOTAL</Text>
                  </View>
                  <View style={styles.totValCell}>
                    <Text style={styles.totValText}>
                      {formatExactAmount(grandTotal)}
                    </Text>
                  </View>
                  <View style={[styles.totArCell, { borderRightWidth: 0 }]}>
                    <Text style={styles.totArText}>الصافي</Text>
                  </View>
                </View>
              </View>

              {/* Payment Breakdown Mini-Table (Attached Directly Below Totals Box) */}
              <View style={styles.paymentBreakdownBox}>
                {/* Header Row */}
                <View style={styles.payRow}>
                  <View style={styles.payColMethod}>
                    <Text style={styles.payHeaderText}>طريقة الدفع</Text>
                  </View>
                  <View style={styles.payColRemaining}>
                    <Text style={styles.payHeaderText}>الباقي</Text>
                  </View>
                  <View style={styles.payColNetwork}>
                    <Text style={styles.payHeaderText}>شبكة</Text>
                  </View>
                  <View style={[styles.payColCash, { borderRightWidth: 0 }]}>
                    <Text style={styles.payHeaderText}>نقدي</Text>
                  </View>
                </View>

                {/* Values Row */}
                <View style={[styles.payRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.payColMethod}>
                    <Text style={styles.payValText}>{paymentKindLabel}</Text>
                  </View>
                  <View style={styles.payColRemaining}>
                    <Text style={styles.payValText}>
                      {formatExactAmount(remainingAmount)}
                    </Text>
                  </View>
                  <View style={styles.payColNetwork}>
                    <Text style={styles.payValText}>0.00</Text>
                  </View>
                  <View style={[styles.payColCash, { borderRightWidth: 0 }]}>
                    <Text style={styles.payValText}>
                      {formatExactAmount(paidCashAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right: ZATCA QR Code */}
            <View style={styles.qrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── 6. TAFQEET ROWS (ARABIC & ENGLISH WORDS, ATTACHED BELOW PAYMENT BOX) ─── */}
          <View style={styles.tafqeetBox} wrap={false}>
            {/* Row 1: Arabic Words */}
            <View style={styles.tafqeetRow}>
              <View style={styles.tafqeetWordsCell}>
                <Text style={styles.tafqeetArText}>{arabicWordsText}</Text>
              </View>
              <View style={[styles.tafqeetLabelCell, { borderRightWidth: 0 }]}>
                <Text style={styles.tafqeetLabelText}>المبلغ كتابة:</Text>
              </View>
            </View>

            {/* Row 2: English Words */}
            <View style={[styles.tafqeetRow, { borderBottomWidth: 0 }]}>
              <View style={styles.tafqeetWordsCell}>
                <Text style={styles.tafqeetEnText}>{englishWordsText}</Text>
              </View>
              <View style={[styles.tafqeetLabelCell, { borderRightWidth: 0 }]}>
                <Text style={styles.tafqeetLabelText}>Amount in word</Text>
              </View>
            </View>
          </View>

          {/* ─── 7. RECEIVER & SELLER SIGNATURES ─── */}
          <View style={styles.signaturesSection} wrap={false}>
            <View style={styles.receiverLineRow}>
              <Text style={styles.dotsText}>
                ..........................................................................
              </Text>
              <Text style={styles.signColonText}> : </Text>
              <Text style={styles.signTitleText}>المستلم</Text>
            </View>

            {signatureDataUrl ? (
              <Image src={signatureDataUrl} style={styles.signatureImage} />
            ) : null}
          </View>

          {/* ─── 8. BOTTOM FOOTER (DIVIDER, ADDRESS/CONTACTS, PAGE 1/1) ─── */}
          <View style={styles.footerContainer} wrap={false}>
            <View style={styles.footerDividerLine} />

            <View style={styles.footerInfoRow}>
              {companyPhone ? (
                <View style={styles.footerContactItem}>
                  <Text style={styles.footerTextBold}>{companyPhone}</Text>
                  <Text style={styles.footerColon}> : </Text>
                  <Text style={styles.footerTextBold}>هاتف</Text>
                </View>
              ) : null}

              {companyMobile ? (
                <View style={styles.footerContactItem}>
                  <Text style={styles.footerTextBold}>{companyMobile}</Text>
                  <Text style={styles.footerColon}> : </Text>
                  <Text style={styles.footerTextBold}>جوال</Text>
                </View>
              ) : null}

              {footerAddressLine ? (
                <Text style={styles.footerAddressText}>{footerAddressLine}</Text>
              ) : null}
            </View>

            <View style={styles.pageNumRow}>
              <Text style={styles.pageNumText}>1/1</Text>
            </View>
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
    padding: 16,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  outerPageFrame: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: "#9CA3AF",
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: "column",
  },

  // 1. Top Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  headerLeftCol: {
    width: "37%",
    alignItems: "flex-start",
    textAlign: "left",
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    marginBottom: 3,
    textAlign: "left",
  },
  activityEnText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginBottom: 4,
    textAlign: "left",
  },
  enMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  enMetaLabel: {
    width: 44,
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  enMetaVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },

  headerCenterCol: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 96,
    height: 84,
    objectFit: "contain",
  },

  headerRightCol: {
    width: "37%",
    alignItems: "flex-end",
    textAlign: "right",
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#000000",
    marginBottom: 5,
    textAlign: "right",
  },
  activityArText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
    marginBottom: 4,
    textAlign: "right",
  },
  arMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  arMetaLabel: {
    width: 62,
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  arMetaColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginHorizontal: 3,
  },
  arMetaVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  topDividerLine: {
    width: "100%",
    height: 1.2,
    backgroundColor: "#6B7280",
    marginBottom: 6,
  },

  // 2. Main Document Title
  titleContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  mainTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13.5,
    color: "#000000",
    textAlign: "center",
  },

  // 3. Dual Grid Tables (Customer & Invoice Meta)
  dualGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 14,
  },
  customerTable: {
    width: "49%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  metaTable: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  gridTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 16.5,
    alignItems: "center",
  },
  custColEn: {
    width: "30%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  custColVal: {
    width: "47%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  custColAddrVal: {
    width: "77%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  custColAr: {
    width: "23%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },

  metaColEn: {
    width: "31%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  metaColVal: {
    width: "44%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  metaColValSplit: {
    width: "44%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  metaTimeSubCell: {
    width: "46%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  metaDateSubCell: {
    width: "54%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  metaColAr: {
    width: "25%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  metaDetailsValCell: {
    width: "53%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  metaDetailsLabelCell: {
    width: "47%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },

  gridLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  gridValText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  gridValTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.3,
    color: "#000000",
    textAlign: "center",
  },

  // 4. Items Table (9 Columns)
  itemsTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  itemsHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 24,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  itemsDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 17,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  thCell: {
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  tdCell: {
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.2,
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdRightText: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },

  // Column Widths (Sum = 100%)
  colNet: { width: "10%" },
  colVat: { width: "8%" },
  colTotal: { width: "9%" },
  colPrice: { width: "8%" },
  colQty: { width: "7%" },
  colUnit: { width: "8%" },
  colDesc: { width: "33.5%" },
  colItem: { width: "13%" },
  colNo: { width: "3.5%" },

  // 5. Totals + Payment Breakdown & QR Code Section
  totalsAndQrSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  totalsAndPaymentCol: {
    width: "44%",
    flexDirection: "column",
  },
  totalsBox: {
    width: "100%",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  totRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 16.5,
    alignItems: "center",
  },
  totEnCell: {
    width: "36%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  totValCell: {
    width: "27%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  totArCell: {
    width: "37%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  totEnText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  totValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.3,
    color: "#000000",
    textAlign: "center",
  },
  totArText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },

  // Payment Breakdown Mini-Table
  paymentBreakdownBox: {
    width: "100%",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  payRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 16.5,
    alignItems: "center",
  },
  payColMethod: {
    width: "23%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  payColRemaining: {
    width: "22%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  payColNetwork: {
    width: "21%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  payColCash: {
    width: "34%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  payHeaderText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  payValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },

  // QR Code Column
  qrCol: {
    paddingLeft: 18,
    justifyContent: "center",
    alignItems: "center",
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

  // 6. Tafqeet Box (Arabic & English Words)
  tafqeetBox: {
    width: "80.5%",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  tafqeetRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 16.5,
    alignItems: "center",
  },
  tafqeetWordsCell: {
    width: "79%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tafqeetLabelCell: {
    width: "21%",
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tafqeetArText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  tafqeetEnText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  tafqeetLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },

  // 7. Signatures Section
  signaturesSection: {
    width: "80.5%",
    marginTop: 14,
    alignItems: "flex-end",
  },
  receiverLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  sellerLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 18,
  },
  dotsText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
  },
  signColonText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginHorizontal: 2,
  },
  signTitleText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  sellerEmpText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  signatureImage: {
    marginTop: 4,
    width: 68,
    height: 32,
    objectFit: "contain",
  },

  // 8. Footer Section
  footerContainer: {
    marginTop: "auto",
    paddingTop: 10,
  },
  footerDividerLine: {
    width: "93%",
    alignSelf: "center",
    height: 1,
    backgroundColor: "#6B7280",
    marginBottom: 7,
  },
  footerInfoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 20,
    marginBottom: 14,
  },
  footerContactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 18,
  },
  footerTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  footerColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginHorizontal: 2,
  },
  footerAddressText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  pageNumRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
});
