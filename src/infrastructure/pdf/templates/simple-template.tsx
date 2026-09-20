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
function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

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

export interface SimpleTemplateProps {
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

export function SimpleTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: SimpleTemplateProps) {
  const styles = buildSimpleStyles(template.primaryColor, template.accentColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";
  // Document title must always be "فاتورة ضريبية" per ZATCA & master guidelines
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

  // Dynamic height for strictly 1 continuous page
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
    "شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا بموجب الشروط والأحكام";

  const issueDateStr = formatDateFormatted(invoice.issueDate);

  return (
    <Document
      title={`فاتورة ضريبية ${numberLabel}`}
      author={company.nameAr}
      subject={titleAr}
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered Watermark Styling (never stretched full page) */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* 1. Header: Document Title & Meta Box (Left) + Company Info & Logo (Right) */}
        <View style={styles.headerBox}>
          {/* Left: Invoice Title & Meta Box */}
          <View style={styles.headerLeft}>
            <View style={styles.invoiceTitleWrap}>
              <Text style={styles.invoiceTitle}>{titleAr}</Text>
              <Text style={styles.invoiceNumber}>{numberLabel}</Text>
            </View>

            {/* Meta Table Box */}
            <View style={styles.metaTable}>
              <View style={styles.metaTableRow}>
                <Text style={styles.metaTableKey}>تاريخ الفاتورة</Text>
                <Text style={styles.metaTableVal}>{issueDateStr}</Text>
              </View>
              <View style={[styles.metaTableRow, styles.metaTableRowLast]}>
                <Text style={styles.metaTableKey}>المبلغ المستحق</Text>
                <Text style={[styles.metaTableVal, styles.boldText]}>
                  0.00 SAR
                </Text>
              </View>
            </View>
          </View>

          {/* Right: Company Logo & Info */}
          <View style={styles.headerRight}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
            <Text style={styles.companyName}>{company.nameAr}</Text>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}

            {company.vatNumber ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.vatNumber}</Text>
              </View>
            ) : null}

            {company.crNumber ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>السجل التجاري</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.crNumber}</Text>
              </View>
            ) : null}

            {formatAddress(company) ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>العنوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{formatAddress(company)}</Text>
              </View>
            ) : null}

            {company.phone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>هاتف</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.phone}</Text>
              </View>
            ) : null}

            {company.email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>البريد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.email}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 2. Customer Section */}
        <View style={styles.customerSection}>
          <Text style={styles.customerSectionTitle}>حررت الفاتورة إلى</Text>
          <Text style={styles.customerName}>{customer.nameAr}</Text>
          {customer.nameEn ? (
            <Text style={styles.customerNameEn}>{customer.nameEn}</Text>
          ) : null}

          {customer.vatNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>الرقم الضريبي</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.vatNumber}</Text>
            </View>
          ) : null}

          {customer.unifiedNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>الرقم الموحد / السجل</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.unifiedNumber}</Text>
            </View>
          ) : null}

          {customer.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>هاتف/جوال</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.phone}</Text>
            </View>
          ) : null}

          {customer.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>البريد</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.email}</Text>
            </View>
          ) : null}

          {customer.addressCity || customer.addressStreet || customer.addressPostalCode ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>العنوان</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>
                {[customer.addressStreet, customer.addressCity, customer.addressPostalCode]
                  .filter(Boolean)
                  .join("، ")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 3. Items Table (RTL: # on Right, Total on Left) */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text
              style={[
                styles.th,
                hasDiscounts ? styles.colDescNarrow : styles.colDesc,
                styles.textRight,
              ]}
            >
              المنتج / الوصف
            </Text>
            <Text style={[styles.th, styles.colQty]}>الكمية</Text>
            <Text style={[styles.th, styles.colPrice]}>السعر</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.colDisc]}>الخصم</Text>
            ) : null}
            <Text style={[styles.th, styles.colVatRate]}>معدل الضريبة</Text>
            <Text style={[styles.th, styles.colVatAmount]}>مبلغ الضريبة</Text>
            <Text style={[styles.th, styles.colTotal]}>الإجمالي</Text>
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
              <Text style={[styles.td, styles.colVatRate]}>
                {item.vatRate}%
              </Text>
              <Text style={[styles.td, styles.colVatAmount]}>
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

        {/* 5. Bottom Section: QR & Notes (Left) + 7-Tier Totals Summary (Right) */}
        <View style={styles.bottomSection} wrap={false}>
          {/* Left Side: QR Code + Terms/Notes */}
          <View style={styles.bottomLeft}>
            <View style={styles.qrAndNotesRow}>
              {qrDataUrl ? (
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                  <Text style={styles.qrCaption}>فاتورة ضريبية إلكترونية</Text>
                </View>
              ) : (
                <View style={styles.qrBox}>
                  <Text style={styles.draftText}>مسودة غير معتمدة</Text>
                </View>
              )}

              <View style={styles.notesBox}>
                {invoice.notes ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteTitle}>ملاحظات:</Text>
                    <Text style={styles.noteContent}>{invoice.notes}</Text>
                  </View>
                ) : null}
                {invoice.terms ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteTitle}>الشروط والأحكام:</Text>
                    <Text style={styles.noteContent}>{invoice.terms}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Right Side: 7-Tier Totals Breakdown */}
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalsVal}>
                {formatExactAmount(computedGross)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>مجموع الخصومات</Text>
              <Text style={styles.totalsVal}>
                {formatExactAmount(computedDiscount)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المبلغ الخاضع للضريبة</Text>
              <Text style={styles.totalsVal}>
                {formatExactAmount(taxableAmount)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>ضريبة القيمة المضافة 15%</Text>
              <Text style={styles.totalsVal}>
                {formatExactAmount(totalVat)} SAR
              </Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsKey, styles.grandTotalKey]}>
                إجمالي المبلغ المستحق
              </Text>
              <Text style={[styles.totalsVal, styles.grandTotalVal]}>
                {formatExactAmount(grandTotal)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المبلغ المدفوع</Text>
              <Text style={styles.totalsVal}>
                {formatExactAmount(grandTotal)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المبلغ المتبقي</Text>
              <Text style={[styles.totalsVal, styles.boldText]}>
                0.00 SAR
              </Text>
            </View>
          </View>
        </View>

        {/* 6. Footer Text */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildSimpleStyles(primary: string, accent: string) {
  return StyleSheet.create({
    page: {
      paddingHorizontal: 25,
      paddingTop: 20,
      paddingBottom: 25,
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
    topBar: {
      height: 3,
      backgroundColor: primary,
      marginBottom: 10,
    },
    headerBox: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
      marginBottom: 8,
    },
    headerRight: {
      width: "55%",
      alignItems: "flex-end",
    },
    logoImage: {
      width: 46,
      height: 46,
      objectFit: "contain",
      marginBottom: 3,
    },
    companyName: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    companyNameEn: {
      fontSize: 7.5,
      color: "#64748b",
      textAlign: "right",
      marginBottom: 1,
    },
    infoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    infoKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    infoVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    headerLeft: {
      width: "42%",
      alignItems: "flex-start",
    },
    invoiceTitleWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginBottom: 5,
    },
    invoiceTitle: {
      fontSize: 13,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    invoiceNumber: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#334155",
      textAlign: "left",
    },
    metaTable: {
      width: "100%",
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#f8fafc",
    },
    metaTableRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    metaTableRowLast: {
      borderBottomWidth: 0,
      backgroundColor: "#f1f5f9",
    },
    metaTableKey: {
      fontSize: 7,
      color: "#475569",
      textAlign: "right",
    },
    metaTableVal: {
      fontSize: 7.5,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    customerSection: {
      alignItems: "flex-end",
      marginBottom: 8,
    },
    customerSectionTitle: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#475569",
      textAlign: "right",
      marginBottom: 1,
    },
    customerName: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    customerNameEn: {
      fontSize: 7.5,
      color: "#64748b",
      textAlign: "right",
    },
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 6,
      backgroundColor: "#ffffff",
    },
    tableHeaderRow: {
      flexDirection: "row-reverse",
      backgroundColor: primary,
      alignItems: "center",
      minHeight: 20,
    },
    tableRow: {
      flexDirection: "row-reverse",
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
      alignItems: "center",
      minHeight: 17,
    },
    tableRowAlt: {
      backgroundColor: "#f8fafc",
    },
    th: {
      color: "#ffffff",
      fontSize: 7.5,
      fontWeight: "bold",
      paddingVertical: 3,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 1,
      borderLeftColor: "rgba(255, 255, 255, 0.25)",
    },
    td: {
      fontSize: 7.5,
      paddingVertical: 2.5,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 1,
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
    colPos: { width: "4%", textAlign: "center" },
    colDesc: { width: "42%", textAlign: "right" },
    colDescNarrow: { width: "34%", textAlign: "right" },
    colQty: { width: "8%", textAlign: "center" },
    colPrice: { width: "12%", textAlign: "center" },
    colDisc: { width: "8%", textAlign: "center" },
    colVatRate: { width: "11%", textAlign: "center" },
    colVatAmount: { width: "11%", textAlign: "center" },
    colTotal: { width: "12%", textAlign: "center", borderLeftWidth: 0 },
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
      paddingHorizontal: 8,
      paddingVertical: 4,
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
      gap: 10,
      marginTop: 4,
    },
    bottomLeft: {
      flex: 1,
    },
    qrAndNotesRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 8,
    },
    qrBox: {
      width: 76,
      alignItems: "center",
      justifyContent: "center",
      shrink: 0,
    },
    qrImage: {
      width: 76,
      height: 76,
    },
    qrCaption: {
      fontSize: 5.5,
      color: "#64748b",
      textAlign: "center",
      marginTop: 2,
    },
    draftText: {
      fontSize: 8,
      color: "#94a3b8",
      textAlign: "center",
    },
    notesBox: {
      flex: 1,
      gap: 4,
    },
    noteBlock: {
      padding: 4,
      backgroundColor: "#f8fafc",
      borderRightWidth: 2,
      borderRightColor: primary,
    },
    noteTitle: {
      fontSize: 6.5,
      fontWeight: "bold",
      color: "#475569",
      textAlign: "right",
    },
    noteContent: {
      fontSize: 6.5,
      color: "#1e293b",
      textAlign: "right",
      marginTop: 1,
    },
    totalsTable: {
      width: 220,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
    },
    totalsRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalsRowGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
    },
    totalsKey: {
      fontSize: 6.8,
      color: "#475569",
      textAlign: "right",
    },
    totalsVal: {
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
    footer: {
      position: "absolute",
      bottom: 12,
      left: 25,
      right: 25,
      paddingTop: 4,
      borderTopWidth: 0.5,
      borderTopColor: "#e2e8f0",
      textAlign: "center",
    },
    footerText: {
      fontSize: 6.5,
      color: "#94a3b8",
      textAlign: "center",
    },
  });
}
