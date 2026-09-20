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

export interface Template9ModernBrownGrayProps {
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

export function Template9ModernBrownGray({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template9ModernBrownGrayProps) {
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

  // Dynamic height calculation for single-page guarantee
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
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Top-Left Corner Graphic Accent (Brown & Gray Organic Triangles) ─── */}
        <View style={styles.topLeftCorner} fixed>
          <Svg width="150" height="150" viewBox="0 0 150 150">
            {/* Soft Gray Inner Curve */}
            <Path d="M 0 0 L 110 0 L 0 145 Z" fill="#B0B7BD" opacity={0.6} />
            {/* Warm Ochre Outer Wedge */}
            <Path d="M 0 0 L 85 0 L 0 120 Z" fill="#A87038" />
          </Svg>
        </View>

        {/* ─── Bottom-Right Corner Graphic Accent (Brown & Gray Organic Triangles) ─── */}
        <View style={styles.bottomRightCorner} fixed>
          <Svg width="150" height="150" viewBox="0 0 150 150">
            {/* Soft Gray Inner Curve */}
            <Path d="M 150 150 L 40 150 L 150 5 Z" fill="#B0B7BD" opacity={0.6} />
            {/* Warm Ochre Outer Wedge */}
            <Path d="M 150 150 L 65 150 L 150 30 Z" fill="#A87038" />
          </Svg>
        </View>

        {/* ─── Header Section ─── */}
        <View style={styles.headerRow}>
          {/* Left: Invoice Metadata & Customer Box */}
          <View style={styles.headerLeft}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>التـــــاريخ</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaValue}>{issueDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>رقم الفاتورة</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaValue}>{numberLabel}</Text>
            </View>

