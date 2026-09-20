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

export interface Template11ModernCleanCharcoalProps {
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

export function Template11ModernCleanCharcoal({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template11ModernCleanCharcoalProps) {
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

        {/* ─── 1. Top Header Row: Dark Badge Contact Block (Left) + Invoice Identification (Right) ─── */}
        <View style={styles.topHeaderRow} wrap={false}>
          {/* Left: Dark Charcoal Badge Block with Contacts */}
          <View style={styles.contactBadgeCol}>
            {company.phone ? (
              <View style={styles.badgeLine}>
                <Text style={styles.badgeIcon}>☎</Text>
                <Text style={styles.badgeText}>{company.phone}</Text>
              </View>
            ) : null}

            {formatAddress(company) ? (
              <View style={styles.badgeLine}>
                <Text style={styles.badgeIcon}>📍</Text>
                <Text style={styles.badgeText}>{formatAddress(company)}</Text>
              </View>
            ) : null}

            {company.email ? (
              <View style={styles.badgeLine}>
                <Text style={styles.badgeIcon}>✉</Text>
                <Text style={styles.badgeText}>{company.email}</Text>
              </View>
            ) : null}
          </View>

          {/* Right: Invoice Metadata & Company Name */}
          <View style={styles.invoiceMetaCol}>
            <Text style={styles.companyNameHeader}>{company.nameAr}</Text>
            {company.vatNumber ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>الرقم الضريبي للمنشأة</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.metaVal}>{company.vatNumber}</Text>
              </View>
            ) : null}
            {company.crNumber ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>السجل التجاري</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.metaVal}>{company.crNumber}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>رقم الفاتورة</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.metaVal, styles.bold]}>#{numberLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>تاريخ الإصدار</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. Middle Section: Document Title (Left) + Customer Block (Right) ─── */}
        <View style={styles.middleSection} wrap={false}>
          {/* Document Title with horizontal accent line */}
          <View style={styles.titleWrap}>
            <Text style={styles.docTitleAr}>فاتورة ضريبية</Text>
            <View style={styles.titleUnderline} />
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
          </View>

          {/* Customer Details Box */}
          <View style={styles.customerBox}>
            <Text style={styles.billToHeading}>فاتورة إلى:</Text>
            <View style={styles.customerRow}>
              <Text style={styles.customerKey}>الاســـــم</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.customerVal, styles.bold]}>{customer.nameAr}</Text>
            </View>
            {customer.phone ? (
              <View style={styles.customerRow}>
                <Text style={styles.customerKey}>رقم الهاتف</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.customerVal}>{customer.phone}</Text>
              </View>
            ) : null}
            {customer.vatNumber ? (
              <View style={styles.customerRow}>
                <Text style={styles.customerKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.customerVal}>{customer.vatNumber}</Text>
              </View>
            ) : null}
            {customer.unifiedNumber ? (
              <View style={styles.customerRow}>
                <Text style={styles.customerKey}>السجل / الموحد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.customerVal}>{customer.unifiedNumber}</Text>
              </View>
            ) : null}
            {customer.addressCity || customer.addressStreet ? (
              <View style={styles.customerRow}>
                <Text style={styles.customerKey}>العنـــــوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.customerVal}>
                  {[customer.addressStreet, customer.addressCity].filter(Boolean).join("، ")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. Items Table ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colTotal]}>المجموع</Text>
            <Text style={[styles.th, styles.colVat]}>الضريبة</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.colDisc]}>الخصم</Text>
            ) : null}
            <Text style={[styles.th, styles.colPrice]}>سعر القطعة</Text>
            <Text style={[styles.th, styles.colQty]}>العدد</Text>
            <Text style={[styles.th, styles.colDesc]}>اسم الصنف / البيان</Text>
            <Text style={[styles.th, styles.colNo]}>NO</Text>
          </View>

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
              <Text style={[styles.td, styles.colNo]}>{r.index}</Text>
            </View>
          ))}
        </View>

        {/* ─── 4. Totals & QR Code Section ─── */}
        <View style={styles.totalsAndQrRow} wrap={false}>
          {/* Distinctive Dark Block Totals Table (Matching image style) */}
          <View style={styles.darkTotalsBox}>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>{formatExactAmount(computedGross)}</Text>
              <Text style={styles.darkTotalKey}>قبل الضريبة</Text>
            </View>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>{formatExactAmount(computedDiscount)}</Text>
              <Text style={styles.darkTotalKey}>مجموع الخصومات</Text>
            </View>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>{formatExactAmount(taxableAmount)}</Text>
              <Text style={styles.darkTotalKey}>المبلغ الخاضع</Text>
            </View>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>{formatExactAmount(totalVat)}</Text>
              <Text style={styles.darkTotalKey}>الضـــــريبة (15%)</Text>
            </View>
            <View style={[styles.darkTotalRow, styles.darkGrandTotalRow]}>
              <Text style={[styles.darkTotalVal, styles.bold]}>{formatExactAmount(grandTotal)}</Text>
              <Text style={[styles.darkTotalKey, styles.bold]}>الإجمــــالي</Text>
            </View>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.darkTotalKey}>المبلغ المدفوع</Text>
            </View>
            <View style={styles.darkTotalRow}>
              <Text style={styles.darkTotalVal}>0.00</Text>
              <Text style={styles.darkTotalKey}>المبلغ المتبقي</Text>
            </View>
          </View>

          {/* Official ZATCA 2D QR Code */}
          <View style={styles.qrSection}>
            {qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image src={qrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrCaption}>فاتورة ضريبية إلكترونية</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 5. Spelled-out Tafqeet Strip ─── */}
        <View style={styles.tafqeetStrip} wrap={false}>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.tafqeetVal}>{tafqeetText}</Text>
        </View>

        {/* ─── 6. Solid Dark Charcoal Bottom Footer Banner (Matching Native Image) ─── */}
        <View style={styles.darkFooterBanner} wrap={false}>
          <Text style={styles.thankYouHeading}>شكرًا لثقتكم</Text>
          <Text style={styles.returnPolicySubText}>{returnPolicyText}</Text>
          {company.footerText ? (
            <Text style={styles.companyFooterSubText}>{company.footerText}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

const CHARCOAL_COLOR = "#1F2428";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
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
  topHeaderRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  contactBadgeCol: {
    backgroundColor: CHARCOAL_COLOR,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    width: "48%",
    alignItems: "flex-start",
  },
  badgeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeIcon: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  badgeText: {
    fontSize: 7.2,
    color: "#F9FAFB",
  },
  invoiceMetaCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  companyNameHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: CHARCOAL_COLOR,
    marginBottom: 3,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  metaKey: {
    fontSize: 7,
    color: "#4B5563",
    fontWeight: "bold",
  },
  colon: {
    fontSize: 7,
    color: "#9CA3AF",
  },
  metaVal: {
    fontSize: 7.2,
    color: "#111827",
  },
  bold: {
    fontWeight: "bold",
  },
  middleSection: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleWrap: {
    width: "48%",
    alignItems: "flex-start",
    paddingTop: 4,
  },
  docTitleAr: {
    fontSize: 22,
    fontWeight: "bold",
    color: CHARCOAL_COLOR,
  },
  titleUnderline: {
    height: 1.5,
    backgroundColor: CHARCOAL_COLOR,
    width: 140,
    marginTop: 3,
    marginBottom: 6,
  },
  logoImage: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginTop: 2,
  },
  customerBox: {
    width: "48%",
    alignItems: "flex-end",
  },
  billToHeading: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 3,
    textAlign: "right",
  },
  customerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  customerKey: {
    fontSize: 7,
    color: "#6B7280",
    fontWeight: "bold",
  },
  customerVal: {
    fontSize: 7.2,
    color: "#111827",
  },
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: CHARCOAL_COLOR,
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
    backgroundColor: "#F9FAFB",
  },
  th: {
    color: "#ffffff",
    fontSize: 7.2,
    fontWeight: "bold",
    paddingVertical: 3,
    paddingHorizontal: 2,
    textAlign: "center",
  },
  td: {
    fontSize: 7,
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
  colDisc: { width: "10%", textAlign: "center" },
  colVat: { width: "14%", textAlign: "center" },
  colTotal: { width: "14%", textAlign: "center" },
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
  totalsAndQrRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  darkTotalsBox: {
    width: 240,
    backgroundColor: CHARCOAL_COLOR,
    borderRadius: 4,
    padding: 6,
  },
  darkTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#374151",
  },
  darkTotalKey: {
    fontSize: 7.2,
    color: "#D1D5DB",
    textAlign: "right",
  },
  darkTotalVal: {
    fontSize: 7.5,
    color: "#FFFFFF",
    textAlign: "left",
  },
  darkGrandTotalRow: {
    backgroundColor: "#111827",
    borderBottomWidth: 0,
    marginVertical: 1,
  },
  qrSection: {
    width: "45%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  qrWrapper: {
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
    backgroundColor: "#F3F4F6",
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
    color: CHARCOAL_COLOR,
  },
  tafqeetVal: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
  },
  darkFooterBanner: {
    backgroundColor: CHARCOAL_COLOR,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    marginTop: 6,
  },
  thankYouHeading: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 2,
  },
  returnPolicySubText: {
    fontSize: 7,
    color: "#D1D5DB",
    textAlign: "center",
  },
  companyFooterSubText: {
    fontSize: 6.5,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 2,
  },
});
