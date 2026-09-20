import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
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

export interface Template10DarkHeaderBrownProps {
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

export function Template10DarkHeaderBrown({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template10DarkHeaderBrownProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const numberLabel = invoice.invoiceNumber ?? "DRAFT";
  const issueDateStr = formatDateFormatted(invoice.issueDate);
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
  const extraItemsCount = Math.max(0, itemsCount - 6);
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

  const returnPolicyText =
    invoice.terms?.trim() ||
    "الإستبدال والإسترجاع خلال فترة الـ 14 يوم من تاريخ أستلام السلعة";

  return (
    <Document
      title={`فاتورة ضريبية ${numberLabel}`}
      author={company.nameAr}
      subject="فاتورة ضريبية / TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. Full-Width Dark Top Banner (Header with Company Branding & Contacts) ─── */}
        <View style={styles.darkHeaderBand} wrap={false}>
          {/* Company Contacts (Left Side of Dark Banner) */}
          <View style={styles.darkHeaderContacts}>
            {company.email ? (
              <View style={styles.darkContactCol}>
                <Text style={styles.darkContactKey}>البريد الإلكتروني</Text>
                <Text style={styles.darkContactVal}>{company.email}</Text>
              </View>
            ) : null}

            {company.phone ? (
              <View style={styles.darkContactCol}>
                <Text style={styles.darkContactKey}>رقم الهـاتـف</Text>
                <Text style={styles.darkContactVal}>{company.phone}</Text>
              </View>
            ) : null}

            {formatAddress(company) ? (
              <View style={styles.darkContactCol}>
                <Text style={styles.darkContactKey}>العنـــــوان</Text>
                <Text style={styles.darkContactVal}>{formatAddress(company)}</Text>
              </View>
            ) : null}
          </View>

          {/* Company Logo & Name (Right Side of Dark Banner) */}
          <View style={styles.darkHeaderBrand}>
            {logoSource ? (
              <Image src={logoSource} style={styles.darkLogo} />
            ) : null}
            <Text style={styles.darkCompanyName}>{company.nameAr}</Text>
            {company.vatNumber ? (
              <Text style={styles.darkCompanyMeta}>الرقم الضريبي: {company.vatNumber}</Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.darkCompanyMeta}>السجل التجاري: {company.crNumber}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. Subheader Section: Customer Details (Left) + Document Title & Number (Right) ─── */}
        <View style={styles.subHeaderSection} wrap={false}>
          {/* Customer Details (Left) */}
          <View style={styles.customerBlock}>
            <Text style={styles.billToLabel}>فاتورة إلى :</Text>
            <Text style={styles.customerNamePrimary}>{customer.nameAr}</Text>
            {customer.phone ? (
              <View style={styles.customerFieldRow}>
                <Text style={styles.custKey}>رقم الهاتف</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.custVal}>{customer.phone}</Text>
              </View>
            ) : null}
            {customer.vatNumber ? (
              <View style={styles.customerFieldRow}>
                <Text style={styles.custKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.custVal}>{customer.vatNumber}</Text>
              </View>
            ) : null}
            {customer.unifiedNumber ? (
              <View style={styles.customerFieldRow}>
                <Text style={styles.custKey}>السجل / الموحد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.custVal}>{customer.unifiedNumber}</Text>
              </View>
            ) : null}
            {customer.addressCity || customer.addressStreet ? (
              <View style={styles.customerFieldRow}>
                <Text style={styles.custKey}>العنـــــوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.custVal}>
                  {[customer.addressStreet, customer.addressCity].filter(Boolean).join("، ")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Invoice Document Title & Meta (Right) */}
          <View style={styles.titleBlock}>
            <Text style={styles.mainTitleAr}>فاتورة ضريبية</Text>
            <Text style={styles.invoiceNumberHash}># {numberLabel}</Text>
            <View style={styles.issueDateRow}>
              <Text style={styles.issueDateLabel}>تاريخ الإصدار</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.issueDateVal}>{issueDateStr}</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. Split Two-Tone Header Items Table ─── */}
        <View style={styles.table}>
          {/* Unified Two-Tone Header Row matching row columns in exact order */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.thDark, styles.colTotal]}>المجموع</Text>
            <Text style={[styles.th, styles.thDark, styles.colVat]}>الضريبة</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.thDark, styles.colDisc]}>الخصم</Text>
            ) : null}
            <Text style={[styles.th, styles.thDark, styles.colPrice]}>سعر القطعة</Text>
            <Text style={[styles.th, styles.thDark, styles.colQty]}>العدد</Text>
            <Text style={[styles.th, styles.thBrown, hasDiscounts ? styles.colDesc : styles.colDescNoDisc]}>اسم الصنف / البيان</Text>
            <Text style={[styles.th, styles.thBrown, styles.colNo]}>NO</Text>
          </View>

          {/* Table Rows with soft alternating stripes */}
          {rows.map((r, idx) => (
            <View
              key={r.key}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : undefined]}
              wrap={false}
            >
              <Text style={[styles.td, styles.colTotal, styles.bold]}>
                {formatExactAmount(r.lineTotal)}
              </Text>
              <Text style={[styles.td, styles.colVat]}>{formatExactAmount(r.lineVat)}</Text>
              {hasDiscounts ? (
                <Text style={[styles.td, styles.colDisc]}>
                  {r.lineDiscount > 0 ? formatExactAmount(r.lineDiscount) : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.colPrice]}>{formatExactAmount(r.unitPrice)}</Text>
              <Text style={[styles.td, styles.colQty]}>{formatQty(r.qty)}</Text>
              <View style={[styles.td, hasDiscounts ? styles.colDesc : styles.colDescNoDisc, styles.textRight]}>
                <Text>{r.desc}</Text>
                {r.lineDiscount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      خصم: {formatExactAmount(r.lineDiscount)} SAR
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.td, styles.colNo]}>{r.index}</Text>
            </View>
          ))}
        </View>

        {/* ─── 4. Totals & Grand Total Ochre Ribbon Block ─── */}
        <View style={styles.totalsSection} wrap={false}>
          {/* Left side: Official ZATCA 2D QR Code */}
          <View style={styles.qrSideWrap}>
            {qrDataUrl ? (
              <View style={styles.qrContainer}>
                <Image src={qrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrCaption}>فاتورة ضريبية إلكترونية</Text>
              </View>
            ) : null}
          </View>

          {/* Right side: 7-Tier Breakdown & Grand Total Banner */}
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(computedGross)}</Text>
              <Text style={styles.totalsKey}>قبل الضريبة</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(computedDiscount)}</Text>
              <Text style={styles.totalsKey}>مجموع الخصومات</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(taxableAmount)}</Text>
              <Text style={styles.totalsKey}>المبلغ الخاضع للضريبة</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(totalVat)}</Text>
              <Text style={styles.totalsKey}>الضـــــريبة (15%)</Text>
            </View>

            {/* Grand Total Ochre Ribbon Bar (Matching Native Image) */}
            <View style={styles.grandTotalRibbon}>
              <Text style={styles.grandTotalValText}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.grandTotalLabelText}>الإجمـــالي</Text>
            </View>

            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.totalsKey}>المبلغ المدفوع</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsVal, styles.bold]}>0.00</Text>
              <Text style={styles.totalsKey}>المبلغ المتبقي</Text>
            </View>
          </View>
        </View>

        {/* ─── 5. Spelled-out Tafqeet Strip ─── */}
        <View style={styles.tafqeetStrip} wrap={false}>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
        </View>

        {/* ─── 6. Terms & Policy Strip ─── */}
        <View style={styles.policyNotice} wrap={false}>
          <Text style={styles.policyNoticeText}>{returnPolicyText}</Text>
        </View>

        {company.footerText ? (
          <View style={styles.footerWrap} fixed>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const PRIMARY_BROWN = "#A87038";
const DARK_HEADER_BG = "#292E33";
const SOFT_STRIPE = "#E8ECEF";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    fontFamily: "Amiri",
    backgroundColor: "#ffffff",
    fontSize: 8,
    color: "#2C2C2C",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
    objectFit: "contain",
  },
  darkHeaderBand: {
    backgroundColor: DARK_HEADER_BG,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  darkHeaderBrand: {
    alignItems: "flex-end",
    width: "45%",
  },
  darkLogo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginBottom: 4,
  },
  darkCompanyName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "right",
  },
  darkCompanyMeta: {
    fontSize: 7,
    color: "#D1D5DB",
    marginTop: 1,
    textAlign: "right",
  },
  darkHeaderContacts: {
    flexDirection: "row-reverse",
    gap: 16,
    width: "52%",
    justifyContent: "flex-start",
  },
  darkContactCol: {
    alignItems: "flex-end",
  },
  darkContactKey: {
    fontSize: 6.8,
    color: "#9CA3AF",
    fontWeight: "bold",
    marginBottom: 1,
  },
  darkContactVal: {
    fontSize: 7,
    color: "#F3F4F6",
    textAlign: "right",
  },
  subHeaderSection: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  titleBlock: {
    width: "45%",
    alignItems: "flex-end",
  },
  mainTitleAr: {
    fontSize: 22,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
    textAlign: "right",
  },
  invoiceNumberHash: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4B5563",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  issueDateRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  issueDateLabel: {
    fontSize: 7.5,
    color: "#6B7280",
    fontWeight: "bold",
  },
  issueDateVal: {
    fontSize: 7.5,
    color: "#111827",
    fontWeight: "bold",
  },
  customerBlock: {
    width: "50%",
    alignItems: "flex-start",
    paddingTop: 2,
  },
  billToLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
    textAlign: "right",
  },
  customerNamePrimary: {
    fontSize: 11,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
    marginBottom: 3,
    textAlign: "right",
  },
  customerFieldRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  custKey: {
    fontSize: 7,
    color: "#6B7280",
    fontWeight: "bold",
  },
  colon: {
    fontSize: 7,
    color: "#9CA3AF",
  },
  custVal: {
    fontSize: 7.2,
    color: "#1F2937",
  },
  table: {
    width: "100%",
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    height: 22,
    alignItems: "center",
  },
  thDark: {
    backgroundColor: DARK_HEADER_BG,
  },
  thBrown: {
    backgroundColor: PRIMARY_BROWN,
  },
  th: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    paddingVertical: 5,
    paddingHorizontal: 2,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
    minHeight: 18,
  },
  tableRowAlt: {
    backgroundColor: SOFT_STRIPE,
  },
  td: {
    fontSize: 7.2,
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    textAlign: "center",
    color: "#1F2937",
  },
  textRight: {
    textAlign: "right",
  },
  bold: {
    fontWeight: "bold",
  },
  colNo: { width: "6%", textAlign: "center" },
  colDesc: { width: "32%", textAlign: "right", paddingRight: 4 },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "14%", textAlign: "center" },
  colDisc: { width: "11%", textAlign: "center" },
  colVat: { width: "12%", textAlign: "center" },
  colTotal: { width: "15%", textAlign: "center" },
  colDescNoDisc: { width: "43%", textAlign: "right", paddingRight: 4 },
  discountBadge: {
    marginTop: 1,
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: "#FEF2F2",
    borderRadius: 2,
    alignSelf: "flex-end",
  },
  discountBadgeText: {
    fontSize: 5,
    color: "#DC2626",
    fontWeight: "bold",
  },
  totalsSection: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  totalsTable: {
    width: 250,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  totalsKey: {
    fontSize: 7.8,
    color: "#374151",
    textAlign: "right",
  },
  totalsVal: {
    fontSize: 8,
    color: "#111827",
    fontWeight: "bold",
    textAlign: "left",
  },
  grandTotalRibbon: {
    backgroundColor: PRIMARY_BROWN,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 4,
    borderRadius: 3,
  },
  grandTotalLabelText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "bold",
  },
  grandTotalValText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  qrSideWrap: {
    width: "45%",
    alignItems: "flex-start",
    paddingTop: 6,
  },
  qrContainer: {
    alignItems: "center",
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  qrCaption: {
    fontSize: 5.5,
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },
  tafqeetStrip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    gap: 4,
  },
  tafqeetLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
  },
  tafqeetValue: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
  },
  policyNotice: {
    textAlign: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  policyNoticeText: {
    fontSize: 7,
    color: "#6B7280",
    textAlign: "center",
  },
  footerWrap: {
    position: "absolute",
    bottom: 12,
    left: 28,
    right: 28,
    textAlign: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