            <View style={styles.customerMetaWrap}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>فاتورة إلى</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={[styles.metaValue, styles.bold]}>{customer.nameAr}</Text>
              </View>
              {customer.phone ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>رقم الهـاتـف</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaValue}>{customer.phone}</Text>
                </View>
              ) : null}
              {customer.vatNumber ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>الرقم الضريبي</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaValue}>{customer.vatNumber}</Text>
                </View>
              ) : null}
              {customer.unifiedNumber ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>السجل / الموحد</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaValue}>{customer.unifiedNumber}</Text>
                </View>
              ) : null}
              {customer.addressCity || customer.addressStreet ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>العنـــــوان</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaValue}>
                    {[customer.addressStreet, customer.addressCity].filter(Boolean).join("، ")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Right: Title & Brand / Logo */}
          <View style={styles.headerRight}>
            <Text style={styles.docTitleMain}>فاتورة ضريبية</Text>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
            <Text style={styles.companyNameText}>{company.nameAr}</Text>
            {company.nameEn ? (
              <Text style={styles.companySubText}>{company.nameEn}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── Items Table ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colNo]}>NO</Text>
            <Text style={[styles.th, styles.colDesc]}>اسم الصنف / البيان</Text>
            <Text style={[styles.th, styles.colQty]}>العدد</Text>
            <Text style={[styles.th, styles.colPrice]}>سعر القطعة</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.colDisc]}>الخصم</Text>
            ) : null}
            <Text style={[styles.th, styles.colVatRate]}>الضريبة</Text>
            <Text style={[styles.th, styles.colVatAmt]}>مبلغ الضريبة</Text>
            <Text style={[styles.th, styles.colTotal]}>المجموع</Text>
          </View>

          {/* Table Body */}
          {rows.map((r, idx) => (
            <View
              key={r.key}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : undefined]}
              wrap={false}
            >
              <Text style={[styles.td, styles.colNo]}>{r.index}</Text>
              <View style={[styles.td, styles.colDesc, styles.textRight]}>
                <Text>{r.desc}</Text>
                {r.lineDiscount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      خصم: {formatExactAmount(r.lineDiscount)} SAR
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.td, styles.colQty]}>{formatQty(r.qty)}</Text>
              <Text style={[styles.td, styles.colPrice]}>{formatExactAmount(r.unitPrice)}</Text>
              {hasDiscounts ? (
                <Text style={[styles.td, styles.colDisc]}>
                  {r.lineDiscount > 0 ? formatExactAmount(r.lineDiscount) : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.colVatRate]}>{r.vatRate}%</Text>
              <Text style={[styles.td, styles.colVatAmt]}>{formatExactAmount(r.lineVat)}</Text>
              <Text style={[styles.td, styles.colTotal, styles.bold]}>
                {formatExactAmount(r.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* ─── Financial Totals Breakdown (Right-Aligned Block Matching Image) ─── */}
        <View style={styles.totalsSection} wrap={false}>
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
              <Text style={styles.totalsKey}>الضــــــريبة (15%)</Text>
            </View>

            {/* Accent divider line before Grand Total */}
            <View style={styles.totalDividerLine} />

            <View style={[styles.totalsRow, styles.grandTotalRow]}>
              <Text style={[styles.totalsVal, styles.grandTotalVal]}>
                {formatExactAmount(grandTotal)}
              </Text>
              <Text style={[styles.totalsKey, styles.grandTotalKey]}>الإجمــــالي</Text>
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

        {/* ─── Tafqeet Strip ─── */}
        <View style={styles.tafqeetStrip} wrap={false}>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
        </View>

        {/* ─── Policy Notice Strip (Matching Image: الإستبدال والإسترجاع...) ─── */}
        <View style={styles.policyBox} wrap={false}>
          <Text style={styles.policyText}>{returnPolicyText}</Text>
        </View>

        {/* ─── Bottom Footer Area: Company Contacts (Left) + Official 2D QR Code (Center/Right) ─── */}
        <View style={styles.bottomFooterSection} wrap={false}>
          {/* Company Contact Details (Left side per image) */}
          <View style={styles.companyContactsCol}>
            {formatAddress(company) ? (
              <View style={styles.contactRow}>
                <Text style={styles.contactVal}>{formatAddress(company)}</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.contactKey}>العنـــــوان</Text>
              </View>
            ) : null}

            {company.phone ? (
              <View style={styles.contactRow}>
                <Text style={styles.contactVal}>{company.phone}</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.contactKey}>رقم الهـاتـف</Text>
              </View>
            ) : null}

            {company.email ? (
              <View style={styles.contactRow}>
                <Text style={styles.contactVal}>{company.email}</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.contactKey}>البريد الإلكتروني</Text>
              </View>
            ) : null}

            {company.vatNumber ? (
              <View style={styles.contactRow}>
                <Text style={styles.contactVal}>{company.vatNumber}</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.contactKey}>الرقم الضريبي</Text>
              </View>
            ) : null}

            {company.crNumber ? (
              <View style={styles.contactRow}>
                <Text style={styles.contactVal}>{company.crNumber}</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.contactKey}>السجل التجاري</Text>
              </View>
            ) : null}
          </View>

          {/* Official ZATCA 2D QR Code (Right side) */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image src={qrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrLabel}>فاتورة ضريبية إلكترونية معتمدة</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

const PRIMARY_BROWN = "#A87038";
const ACCENT_GRAY = "#9AA0A6";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 32,
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
  topLeftCorner: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 150,
    height: 150,
  },
  bottomRightCorner: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 150,
    height: 150,
  },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingTop: 4,
  },
  headerRight: {
    width: "48%",
    alignItems: "flex-end",
  },
  docTitleMain: {
    fontSize: 22,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
    textAlign: "right",
    marginBottom: 4,
  },
  logoImage: {
    width: 55,
    height: 55,
    objectFit: "contain",
    marginVertical: 4,
  },
  companyNameText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "right",
  },
  companySubText: {
    fontSize: 7.5,
    color: "#666666",
    textAlign: "right",
  },
  headerLeft: {
    width: "48%",
    alignItems: "flex-start",
    paddingTop: 6,
  },
  customerMetaWrap: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    width: "100%",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginBottom: 2.5,
  },
  metaLabel: {
    fontSize: 7.5,
    color: "#4B5563",
    fontWeight: "bold",
    textAlign: "right",
  },
  colon: {
    fontSize: 7.5,
    color: "#6B7280",
  },
  metaValue: {
    fontSize: 7.8,
    color: "#111827",
    textAlign: "right",
  },
  bold: {
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: PRIMARY_BROWN,
    alignItems: "center",
    minHeight: 22,
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
    minHeight: 18,
  },
  tableRowAlt: {
    backgroundColor: "#FAF8F5",
  },
  th: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    paddingVertical: 3,
    paddingHorizontal: 2,
    textAlign: "center",
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
  colNo: { width: "5%", textAlign: "center" },
  colDesc: { width: "37%", textAlign: "right" },
  colQty: { width: "8%", textAlign: "center" },
  colPrice: { width: "12%", textAlign: "center" },
  colDisc: { width: "8%", textAlign: "center" },
  colVatRate: { width: "9%", textAlign: "center" },
  colVatAmt: { width: "9%", textAlign: "center" },
  colTotal: { width: "12%", textAlign: "center" },
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
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  totalsTable: {
    width: 230,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
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
  totalDividerLine: {
    height: 1,
    backgroundColor: PRIMARY_BROWN,
    marginVertical: 3,
  },
  grandTotalRow: {
    paddingVertical: 3,
  },
  grandTotalKey: {
    fontSize: 9,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
  },
  grandTotalVal: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: PRIMARY_BROWN,
  },
  tafqeetStrip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
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
  policyBox: {
    textAlign: "center",
    marginVertical: 8,
  },
  policyText: {
    fontSize: 7.2,
    color: "#4B5563",
    textAlign: "center",
  },
  bottomFooterSection: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
    paddingTop: 8,
  },
  companyContactsCol: {
    width: "60%",
    alignItems: "flex-start",
  },
  contactRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  contactKey: {
    fontSize: 7,
    color: "#4B5563",
    fontWeight: "bold",
  },
  contactVal: {
    fontSize: 7,
    color: "#1F2937",
  },
  qrCol: {
    width: "35%",
    alignItems: "center",
  },
  qrWrapper: {
    alignItems: "center",
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  qrLabel: {
    fontSize: 5.5,
    color: ACCENT_GRAY,
    marginTop: 2,
    textAlign: "center",
  },
});
