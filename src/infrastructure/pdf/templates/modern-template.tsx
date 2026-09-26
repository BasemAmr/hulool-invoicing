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

export interface ModernTemplateProps {
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

export function ModernTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ModernTemplateProps) {
  const styles = buildModernStyles(template.primaryColor, template.accentColor);
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
    "فاتورة ضريبية معتمدة صادرة إلكترونياً وفق متطلبات هيئة الزكاة والضريبة والجمارك";

  const issueDateStr = formatDateFormatted(invoice.issueDate);
  const customerAddress = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .filter(Boolean)
    .join("، ");

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

        {/* 1. Header: Company Info (Right/Start) + Inv Number (Center) + Title (Left) */}
        <View style={styles.headerRow}>
          {/* Start / Right: Company Logo & Info */}
          <View style={styles.headerCompanyCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
            <Text style={styles.companyName}>{company.nameAr}</Text>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
          </View>

          {/* Center: Invoice Number & Status Badge */}
          <View style={styles.headerCenterCol}>
            <Text style={styles.invoiceNumber}>{numberLabel}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {invoice.status === "issued" ? "معتمدة ومصدرة" : "مسودة"}
              </Text>
            </View>
          </View>

          {/* Left: Invoice Title */}
          <View style={styles.headerTitleCol}>
            <Text style={styles.invoiceTitle}>{titleAr}</Text>
          </View>
        </View>

        {/* 2. Top Color Banner: Invoice Metadata (Left) + Client Info (Right) */}
        <View style={styles.bannerGrid}>
          {/* Banner Left: Metadata Grid */}
          <View style={styles.bannerMetaCol}>
            <View style={styles.bannerMetaRow}>
              <View style={styles.labelWithColon}>
                <Text style={styles.bannerMetaKey}>تاريخ الإصدار</Text>
                <Text style={styles.colon}>:</Text>
              </View>
              <Text style={styles.bannerMetaVal}>{issueDateStr}</Text>
            </View>
            {company.vatNumber ? (
              <View style={styles.bannerMetaRow}>
                <View style={styles.labelWithColon}>
                  <Text style={styles.bannerMetaKey}>الرقم الضريبي للمنشأة</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.bannerMetaVal}>{company.vatNumber}</Text>
              </View>
            ) : null}
            {company.crNumber ? (
              <View style={styles.bannerMetaRow}>
                <View style={styles.labelWithColon}>
                  <Text style={styles.bannerMetaKey}>السجل التجاري</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.bannerMetaVal}>{company.crNumber}</Text>
              </View>
            ) : null}
          </View>

          {/* Banner Right: Client Info */}
          <View style={styles.bannerClientCol}>
            <Text style={styles.bannerClientTitle}>حررت الفاتورة إلى</Text>
            <Text style={styles.bannerClientName}>{customer.nameAr}</Text>
            {customer.nameEn ? (
              <Text style={styles.bannerClientNameEn}>{customer.nameEn}</Text>
            ) : null}

            {customer.vatNumber ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.vatNumber}</Text>
              </View>
            ) : null}

            {customer.unifiedNumber ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>الرقم الموحد / السجل</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.unifiedNumber}</Text>
              </View>
            ) : null}

            {customer.phone ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>جوال</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.phone}</Text>
              </View>
            ) : null}

            {customer.email ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>البريد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.email}</Text>
              </View>
            ) : null}

            {customerAddress ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>العنوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customerAddress}</Text>
              </View>
            ) : null}
          </View>
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

        {/* 5. Bottom Section */}
        <View style={styles.bottomSection} wrap={false}>
          {/* Left: Notes & QR */}
          <View style={styles.bottomLeft}>
            {qrDataUrl ? (
              <View style={styles.qrRow}>
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </View>
                <View style={styles.notesContainer}>
                  {invoice.notes ? (
                    <View style={styles.noteItem}>
                      <Text style={styles.noteTitle}>ملاحظات للعميل</Text>
                      <Text style={styles.noteText}>{invoice.notes}</Text>
                    </View>
                  ) : null}
                  {invoice.terms ? (
                    <View style={styles.noteItem}>
                      <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                      <Text style={styles.noteText}>{invoice.terms}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Right: 7-Tier Totals Card */}
          <View style={styles.totalsCard}>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalVal}>
                {formatExactAmount(computedGross)} SAR
              </Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>مجموع الخصومات</Text>
              <Text style={styles.totalVal}>
                {formatExactAmount(computedDiscount)} SAR
              </Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>المبلغ الخاضع للضريبة</Text>
              <Text style={styles.totalVal}>
                {formatExactAmount(taxableAmount)} SAR
              </Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>القيمة المضافة (15%)</Text>
              <Text style={styles.totalVal}>
                {formatExactAmount(totalVat)} SAR
              </Text>
            </View>
            <View style={[styles.totalLine, styles.totalLineGrand]}>
              <Text style={[styles.totalKey, styles.grandTotalKey]}>
                إجمالي المبلغ المستحق
              </Text>
              <Text style={[styles.totalVal, styles.grandTotalText]}>
                {formatExactAmount(grandTotal)} SAR
              </Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>المبلغ المدفوع</Text>
              <Text style={styles.totalVal}>
                {formatExactAmount(grandTotal)} SAR
              </Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>المبلغ المتبقي</Text>
              <Text style={[styles.totalVal, styles.boldText]}>
                0.00 SAR
              </Text>
            </View>
          </View>
        </View>

        {/* 6. Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildModernStyles(primary: string, accent: string) {
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
    headerRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    headerCompanyCol: {
      width: "35%",
      alignItems: "flex-end",
    },
    logoImage: {
      width: 48,
      height: 48,
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
    },
    headerCenterCol: {
      width: "35%",
      alignItems: "center",
      justifyContent: "center",
    },
    invoiceNumber: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#334155",
      textAlign: "center",
    },
    statusBadge: {
      marginTop: 3,
      paddingVertical: 1.5,
      paddingHorizontal: 6,
      backgroundColor: "#f1f5f9",
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderRadius: 2,
      alignSelf: "center",
    },
    statusBadgeText: {
      fontSize: 6.5,
      color: "#475569",
      fontWeight: "bold",
      textAlign: "center",
    },
    headerTitleCol: {
      width: "30%",
      alignItems: "flex-start",
    },
    invoiceTitle: {
      fontSize: 15,
      fontWeight: "bold",
      color: primary,
      textAlign: "left",
    },
    bannerGrid: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderTopWidth: 2,
      borderTopColor: primary,
      padding: 8,
      marginBottom: 8,
    },
    bannerClientCol: {
      width: "48%",
      alignItems: "flex-end",
    },
    bannerClientTitle: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
      marginBottom: 2,
    },
    bannerClientName: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    bannerClientNameEn: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
      marginBottom: 1,
    },
    bannerClientRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    bannerClientKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    bannerClientVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    bannerMetaCol: {
      width: "48%",
      alignItems: "flex-start",
    },
    bannerMetaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingVertical: 1.5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    labelWithColon: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    bannerMetaKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    bannerMetaVal: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "left",
    },
    table: {
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
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
      alignItems: "center",
      minHeight: 18,
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
    },
    td: {
      fontSize: 7.5,
      paddingVertical: 2.5,
      paddingHorizontal: 3,
      textAlign: "center",
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
    colTotal: { width: "12%", textAlign: "center" },
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
      gap: 12,
      marginTop: 4,
    },
    bottomLeft: {
      flex: 1,
    },
    qrRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 8,
    },
    qrBox: {
      width: 113,
      height: 113,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ffffff",
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      padding: 2,
    },
    qrImage: {
      width: 109,
      height: 109,
    },
    qrPlaceholder: {
      width: 109,
      height: 109,
    },
    notesContainer: {
      flex: 1,
      gap: 4,
    },
    noteItem: {
      padding: 4,
      backgroundColor: "#f8fafc",
      borderRadius: 2,
      borderRightWidth: 2,
      borderRightColor: primary,
    },
    noteTitle: {
      fontSize: 6.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    noteText: {
      fontSize: 6.5,
      color: "#1e293b",
      textAlign: "right",
      marginTop: 1,
    },
    totalsCard: {
      width: 220,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderRadius: 2,
    },
    totalLine: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalLineGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
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
    grandTotalText: {
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
