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

export interface Template1AlAsmaProps {
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
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
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
  // Clean IEEE-754 floating point representation artifacts (e.g. 415.65000000000003 -> 415.65)
  let str: string;
  if (typeof val === "number") {
    str = Number.isFinite(val) ? String(Number(val.toFixed(10))) : "0.00";
  } else {
    const rawStr = String(val).trim();
    const num = Number(rawStr);
    str = Number.isFinite(num) && rawStr.includes(".") && rawStr.length > 12
      ? String(Number(num.toFixed(10)))
      : rawStr;
  }
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

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toEasternArabicDigits(str: string): string {
  return str.replace(/\d/g, (d) => EASTERN_DIGITS[Number(d)] ?? d);
}

export function Template1AlAsma({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template1AlAsmaProps) {
  // Paper dimensions and dynamic single-page height guarantee
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Header dynamic lines
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";

  const companyAddressParts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";

  const logoSource = logoDataUrl || company.logoUrl;

  // Customer & Invoice Details
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerNameEn = customer.nameEn && customer.nameAr ? customer.nameEn : "";
  const customerAddressParts = [
    customer.addressStreet,
    (customer as any).addressDistrict,
    customer.addressCity,
    customer.addressPostalCode,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");
  const customerVat = customer.vatNumber || "";
  const customerUnified = customer.unifiedNumber || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";

  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateFormatted(invoice.issueDate);
  const issueDateAr = issueDateStr ? toEasternArabicDigits(issueDateStr) : "";

  // Items calculation with discounts and exact values
  const items = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = Number((qty * unitPrice).toFixed(10));
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal =
      item.lineSubtotal !== undefined && item.lineSubtotal !== null && item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Number(Math.max(0, gross - lineDiscount).toFixed(10));
    const vatRate = item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat = item.lineVat !== undefined && item.lineVat !== null ? toNumber(item.lineVat) : Number((taxableSubtotal * (vatRate / 100)).toFixed(10));
    const lineTotal = item.lineTotal !== undefined && item.lineTotal !== null ? toNumber(item.lineTotal) : Number((taxableSubtotal + lineVat).toFixed(10));

    return {
      key: item.position ?? idx,
      si: String(idx + 1),
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

  const sumGross = rows.reduce((a, r) => a + r.gross, 0);
  const sumDisc = rows.reduce((a, r) => a + r.lineDiscount, 0);
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

  const amountPaid = grandTotal;
  const balanceDue = 0;
  const tafqeetText = tafqeet(grandTotal);

  // Dynamic height calculation for strictly 1 continuous page
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 7);
  let extraContentHeight = extraItemsCount * 30;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 14;

  if (invoice.notes) {
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 6) * 12;
  }
  if (invoice.terms) {
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 6) * 12;
  }
  if (company.footerText) {
    extraContentHeight += 22;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${docNo}`}
      author={toText(companyNameAr || companyNameEn)}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Main Outer Box with Rounded Corners */}
        <View style={styles.mainContainer}>
          {/* ─── Header: Company Info & Logo (Left) & QR Code (Right) ─── */}
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              {/* Logo conditionally rendered: no placeholder if absent */}
              {logoSource ? (
                <View style={styles.logoWrapper}>
                  <Image src={logoSource} style={styles.logoImage} />
                </View>
              ) : null}

              {companyNameAr ? (
                <Text style={styles.companyNameAr}>{companyNameAr}</Text>
              ) : null}
              {companyNameEn ? (
                <Text style={styles.companyNameEn}>{companyNameEn}</Text>
              ) : null}

              {/* Company CR and Tax Number via middle-colon pattern */}
              <View style={styles.companyMetaList}>
                {companyVat ? (
                  <View style={styles.companyMetaRow}>
                    <Text style={styles.companyMetaLabel}>الرقم الضريبي</Text>
                    <Text style={styles.companyMetaColon}>:</Text>
                    <Text style={styles.companyMetaVal}>{companyVat}</Text>
                  </View>
                ) : null}
                {companyCr ? (
                  <View style={styles.companyMetaRow}>
                    <Text style={styles.companyMetaLabel}>السجل التجاري / الرقم الموحد</Text>
                    <Text style={styles.companyMetaColon}>:</Text>
                    <Text style={styles.companyMetaVal}>{companyCr}</Text>
                  </View>
                ) : null}
                {companyAddress ? (
                  <View style={styles.companyMetaRow}>
                    <Text style={styles.companyMetaLabel}>العنوان الوطني</Text>
                    <Text style={styles.companyMetaColon}>:</Text>
                    <Text style={styles.companyMetaVal}>{companyAddress}</Text>
                  </View>
                ) : null}
                {companyPhone || companyEmail ? (
                  <View style={styles.companyMetaRow}>
                    <Text style={styles.companyMetaLabel}>التواصل</Text>
                    <Text style={styles.companyMetaColon}>:</Text>
                    <Text style={styles.companyMetaVal}>
                      {[companyPhone, companyEmail, companyWebsite].filter(Boolean).join(" | ")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ZATCA 2D QR Code */}
            <View style={styles.headerRight}>
              {qrDataUrl ? (
                <View style={styles.qrContainer}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                  <Text style={styles.qrLabel}>رمز الاستجابة السريع</Text>
                  <Text style={styles.qrLabelEn}>ZATCA QR Code</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Top Divider */}
          <View style={styles.horizontalDivider} />

          {/* ─── Customer & Invoice Info Grid ─── */}
          <View style={styles.infoSection}>
            {/* Row 1: Customer Name (Left) & Invoice No (Right) */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>اسم العميل / Customer Name</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>
                    {customerName}
                    {customerNameEn ? ` (${customerNameEn})` : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.infoColRight}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>رقم الفاتورة / Invoice No</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>{docNo}</Text>
                </View>
              </View>
            </View>

            {/* Row 2: Customer Address (Left) & Issue Date (Right) */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>العنوان / Address</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>{customerAddress || "-"}</Text>
                </View>
              </View>
              <View style={styles.infoColRight}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>تاريخ الإصدار / Issue Date</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>
                    {issueDateStr ? `${issueDateStr}${issueDateAr ? ` (${issueDateAr})` : ""}` : "-"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Row 3: Customer VAT (Left) & Unified No / CR (Right - repurposed) */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>الرقم الضريبي للعميل / VAT No</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>{customerVat || "-"}</Text>
                </View>
              </View>
              <View style={styles.infoColRight}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>السجل / الرقم الموحد / CR</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValueBold}>{customerUnified || "-"}</Text>
                </View>
              </View>
            </View>

            {/* Row 4: Optional Customer Contact */}
            {customerPhone || customerEmail ? (
              <View style={styles.infoRow}>
                <View style={styles.infoColLeft}>
                  <View style={styles.bidiRow}>
                    <Text style={styles.infoLabel}>هاتف العميل / Phone</Text>
                    <Text style={styles.infoColon}>:</Text>
                    <Text style={styles.infoValueBold}>{customerPhone || "-"}</Text>
                  </View>
                </View>
                <View style={styles.infoColRight}>
                  <View style={styles.bidiRow}>
                    <Text style={styles.infoLabel}>البريد الإلكتروني / Email</Text>
                    <Text style={styles.infoColon}>:</Text>
                    <Text style={styles.infoValueBold}>{customerEmail || "-"}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Centered Document Title: Clear "فاتورة ضريبية" without "مبسطة" */}
            <View style={styles.titleWrapper}>
              <Text style={styles.documentTitle}>
                فاتورة ضريبية / TAX INVOICE
              </Text>
            </View>
          </View>

          {/* ─── Items Table ─── */}
          <View style={styles.tableContainer}>
            {/* Table Header: Removed prohibited unit & code columns, reallocated widths */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>رقم</Text>
                <Text style={styles.thEn}>SI</Text>
              </View>
              <View style={[styles.thCell, { width: "34%" }]}>
                <Text style={styles.thAr}>وصف السلعة أو الخدمة</Text>
                <Text style={styles.thEn}>Description</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "12%" }]}>
                <Text style={styles.thAr}>سعر الوحدة</Text>
                <Text style={styles.thEn}>Unit Price</Text>
              </View>
              <View style={[styles.thCell, { width: "13%" }]}>
                <Text style={styles.thAr}>المبلغ الخاضع للضريبة</Text>
                <Text style={styles.thEn}>Taxable Amount</Text>
              </View>
              <View style={[styles.thCell, { width: "13%" }]}>
                <Text style={styles.thAr}>ضريبة القيمة المضافة</Text>
                <Text style={styles.thEn}>VAT Amount</Text>
              </View>
              <View style={[styles.thCell, { width: "13%", borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>المجموع شامل الضريبة</Text>
                <Text style={styles.thEn}>Total (Inc. VAT)</Text>
              </View>
            </View>

            {/* Table Body */}
            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdEmpty}>No items / لا توجد أصناف</Text>
                </View>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <View style={[styles.tdCell, styles.alignCenter, { width: "6%" }]}>
                    <Text style={styles.tdText}>{row.si}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "34%" }]}>
                    <Text style={styles.tdDescription}>{row.desc}</Text>
                    {row.lineDiscount > 0 ? (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>
                          خصم: {formatExactAmount(row.lineDiscount)} (قبل الخصم: {formatExactAmount(row.gross)})
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.tdCell, styles.alignCenter, { width: "9%" }]}>
                    <Text style={styles.tdText}>{formatQty(row.qty)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "12%" }]}>
                    <Text style={styles.tdText}>{formatExactAmount(row.unitPrice)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "13%" }]}>
                    <Text style={styles.tdText}>{formatExactAmount(row.taxableSubtotal)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "13%" }]}>
                    <Text style={styles.tdText}>{formatExactAmount(row.lineVat)}</Text>
                    <Text style={styles.tdSubText}>%{row.vatRate}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "13%", borderRightWidth: 0 }]}>
                    <Text style={styles.tdTextBold}>{formatExactAmount(row.lineTotal)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ─── Footer: Amount in Words & Totals Box ─── */}
          <View style={styles.footerContainer}>
            {/* Amount in Words (Left) */}
            <View style={styles.wordsContainer}>
              <View style={styles.wordsLabelRow}>
                <Text style={styles.wordsLabel}>المبلغ بالكلمات / Amount in Words</Text>
              </View>
              <Text style={styles.wordsValue}>{tafqeetText}</Text>
            </View>

            {/* Totals Summary Box (Right) */}
            <View style={styles.totalsTable}>
              {/* Total Gross */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>المجموع قبل الخصم</Text>
                  <Text style={styles.totalLabelEn}>Total Gross</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>
                    {formatExactAmount(sumGross > 0 ? sumGross : taxableAmount + sumDisc)}
                  </Text>
                </View>
              </View>

              {/* Total Discount */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>إجمالي الخصم</Text>
                  <Text style={styles.totalLabelEn}>Total Discount</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatExactAmount(sumDisc)}</Text>
                </View>
              </View>

              {/* Taxable Amount */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>المبلغ الخاضع للضريبة</Text>
                  <Text style={styles.totalLabelEn}>Taxable Amount</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatExactAmount(taxableAmount)}</Text>
                </View>
              </View>

              {/* Total VAT */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>ضريبة القيمة المضافة (%15)</Text>
                  <Text style={styles.totalLabelEn}>Total VAT</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatExactAmount(totalVat)}</Text>
                </View>
              </View>

              {/* Grand Total */}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.grandTotalLabelAr}>المجموع الكلي شامل الضريبة</Text>
                  <Text style={styles.grandTotalLabelEn}>Grand Total</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.grandTotalValueText}>{formatExactAmount(grandTotal)}</Text>
                </View>
              </View>

              {/* Invoice Paid (Fully Settled) */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>المبلغ المدفوع</Text>
                  <Text style={styles.totalLabelEn}>Paid Amount</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatExactAmount(amountPaid)}</Text>
                </View>
              </View>

              {/* Balance Due (Zero) */}
              <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelAr}>المبلغ المتبقي</Text>
                  <Text style={styles.totalLabelEn}>Balance Due</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatExactAmount(balanceDue)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Notes & Terms Section ─── */}
          {invoice.notes || invoice.terms ? (
            <View style={styles.notesSection}>
              {invoice.notes ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>ملاحظات / Notes</Text>
                  <Text style={styles.noteContent}>{invoice.notes}</Text>
                </View>
              ) : null}
              {invoice.terms ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>الشروط والأحكام / Terms &amp; Conditions</Text>
                  <Text style={styles.noteContent}>{invoice.terms}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ─── Company Footer Text ─── */}
          {company.footerText ? (
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerText}>{company.footerText}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    padding: 16,
    fontSize: 8,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  mainContainer: {
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 0,
    overflow: "hidden",
  },
  // Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    width: "68%",
  },
  logoWrapper: {
    marginBottom: 4,
  },
  logoImage: {
    maxHeight: 45,
    maxWidth: 120,
    objectFit: "contain",
  },
  companyNameAr: {
    fontSize: 12,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 9,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 3,
    textAlign: "left",
  },
  companyMetaList: {
    marginTop: 2,
  },
  companyMetaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1.5,
  },
  companyMetaLabel: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#111111",
  },
  companyMetaColon: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    marginHorizontal: 2,
    color: "#111111",
  },
  companyMetaVal: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#222222",
  },
  headerRight: {
    width: "30%",
    alignItems: "flex-end",
  },
  qrContainer: {
    borderWidth: 0.75,
    borderColor: "#000000",
    padding: 3,
    alignItems: "center",
  },
  qrImage: {
    width: 65,
    height: 65,
  },
  qrLabel: {
    fontSize: 6,
    fontFamily: "Amiri",
    color: "#000000",
    marginTop: 2,
    textAlign: "center",
  },
  qrLabelEn: {
    fontSize: 5.5,
    fontFamily: "Amiri",
    color: "#444444",
    textAlign: "center",
  },
  horizontalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    width: "100%",
  },
  // Info Section
  infoSection: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoColLeft: {
    width: "55%",
  },
  infoColRight: {
    width: "45%",
  },
  bidiRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
  },
  infoLabel: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  infoColon: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginHorizontal: 2.5,
    color: "#000000",
  },
  infoValueBold: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  titleWrapper: {
    alignItems: "center",
    marginTop: 3,
    marginBottom: 3,
    paddingVertical: 2,
    backgroundColor: "#F4F4F4",
    borderWidth: 0.5,
    borderColor: "#000000",
  },
  documentTitle: {
    fontSize: 9,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  // Items Table
  tableContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    marginHorizontal: 0,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#000000",
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    color: "#FFFFFF",
    fontSize: 6.8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
  },
  thEn: {
    color: "#FFFFFF",
    fontSize: 6.2,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 18,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#CCCCCC",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  alignCenter: {
    alignItems: "center",
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  tdText: {
    fontSize: 7.5,
    color: "#000000",
  },
  tdTextBold: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  tdSubText: {
    fontSize: 6,
    color: "#666666",
  },
  tdDescription: {
    fontSize: 7.5,
    color: "#000000",
    lineHeight: 1.2,
    textAlign: "right",
  },
  discountBadge: {
    marginTop: 1.5,
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  discountBadgeText: {
    fontSize: 6,
    color: "#222222",
    fontFamily: "Amiri",
  },
  tdEmpty: {
    fontSize: 7.5,
    color: "#666666",
    textAlign: "center",
    paddingVertical: 6,
  },
  // Footer
  footerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  wordsContainer: {
    width: "52%",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  wordsLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  wordsLabel: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  wordsValue: {
    fontSize: 7.5,
    color: "#222222",
    fontFamily: "Amiri",
    lineHeight: 1.3,
  },
  // Summary Totals
  totalsTable: {
    width: "48%",
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
  },
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    minHeight: 16,
    alignItems: "center",
  },
  totalLabelCell: {
    width: "60%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  totalLabelAr: {
    fontSize: 7.2,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  totalLabelEn: {
    fontSize: 6.8,
    color: "#444444",
  },
  totalValueCell: {
    width: "40%",
    alignItems: "flex-end",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderLeftWidth: 0.5,
    borderLeftColor: "#CCCCCC",
  },
  totalValueText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  grandTotalRow: {
    backgroundColor: "#F0F0F0",
  },
  grandTotalLabelAr: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  grandTotalLabelEn: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  grandTotalValueText: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // Notes & Terms
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FAFAFA",
  },
  noteBox: {
    marginBottom: 4,
  },
  noteTitle: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },
  noteContent: {
    fontSize: 7,
    fontFamily: "Amiri",
    color: "#333333",
    lineHeight: 1.3,
    textAlign: "right",
  },
  // Footer text
  footerTextContainer: {
    borderTopWidth: 0.5,
    borderTopColor: "#CCCCCC",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    fontFamily: "Amiri",
    color: "#444444",
    textAlign: "center",
  },
});
