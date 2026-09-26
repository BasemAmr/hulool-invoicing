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

export interface Template8SalehAlHaiderProps {
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

// ─── Arabic Tafqeet (Spelled-out Numbers to Words) ───
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

function getCompanyAddress(company: CompanyRecord): string {
  const parts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return parts.join(" - ");
}

function getCustomerAddress(customer: CustomerRecord): string {
  const parts = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return parts.join(" - ");
}

export function Template8SalehAlHaider({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template8SalehAlHaiderProps) {
  // Paper dimensions and dynamic single-page height guarantee
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Company Information
  const companyNameAr = company.nameAr || company.nameEn || "";
  const companySubtitleAr = company.nameEn && company.nameAr ? company.nameEn : "";
  const companyVatNumber = company.vatNumber || "";
  const companyCrNumber = company.crNumber || "";
  const companyAddress = getCompanyAddress(company);
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";

  // Dynamic Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateFormatted(invoice.issueDate);

  // Customer Data
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerTaxNumber = customer.vatNumber || "";
  const customerUnifiedOrCr = toText(
    customer.unifiedNumber ??
      (customer as unknown as { crNumber?: string | number })?.crNumber ??
      (customer as unknown as { customerNumber?: string | number })?.customerNumber ??
      (customer as unknown as { clientNo?: string | number })?.clientNo ??
      (customer as unknown as { code?: string | number })?.code ??
      ""
  );
  const customerAddress = getCustomerAddress(customer);
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";

  // Items calculation with discounts and exact values
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;
  let totalQty = 0;

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

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;
    totalQty += qty;

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

  const firstVatRate = rows.find((r) => r.vatRate !== undefined)?.vatRate ?? 15;
  const tafqeetText = tafqeet(grandTotal);

  // Dynamic height calculation for strictly 1 continuous page
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 22;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 14;

  if (invoice.notes) {
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 5) * 10;
  }
  if (invoice.terms) {
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 5) * 10;
  }
  if (company.footerText) {
    extraContentHeight += 18;
  }
  if (customerAddress || customerPhone || customerEmail) {
    extraContentHeight += 16;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={toText(companyNameAr)}
      subject="فاتورة ضريبية / TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered Watermark Styling (never stretched full page) */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ROW: QR CODE (LEFT), LOGO (CENTER), COMPANY INFO (RIGHT) ─── */}
        <View style={styles.headerRow}>
          {/* Top-Left: Official ZATCA 2D QR Code only */}
          <View style={styles.headerQrWrap}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>

          {/* Top-Center: Company Logo (conditionally rendered, null if absent, NO dummy placeholder) */}
          <View style={styles.headerCenterLogo}>
            {logoSource ? (
              <Image src={logoSource} style={styles.customLogoImg} />
            ) : null}
          </View>

          {/* Top-Right: Company Information */}
          <View style={styles.headerCompanyRight}>
            <Text style={styles.companyNameText}>{companyNameAr}</Text>
            {companySubtitleAr ? (
              <Text style={styles.companySubtitleText}>{companySubtitleAr}</Text>
            ) : null}
            {companyVatNumber ? (
              <View style={styles.bidiInlineRow}>
                <Text style={styles.companyMetaValue}>{companyVatNumber}</Text>
                <Text style={styles.companyMetaColon}>:</Text>
                <Text style={styles.companyMetaLabel}>الرقم الضريبي</Text>
              </View>
            ) : null}
            {companyCrNumber ? (
              <View style={styles.bidiInlineRow}>
                <Text style={styles.companyMetaValue}>{companyCrNumber}</Text>
                <Text style={styles.companyMetaColon}>:</Text>
                <Text style={styles.companyMetaLabel}>س.ت / الرقم الموحد</Text>
              </View>
            ) : null}
            {companyAddress ? (
              <Text style={styles.companyAddressText}>{companyAddress}</Text>
            ) : null}
            {companyPhone || companyEmail || companyWebsite ? (
              <Text style={styles.companyContactText}>
                {[companyPhone, companyEmail, companyWebsite].filter(Boolean).join(" | ")}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Horizontal Divider Line */}
        <View style={styles.headerDivider} />

        {/* ─── 2. INFO / METADATA STRIP (3 CELLS WITH THIN VERTICAL DIVIDERS) ─── */}
        <View style={styles.metaStripContainer}>
          {/* 1. Left Cell: Document Type & Number */}
          <View style={[styles.metaCell, styles.metaCellInvoice]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.metaTitleEn}>TAX INVOICE</Text>
              <Text style={styles.metaTitleAr}>فاتورة ضريبية</Text>
            </View>
            <View style={styles.metaRowInlineBottom}>
              <Text style={styles.metaValueStrong}>{invoiceNumber}</Text>
              <Text style={styles.metaLabelText}>رقم الفاتورة</Text>
            </View>
          </View>

          {/* 2. Middle Cell: Date (Issue Date strictly DD/MM/YYYY) */}
          <View style={[styles.metaCell, styles.metaCellDate]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.metaTitleEn}>Issue Date</Text>
              <Text style={styles.metaLabelText}>تاريخ الإصدار</Text>
            </View>
            <View style={styles.metaRowInlineBottom}>
              <Text style={styles.metaValueStrong}>{issueDateStr}</Text>
            </View>
          </View>

          {/* 3. Right Cell: Customer Information */}
          <View style={[styles.metaCell, styles.metaCellCustomer, { borderLeftWidth: 0 }]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.customerNameValue}>{customerName || "عميل عام"}</Text>
              <Text style={styles.metaLabelText}>اسم العميل</Text>
            </View>
            {customerTaxNumber ? (
              <View style={styles.metaRowInline}>
                <Text style={styles.metaValueText}>{customerTaxNumber}</Text>
                <Text style={styles.metaLabelText}>الرقم الضريبي</Text>
              </View>
            ) : null}
            {customerUnifiedOrCr ? (
              <View style={styles.metaRowInline}>
                <Text style={styles.metaValueText}>{customerUnifiedOrCr}</Text>
                <Text style={styles.metaLabelText}>الرقم الموحد / س.ت</Text>
              </View>
            ) : null}
            {customerAddress ? (
              <View style={styles.metaRowInline}>
                <Text style={styles.metaValueTextSmall}>{customerAddress}</Text>
                <Text style={styles.metaLabelText}>العنوان الوطني</Text>
              </View>
            ) : null}
            {customerPhone || customerEmail ? (
              <View style={styles.metaRowInline}>
                <Text style={styles.metaValueTextSmall}>
                  {[customerPhone, customerEmail].filter(Boolean).join(" | ")}
                </Text>
                <Text style={styles.metaLabelText}>التواصل</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. MAIN PRODUCT TABLE (PLAIN BLACK/WHITE, HIGH-DENSITY GRID) ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* Total / الإجمالي شامل الضريبة (Far-Left in RTL view) */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thText}>الإجمالي شامل الضريبة</Text>
            </View>
            {/* VAT Amount / مبلغ الضريبة */}
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thText}>مبلغ الضريبة</Text>
            </View>
            {/* VAT Rate / نسبة الضريبة */}
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thText}>نسبة الضريبة</Text>
            </View>
            {/* Unit Price / سعر الوحدة */}
            <View style={[styles.thCell, styles.colUnitPrice]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>
            {/* Quantity / الكمية */}
            <View style={[styles.thCell, styles.colQuantity]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            {/* Item Name & Description / اسم الصنف والبيان */}
            <View style={[styles.thCell, styles.colItemName]}>
              <Text style={styles.thText}>اسم الصنف والبيان</Text>
            </View>
            {/* Index / م (Far-Right in RTL view) */}
            <View style={[styles.thCell, styles.colIndex, { borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>م</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.tableBodyRow,
                index === rows.length - 1 ? styles.tableLastRow : {},
              ]}
            >
              {/* 1. الإجمالي شامل الضريبة */}
              <View style={[styles.tdCell, styles.colTotal]}>
                <Text style={styles.tdNumTextBold}>{formatExactAmount(row.lineTotal)}</Text>
              </View>

              {/* 2. مبلغ الضريبة */}
              <View style={[styles.tdCell, styles.colVatAmount]}>
                <Text style={styles.tdNumText}>{formatExactAmount(row.lineVat)}</Text>
              </View>

              {/* 3. نسبة الضريبة */}
              <View style={[styles.tdCell, styles.colVatRate]}>
                <Text style={styles.tdTextCenter}>{row.vatRate}%</Text>
              </View>

              {/* 4. سعر الوحدة */}
              <View style={[styles.tdCell, styles.colUnitPrice]}>
                <Text style={styles.tdNumText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>

              {/* 5. الكمية */}
              <View style={[styles.tdCell, styles.colQuantity]}>
                <Text style={styles.tdNumTextBold}>{formatQty(row.qty)}</Text>
              </View>

              {/* 6. اسم الصنف والبيان مع تفاصيل الخصم إن وجد */}
              <View style={[styles.tdCell, styles.colItemName]}>
                <Text style={styles.tdItemDescription}>{row.desc}</Text>
                {row.lineDiscount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.gross)} | بعد: {formatExactAmount(row.taxableSubtotal)})
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* 7. م (التسلسل) */}
              <View style={[styles.tdCell, styles.colIndex, { borderLeftWidth: 0 }]}>
                <Text style={styles.tdTextCenter}>{row.index}</Text>
              </View>
            </View>
          ))}

          {/* Fallback empty row if no items present */}
          {rows.length === 0 ? (
            <View style={[styles.tableBodyRow, styles.tableLastRow]}>
              <View style={[styles.tdCell, styles.colTotal]}><Text style={styles.tdTextCenter}>0.00</Text></View>
              <View style={[styles.tdCell, styles.colVatAmount]}><Text style={styles.tdTextCenter}>0.00</Text></View>
              <View style={[styles.tdCell, styles.colVatRate]}><Text style={styles.tdTextCenter}>15%</Text></View>
              <View style={[styles.tdCell, styles.colUnitPrice]}><Text style={styles.tdTextCenter}>0.00</Text></View>
              <View style={[styles.tdCell, styles.colQuantity]}><Text style={styles.tdTextCenter}>0</Text></View>
              <View style={[styles.tdCell, styles.colItemName]}><Text style={styles.tdTextCenter}>لا توجد عناصر</Text></View>
              <View style={[styles.tdCell, styles.colIndex, { borderLeftWidth: 0 }]}><Text style={styles.tdTextCenter}>-</Text></View>
            </View>
          ) : null}
        </View>

        {/* ─── 4. TOTALS SUMMARY BOX (HIGH-DENSITY BLACK & WHITE GRID) ─── */}
        <View style={styles.totalsBoxContainer}>
          {/* Row 1: Subtotal Excl. VAT & Total Quantity */}
          <View style={styles.totalsRow}>
            <View style={styles.totalsCellLeft}>
              <Text style={styles.totalsValueBold}>{formatExactAmount(taxableAmount)}</Text>
              <Text style={styles.totalsLabel}>المجموع غير شامل الضريبة</Text>
            </View>
            <View style={styles.totalsCellRight}>
              <Text style={styles.totalsValueBold}>{formatQty(totalQty)}</Text>
              <Text style={styles.totalsLabel}>إجمالي الكمية</Text>
            </View>
          </View>

          {/* Row 2: Discount & Taxable Amount */}
          <View style={styles.totalsRow}>
            <View style={styles.totalsCellLeft}>
              <Text style={styles.totalsValue}>{formatExactAmount(computedDiscount)}</Text>
              <Text style={styles.totalsLabel}>إجمالي الخصم</Text>
            </View>
            <View style={styles.totalsCellRight}>
              <Text style={styles.totalsValue}>{formatExactAmount(taxableAmount)}</Text>
              <Text style={styles.totalsLabel}>المبلغ الخاضع للضريبة</Text>
            </View>
          </View>

          {/* Row 3: VAT Amount & Paid Amount */}
          <View style={styles.totalsRow}>
            <View style={styles.totalsCellLeft}>
              <Text style={styles.totalsValue}>{formatExactAmount(totalVat)}</Text>
              <Text style={styles.totalsLabel}>ضريبة القيمة المضافة ({firstVatRate}%)</Text>
            </View>
            <View style={styles.totalsCellRight}>
              <Text style={styles.totalsValueBold}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.totalsLabel}>المبلغ المدفوع</Text>
            </View>
          </View>

          {/* Row 4: Balance Due & Payment Status */}
          <View style={styles.totalsRow}>
            <View style={styles.totalsCellLeft}>
              <Text style={styles.totalsValue}>0.00 SAR</Text>
              <Text style={styles.totalsLabel}>المبلغ المستحق</Text>
            </View>
            <View style={styles.totalsCellRight}>
              <Text style={styles.totalsStatusText}>تم الدفع بالكامل . مدفوعة</Text>
            </View>
          </View>

          {/* Row 5: Grand Total & Spelled-out Tafqeet */}
          <View style={[styles.totalsRow, styles.totalsFinalRow]}>
            <View style={styles.totalsCellLeft}>
              <Text style={styles.netTotalValueBold}>{formatExactAmount(grandTotal)} SAR</Text>
              <Text style={styles.netTotalLabelBold}>صافي الفاتورة شامل الضريبة</Text>
            </View>
            <View style={styles.totalsCellRightWords}>
              <Text style={styles.amountWordsText}>{tafqeetText}</Text>
            </View>
          </View>
        </View>

        {/* ─── 5. NOTES & TERMS SECTION (IF PRESENT) ─── */}
        {toText(invoice.notes) || toText(invoice.terms) ? (
          <View style={styles.notesSection}>
            {toText(invoice.notes) ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>ملاحظات</Text>
                <Text style={styles.notesText}>{toText(invoice.notes)}</Text>
              </View>
            ) : null}
            {toText(invoice.terms) ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                <Text style={styles.notesText}>{toText(invoice.terms)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 6. FOOTER TEXT (IF PRESENT) ─── */}
        {company.footerText ? (
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 16,
    fontSize: 8,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header: 3-column Layout (QR Code Left, Logo Center, Company Info Right) ───
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  headerQrWrap: {
    width: "20%",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  qrImage: {
    width: 109,
    height: 109,
  },
  qrPlaceholder: {
    width: 109,
    height: 109,
  },
  headerCenterLogo: {
    width: "35%",
    alignItems: "center",
    justifyContent: "center",
  },
  customLogoImg: {
    width: 90,
    height: 65,
    objectFit: "contain",
  },
  headerCompanyRight: {
    width: "45%",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  companyNameText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companySubtitleText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "right",
    marginBottom: 3,
  },
  companyAddressText: {
    fontSize: 7,
    color: "#333333",
    textAlign: "right",
    marginTop: 2,
  },
  companyContactText: {
    fontSize: 7,
    color: "#333333",
    textAlign: "right",
    marginTop: 1,
  },
  bidiInlineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 1,
  },
  companyMetaLabel: {
    fontSize: 7.5,
    color: "#000000",
  },
  companyMetaColon: {
    fontSize: 7.5,
    color: "#000000",
    marginHorizontal: 2,
  },
  companyMetaValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Divider Line ───
  headerDivider: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
    marginBottom: 6,
    width: "100%",
  },

  // ─── Metadata Strip (3 Cells Separated by Thin Vertical Rules) ───
  metaStripContainer: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#000000",
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    minHeight: 40,
  },
  metaCell: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    justifyContent: "space-between",
    borderLeftWidth: 0.8,
    borderLeftColor: "#000000",
  },
  metaCellInvoice: {
    width: "27%",
  },
  metaCellDate: {
    width: "23%",
  },
  metaCellCustomer: {
    width: "50%",
  },
  metaRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  metaRowInlineBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaTitleEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  metaTitleAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  metaLabelText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  metaValueText: {
    fontSize: 7.5,
    color: "#000000",
  },
  metaValueTextSmall: {
    fontSize: 6.8,
    color: "#222222",
  },
  metaValueStrong: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  customerNameValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Main Product Table (Plain Black/White High-Density Grid) ───
  tableContainer: {
    borderWidth: 0.8,
    borderColor: "#000000",
    width: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
    backgroundColor: "#FFFFFF",
    minHeight: 18,
    alignItems: "center",
  },
  thCell: {
    borderLeftWidth: 0.6,
    borderLeftColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // Column Proportions (Total 100%)
  colTotal: {
    width: "13%",
  },
  colVatAmount: {
    width: "11%",
  },
  colVatRate: {
    width: "9%",
  },
  colUnitPrice: {
    width: "12%",
  },
  colQuantity: {
    width: "9%",
  },
  colItemName: {
    width: "41%",
  },
  colIndex: {
    width: "5%",
  },

  // Table Body Rows
  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 17,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  tableLastRow: {
    borderBottomWidth: 0,
  },
  tdCell: {
    borderLeftWidth: 0.6,
    borderLeftColor: "#000000",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  tdNumText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  tdNumTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  tdTextCenter: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
    width: "100%",
  },
  tdItemDescription: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  discountBadge: {
    marginTop: 1,
    paddingVertical: 1,
    paddingHorizontal: 3,
    backgroundColor: "#F4F4F5",
    borderWidth: 0.5,
    borderColor: "#A1A1AA",
    borderRadius: 2,
    alignSelf: "flex-end",
  },
  discountBadgeText: {
    fontSize: 6.5,
    color: "#18181B",
    textAlign: "right",
  },

  // ─── Totals Summary Box ───
  totalsBoxContainer: {
    marginTop: 8,
    borderWidth: 0.8,
    borderColor: "#000000",
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 16,
    alignItems: "center",
  },
  totalsFinalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#FAFAFA",
    minHeight: 20,
  },
  totalsCellLeft: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderLeftWidth: 0.8,
    borderLeftColor: "#000000",
  },
  totalsCellRight: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  totalsCellRightWords: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  totalsLabel: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  totalsValue: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  totalsValueBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  totalsStatusText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    width: "100%",
  },
  netTotalLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  netTotalValueBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  amountWordsText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Notes & Terms Section ───
  notesSection: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 0.6,
    borderColor: "#444444",
  },
  noteItem: {
    marginBottom: 3,
  },
  noteTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 7,
    color: "#222222",
    textAlign: "right",
    lineHeight: 1.2,
  },

  // ─── Footer Text ───
  footerContainer: {
    marginTop: 6,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: "#444444",
    textAlign: "center",
  },
});
