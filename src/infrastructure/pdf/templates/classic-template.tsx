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

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Utility Helpers ───
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

function formatAddress(company: CompanyRecord): string {
  const parts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.join("، ");
}

export interface ClassicTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl: string | null;
  signatureDataUrl: string | null;
}

export function ClassicTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ClassicTemplateProps) {
  const styles = buildClassicStyles(template.primaryColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";
  const titleAr = "فاتورة ضريبية";

  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

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

  const tafqeetText = tafqeet(grandTotal);

  const hasDiscounts = rows.some((r) => r.lineDiscount > 0);

  // Dynamic height calculation
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 22;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 12;

  if (invoice.notes) {
    extraContentHeight += 20 + Math.min(invoice.notes.split("\n").length, 5) * 8;
  }
  if (invoice.terms) {
    extraContentHeight += 20 + Math.min(invoice.terms.split("\n").length, 5) * 8;
  }
  if (company.footerText) {
    extraContentHeight += 16;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const footerText =
    company.footerText?.trim() ||
    "فاتورة تجارية معتمدة — نشكركم لتعاملكم معنا";

  const issueDateStr = formatDateFormatted(invoice.issueDate);

  return (
    <Document
      title={`فاتورة ضريبية ${numberLabel}`}
      author={company.nameAr}
      subject={titleAr}
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered Watermark Styling */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Outer Frame */}
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            {/* 1. Header: Document Title & Meta Box (Left) + Company Info (Right) */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.docTitle}>{titleAr}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>الرقم</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaVal}>{numberLabel}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>تاريخ الإصدار</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaVal}>{issueDateStr}</Text>
                </View>
              </View>

              <View style={styles.headerRight}>
                {logoSource ? (
                  <Image src={logoSource} style={styles.logo} />
                ) : null}
                <Text style={styles.companyName}>{company.nameAr}</Text>
                {company.vatNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>الرقم الضريبي</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.detailVal}>{company.vatNumber}</Text>
                  </View>
                ) : null}
                {company.crNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>السجل التجاري</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.detailVal}>{company.crNumber}</Text>
                  </View>
                ) : null}
                {formatAddress(company) ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>العنوان</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.detailVal}>{formatAddress(company)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. Customer Section */}
            <View style={styles.customerBox}>
              <Text style={styles.customerHeader}>بيانات العميل (المشتري)</Text>
              <Text style={styles.customerName}>{customer.nameAr}</Text>
              {customer.vatNumber ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>الرقم الضريبي</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.vatNumber}</Text>
                </View>
              ) : null}
              {customer.unifiedNumber ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>الرقم الموحد / السجل</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.unifiedNumber}</Text>
                </View>
              ) : null}
              {customer.phone ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>الهاتف</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.phone}</Text>
                </View>
              ) : null}
              {customer.email ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>البريد</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.email}</Text>
                </View>
              ) : null}
            </View>

            {/* 3. Items Table (RTL) */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.colPos]}>#</Text>
                <Text
                  style={[
                    styles.th,
                    hasDiscounts ? styles.colDescNarrow : styles.colDesc,
                  ]}
                >
                  البيان / الصنف
                </Text>
                <Text style={[styles.th, styles.colQty]}>الكمية</Text>
                <Text style={[styles.th, styles.colPrice]}>السعر</Text>
                {hasDiscounts ? (
                  <Text style={[styles.th, styles.colDisc]}>الخصم</Text>
                ) : null}
                <Text style={[styles.th, styles.colVat]}>الضريبة</Text>
                <Text style={[styles.th, styles.colTotal]}>المجموع</Text>
              </View>

              {rows.map((item, idx) => (
                <View
                  key={item.key}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : undefined]}
                  wrap={false}
                >
                  <Text style={[styles.td, styles.colPos]}>{item.index}</Text>
                  <View
                    style={[
                      styles.td,
                      hasDiscounts ? styles.colDescNarrow : styles.colDesc,
                      styles.textRight,
                    ]}
                  >
                    <Text>{item.desc}</Text>
                    {item.lineDiscount > 0 ? (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>
                          خصم: {formatExactAmount(item.lineDiscount)} SAR
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.td, styles.colQty]}>{formatQty(item.qty)}</Text>
                  <Text style={[styles.td, styles.colPrice]}>
                    {formatExactAmount(item.unitPrice)}
                  </Text>
                  {hasDiscounts ? (
                    <Text style={[styles.td, styles.colDisc]}>
                      {item.lineDiscount > 0
                        ? formatExactAmount(item.lineDiscount)
                        : "—"}
                    </Text>
                  ) : null}
                  <Text style={[styles.td, styles.colVat]}>
                    {formatExactAmount(item.lineVat)}
                  </Text>
                  <Text style={[styles.td, styles.colTotal, styles.boldText]}>
                    {formatExactAmount(item.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>

            {/* 4. Tafqeet Banner Strip */}
            <View style={styles.tafqeetBanner} wrap={false}>
              <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة</Text>
              <Text style={styles.tafqeetColon}>:</Text>
              <Text style={styles.tafqeetVal}>{tafqeetText}</Text>
            </View>

            {/* 5. Bottom Section: QR, Notes & 7-Tier Totals */}
            <View style={styles.bottomSection} wrap={false}>
              <View style={styles.bottomLeft}>
                {qrDataUrl ? (
                  <View style={styles.qrBox}>
                    <Image src={qrDataUrl} style={styles.qrImage} />
                  </View>
                ) : null}
              </View>

              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>الإجمالي قبل الضريبة</Text>
                  <Text style={styles.totalVal}>{formatExactAmount(computedGross)} SAR</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>مجموع الخصومات</Text>
                  <Text style={styles.totalVal}>{formatExactAmount(computedDiscount)} SAR</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>المبلغ الخاضع للضريبة</Text>
                  <Text style={styles.totalVal}>{formatExactAmount(taxableAmount)} SAR</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>ضريبة القيمة المضافة (15%)</Text>
                  <Text style={styles.totalVal}>{formatExactAmount(totalVat)} SAR</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalKey}>إجمالي المبلغ المستحق</Text>
                  <Text style={styles.grandTotalVal}>
                    {formatExactAmount(grandTotal)} SAR
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>المبلغ المدفوع</Text>
                  <Text style={styles.totalVal}>{formatExactAmount(grandTotal)} SAR</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>المبلغ المتبقي</Text>
                  <Text style={[styles.totalVal, styles.boldText]}>0.00 SAR</Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            {invoice.notes || invoice.terms ? (
              <View style={styles.notesSection}>
                {invoice.notes && <Text style={styles.notesText}>{`ملاحظات: ${invoice.notes}`}</Text>}
                {invoice.terms && <Text style={styles.notesText}>{`الشروط: ${invoice.terms}`}</Text>}
              </View>
            ) : null}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildClassicStyles(primary: string) {
  return StyleSheet.create({
    page: {
      padding: 16,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 8,
      color: "#1e293b",
    },
    backgroundImage: {
      position: "absolute",
      top: "28%",
      left: "25%",
      width: "50%",
      opacity: 0.04,
      objectFit: "contain",
    },
    outerFrame: {
      borderWidth: 2,
      borderColor: primary,
      padding: 2,
      flex: 1,
    },
    innerFrame: {
      borderWidth: 1,
      borderColor: primary,
      padding: 10,
      flex: 1,
    },
    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingBottom: 8,
      borderBottomWidth: 1.5,
      borderBottomColor: primary,
      marginBottom: 6,
    },
    headerRight: {
      width: "55%",
      alignItems: "flex-end",
    },
    logo: {
      width: 44,
      height: 44,
      objectFit: "contain",
      marginBottom: 3,
    },
    companyName: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    detailRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    detailKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    detailVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    headerLeft: {
      width: "40%",
      alignItems: "flex-start",
    },
    docTitle: {
      fontSize: 13,
      fontWeight: "bold",
      color: primary,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 2,
    },
    metaKey: {
      fontSize: 7,
      color: "#64748b",
    },
    metaVal: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#0f172a",
    },
    customerBox: {
      padding: 6,
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      marginBottom: 6,
      alignItems: "flex-end",
    },
    customerHeader: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
      marginBottom: 2,
    },
    customerName: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#0f172a",
      marginBottom: 2,
    },
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 6,
    },
    tableHeaderRow: {
      flexDirection: "row-reverse",
      backgroundColor: primary,
      alignItems: "center",
      minHeight: 18,
    },
    tableRow: {
      flexDirection: "row-reverse",
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
      alignItems: "center",
      minHeight: 16,
    },
    tableRowAlt: {
      backgroundColor: "#f8fafc",
    },
    th: {
      color: "#ffffff",
      fontSize: 7,
      fontWeight: "bold",
      paddingVertical: 2,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "rgba(255, 255, 255, 0.3)",
    },
    td: {
      fontSize: 7,
      paddingVertical: 2,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "#e2e8f0",
      color: "#1e293b",
    },
    textRight: {
      textAlign: "right",
    },
    boldText: {
      fontWeight: "bold",
      color: "#0f172a",
    },
    colPos: { width: "5%", textAlign: "center" },
    colDesc: { width: "43%", textAlign: "right" },
    colDescNarrow: { width: "35%", textAlign: "right" },
    colQty: { width: "10%", textAlign: "center" },
    colPrice: { width: "14%", textAlign: "center" },
    colDisc: { width: "8%", textAlign: "center" },
    colVat: { width: "14%", textAlign: "center" },
    colTotal: { width: "14%", textAlign: "center" },
    discountBadge: {
      marginTop: 1,
      paddingHorizontal: 3,
      paddingVertical: 1,
      backgroundColor: "#fef2f2",
      borderRadius: 2,
      alignSelf: "flex-end",
    },
    discountBadgeText: {
      fontSize: 5.5,
      color: "#dc2626",
      fontWeight: "bold",
    },
    tafqeetBanner: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginBottom: 6,
      gap: 4,
    },
    tafqeetLabel: {
      fontSize: 7,
      fontWeight: "bold",
      color: "#475569",
    },
    tafqeetColon: {
      fontSize: 7,
      color: "#475569",
    },
    tafqeetVal: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
    },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginTop: 4,
    },
    bottomLeft: {
      width: "45%",
    },
    qrBox: {
      width: 70,
      height: 70,
      padding: 2,
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
    },
    qrImage: {
      width: 66,
      height: 66,
    },
    totalsBox: {
      width: 210,
      borderWidth: 1,
      borderColor: primary,
    },
    totalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 1.5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    grandTotalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      backgroundColor: primary,
      paddingVertical: 2.5,
      paddingHorizontal: 6,
    },
    totalKey: {
      fontSize: 6.8,
      color: "#475569",
      textAlign: "right",
    },
    totalVal: {
      fontSize: 7.2,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    grandTotalKey: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 7.8,
      textAlign: "right",
    },
    grandTotalVal: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8.5,
      textAlign: "left",
    },
    notesSection: {
      marginTop: 6,
      padding: 4,
      backgroundColor: "#f8fafc",
      borderWidth: 0.5,
      borderColor: "#e2e8f0",
    },
    notesText: {
      fontSize: 6.5,
      color: "#475569",
      textAlign: "right",
    },
    footer: {
      position: "absolute",
      bottom: 10,
      left: 20,
      right: 20,
      textAlign: "center",
    },
    footerText: {
      fontSize: 6.5,
      color: "#94a3b8",
      textAlign: "center",
    },
  });
}
