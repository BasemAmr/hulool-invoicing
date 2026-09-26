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

export interface Template5TharaRiyadhProps {
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

// ─── Arabic Tafqeet (Number to Words) ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
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
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

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
  if (num <= 0) return "صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Helpers ───
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
 * Exact numeric amount formatter: preserves complete decimal representation
 * without rounding or truncating raw decimals, and formats the integer part with commas.
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
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

/**
 * Strict DD/MM/YYYY date formatter for Issue Date only.
 */
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

const DEFAULT_TERMS: string[] = [
  "1- يجب إحضار الفاتورة الأصلية عند الاسترجاع أو الاستبدال.",
  "2- الاسترجاع والاستبدال خلال 7 أيام من تاريخ الشراء.",
  "3- التأكد من سلامة البضاعة وصلاحيتها قبل الاستلام.",
];

export function Template5TharaRiyadh({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template5TharaRiyadhProps) {
  // Paper dimensions and dynamic single-page height guarantee
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Header dynamic lines (Arabic & English)
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyPhone = company.phone || "";

  const companyAddressPartsAr = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressStreet,
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity,
    company.addressPostalCode,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const companyAddressAr = companyAddressPartsAr.join(" - ");

  const companyAddressPartsEn = [
    company.addressBuildingNumber ? `Bldg ${company.addressBuildingNumber}` : "",
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const companyAddressEn = companyAddressPartsEn.join(" - ");

  const logoSource = logoDataUrl || company.logoUrl || null;

  // Customer & Invoice Details
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerUnifiedOrCr = customer.unifiedNumber || (customer as any).crNumber || "";

  const customerAddressParts = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerContact = [customerPhone, customerEmail].filter(Boolean).join(" | ");

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateFormatted = formatDateFormatted(invoice.issueDate);

  // Items calculation with discounts and exact values
  const items = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);
    const vatRate = item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    return {
      key: item.position ?? idx,
      index: String(idx + 1),
      descAr: item.description || "",
      descEn: (item as any).descriptionEn || "",
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

  const sumGross = rows.reduce((a, r) => a + r.gross, 0);
  const sumDiscount = rows.reduce((a, r) => a + r.lineDiscount, 0);
  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);

  const taxableAmount =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : rows.reduce((a, r) => a + r.lineVat, 0);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableAmount + totalVat;

  const tafqeetText = tafqeet(grandTotal);

  const firstItem = rows[0];
  const mainVatRate = firstItem ? firstItem.vatRate : 15;

  // Dynamic height calculation for strictly 1 continuous page
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 6);
  let extraContentHeight = extraItemsCount * 26;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 14;

  if (invoice.notes) {
    extraContentHeight += 20 + Math.min(invoice.notes.split("\n").length, 5) * 11;
  }
  if (invoice.terms) {
    extraContentHeight += 20 + Math.min(invoice.terms.split("\n").length, 5) * 11;
  }
  if (company.footerText) {
    extraContentHeight += 18;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize: [number, number] = [basePageWidth, dynamicHeight];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={toText(companyNameAr || companyNameEn)}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark (Centered, 50% width, 0.04 opacity) */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        <View style={styles.container}>
          {/* ══════════════════════ 1. HEADER (Mirrored Bilingual Header) ══════════════════════ */}
          <View style={styles.header}>
            {/* Left English Block */}
            <View style={styles.headerLeftCol}>
              {companyNameEn ? (
                <Text style={styles.headerEnTitle}>{companyNameEn}</Text>
              ) : null}
              {companyAddressEn ? (
                <Text style={styles.headerEnSub}>{companyAddressEn}</Text>
              ) : null}
              {companyPhone ? (
                <View style={styles.headerContactRow}>
                  <Text style={styles.headerContactLabel}>Tel :</Text>
                  <Text style={styles.headerContactValue}>{companyPhone}</Text>
                </View>
              ) : null}
              {companyVat ? (
                <View style={styles.headerContactRow}>
                  <Text style={styles.headerContactLabel}>VAT Reg :</Text>
                  <Text style={styles.headerContactValue}>{companyVat}</Text>
                </View>
              ) : null}
              {companyCr ? (
                <View style={styles.headerContactRow}>
                  <Text style={styles.headerContactLabel}>C.R. No :</Text>
                  <Text style={styles.headerContactValue}>{companyCr}</Text>
                </View>
              ) : null}
            </View>

            {/* Center Logo Block (Strictly null if absent; no dummy monogram circle) */}
            <View style={styles.headerCenterCol}>
              {logoSource ? (
                <Image src={logoSource} style={styles.logoImage} />
              ) : null}
            </View>

            {/* Right Arabic Block */}
            <View style={styles.headerRightCol}>
              {companyNameAr ? (
                <Text style={styles.headerArTitle}>{companyNameAr}</Text>
              ) : null}
              {companyAddressAr ? (
                <Text style={styles.headerArSub}>{companyAddressAr}</Text>
              ) : null}
              {companyPhone ? (
                <View style={styles.headerContactRowAr}>
                  <Text style={styles.headerContactLabelAr}>هاتف :</Text>
                  <Text style={styles.headerContactValueAr}>{companyPhone}</Text>
                </View>
              ) : null}
              {companyVat ? (
                <View style={styles.headerContactRowAr}>
                  <Text style={styles.headerContactLabelAr}>الرقم الضريبي :</Text>
                  <Text style={styles.headerContactValueAr}>{companyVat}</Text>
                </View>
              ) : null}
              {companyCr ? (
                <View style={styles.headerContactRowAr}>
                  <Text style={styles.headerContactLabelAr}>السجل التجاري :</Text>
                  <Text style={styles.headerContactValueAr}>{companyCr}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Top Divider */}
          <View style={styles.headerBottomDivider} />

          {/* ══════════════════════ 2. INFO STRIP (Tax Invoice Title + Metadata) ══════════════════════ */}
          <View style={styles.infoStrip}>
            {/* Left side: Invoice No, Issue Date (DD/MM/YYYY only, NO payment method, NO time) */}
            <View style={styles.infoLeftBlock}>
              <View style={styles.infoMetaRowLeft}>
                <Text style={styles.infoMetaLabelLeft}>رقم الفاتورة</Text>
                <Text style={styles.infoMetaColonLeft}>:</Text>
                <Text style={styles.infoMetaValLeft}>{invoiceNum}</Text>
              </View>
              <View style={styles.infoMetaRowLeft}>
                <Text style={styles.infoMetaLabelLeft}>تاريخ الإصدار</Text>
                <Text style={styles.infoMetaColonLeft}>:</Text>
                <Text style={styles.infoMetaValLeft}>{issueDateFormatted}</Text>
              </View>
            </View>

            {/* Center: Clear Title "فاتورة ضريبية / TAX INVOICE" */}
            <View style={styles.infoCenterBlock}>
              <Text style={styles.invoiceTitleText}>فاتورة ضريبية</Text>
              <Text style={styles.invoiceTitleSubText}>TAX INVOICE</Text>
            </View>

            {/* Right side: Customer Details (with 3-element middle-colon pattern) */}
            <View style={styles.infoRightBlock}>
              <View style={styles.infoMetaRowRight}>
                <Text style={styles.infoMetaLabelRight}>اسم العميل</Text>
                <Text style={styles.infoMetaColon}>:</Text>
                <Text style={styles.infoMetaValRight}>{customerName || "-"}</Text>
              </View>
              {customerVat ? (
                <View style={styles.infoMetaRowRight}>
                  <Text style={styles.infoMetaLabelRight}>الرقم الضريبي</Text>
                  <Text style={styles.infoMetaColon}>:</Text>
                  <Text style={styles.infoMetaValRight}>{customerVat}</Text>
                </View>
              ) : null}
              {customerUnifiedOrCr ? (
                <View style={styles.infoMetaRowRight}>
                  <Text style={styles.infoMetaLabelRight}>الرقم الموحد / السجل</Text>
                  <Text style={styles.infoMetaColon}>:</Text>
                  <Text style={styles.infoMetaValRight}>{customerUnifiedOrCr}</Text>
                </View>
              ) : null}
              {customerAddress ? (
                <View style={styles.infoMetaRowRight}>
                  <Text style={styles.infoMetaLabelRight}>العنوان الوطني</Text>
                  <Text style={styles.infoMetaColon}>:</Text>
                  <Text style={styles.infoMetaValRight}>{customerAddress}</Text>
                </View>
              ) : null}
              {customerContact ? (
                <View style={styles.infoMetaRowRight}>
                  <Text style={styles.infoMetaLabelRight}>بيانات التواصل</Text>
                  <Text style={styles.infoMetaColon}>:</Text>
                  <Text style={styles.infoMetaValRight}>{customerContact}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ══════════════════════ 3. PRODUCT TABLE ══════════════════════ */}
          {/* RTL order: Total Inc VAT (left) -> VAT Amount -> VAT Rate -> Unit Price -> Qty -> Description -> # (peach right) */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "15%" }]}>
                <Text style={styles.thAr}>المجموع شامل الضريبة</Text>
                <Text style={styles.thEn}>Total (Inc. VAT)</Text>
              </View>
              <View style={[styles.thCell, { width: "12%" }]}>
                <Text style={styles.thAr}>مبلغ الضريبة</Text>
                <Text style={styles.thEn}>VAT Amount</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thAr}>نسبة الضريبة</Text>
                <Text style={styles.thEn}>VAT Rate</Text>
              </View>
              <View style={[styles.thCell, { width: "13%" }]}>
                <Text style={styles.thAr}>سعر الوحدة</Text>
                <Text style={styles.thEn}>Unit Price</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "36%" }]}>
                <Text style={styles.thAr}>البيان</Text>
                <Text style={styles.thEn}>Description</Text>
              </View>
              {/* Highlighted Peach Sequence Column Header */}
              <View style={[styles.thCell, styles.peachAccentCell, { width: "6%", borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>م</Text>
                <Text style={styles.thEn}>#</Text>
              </View>
            </View>

            {/* Table Rows */}
            {rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                {/* Total Inc. VAT */}
                <Text style={[styles.td, { width: "15%", fontWeight: "bold" }]}>
                  {formatExactAmount(row.lineTotal)}
                </Text>

                {/* VAT Amount */}
                <Text style={[styles.td, { width: "12%" }]}>
                  {formatExactAmount(row.lineVat)}
                </Text>

                {/* VAT Rate */}
                <Text style={[styles.td, { width: "9%" }]}>
                  {row.vatRate}%
                </Text>

                {/* Unit Price */}
                <Text style={[styles.td, { width: "13%" }]}>
                  {formatExactAmount(row.unitPrice)}
                </Text>

                {/* Quantity */}
                <Text style={[styles.td, { width: "9%", fontWeight: "bold" }]}>
                  {formatQty(row.qty)}
                </Text>

                {/* Dual-language Description + Discount Badge */}
                <View style={[styles.tdDescCell, { width: "36%" }]}>
                  <Text style={styles.tdDescAr}>{row.descAr}</Text>
                  {row.descEn ? <Text style={styles.tdDescEn}>{row.descEn}</Text> : null}
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.gross)} | بعد: {formatExactAmount(row.taxableSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Highlighted Peach Sequence Data Cell */}
                <View style={[styles.td, styles.peachAccentCell, { width: "6%", borderRightWidth: 0 }]}>
                  <Text style={styles.indexText}>{row.index}</Text>
                </View>
              </View>
            ))}

            {/* Fallback empty row */}
            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.td, { width: "15%" }]}>0.00</Text>
                <Text style={[styles.td, { width: "12%" }]}>0.00</Text>
                <Text style={[styles.td, { width: "9%" }]}>15%</Text>
                <Text style={[styles.td, { width: "13%" }]}>0.00</Text>
                <Text style={[styles.td, { width: "9%" }]}>0</Text>
                <View style={[styles.tdDescCell, { width: "36%" }]}>
                  <Text style={styles.tdDescAr}>لا توجد بنود</Text>
                </View>
                <View style={[styles.td, styles.peachAccentCell, { width: "6%", borderRightWidth: 0 }]}>
                  <Text style={styles.indexText}>-</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ══════════════════════ 4. TOTALS & TAFQEET & NOTES BOX ══════════════════════ */}
          <View style={styles.totalsContainer}>
            {/* Right Side (Arabic RTL reading order): Tafqeet & Terms / Notes */}
            <View style={styles.totalsRightPanel}>
              {/* Tafqeet Box */}
              <View style={styles.tafqeetBox}>
                <View style={styles.tafqeetHeader}>
                  <Text style={styles.tafqeetHeaderText}>المبلغ المستحق كتابة / Amount in Words</Text>
                </View>
                <View style={styles.tafqeetBody}>
                  <Text style={styles.tafqeetBodyText}>{tafqeetText}</Text>
                </View>
              </View>

              {/* Notes & Terms Box */}
              <View style={styles.policyBox}>
                {invoice.notes ? (
                  <View style={styles.policySubSection}>
                    <Text style={styles.policyTitle}>ملاحظات / Notes :</Text>
                    <Text style={styles.policyLine}>{invoice.notes}</Text>
                  </View>
                ) : null}

                {invoice.terms ? (
                  <View style={styles.policySubSection}>
                    <Text style={styles.policyTitle}>الشروط والأحكام / Terms & Conditions :</Text>
                    <Text style={styles.policyLine}>{invoice.terms}</Text>
                  </View>
                ) : (
                  <View style={styles.policySubSection}>
                    <Text style={styles.policyTitle}>سياسة الاسترجاع والاستبدال :</Text>
                    {DEFAULT_TERMS.map((term, i) => (
                      <Text key={i} style={styles.policyLine}>
                        {term}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Left Side: Financial Totals Breakdown Table */}
            <View style={styles.totalsLeftPanel}>
              <View style={styles.totalsTable}>
                {/* Gross Subtotal */}
                <View style={styles.totalsTableRow}>
                  <Text style={styles.totalsValText}>{formatExactAmount(sumGross)} ر.س</Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={styles.totalsLabelAr}>الإجمالي قبل الخصم</Text>
                    <Text style={styles.totalsLabelEn}>Gross Amount</Text>
                  </View>
                </View>

                {/* Total Discount (Rendered conditionally if discount > 0) */}
                {sumDiscount > 0 ? (
                  <View style={styles.totalsTableRow}>
                    <Text style={[styles.totalsValText, { color: "#C2410C" }]}>
                      -{formatExactAmount(sumDiscount)} ر.س
                    </Text>
                    <View style={styles.totalsLabelBlock}>
                      <Text style={styles.totalsLabelAr}>مجموع الخصم</Text>
                      <Text style={styles.totalsLabelEn}>Total Discount</Text>
                    </View>
                  </View>
                ) : null}

                {/* Taxable Amount */}
                <View style={styles.totalsTableRow}>
                  <Text style={styles.totalsValText}>{formatExactAmount(taxableAmount)} ر.س</Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={styles.totalsLabelAr}>المبلغ الخاضع للضريبة</Text>
                    <Text style={styles.totalsLabelEn}>Taxable Amount</Text>
                  </View>
                </View>

                {/* VAT Amount */}
                <View style={styles.totalsTableRow}>
                  <Text style={styles.totalsValText}>{formatExactAmount(totalVat)} ر.س</Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={styles.totalsLabelAr}>ضريبة القيمة المضافة ({mainVatRate}%)</Text>
                    <Text style={styles.totalsLabelEn}>VAT Amount</Text>
                  </View>
                </View>

                {/* Grand Total (Highlighted in Thara Peach Tint #FCE7DB) */}
                <View style={[styles.totalsTableRow, styles.grandTotalRowHighlight]}>
                  <Text style={[styles.totalsValText, styles.grandTotalValHighlight]}>
                    {formatExactAmount(grandTotal)} ر.س
                  </Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={[styles.totalsLabelAr, styles.grandTotalLabelHighlight]}>
                      المجموع الكلي شامل الضريبة
                    </Text>
                    <Text style={[styles.totalsLabelEn, styles.grandTotalLabelHighlight]}>
                      Grand Total (Inc. VAT)
                    </Text>
                  </View>
                </View>

                {/* Invoice Paid (= Grand Total) */}
                <View style={styles.totalsTableRow}>
                  <Text style={styles.totalsValText}>{formatExactAmount(grandTotal)} ر.س</Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={styles.totalsLabelAr}>المبلغ المدفوع</Text>
                    <Text style={styles.totalsLabelEn}>Invoice Paid</Text>
                  </View>
                </View>

                {/* Balance Due (= 0.00 SAR) */}
                <View style={[styles.totalsTableRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.totalsValText}>0.00 ر.س</Text>
                  <View style={styles.totalsLabelBlock}>
                    <Text style={styles.totalsLabelAr}>المبلغ المتبقي</Text>
                    <Text style={styles.totalsLabelEn}>Balance Due</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ══════════════════════ 5. FOOTER SECTION ══════════════════════ */}
          <View style={styles.footerSection}>
            {/* Center: Official ZATCA 2D QR Code */}
            {qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image src={qrDataUrl} style={styles.qrImage} />
              </View>
            ) : (
              <View style={styles.qrWrapper}>
                <View style={styles.qrPlaceholder} />
              </View>
            )}

            {/* Custom Company Footer Text (if present) */}
            {company.footerText ? (
              <View style={styles.footerTextBox}>
                <Text style={styles.footerCustomText}>{company.footerText}</Text>
              </View>
            ) : null}
          </View>

          {/* ══════════════════════ 6. STRICT SINGLE-PAGE INDICATOR ══════════════════════ */}
          <View style={styles.pageNumberRow}>
            <Text style={styles.pageNumberText}>الصفحة 1 من 1</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    fontSize: 7.5,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },
  container: {
    flexDirection: "column",
  },

  // ─── Header ───
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "38%",
    alignItems: "flex-start",
  },
  headerEnTitle: {
    fontSize: 9.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "left",
  },
  headerEnSub: {
    fontSize: 7,
    color: "#000000",
    marginBottom: 3,
    textAlign: "left",
  },
  headerContactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  headerContactLabel: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    width: 50,
    textAlign: "left",
  },
  headerContactValue: {
    fontSize: 7,
    textAlign: "left",
  },

  // Logo (Center)
  headerCenterCol: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 80,
    height: 50,
    objectFit: "contain",
  },

  headerRightCol: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerArTitle: {
    fontSize: 10,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  headerArSub: {
    fontSize: 7,
    color: "#000000",
    marginBottom: 3,
    textAlign: "right",
  },
  headerContactRowAr: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1,
  },
  headerContactLabelAr: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    width: 58,
    textAlign: "right",
  },
  headerContactValueAr: {
    fontSize: 7,
    textAlign: "right",
  },

  headerBottomDivider: {
    height: 1,
    backgroundColor: "#000000",
    marginBottom: 6,
  },

  // ─── Info Strip ───
  infoStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 2,
  },
  infoLeftBlock: {
    width: "30%",
    flexDirection: "column",
  },
  infoMetaRowLeft: {
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 2,
  },
  infoMetaLabelLeft: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "right",
  },
  infoMetaColonLeft: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    marginHorizontal: 2,
  },
  infoMetaValLeft: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },

  infoCenterBlock: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  invoiceTitleText: {
    fontSize: 13,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  invoiceTitleSubText: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    letterSpacing: 1,
  },

  infoRightBlock: {
    width: "38%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  infoMetaRowRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 2,
  },
  infoMetaLabelRight: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "right",
  },
  infoMetaColon: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    marginHorizontal: 2,
  },
  infoMetaValRight: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Table ───
  table: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EFEFEF",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    minHeight: 22,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  peachAccentCell: {
    backgroundColor: "#FCE7DB", // Thara classic warm peach highlight
  },
  thAr: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5.5,
    color: "#000000",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  td: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdDescCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  tdDescAr: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  tdDescEn: {
    fontSize: 5.5,
    color: "#333333",
    textAlign: "left",
  },
  discountBadge: {
    marginTop: 1.5,
    backgroundColor: "#FEF2F2",
    borderWidth: 0.5,
    borderColor: "#EF4444",
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    alignSelf: "flex-end",
  },
  discountBadgeText: {
    fontSize: 5.5,
    color: "#DC2626",
    fontFamily: "Amiri",
    fontWeight: "bold",
  },
  indexText: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // ─── Totals & Tafqeet Section ───
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  totalsLeftPanel: {
    width: "46%",
  },
  totalsRightPanel: {
    width: "52%",
    flexDirection: "column",
  },

  totalsTable: {
    borderWidth: 0.75,
    borderColor: "#000000",
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    minHeight: 16,
  },
  grandTotalRowHighlight: {
    backgroundColor: "#FCE7DB", // Peach accent
    borderTopWidth: 0.75,
    borderTopColor: "#000000",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
  },
  totalsLabelBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  totalsLabelAr: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsLabelEn: {
    fontSize: 5,
    color: "#444444",
    textAlign: "right",
  },
  totalsValText: {
    fontSize: 7,
    fontFamily: "Amiri",
    color: "#000000",
    textAlign: "left",
  },
  grandTotalValHighlight: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  grandTotalLabelHighlight: {
    color: "#000000",
    fontWeight: "bold",
  },

  tafqeetBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tafqeetHeader: {
    backgroundColor: "#EFEFEF",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tafqeetHeaderText: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tafqeetBody: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 20,
  },
  tafqeetBodyText: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  policyBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  policySubSection: {
    marginBottom: 2,
  },
  policyTitle: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginBottom: 1.5,
    textAlign: "right",
  },
  policyLine: {
    fontSize: 6,
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },

  // ─── Footer Section ───
  footerSection: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  qrWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  qrImage: {
    width: 99,
    height: 99,
  },
  qrPlaceholder: {
    width: 99,
    height: 99,
    borderWidth: 0.75,
    borderColor: "#D1D5DB",
  },
  footerTextBox: {
    paddingHorizontal: 10,
    marginTop: 2,
  },
  footerCustomText: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    color: "#444444",
    textAlign: "center",
  },

  // Page Indicator
  pageNumberRow: {
    alignItems: "center",
    marginTop: 2,
  },
  pageNumberText: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    color: "#666666",
  },
});
