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

// ─── Number to Arabic Words (Tafqeet) ───
const ONES = [
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
const TEENS = [
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
const TENS = [
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
const HUNDREDS = [
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

function convertGroup(n: number): string {
  let res = "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0) res += HUNDREDS[h];
  if (rem > 0) {
    if (res) res += " و ";
    if (rem <= 10) res += ONES[rem];
    else if (rem < 20) res += TEENS[rem - 10];
    else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      if (u > 0) res += ONES[u] + " و " + TENS[t];
      else res += TENS[t];
    }
  }
  return res;
}

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);
  let out = "";

  if (millions > 0) {
    if (millions === 1) out += "مليون";
    else if (millions === 2) out += "مليونان";
    else if (millions >= 3 && millions <= 10) out += convertGroup(millions) + " ملايين";
    else out += convertGroup(millions) + " مليون";
  }

  if (thousands > 0) {
    if (out) out += " و ";
    if (thousands === 1) out += "ألف";
    else if (thousands === 2) out += "ألفان";
    else if (thousands >= 3 && thousands <= 10) out += convertGroup(thousands) + " آلاف";
    else out += convertGroup(thousands) + " ألف";
  }

  if (remainder > 0) {
    if (out) out += " و ";
    out += convertGroup(remainder);
  }

  return out;
}

function tafqeet(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (num <= 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريالاً سعودياً";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Number to English Words ───
const EN_ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertEnGroup(n: number): string {
  let res = "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0) res += EN_ONES[h] + " Hundred";
  if (rem > 0) {
    if (res) res += " ";
    if (rem < 20) res += EN_ONES[rem];
    else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      res += EN_TENS[t] + (u > 0 ? " " + EN_ONES[u] : "");
    }
  }
  return res;
}

function numberToEnglishWords(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (num <= 0) return "Zero Saudi Riyals only.";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  const thousands = Math.floor(riyals / 1000);
  const rem = riyals % 1000;
  let out = "";
  if (thousands > 0) out += convertEnGroup(thousands) + " Thousand";
  if (rem > 0) out += (out ? " " : "") + convertEnGroup(rem);
  if (!out) out = "Zero";

  out += " Saudi Riyals";
  if (halalas > 0) {
    out += " And " + (halalas < 20 ? EN_ONES[halalas] : EN_TENS[Math.floor(halalas / 10)] + (halalas % 10 > 0 ? " " + EN_ONES[halalas % 10] : "")) + " Halalas";
  }
  return out + " only.";
}

// ─── Helpers ───
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function formatDateFormatted(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function formatCompanyFullAddress(company: CompanyRecord): string {
  const parts = [
    company.addressStreet ? `شارع ${company.addressStreet}` : "",
    company.addressBuildingNumber ? `بناية رقم ${company.addressBuildingNumber}` : "",
    company.addressAdditionalNumber ? `رقم عدي ${company.addressAdditionalNumber}` : "",
    company.addressCity ? `${company.addressCity}` : "",
    company.addressPostalCode ? `${company.addressPostalCode}` : "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  return parts.join(" - ");
}

export interface Template14RedaTradingProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl: string | null;
  signatureDataUrl?: string | null;
}

export function Template14RedaTrading({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template14RedaTradingProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDateFormatted(invoice.issueDate);
  const logoSource = logoDataUrl || company.logoUrl;
  const companyUnifiedNumber =
    (company as CompanyRecord & { unifiedNumber?: string | null }).unifiedNumber || "";
  const companyAddress = [
    company.addressAdditionalNumber,
    company.addressPostalCode,
    company.addressStreet,
    company.addressBuildingNumber,
    company.addressDistrict,
    company.addressCity,
    "Saudi Arabia",
  ].filter(Boolean).join(" - ");
  const customerAddress = [
    customer.addressCity,
    customer.addressPostalCode,
    customer.addressStreet,
  ].filter(Boolean).join(" - ");

  const items: InvoiceItemDto[] = invoice.items || [];
  let computedVat = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedVat += lineVat;

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      gross,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableAmount + totalVat;

  const tafqeetAr = tafqeet(grandTotal);
  const tafqeetEn = numberToEnglishWords(grandTotal);

  // Dynamic height calculation so the whole document always fits on one continuous page
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 4);
  let extraContentHeight = extraItemsCount * 22;
  if (invoice.notes) {
    extraContentHeight += 16 + Math.min(invoice.notes.split("\n").length, 4) * 8;
  }
  if (invoice.terms) {
    extraContentHeight += 16 + Math.min(invoice.terms.split("\n").length, 4) * 8;
  }
  if (company.footerText) {
    extraContentHeight += 14;
  }

  // Generous buffer to prevent ever spilling onto a 2nd page
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight) + 80;
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr}
      subject="فاتورة ضريبية / TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ─── */}
        <View style={styles.topHeader} wrap={false}>
          {/* Left Column: English Company Title & Products */}
          <View style={styles.headerLeftCol}>
            {company.nameEn ? <Text style={styles.companyNameEnRed}>{company.nameEn}</Text> : null}
            {company.phone ? <Text style={styles.contactEnText}>{company.phone}</Text> : null}
            {company.email ? <Text style={styles.contactEnText}>{company.email}</Text> : null}
            {company.website ? <Text style={styles.contactEnText}>{company.website}</Text> : null}
            <Text style={styles.crVatEnText}>
              {company.crNumber ? `C.R.No: ${company.crNumber}` : ""}
              {company.crNumber && company.vatNumber ? " - " : ""}
              {company.vatNumber ? `VAT No: ${company.vatNumber}` : ""}
            </Text>
          </View>

          {/* Center Column: Logo & Tagline */}
          <View style={styles.headerCenterCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
            <Text style={styles.logoTaglineAr}>المعدات والمواد الصناعية</Text>
            <Text style={styles.logoTaglineEn}>INDUSTRIAL SUPPLIES</Text>
          </View>

          {/* Right Column: Arabic Company Title & Products */}
          <View style={styles.headerRightCol}>
            <Text style={styles.companyNameArRed}>{company.nameAr || "مؤسسة رضاء التجارية"}</Text>
            {companyAddress ? <Text style={styles.productsArText}>{companyAddress}</Text> : null}
            <View style={styles.bidiCrVatRow}>
              {company.crNumber ? (
                <View style={styles.bidiInlinePair}>
                  <Text style={styles.crVatArText}>س.ت: {company.crNumber}</Text>
                </View>
              ) : null}
              {company.crNumber && company.vatNumber ? (
                <Text style={styles.crVatArText}> - </Text>
              ) : null}
              {company.vatNumber ? (
                <View style={styles.bidiInlinePair}>
                  <Text style={styles.crVatArText}>رقم الضريبي: {company.vatNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── 2. DOCUMENT TITLE & INVOICE NUMBER BAR ─── */}
        <View style={styles.titleBar} wrap={false}>
          <Text style={styles.titleText}>TAX INVOICE / فاتورة ضريبية</Text>
        </View>

        <View style={styles.invoiceNoStrip} wrap={false}>
          <View style={styles.invoiceNoPair}>
            <Text style={styles.metaLabelEn}>Invoice No:</Text>
            <Text style={styles.metaValBold}>{invoiceNum}</Text>
          </View>
          <View style={styles.invoiceNoPair}>
            <Text style={styles.metaValBold}>{invoiceNum}</Text>
            <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
          </View>
        </View>

        {/* ─── 3. OUR DETAILS (SUPPLIER) BOX ─── */}
        <View style={styles.partyBox} wrap={false}>
          <View style={styles.partyHeaderBar}>
            <Text style={styles.partyHeaderEn}>■ Our Details:</Text>
            <Text style={styles.partyHeaderAr}>■ تفاصيل شركتنا</Text>
          </View>
          <View style={styles.partyGrid}>
            {/* Row 1: Name */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Name:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38]}>
                <Text style={styles.cellValBold}>{company.nameEn || company.nameAr}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValBold}>{company.nameAr}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الاسم</Text>
              </View>
            </View>

            {/* Row 2: Street Name */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Street Name:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38]}>
                <Text style={styles.cellValText}>{company.addressStreet || ""}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressStreet || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>اسم الشارع</Text>
              </View>
            </View>

            {/* Row 3: Building No & City */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Building No:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{company.addressBuildingNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>City:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}>{company.addressCity || ""}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressCity || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>المدينة</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressBuildingNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>رقم المبنى</Text>
              </View>
            </View>

            {/* Row 4: Addl. No & District */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Addl. No:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{company.addressAdditionalNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>District:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}>{company.addressDistrict || ""}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressDistrict ? `حي ${company.addressDistrict}` : ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الحي</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressAdditionalNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرقم الإضافي</Text>
              </View>
            </View>

            {/* Row 5: Postal Code & Country */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Postal Code:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{company.addressPostalCode || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>Country:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}>Saudi Arabia</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>المملكة العربية السعودية</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>البلد</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{company.addressPostalCode || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرمز البريدي</Text>
              </View>
            </View>

            {/* Row 6: VAT Number & CRN */}
            <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>VAT Number:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValBold}>{company.vatNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>CRN</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w15]}>
                <Text style={styles.cellValBold}>{company.crNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w15]}>
                <Text style={styles.cellValBold}>{companyUnifiedNumber}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرقم الموحد</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w15, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValBold}>{company.vatNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرقم الضريبي</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 4. CLIENT DETAILS BOX ─── */}
        <View style={styles.partyBox} wrap={false}>
          <View style={styles.partyHeaderBar}>
            <Text style={styles.partyHeaderEn}>■ Client Details:</Text>
            <Text style={styles.partyHeaderAr}>■ تفاصيل شركة العميل</Text>
          </View>
          <View style={styles.partyGrid}>
            {/* Row 1: Name */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Name:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38]}>
                <Text style={styles.cellValBold}>{customer.nameEn || customer.nameAr || "-"}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValBold}>{customer.nameAr || customer.nameEn || "-"}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الاسم</Text>
              </View>
            </View>

            {/* Row 2: Street Name */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Address:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38]}>
                <Text style={styles.cellValText}>{customerAddress}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w38, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{customerAddress}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>العنوان</Text>
              </View>
            </View>

            {/* Row 3: Building No & City */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Phone:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{customer.phone || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>City:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}>{customer.addressCity || ""}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{customer.addressCity || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>المدينة</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{customer.phone || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الهاتف</Text>
              </View>
            </View>

            {/* Row 4: Addl. No & District */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Email:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{customer.email || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}></Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}></Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{customer.email || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>البريد</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}></Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}></Text>
              </View>
            </View>

            {/* Row 5: Postal Code & Country */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>Postal Code:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w18]}>
                <Text style={styles.cellValText}>{customer.addressPostalCode || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10]}>
                <Text style={styles.cellLabelEn}>Country:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValText}>Saudi Arabia</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>المملكة العربية السعودية</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w8, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>البلد</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w12, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValText}>{customer.addressPostalCode || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرمز البريدي</Text>
              </View>
            </View>

            {/* Row 6: VAT Number & Unified/CR */}
            <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.gridCellLabel, styles.w12]}>
                <Text style={styles.cellLabelEn}>VAT Number:</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w28]}>
                <Text style={styles.cellValBold}>{customer.vatNumber || "-"}</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20]}>
                <Text style={styles.cellValBold}>{customer.unifiedNumber || ""}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرقم الموحد</Text>
              </View>
              <View style={[styles.gridCellVal, styles.w20, { alignItems: "flex-end" }]}>
                <Text style={styles.cellValBold}>{customer.vatNumber || "-"}</Text>
              </View>
              <View style={[styles.gridCellLabel, styles.w10, { alignItems: "flex-end" }]}>
                <Text style={styles.cellLabelAr}>الرقم الضريبي</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 5. DATES & ORDER REFERENCE BAR (Issue Date Only) ─── */}
        <View style={styles.orderRefTable} wrap={false}>
          <View style={styles.orderRefHeaderRow}>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefHeaderAr}>تاريخ الفاتورة</Text>
              <Text style={styles.orderRefHeaderEn}>Invoice Date</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefHeaderAr}>رقم أمر الشراء</Text>
              <Text style={styles.orderRefHeaderEn}>Contract / PO No</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefHeaderAr}>فترة الفاتورة</Text>
              <Text style={styles.orderRefHeaderEn}>Invoice Period</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w40, { borderRightWidth: 0 }]}>
              <Text style={styles.orderRefHeaderAr}>رقم المرجع</Text>
              <Text style={styles.orderRefHeaderEn}>Project / Reference No</Text>
            </View>
          </View>
          <View style={styles.orderRefDataRow}>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefValText}>{issueDateStr}</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefValText}>-</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w20]}>
              <Text style={styles.orderRefValText}>-</Text>
            </View>
            <View style={[styles.orderRefCell, styles.w40, { borderRightWidth: 0 }]}>
              <Text style={styles.orderRefValText}>-</Text>
            </View>
          </View>
        </View>

        {/* ─── 6. ITEMS TABLE (BILINGUAL) ─── */}
        <View style={styles.itemsTable} wrap={false}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* Total Amount Incl. VAT */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thAr}>الإجمالي</Text>
              <Text style={styles.thAr}>(ريال سعودي)</Text>
              <Text style={styles.thEn}>Total Amount</Text>
              <Text style={styles.thEn}>Incl.VAT (SAR)</Text>
            </View>
            {/* VAT Amount */}
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thAr}>ضريبة القيمة المضافة</Text>
              <Text style={styles.thAr}>(ريال سعودي)</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
              <Text style={styles.thEn}>(SAR)</Text>
            </View>
            {/* VAT % */}
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thAr}>ضريبة القيمة المضافة</Text>
              <Text style={styles.thEn}>VAT %</Text>
            </View>
            {/* Total Price Excl. VAT */}
            <View style={[styles.thCell, styles.colSubtotal]}>
              <Text style={styles.thAr}>السعر الإجمالي غير شامل ضريبة القيمة المضافة</Text>
              <Text style={styles.thAr}>(ريال سعودي)</Text>
              <Text style={styles.thEn}>Total Price</Text>
              <Text style={styles.thEn}>excl. VAT (SAR)</Text>
            </View>
            {/* Unit Rate */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thAr}>(ريال سعودي)</Text>
              <Text style={styles.thEn}>Unit Rate</Text>
              <Text style={styles.thEn}>(SAR)</Text>
            </View>
            {/* Qty */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            {/* Nature of Goods or Services */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thAr}>تفاصيل السلع أو الخدمات</Text>
              <Text style={styles.thEn}>Nature of Goods or Services</Text>
            </View>
            {/* # */}
            <View style={[styles.thCell, styles.colNo, { borderRightWidth: 0 }]}>
              <Text style={styles.thAr}>#</Text>
            </View>
          </View>

          {/* Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow}>
              <View style={[styles.tdCell, styles.colTotal]}>
                <Text style={styles.tdTextBold}>{formatExactAmount(row.lineTotal)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colVatAmount]}>
                <Text style={styles.tdText}>{formatExactAmount(row.lineVat)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colVatRate]}>
                <Text style={styles.tdText}>{row.vatRate}%</Text>
              </View>
              <View style={[styles.tdCell, styles.colSubtotal]}>
                {row.lineDiscount > 0 ? (
                  <>
                    <Text style={styles.discountHintText}>Before: {formatExactAmount(row.gross)}</Text>
                    <Text style={styles.tdText}>{formatExactAmount(row.taxableSubtotal)}</Text>
                  </>
                ) : (
                  <Text style={styles.tdText}>{formatExactAmount(row.taxableSubtotal)}</Text>
                )}
              </View>
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdText}>{formatQty(row.qty)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colDesc, { alignItems: "flex-start", paddingHorizontal: 4 }]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
                {row.lineDiscount > 0 ? (
                  <Text style={styles.discountHintText}>
                    Discount: {formatExactAmount(row.lineDiscount)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.tdCell, styles.colNo, { borderRightWidth: 0 }]}>
                <Text style={styles.tdText}>{row.index}</Text>
              </View>
            </View>
          ))}

          {/* Empty Filler Row */}
          {rows.length < 4 ? (
            <View style={[styles.emptyFillerRow, { height: (4 - rows.length) * 20 }]}>
              <View style={[styles.tdCell, styles.colTotal]} />
              <View style={[styles.tdCell, styles.colVatAmount]} />
              <View style={[styles.tdCell, styles.colVatRate]} />
              <View style={[styles.tdCell, styles.colSubtotal]} />
              <View style={[styles.tdCell, styles.colPrice]} />
              <View style={[styles.tdCell, styles.colQty]} />
              <View style={[styles.tdCell, styles.colDesc]} />
              <View style={[styles.tdCell, styles.colNo, { borderRightWidth: 0 }]} />
            </View>
          ) : null}
        </View>

        {/* ─── 7. TOTALS & ZATCA QR SUMMARY BOX ─── */}
        <View style={styles.totalsAndQrSection} wrap={false}>
          {/* Left Block: Numerical Totals Table */}
          <View style={styles.totalsTable}>
            {/* Total Excl. VAT */}
            <View style={styles.totalRow}>
              <View style={[styles.totalLabelCellEn, styles.w35]}>
                <Text style={styles.totalLabelEnText}>Total excl. VAT (SAR):</Text>
              </View>
              <View style={[styles.totalValCell, styles.w20]}>
                <Text style={styles.totalValText}>{formatExactAmount(taxableAmount)}</Text>
              </View>
              <View style={[styles.totalLabelCellAr, styles.w45]}>
                <Text style={styles.totalLabelArText}>الإجمالي غير شامل ضريبة القيمة المضافة (ريال سعودي)</Text>
              </View>
            </View>

            {/* VAT Amount */}
            <View style={styles.totalRow}>
              <View style={[styles.totalLabelCellEn, styles.w35]}>
                <Text style={styles.totalLabelEnText}>VAT Amount (SAR):</Text>
              </View>
              <View style={[styles.totalValCell, styles.w20]}>
                <Text style={styles.totalValText}>{formatExactAmount(totalVat)}</Text>
              </View>
              <View style={[styles.totalLabelCellAr, styles.w45]}>
                <Text style={styles.totalLabelArText}>ضريبة القيمة المضافة (ريال سعودي)</Text>
              </View>
            </View>

            {/* Amount Incl. VAT */}
            <View style={styles.totalRow}>
              <View style={[styles.totalLabelCellEn, styles.w35]}>
                <Text style={styles.totalLabelEnText}>Amount Incl. VAT (SAR):</Text>
              </View>
              <View style={[styles.totalValCell, styles.w20]}>
                <Text style={styles.totalValBold}>{formatExactAmount(grandTotal)}</Text>
              </View>
              <View style={[styles.totalLabelCellAr, styles.w45]}>
                <Text style={styles.totalLabelArText}>المبلغ شاملاً ضريبة القيمة المضافة (ريال سعودي)</Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <View style={[styles.totalLabelCellEn, styles.w35]}>
                <Text style={styles.totalLabelEnText}>Invoice Paid (SAR):</Text>
              </View>
              <View style={[styles.totalValCell, styles.w20]}>
                <Text style={styles.totalValBold}>{formatExactAmount(grandTotal)}</Text>
              </View>
              <View style={[styles.totalLabelCellAr, styles.w45]}>
                <Text style={styles.totalLabelArText}>تم سداد الفاتورة</Text>
              </View>
            </View>

            {/* Balance Due */}
            <View style={styles.totalRow}>
              <View style={[styles.totalLabelCellEn, styles.w35]}>
                <Text style={styles.totalLabelEnText}>Balance Due (SAR):</Text>
              </View>
              <View style={[styles.totalValCell, styles.w20]}>
                <Text style={styles.totalValBold}>0</Text>
              </View>
              <View style={[styles.totalLabelCellAr, styles.w45]}>
                <Text style={styles.totalLabelArText}>إجمالي المبلغ المستحق (ريال سعودي)</Text>
              </View>
            </View>

            {/* Words in English & Arabic */}
            <View style={styles.wordsRow}>
              <Text style={styles.wordsEnText}>Amount in words: {tafqeetEn}</Text>
              <Text style={styles.wordsArText}>{tafqeetAr}</Text>
            </View>
          </View>

          {/* Right Block: ZATCA QR Code */}
          <View style={styles.qrBlock}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.zatcaQrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 8. BANK DETAILS & SIGNATURE BOXES ─── */}
        <View style={styles.bankAndSignaturesGrid} wrap={false}>
          {/* Company Contact Details */}
          <View style={styles.bankTableCol}>
            <View style={styles.bankHeaderRow}>
              <Text style={styles.bankHeaderText}>بيانات الشركة / Company Details</Text>
            </View>
            <View style={styles.bankGridRow}>
              <View style={styles.bankValCell}>
                <Text style={styles.bankValText}>{company.nameEn || company.nameAr}</Text>
              </View>
              <View style={styles.bankLabelCell}>
                <Text style={styles.bankLabelEn}>NAME</Text>
                <Text style={styles.bankLabelAr}>الاسم</Text>
              </View>
            </View>
            <View style={styles.bankGridRow}>
              <View style={styles.bankValCell}>
                <Text style={styles.bankValText}>{company.phone || ""}</Text>
              </View>
              <View style={styles.bankLabelCell}>
                <Text style={styles.bankLabelEn}>PHONE</Text>
                <Text style={styles.bankLabelAr}>الهاتف</Text>
              </View>
            </View>
            <View style={styles.bankGridRow}>
              <View style={styles.bankValCell}>
                <Text style={styles.bankValText}>{company.email || ""}</Text>
              </View>
              <View style={styles.bankLabelCell}>
                <Text style={styles.bankLabelEn}>EMAIL</Text>
                <Text style={styles.bankLabelAr}>البريد</Text>
              </View>
            </View>
            <View style={styles.bankGridRow}>
              <View style={styles.bankValCell}>
                <Text style={styles.bankValText}>{company.website || ""}</Text>
              </View>
              <View style={styles.bankLabelCell}>
                <Text style={styles.bankLabelEn}>WEBSITE</Text>
                <Text style={styles.bankLabelAr}>الموقع</Text>
              </View>
            </View>
            <View style={[styles.bankGridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.bankValCell}>
                <Text style={styles.bankValText}>{companyUnifiedNumber || company.crNumber || ""}</Text>
              </View>
              <View style={styles.bankLabelCell}>
                <Text style={styles.bankLabelEn}>UNIFIED / CR</Text>
                <Text style={styles.bankLabelAr}>الرقم الموحد / السجل</Text>
              </View>
            </View>
          </View>

          {/* Invoice Notes */}
          <View style={styles.signCol}>
            <View style={styles.signHeaderRow}>
              <Text style={styles.signHeaderText}>Notes / ملاحظات</Text>
            </View>
            <View style={styles.signContentArea}>
              {invoice.notes ? <Text style={styles.signPromptEn}>{invoice.notes}</Text> : null}
            </View>
          </View>

          {/* Invoice Terms */}
          <View style={styles.signCol}>
            <View style={styles.signHeaderRow}>
              <Text style={styles.signHeaderText}>Terms / الشروط</Text>
            </View>
            <View style={styles.signContentArea}>
              {invoice.terms ? <Text style={styles.signPromptEn}>{invoice.terms}</Text> : null}
            </View>
          </View>

          {/* Customer Contact */}
          <View style={styles.signCol}>
            <View style={styles.signHeaderRow}>
              <Text style={styles.signHeaderText}>Customer / العميل</Text>
            </View>
            <View style={styles.signContentArea}>
              {customer.phone ? <Text style={styles.signPromptEn}>{customer.phone}</Text> : null}
              {customer.email ? <Text style={styles.signPromptEn}>{customer.email}</Text> : null}
            </View>
          </View>
        </View>

        {/* ─── 9. BOTTOM FOOTER ADDRESS & PHONE ─── */}
        <View style={styles.footerAddressStrip} wrap={false}>
          <Text style={styles.footerArAddress}>
            {company.footerText || formatCompanyFullAddress(company)}
            {company.phone ? ` - ${company.phone}` : ""}
          </Text>
          <Text style={styles.footerEnAddress}>
            {company.phone ? `Tel: ${company.phone} - ` : ""}
            {[company.addressStreet, company.addressDistrict, company.addressCity, company.addressPostalCode]
              .filter(Boolean)
              .join(" - ") || "Kingdom of Saudi Arabia"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 7.5,
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
    objectFit: "contain",
  },

  // 1. Top Header
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeftCol: {
    width: "36%",
    alignItems: "flex-start",
  },
  companyNameEnRed: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#B91C1C",
    fontFamily: "Helvetica",
    marginBottom: 2,
  },
  productsEnText: {
    fontSize: 5.5,
    color: "#000000",
    fontFamily: "Helvetica",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  contactEnText: {
    fontSize: 5.5,
    color: "#000000",
    fontFamily: "Helvetica",
  },
  crVatEnText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#B91C1C",
    fontFamily: "Helvetica",
  },
  headerCenterCol: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 70,
    height: 38,
    objectFit: "contain",
    marginBottom: 2,
  },
  logoTaglineAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "center",
  },
  logoTaglineEn: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    fontFamily: "Helvetica",
    textAlign: "center",
  },
  headerRightCol: {
    width: "36%",
    alignItems: "flex-end",
  },
  companyNameArRed: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "right",
    marginBottom: 2,
  },
  productsArText: {
    fontSize: 6,
    color: "#000000",
    textAlign: "right",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  bidiCrVatRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  bidiInlinePair: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  crVatArText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#B91C1C",
  },

  // 2. Document Title
  titleBar: {
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 2,
    marginBottom: 3,
  },
  titleText: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#000000",
  },
  invoiceNoStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  invoiceNoPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  metaLabelAr: {
    fontSize: 8,
    fontWeight: "bold",
  },
  metaValBold: {
    fontSize: 8,
    fontWeight: "bold",
  },

  // 3. Party Boxes
  partyBox: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  partyHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  partyHeaderEn: {
    fontSize: 7,
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  partyHeaderAr: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  partyGrid: {
    flexDirection: "column",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
    minHeight: 14,
    alignItems: "center",
  },
  gridCellLabel: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    paddingHorizontal: 3,
    height: "100%",
  },
  gridCellVal: {
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 3,
    height: "100%",
  },
  cellLabelEn: {
    fontSize: 6,
    color: "#000000",
    fontFamily: "Helvetica",
    fontWeight: "bold",
  },
  cellLabelAr: {
    fontSize: 6.5,
    color: "#000000",
    fontWeight: "bold",
  },
  cellValText: {
    fontSize: 6.5,
    color: "#000000",
  },
  cellValBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#000000",
  },

  w8: { width: "8%" },
  w10: { width: "10%" },
  w12: { width: "12%" },
  w15: { width: "15%" },
  w18: { width: "18%" },
  w20: { width: "20%" },
  w28: { width: "28%" },
  w35: { width: "35%" },
  w38: { width: "38%" },
  w40: { width: "40%" },
  w45: { width: "45%" },

  // 5. Order Reference Table
  orderRefTable: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  orderRefHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#C5CCD4",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 20,
    alignItems: "center",
  },
  orderRefDataRow: {
    flexDirection: "row",
    minHeight: 14,
    alignItems: "center",
  },
  orderRefCell: {
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    height: "100%",
    paddingVertical: 1,
  },
  orderRefHeaderAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  orderRefHeaderEn: {
    fontSize: 5.5,
    fontFamily: "Helvetica",
    textAlign: "center",
  },
  orderRefValText: {
    fontSize: 7,
    textAlign: "center",
  },

  // 6. Items Table
  itemsTable: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#B8C1CA",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 28,
    alignItems: "center",
  },
  thCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    height: "100%",
  },
  thAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5,
    fontFamily: "Helvetica",
    color: "#000000",
    textAlign: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 18,
    alignItems: "center",
  },
  emptyFillerRow: {
    flexDirection: "row",
  },
  tdCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 1.5,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
    height: "100%",
  },
  tdText: {
    fontSize: 6.8,
    textAlign: "center",
  },
  tdTextBold: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  tdDescText: {
    fontSize: 6.8,
    textAlign: "left",
  },
  discountHintText: {
    fontSize: 5.5,
    color: "#C53030",
  },

  colTotal: { width: "14%" },
  colVatAmount: { width: "12%" },
  colVatRate: { width: "7%" },
  colSubtotal: { width: "16%" },
  colPrice: { width: "12%" },
  colQty: { width: "7%" },
  colDesc: { width: "28%" },
  colNo: { width: "4%" },

  // 7. Totals & QR Section
  totalsAndQrSection: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  totalsTable: {
    width: "82%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    height: 15,
    alignItems: "center",
  },
  totalLabelCellEn: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    paddingHorizontal: 4,
    height: "100%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  totalLabelEnText: {
    fontSize: 6.5,
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  totalValCell: {
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  totalValText: {
    fontSize: 7,
    color: "#000000",
  },
  totalValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  totalLabelCellAr: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    height: "100%",
  },
  totalLabelArText: {
    fontSize: 6.8,
    fontWeight: "bold",
  },
  wordsRow: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#FFFFFF",
  },
  wordsEnText: {
    fontSize: 6.5,
    fontFamily: "Helvetica",
    color: "#000000",
    marginBottom: 1,
  },
  wordsArText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  qrBlock: {
    width: "18%",
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  zatcaQrImage: {
    width: 65,
    height: 65,
  },

  // 8. Bank & Signatures Grid
  bankAndSignaturesGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 3,
    minHeight: 65,
  },
  bankTableCol: {
    width: "42%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  bankHeaderRow: {
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bankHeaderText: {
    fontSize: 6.5,
    fontWeight: "bold",
  },
  bankGridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
    height: 12,
    alignItems: "center",
  },
  bankLabelCell: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 2,
    gap: 2,
  },
  bankLabelEn: {
    fontSize: 5,
    fontFamily: "Helvetica",
    fontWeight: "bold",
  },
  bankLabelAr: {
    fontSize: 5.5,
    fontWeight: "bold",
  },
  bankValCell: {
    width: "52%",
    paddingHorizontal: 2,
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#D1D5DB",
  },
  bankValText: {
    fontSize: 5.5,
    fontWeight: "bold",
  },

  signCol: {
    width: "19.33%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    flexDirection: "column",
  },
  signHeaderRow: {
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  signHeaderText: {
    fontSize: 6.5,
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  signContentArea: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 3,
  },
  signPromptAr: {
    fontSize: 5.5,
    fontWeight: "bold",
  },
  signPromptEn: {
    fontSize: 5,
    fontFamily: "Helvetica",
    color: "#444444",
  },

  // 9. Beneficiary Bar
  beneficiaryStrip: {
    borderWidth: 1,
    borderColor: "#B91C1C",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  beneficiaryText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#B91C1C",
    fontFamily: "Helvetica",
    textAlign: "center",
  },

  // 10. Brand Logos Bar
  brandLogosBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 2,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#D1D5DB",
    marginBottom: 3,
  },
  brandText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#374151",
    fontFamily: "Helvetica",
  },

  // 11. Footer Address Strip
  footerAddressStrip: {
    alignItems: "center",
    justifyContent: "center",
  },
  footerArAddress: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#000000",
  },
  footerEnAddress: {
    fontSize: 5.5,
    fontFamily: "Helvetica",
    textAlign: "center",
    color: "#333333",
    marginTop: 1,
  },
});
