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

export interface Template6JabalAlRayanProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

// ─── Optional extension interfaces (safely extracted, falling back gracefully) ───

interface InvoiceExtensions {
  store?: string | null;
  salesman?: string | null;
  customerNo?: string | null;
  discountTotal?: number | string | null;
  discount?: number | string | null;
}

interface CustomerExtensions {
  crNumber?: string | null;
  clientNo?: string | null;
  customerCode?: string | null;
  addressDistrict?: string | null;
  addressBuildingNumber?: string | null;
  addressAdditionalNumber?: string | null;
}

interface ItemExtensions {
  discount?: string | number | null;
  taxRate?: string | number | null;
  descriptionEn?: string | null;
  nameEn?: string | null;
  itemCode?: string | null;
  code?: string | null;
  unit?: string | null;
}

// ─── Value Conversion & Formatting Helpers ───

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats monetary amounts with exact raw decimal representation without rounding or toFixed(2).
 * Formats the integer portion with commas and preserves the exact decimal tail.
 */
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
  if (val === null || val === undefined || val === "") return "0";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const parts = str.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

/**
 * Strict date formatting: Issue Date ONLY as DD/MM/YYYY.
 * Disallows hours, minutes, seconds, supply date, or due date.
 */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const clean = iso.slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return iso || "";
  }
}

function getCompanyAddress(company: CompanyRecord): string {
  const parts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressStreet,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : null,
  ].filter(Boolean);
  return parts.join(" - ");
}

function getCustomerAddress(customer: CustomerRecord): string {
  const ext = customer as CustomerRecord & CustomerExtensions;
  const parts = [
    ext.addressBuildingNumber ? `مبنى ${ext.addressBuildingNumber}` : null,
    customer.addressStreet,
    ext.addressDistrict ? `حي ${ext.addressDistrict}` : null,
    customer.addressCity,
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : null,
    ext.addressAdditionalNumber ? `الرقم الإضافي: ${ext.addressAdditionalNumber}` : null,
  ].filter(Boolean);
  return parts.join(" - ");
}

// ─── Arabic Tafqeet (Spelled-out Amount) ───

const ARABIC_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const ARABIC_TEENS = [
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
const ARABIC_TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const ARABIC_HUNDREDS = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertThreeDigits(n: number): string {
  if (n <= 0) return "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0 && ARABIC_HUNDREDS[h]) {
    parts.push(ARABIC_HUNDREDS[h]);
  }
  if (rem > 0) {
    if (rem < 10) {
      if (ARABIC_ONES[rem]) parts.push(ARABIC_ONES[rem]);
    } else if (rem < 20) {
      const teen = ARABIC_TEENS[rem - 10];
      if (teen) parts.push(teen);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const tensLabel = ARABIC_TENS[t];
      if (u > 0 && ARABIC_ONES[u]) {
        parts.push(`${ARABIC_ONES[u]} و${tensLabel}`);
      } else if (tensLabel) {
        parts.push(tensLabel);
      }
    }
  }
  return parts.join(" و");
}

function numberToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(`${convertThreeDigits(millions)} ملايين`);
    else parts.push(`${convertThreeDigits(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertThreeDigits(thousands)} آلاف`);
    else parts.push(`${convertThreeDigits(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  return parts.join(" و");
}

function tafqeet(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و" + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Main Template Component ───

export function Template6JabalAlRayan({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template6JabalAlRayanProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = invoice as InvoiceDto & InvoiceExtensions;
  const custExt = customer as CustomerRecord & CustomerExtensions;

  // Invoice & Dates
  const invoiceNum = toText(invoice.invoiceNumber);
  const issueDateFormatted = formatDate(invoice.issueDate);

  // Customer Details
  const customerName = toText(customer.nameAr || customer.nameEn);
  const customerVat = toText(customer.vatNumber);
  const customerUnifiedOrCr = toText(
    customer.unifiedNumber ?? custExt.crNumber ?? custExt.customerCode ?? custExt.clientNo ?? ""
  );
  const customerAddress = getCustomerAddress(customer);
  const customerContact = [
    customer.phone ? `هاتف: ${customer.phone}` : null,
    customer.email ? `بريد: ${customer.email}` : null,
  ].filter(Boolean).join(" | ");

  // Line items processing with accurate discount & VAT calculations
  const rawItems = invoice.items ?? [];
  let computedSubtotal = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;

  const rows = rawItems.map((item: InvoiceItemDto, idx: number) => {
    const extItem = item as InvoiceItemDto & ItemExtensions;
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawSubtotal = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount ?? extItem.discount ?? 0);
    const taxableSubtotal = Math.max(0, rawSubtotal - lineDiscount);
    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null
        ? toNumber(item.vatRate)
        : extItem.taxRate !== undefined && extItem.taxRate !== null
        ? toNumber(extItem.taxRate)
        : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : (taxableSubtotal * vatRate) / 100;
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedSubtotal += rawSubtotal;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;

    const descAr = toText(item.description);
    const descEn = toText(extItem.descriptionEn ?? extItem.nameEn ?? "");
    const itemCode = toText(extItem.itemCode ?? extItem.code ?? "");

    return {
      key: item.position ?? idx,
      index: idx + 1,
      descAr,
      descEn,
      itemCode,
      qty,
      unitPrice,
      rawSubtotal,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  // Totals calculations
  const subtotalVal = invoice.subtotal !== undefined && invoice.subtotal !== null
    ? toNumber(invoice.subtotal)
    : computedSubtotal;
  const headerDiscount = toNumber(invExt.discountTotal ?? invExt.discount ?? 0);
  const totalDiscountVal = headerDiscount > 0 ? headerDiscount : computedDiscount;
  const taxableSubtotalVal = Math.max(0, subtotalVal - totalDiscountVal);
  const vatVal = invoice.vatAmount !== undefined && invoice.vatAmount !== null
    ? toNumber(invoice.vatAmount)
    : computedVat;
  const totalVal = invoice.total !== undefined && invoice.total !== null
    ? toNumber(invoice.total)
    : taxableSubtotalVal + vatVal;

  const firstItemVatRate = rows.find((r) => r.vatRate !== undefined)?.vatRate ?? 15;
  const vatRatePercentage = `${firstItemVatRate}%`;

  // Tafqeet spells out actual final grand total (invoice.total)
  const tafqeetText = tafqeet(totalVal);

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, rows.length - 7);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes) {
    extraContentHeight += 18 + Math.min(invoice.notes.split("\n").length, 3) * 10;
  }
  if (invoice.terms) {
    extraContentHeight += 18 + Math.min(invoice.terms.split("\n").length, 3) * 10;
  }
  if (company.footerText) {
    extraContentHeight += 14;
  }
  const pageHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);

  // Empty filler rows to preserve aesthetic balance for short invoices
  const minRows = 4;
  const emptyRowsCount = Math.max(0, Math.min(minRows - rows.length, 3));

  const logoUrl = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية - ${invoiceNum}`}
      author={company.nameAr || company.nameEn || "فاتورة ضريبية"}
      subject="Tax Invoice - فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={{ width: basePageWidth, height: pageHeight }} orientation="portrait" style={styles.page}>
        {/* Centered subtle watermark background if provided */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.watermarkBg} />
        ) : null}

        {/* ─── OUTER MAROON FRAME ─── */}
        <View style={styles.outerFrame}>
          {/* ─── 1. TOP HEADER SECTION ─── */}
          <View style={styles.headerContainer}>
            {/* Top row: English details on left, Logo in center, Arabic details on right */}
            <View style={styles.headerTopRow}>
              {/* Left Column (English Company Info) */}
              <View style={styles.headerLeftCol}>
                {company.nameEn ? (
                  <Text style={styles.companyNameEn}>{company.nameEn}</Text>
                ) : null}
                <Text style={styles.headerCrLine}>
                  {company.crNumber ? `C.R.: ${company.crNumber}` : ""}
                  {company.addressCity ? ` - ${company.addressCity}` : ""}
                </Text>
                <Text style={styles.headerBranchEn}>
                  {[
                    company.addressDistrict || "",
                    company.phone ? `TEL: ${company.phone}` : "",
                    company.email ? `EMAIL: ${company.email}` : "",
                  ].filter(Boolean).join(" - ")}
                </Text>
              </View>

              {/* Center Column: Conditional Logo & Clear Tax Invoice Title */}
              <View style={styles.headerCenterCol}>
                {logoUrl ? (
                  <Image src={logoUrl} style={styles.logoImage} />
                ) : null}
                <Text style={styles.taxInvoiceTitleCenter}>فاتورة ضريبية</Text>
                <Text style={styles.taxInvoiceSubtitleCenter}>TAX INVOICE</Text>
              </View>

              {/* Right Column (Arabic Company Info) */}
              <View style={styles.headerRightCol}>
                <Text style={styles.companyNameAr}>{company.nameAr || ""}</Text>
                <Text style={styles.headerCrLine}>
                  {company.crNumber ? `س.ت: ${company.crNumber}` : ""}
                  {company.addressCity ? ` - ${company.addressCity}` : ""}
                </Text>
                <Text style={styles.headerBranchAr}>
                  {[
                    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
                    company.phone ? `هاتف: ${company.phone}` : "",
                    company.email ? `بريد: ${company.email}` : "",
                  ].filter(Boolean).join(" - ")}
                </Text>
              </View>
            </View>

            {/* Full-width Company VAT strip */}
            <View style={styles.headerVatStrip}>
              <Text style={styles.headerVatText}>
                {company.vatNumber
                  ? `VAT | ${company.vatNumber} | الرقم الضريبي للمنشأة`
                  : "فاتورة ضريبية معتمدة وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك"}
              </Text>
            </View>
          </View>

          {/* ─── 2. TAX INVOICE CALLIGRAPHIC PILL BANNER ─── */}
          <View style={styles.taxInvoiceBannerWrap}>
            <View style={styles.taxInvoiceBannerPill}>
              <Text style={styles.taxInvoiceBannerText}>فاتورة ضريبية</Text>
            </View>
          </View>

          {/* ─── 3. METADATA CAPSULE CELLS (ROW 1: Invoice & Company Identifiers) ─── */}
          <View style={styles.metaRow1}>
            {/* Cell 1: رقم الفاتورة / INVOICE NO. */}
            <View style={[styles.capsuleCell, { flex: 1.4 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>INVOICE NO.</Text>
                <Text style={styles.capsuleLabelAr}>رقم الفاتورة</Text>
              </View>
              <Text style={styles.capsuleValueTextBold}>{invoiceNum || "-"}</Text>
            </View>

            {/* Cell 2: تاريخ الإصدار / ISSUE DATE */}
            <View style={[styles.capsuleCell, { flex: 1.3 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>ISSUE DATE</Text>
                <Text style={styles.capsuleLabelAr}>تاريخ الإصدار</Text>
              </View>
              <Text style={styles.capsuleValueText}>{issueDateFormatted || "-"}</Text>
            </View>

            {/* Cell 3: السجل التجاري / C.R. NO. */}
            <View style={[styles.capsuleCell, { flex: 1.3 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>C.R. NO.</Text>
                <Text style={styles.capsuleLabelAr}>السجل التجاري</Text>
              </View>
              <Text style={styles.capsuleValueText}>{company.crNumber || "-"}</Text>
            </View>

            {/* Cell 4: الرقم الضريبي / VAT NO. */}
            <View style={[styles.capsuleCell, { flex: 1.4 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>VAT NO.</Text>
                <Text style={styles.capsuleLabelAr}>الرقم الضريبي</Text>
              </View>
              <Text style={styles.capsuleValueText}>{company.vatNumber || "-"}</Text>
            </View>

            {/* Cell 5: المدينة / الفرع / LOCATION */}
            <View style={[styles.capsuleCell, { flex: 1.3 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>LOCATION</Text>
                <Text style={styles.capsuleLabelAr}>الفرع / المدينة</Text>
              </View>
              <Text style={styles.capsuleValueText}>
                {invExt.store || company.addressCity || "المملكة العربية السعودية"}
              </Text>
            </View>
          </View>

          {/* ─── 4. CUSTOMER METADATA CAPSULE CELLS (ROW 2: Customer Identity) ─── */}
          <View style={styles.metaRow2}>
            {/* Customer Name */}
            <View style={[styles.capsuleCell, { flex: 3.2 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>CUSTOMER NAME</Text>
                <Text style={styles.capsuleLabelAr}>اسم العميل</Text>
              </View>
              <Text style={styles.capsuleValueCustomerName}>{customerName || "-"}</Text>
            </View>

            {/* Customer VAT Number */}
            <View style={[styles.capsuleCell, { flex: 2 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>VAT NUMBER</Text>
                <Text style={styles.capsuleLabelAr}>الرقم الضريبي للعميل</Text>
              </View>
              <Text style={styles.capsuleValueText}>{customerVat || "-"}</Text>
            </View>

            {/* Customer Unified / CR Number */}
            <View style={[styles.capsuleCell, { flex: 1.8 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>CR / UNIFIED NO.</Text>
                <Text style={styles.capsuleLabelAr}>الرقم الموحد / السجل</Text>
              </View>
              <Text style={styles.capsuleValueText}>{customerUnifiedOrCr || "-"}</Text>
            </View>
          </View>

          {/* ─── 5. CUSTOMER ADDRESS & CONTACT CAPSULE CELLS (ROW 3) ─── */}
          <View style={styles.metaRow3}>
            {/* National Address */}
            <View style={[styles.capsuleCell, { flex: 3.5 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>NATIONAL ADDRESS</Text>
                <Text style={styles.capsuleLabelAr}>العنوان الوطني للعميل</Text>
              </View>
              <Text style={styles.capsuleValueAddress}>{customerAddress || "-"}</Text>
            </View>

            {/* Contact Details */}
            <View style={[styles.capsuleCell, { flex: 2.5 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>CONTACT</Text>
                <Text style={styles.capsuleLabelAr}>بيانات التواصل</Text>
              </View>
              <Text style={styles.capsuleValueText}>{customerContact || "-"}</Text>
            </View>
          </View>

          {/* ─── 6. PRODUCT ITEMS TABLE ─── */}
          <View style={styles.tableContainer}>
            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
              {/* Col 1: الرقم التسلسلي / S.N */}
              <View style={[styles.thCell, styles.colSeq]}>
                <Text style={styles.thTextAr}>م</Text>
                <Text style={styles.thTextEn}>S.N</Text>
              </View>

              {/* Col 2: إسم الصنف والبيان / DESCRIPTION */}
              <View style={[styles.thCell, styles.colDesc]}>
                <Text style={styles.thTextAr}>إسم الصنف والبيان</Text>
                <Text style={styles.thTextEn}>DESCRIPTION</Text>
              </View>

              {/* Col 3: الكمية / QUANTITY */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thTextAr}>الكمية</Text>
                <Text style={styles.thTextEn}>QTY</Text>
              </View>

              {/* Col 4: سعر الوحدة / UNIT PRICE */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thTextAr}>سعر الوحدة</Text>
                <Text style={styles.thTextEn}>PRICE</Text>
              </View>

              {/* Col 5: المبلغ الخاضع للضريبة / TAXABLE AMOUNT */}
              <View style={[styles.thCell, styles.colTaxable]}>
                <Text style={styles.thTextAr}>الخاضع للضريبة</Text>
                <Text style={styles.thTextEn}>TAXABLE</Text>
              </View>

              {/* Col 6: نسبة الضريبة / VAT RATE */}
              <View style={[styles.thCell, styles.colVatRate]}>
                <Text style={styles.thTextAr}>النسبة</Text>
                <Text style={styles.thTextEn}>RATE</Text>
              </View>

              {/* Col 7: مبلغ الضريبة / VAT AMOUNT */}
              <View style={[styles.thCell, styles.colVatAmount]}>
                <Text style={styles.thTextAr}>الضريبة</Text>
                <Text style={styles.thTextEn}>VAT</Text>
              </View>

              {/* Col 8: الإجمالي شامل الضريبة / TOTAL (INC. VAT) */}
              <View style={[styles.thCell, styles.colTotal, { borderRightWidth: 0 }]}>
                <Text style={styles.thTextAr}>الإجمالي</Text>
                <Text style={styles.thTextEn}>TOTAL</Text>
              </View>
            </View>

            {/* Table Body Rows */}
            {rows.map((row) => (
              <View key={row.key} style={styles.tableBodyRow}>
                {/* Seq */}
                <View style={[styles.tdCell, styles.colSeq]}>
                  <Text style={styles.tdTextCenter}>{row.index}</Text>
                </View>

                {/* Description & Item details */}
                <View style={[styles.tdCell, styles.colDesc, styles.tdDescCell]}>
                  <Text style={styles.tdTextDesc}>{row.descAr}</Text>
                  {row.descEn ? (
                    <Text style={styles.tdTextDescEn}>{row.descEn}</Text>
                  ) : null}
                  {row.itemCode ? (
                    <Text style={styles.itemCodeBadge}>كود: {row.itemCode}</Text>
                  ) : null}
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.rawSubtotal)} | بعد: {formatExactAmount(row.taxableSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdTextCenter}>{formatQty(row.qty)}</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdTextRight}>{formatExactAmount(row.unitPrice)}</Text>
                </View>

                {/* Taxable Subtotal */}
                <View style={[styles.tdCell, styles.colTaxable]}>
                  <Text style={styles.tdTextRight}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>

                {/* VAT Rate */}
                <View style={[styles.tdCell, styles.colVatRate]}>
                  <Text style={styles.tdTextCenter}>{row.vatRate}%</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, styles.colVatAmount]}>
                  <Text style={styles.tdTextRight}>{formatExactAmount(row.lineVat)}</Text>
                </View>

                {/* Line Total Inc VAT */}
                <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextRightBold}>{formatExactAmount(row.lineTotal)}</Text>
                </View>
              </View>
            ))}

            {/* Empty filler rows for authentic structured appearance */}
            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.tableBodyRow}>
                <View style={[styles.tdCell, styles.colSeq]}><Text style={styles.tdTextCenter}>{rows.length + idx + 1}</Text></View>
                <View style={[styles.tdCell, styles.colDesc]}><Text style={styles.tdTextDesc}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colQty]}><Text style={styles.tdTextCenter}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colPrice]}><Text style={styles.tdTextRight}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colTaxable]}><Text style={styles.tdTextRight}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colVatRate]}><Text style={styles.tdTextCenter}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colVatAmount]}><Text style={styles.tdTextRight}>{""}</Text></View>
                <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}><Text style={styles.tdTextRight}>{""}</Text></View>
              </View>
            ))}
          </View>

          {/* ─── 7. FOOTER SECTION (QR CODE, NOTES & COMPLIANCE, TOTALS GRID) ─── */}
          <View style={styles.footerContainer}>
            {/* Left Block: Official ZATCA 2D QR Code */}
            <View style={styles.footerQrBlock}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>رمز الاستجابة السريع</Text>
                  <Text style={styles.qrPlaceholderSubText}>ZATCA QR</Text>
                </View>
              )}
            </View>

            {/* Center Block: Notes, Terms, and Regulatory Notice */}
            <View style={styles.footerCenterBlock}>
              {invoice.notes ? (
                <View style={styles.footerNoteSection}>
                  <Text style={styles.footerNoteTitle}>ملاحظات الفاتورة / Notes:</Text>
                  <Text style={styles.footerNoteContent}>{invoice.notes}</Text>
                </View>
              ) : null}

              {invoice.terms ? (
                <View style={styles.footerNoteSection}>
                  <Text style={styles.footerNoteTitle}>الشروط والأحكام / Terms & Conditions:</Text>
                  <Text style={styles.footerNoteContent}>{invoice.terms}</Text>
                </View>
              ) : null}

              {company.footerText ? (
                <View style={styles.footerNoteSection}>
                  <Text style={styles.footerCustomText}>{company.footerText}</Text>
                </View>
              ) : null}

              {!invoice.notes && !invoice.terms && !company.footerText ? (
                <View style={styles.complianceNoticeBox}>
                  <Text style={styles.complianceNoticeAr}>
                    أقرت المنشأة بصحة هذه البيانات وأن هذه الفاتورة صادرة ومعتمدة إلكترونياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA).
                  </Text>
                  <Text style={styles.complianceNoticeEn}>
                    Official tax invoice authenticated in compliance with ZATCA regulations.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Right Block: Comprehensive Totals Summary Grid */}
            <View style={styles.footerTotalsBlock}>
              {/* Gross Total Excl. VAT */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>الإجمالي قبل الخصم</Text>
                  <Text style={styles.totalsLabelEn}>GROSS TOTAL</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatExactAmount(subtotalVal)}</Text>
                </View>
              </View>

              {/* Total Discounts */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>إجمالي الخصم</Text>
                  <Text style={styles.totalsLabelEn}>TOTAL DISCOUNT</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatExactAmount(totalDiscountVal)}</Text>
                </View>
              </View>

              {/* Taxable Amount */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>المبلغ الخاضع للضريبة</Text>
                  <Text style={styles.totalsLabelEn}>TAXABLE AMOUNT</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatExactAmount(taxableSubtotalVal)}</Text>
                </View>
              </View>

              {/* VAT Amount with Percentage */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>ضريبة القيمة المضافة ({vatRatePercentage})</Text>
                  <Text style={styles.totalsLabelEn}>VAT AMOUNT</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatExactAmount(vatVal)}</Text>
                </View>
              </View>

              {/* Grand Total Inc. VAT */}
              <View style={styles.totalsRowHighlight}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelArBold}>الإجمالي شامل الضريبة</Text>
                  <Text style={styles.totalsLabelEnBold}>GRAND TOTAL</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueTextBold}>{formatExactAmount(totalVal)}</Text>
                </View>
              </View>

              {/* Invoice Paid */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>المبلغ المسدد</Text>
                  <Text style={styles.totalsLabelEn}>INVOICE PAID</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatExactAmount(totalVal)}</Text>
                </View>
              </View>

              {/* Balance Due */}
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>المبلغ المتبقي</Text>
                  <Text style={styles.totalsLabelEn}>BALANCE DUE</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>0.00 ر.س</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── 8. TAFQEET AMOUNT IN WORDS FULL-WIDTH STRIP ─── */}
          <View style={styles.tafqeetStrip}>
            <Text style={styles.tafqeetText}>
              {tafqeetText ? `المبلغ المستحق رقماً وكتابة: ${tafqeetText}` : ""}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── MAROON THEME PALETTE & STYLESHEET ───
const MAROON = "#8A1528";
const MAROON_LINE = "#8A1528";
const MAROON_FILL = "#FDF4F5";
const MAROON_FILL_ALT = "#F8E9EC";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 7,
    color: MAROON,
  },
  watermarkBg: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },
  outerFrame: {
    borderWidth: 1.5,
    borderColor: MAROON_LINE,
    borderRadius: 6,
    padding: 6,
    flexDirection: "column",
    flex: 1,
  },

  // ─── Header ───
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: MAROON_LINE,
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeftCol: {
    width: "35%",
    alignItems: "flex-start",
  },
  companyNameEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "left",
    marginBottom: 1,
  },
  headerCrLine: {
    fontSize: 6,
    color: MAROON,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 1,
  },
  headerBranchEn: {
    fontSize: 5,
    color: MAROON,
    textAlign: "left",
    lineHeight: 1.2,
  },
  headerCenterCol: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 65,
    height: 38,
    objectFit: "contain",
    marginBottom: 2,
  },
  taxInvoiceTitleCenter: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  taxInvoiceSubtitleCenter: {
    fontSize: 6,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  headerRightCol: {
    width: "35%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
    marginBottom: 1,
  },
  headerBranchAr: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "right",
    lineHeight: 1.2,
  },
  headerVatStrip: {
    marginTop: 3,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  headerVatText: {
    fontSize: 7,
    fontWeight: "bold",
    color: MAROON,
    letterSpacing: 0.3,
  },

  // ─── Calligraphic Tax Invoice Banner ───
  taxInvoiceBannerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  taxInvoiceBannerPill: {
    borderWidth: 1.2,
    borderColor: MAROON_LINE,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  taxInvoiceBannerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },

  // ─── Capsule Metadata Cells ───
  metaRow1: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  metaRow2: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  metaRow3: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 5,
  },
  capsuleCell: {
    borderWidth: 1,
    borderColor: MAROON_LINE,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
    minHeight: 26,
    backgroundColor: "#FFFFFF",
  },
  capsuleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2,
    marginBottom: 1,
  },
  capsuleLabelEn: {
    fontSize: 5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "left",
  },
  capsuleLabelAr: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  capsuleValueText: {
    fontSize: 7,
    color: MAROON,
    textAlign: "center",
  },
  capsuleValueTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  capsuleValueCustomerName: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  capsuleValueAddress: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "center",
  },

  // ─── Products Table ───
  tableContainer: {
    borderWidth: 1,
    borderColor: MAROON_LINE,
    marginBottom: 5,
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MAROON_LINE,
    backgroundColor: MAROON_FILL,
    minHeight: 20,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.1,
  },
  thTextEn: {
    fontSize: 5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.1,
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: MAROON_LINE,
    minHeight: 15,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: MAROON_LINE,
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdDescCell: {
    justifyContent: "flex-start",
  },
  tdTextCenter: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "center",
  },
  tdTextRight: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "right",
  },
  tdTextRightBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  tdTextDesc: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "right",
  },
  tdTextDescEn: {
    fontSize: 5,
    color: MAROON,
    textAlign: "right",
  },
  itemCodeBadge: {
    fontSize: 5,
    color: MAROON,
    textAlign: "right",
    opacity: 0.8,
  },
  discountBadge: {
    marginTop: 1,
    paddingVertical: 1,
    paddingHorizontal: 2,
    backgroundColor: MAROON_FILL,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: MAROON_LINE,
  },
  discountBadgeText: {
    fontSize: 5,
    color: MAROON,
    textAlign: "right",
    fontWeight: "bold",
  },

  // Column Widths
  colSeq: { width: "5%" },
  colDesc: { width: "35%" },
  colQty: { width: "8%" },
  colPrice: { width: "10%" },
  colTaxable: { width: "12%" },
  colVatRate: { width: "8%" },
  colVatAmount: { width: "10%" },
  colTotal: { width: "12%" },

  // ─── Footer Section ───
  footerContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: MAROON_LINE,
    minHeight: 88,
    alignItems: "stretch",
  },
  footerQrBlock: {
    width: "20%",
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  qrImage: {
    width: 68,
    height: 68,
  },
  qrPlaceholder: {
    width: 64,
    height: 64,
    borderWidth: 0.5,
    borderColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  qrPlaceholderText: {
    fontSize: 6,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  qrPlaceholderSubText: {
    fontSize: 5,
    color: MAROON,
    textAlign: "center",
    marginTop: 2,
  },

  footerCenterBlock: {
    width: "44%",
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    flexDirection: "column",
    justifyContent: "center",
    padding: 4,
    gap: 3,
  },
  footerNoteSection: {
    marginBottom: 2,
  },
  footerNoteTitle: {
    fontSize: 6,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
    marginBottom: 1,
  },
  footerNoteContent: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "right",
    lineHeight: 1.2,
  },
  footerCustomText: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "center",
    fontWeight: "bold",
  },
  complianceNoticeBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  complianceNoticeAr: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.3,
    marginBottom: 1,
  },
  complianceNoticeEn: {
    fontSize: 4.8,
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.2,
  },

  footerTotalsBlock: {
    width: "36%",
    flexDirection: "column",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: MAROON_LINE,
    flex: 1,
    alignItems: "center",
  },
  totalsRowHighlight: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: MAROON_LINE,
    backgroundColor: MAROON_FILL,
    flex: 1.1,
    alignItems: "center",
  },
  totalsLabelCol: {
    width: "55%",
    borderRightWidth: 0.5,
    borderRightColor: MAROON_LINE,
    paddingHorizontal: 3,
    paddingVertical: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  totalsLabelAr: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsLabelArBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsLabelEn: {
    fontSize: 4.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsLabelEnBold: {
    fontSize: 5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsValueCol: {
    width: "45%",
    paddingHorizontal: 3,
    paddingVertical: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  totalsValueText: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "center",
  },
  totalsValueTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },

  // ─── Tafqeet Words Strip ───
  tafqeetStrip: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: MAROON_LINE,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MAROON_FILL,
  },
  tafqeetText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
});
