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

export interface PosTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

export function PosTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
}: PosTemplateProps) {
  const isMonochrome = template.id === "pos_monochrome";
  const styles = buildPosStyles(template.primaryColor, isMonochrome);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";
  const titleAr = "فاتورة ضريبية";

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

  const footerText =
    company.footerText?.trim() || "شكراً لزيارتكم — نتطلع لخدمتكم دائماً";

  const issueDateStr = formatDateFormatted(invoice.issueDate);

  // ─── Comprehensive Dynamic Height Calculation (80mm = 226pt width) ───
  // Strictly guarantees all content fits on ONE single continuous thermal roll page.
  let contentHeight = 24; // Base page padding (padding: 8 * 2 = 16 + buffer)

  // 1. Header height
  if (logoSource) contentHeight += 48;
  contentHeight += 18; // companyName
  if (company.nameEn) contentHeight += 12;
  if (company.vatNumber) contentHeight += 14;
  if (company.crNumber) contentHeight += 14;
  if (formatAddress(company)) contentHeight += 18;
  contentHeight += 10; // dashed divider

  // 2. Meta box height
  contentHeight += 22; // titleAr
  contentHeight += 14; // invoice number
  contentHeight += 14; // issue date
  if (customer.nameAr && customer.nameAr !== "عميل نقدي") contentHeight += 14;
  if (customer.vatNumber) contentHeight += 14;
  contentHeight += 10; // solid divider

  // 3. Items table height
  contentHeight += 16; // table header
  contentHeight += 8; // dashed divider
  rows.forEach((r) => {
    let rowH = 22;
    if (r.desc && r.desc.length > 20) {
      rowH += Math.ceil(r.desc.length / 20) * 10;
    }
    if (r.lineDiscount > 0) {
      rowH += 12;
    }
    contentHeight += rowH;
  });
  contentHeight += 8; // dashed divider

  // 4. Totals (7 rows)
  contentHeight += 7 * 14; // 98pt
  contentHeight += 8; // totalRowGrand extra padding

  // 5. Tafqeet box
  contentHeight += 22;
  if (tafqeetText && tafqeetText.length > 30) {
    contentHeight += Math.ceil(tafqeetText.length / 30) * 10;
  }
  contentHeight += 8; // dashed divider

  // 6. Bottom section
  if (qrDataUrl) {
    contentHeight += 88; // QR container 75 + margin
  }
  if (invoice.notes) {
    contentHeight += 18 + Math.min(invoice.notes.split("\n").length, 5) * 12;
    if (invoice.notes.length > 30) {
      contentHeight += Math.ceil(invoice.notes.length / 30) * 8;
    }
  }
  if (invoice.terms) {
    contentHeight += 18 + Math.min(invoice.terms.split("\n").length, 5) * 12;
    if (invoice.terms.length > 30) {
      contentHeight += Math.ceil(invoice.terms.length / 30) * 8;
    }
  }
  if (footerText) {
    contentHeight += 18 + Math.ceil(footerText.length / 35) * 8;
  }

  // Safety buffer to ensure font metrics / subpixel rounding NEVER trigger a page 2
  contentHeight += 60;

  const dynamicRollHeight = Math.max(680, Math.ceil(contentHeight));

  return (
    <Document
      title={`فاتورة ضريبية ${numberLabel}`}
      author={company.nameAr}
      subject={titleAr}
      creator="Hulool Invoicing"
    >
      <Page size={[226, dynamicRollHeight]} style={styles.page}>
        {/* 1. Top Header: Logo + Company Info */}
        <View style={styles.header} wrap={false}>
          {logoSource ? (
            <Image src={logoSource} style={styles.logo} />
          ) : null}
          <Text style={styles.companyName}>{company.nameAr}</Text>
          {company.nameEn ? (
            <Text style={styles.companyNameEn}>{company.nameEn}</Text>
          ) : null}
          {company.vatNumber ? (
            <View style={styles.headerInfoRow}>
              <Text style={styles.vatText}>الرقم الضريبي</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.vatText}>{company.vatNumber}</Text>
            </View>
          ) : null}
          {company.crNumber ? (
            <View style={styles.headerInfoRow}>
              <Text style={styles.vatText}>السجل التجاري</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.vatText}>{company.crNumber}</Text>
            </View>
          ) : null}
          {formatAddress(company) ? (
            <Text style={styles.addressText}>{formatAddress(company)}</Text>
          ) : null}
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 2. Receipt Meta Info (RTL Centered) */}
        <View style={styles.metaBox} wrap={false}>
          <Text style={styles.docTitle}>{titleAr}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>رقم الفاتورة</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.metaVal}>{numberLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>تاريخ الإصدار</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
          </View>
          {customer.nameAr && customer.nameAr !== "عميل نقدي" ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>العميل</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaVal}>{customer.nameAr}</Text>
            </View>
          ) : null}
          {customer.vatNumber ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>الرقم الضريبي</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaVal}>{customer.vatNumber}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.solidDivider}>________________________________________</Text>

        {/* 3. Items Table (RTL: Product on Right, Total on Left) */}
        <View style={styles.itemsTable} wrap={false}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.colDesc, styles.textRight]}>المنتج</Text>
            <Text style={styles.colQty}>الكمية</Text>
            <Text style={styles.colPrice}>السعر</Text>
            <Text style={styles.colVat}>الضريبة</Text>
            <Text style={styles.colTotal}>الإجمالي</Text>
          </View>
          <Text style={styles.dashedDivider}>----------------------------------------</Text>

          {rows.map((item, idx) => (
            <View key={item.key} style={styles.itemRow} wrap={false}>
              <View style={[styles.colDesc, styles.textRight]}>
                <Text>{item.desc}</Text>
                {item.lineDiscount > 0 ? (
                  <Text style={styles.itemDiscountText}>
                    خصم: {formatExactAmount(item.lineDiscount)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.colQty}>{formatQty(item.qty)}</Text>
              <Text style={styles.colPrice}>{formatExactAmount(item.unitPrice)}</Text>
              <Text style={styles.colVat}>{item.vatRate}%</Text>
              <Text style={[styles.colTotal, styles.boldText]}>
                {formatExactAmount(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 4. Financial Summary (7-Tier Breakdown) */}
        <View style={styles.totalsBox} wrap={false}>
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
            <Text style={styles.totalKey}>ضريبة القيمة المضافة 15%</Text>
            <Text style={styles.totalVal}>{formatExactAmount(totalVat)} SAR</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowGrand]}>
            <Text style={[styles.totalKey, styles.boldText]}>إجمالي المبلغ المستحق</Text>
            <Text style={[styles.totalVal, styles.boldText]}>
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

        {/* 5. Arabic Tafqeet Words */}
        <View style={styles.tafqeetBox} wrap={false}>
          <Text style={styles.tafqeetText}>{tafqeetText}</Text>
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 6. Official ZATCA 2D QR Code & Notes / Terms / Footer */}
        <View style={styles.bottomSection} wrap={false}>
          {qrDataUrl ? (
            <View style={styles.qrContainer}>
              <Image src={qrDataUrl} style={styles.qrImage} />
            </View>
          ) : null}

          {invoice.notes ? (
            <Text style={styles.termsText}>{invoice.notes}</Text>
          ) : null}

          {invoice.terms ? (
            <Text style={styles.termsText}>{invoice.terms}</Text>
          ) : null}

          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildPosStyles(primary: string, isMonochrome: boolean) {
  const baseColor = isMonochrome ? "#000000" : primary;

  return StyleSheet.create({
    page: {
      padding: 8,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 7,
      color: "#000000",
    },
    header: {
      alignItems: "center",
      marginBottom: 3,
    },
    logo: {
      width: 38,
      height: 38,
      objectFit: "contain",
      marginBottom: 2,
    },
    companyName: {
      fontSize: 10.5,
      fontWeight: "bold",
      textAlign: "center",
      color: baseColor,
    },
    companyNameEn: {
      fontSize: 6.5,
      textAlign: "center",
      color: "#475569",
    },
    headerInfoRow: {
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      gap: 2,
      marginTop: 1,
    },
    vatText: {
      fontSize: 6.5,
      textAlign: "center",
    },
    colon: {
      fontSize: 6.5,
      textAlign: "center",
    },
    addressText: {
      fontSize: 6,
      textAlign: "center",
      color: "#475569",
      marginTop: 1,
    },
    dashedDivider: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "center",
      marginVertical: 2,
    },
    solidDivider: {
      fontSize: 6,
      color: "#475569",
      textAlign: "center",
      marginVertical: 2,
    },
    metaBox: {
      alignItems: "center",
      marginVertical: 2,
    },
    docTitle: {
      fontSize: 9,
      fontWeight: "bold",
      color: baseColor,
      textAlign: "center",
      marginBottom: 3,
    },
    metaRow: {
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      gap: 2,
      marginBottom: 1,
    },
    metaKey: {
      fontSize: 6.5,
      color: "#475569",
    },
    metaVal: {
      fontSize: 6.5,
      fontWeight: "bold",
    },
    itemsTable: {
      marginVertical: 2,
    },
    itemsHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 1,
    },
    itemRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 1.5,
      borderBottomWidth: 0.3,
      borderBottomColor: "#e2e8f0",
    },
    colDesc: {
      width: "36%",
      textAlign: "right",
      fontSize: 6.5,
    },
    itemDiscountText: {
      fontSize: 5,
      color: "#dc2626",
    },
    colQty: {
      width: "12%",
      textAlign: "center",
      fontSize: 6.5,
    },
    colPrice: {
      width: "16%",
      textAlign: "center",
      fontSize: 6.5,
    },
    colVat: {
      width: "14%",
      textAlign: "center",
      fontSize: 6.5,
    },
    colTotal: {
      width: "22%",
      textAlign: "left",
      fontSize: 6.5,
    },
    textRight: {
      textAlign: "right",
    },
    boldText: {
      fontWeight: "bold",
    },
    totalsBox: {
      marginVertical: 2,
    },
    totalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 1,
    },
    totalRowGrand: {
      borderTopWidth: 0.5,
      borderTopColor: "#000000",
      borderBottomWidth: 0.5,
      borderBottomColor: "#000000",
      paddingVertical: 2,
      marginVertical: 1,
    },
    totalKey: {
      fontSize: 6.5,
      color: "#334155",
    },
    totalVal: {
      fontSize: 6.5,
      textAlign: "left",
    },
    tafqeetBox: {
      paddingVertical: 2,
      paddingHorizontal: 4,
      backgroundColor: "#f8fafc",
      marginVertical: 2,
    },
    tafqeetText: {
      fontSize: 6,
      textAlign: "center",
      fontWeight: "bold",
    },
    bottomSection: {
      alignItems: "center",
      marginTop: 3,
    },
    qrContainer: {
      width: 75,
      height: 75,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 3,
    },
    qrImage: {
      width: 75,
      height: 75,
    },
    termsText: {
      fontSize: 5.5,
      color: "#64748b",
      textAlign: "center",
      marginTop: 2,
    },
    footerText: {
      fontSize: 5.5,
      color: "#94a3b8",
      textAlign: "center",
      marginTop: 2,
    },
  });
}
