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

export interface BilingualZatcaTemplateProps {
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

export function BilingualZatcaTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: BilingualZatcaTemplateProps) {
  const styles = buildZatcaStyles(template.primaryColor, template.accentColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";
  const titleAr = "فاتورة ضريبية";
  const titleEn = "TAX INVOICE";

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
    "فاتورة ضريبية إلكترونية معتمدة — صادرة وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك بالمملكة العربية السعودية";

  const issueDateStr = formatDateFormatted(invoice.issueDate);

  return (
    <Document
      title={`Tax Invoice ${numberLabel}`}
      author={company.nameAr}
      subject="ZATCA TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* 1. Dual Header: Left (Document Identification & Logo) + Right (Invoice Meta) */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.titleAr}>{titleAr}</Text>
              <Text style={styles.titleEn}>{titleEn}</Text>
            </View>
          </View>

          <View style={styles.headerLeft}>
            <View style={styles.metaTable}>
              <View style={styles.metaRow}>
                <View style={styles.metaKeyWrap}>
                  <Text style={styles.metaKeyAr}>رقم الفاتورة</Text>
                  <Text style={styles.metaKeyEn}>/ Invoice No</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{numberLabel}</Text>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaKeyWrap}>
                  <Text style={styles.metaKeyAr}>تاريخ الإصدار</Text>
                  <Text style={styles.metaKeyEn}>/ Issue Date</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{issueDateStr}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Parties Box: Seller (Right) & Buyer (Left) */}
        <View style={styles.partiesGrid}>
          {/* Seller (Supplier) */}
          <View style={styles.partyBox}>
            <View style={styles.partyBoxHeader}>
              <Text style={styles.partyBoxTitle}>المورّد / Seller (Supplier)</Text>
            </View>
            <View style={styles.partyBoxContent}>
              <Text style={styles.partyName}>{company.nameAr}</Text>
              {company.nameEn ? (
                <Text style={styles.partyNameEn}>{company.nameEn}</Text>
              ) : null}

              {company.vatNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الضريبي</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tax ID</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.vatNumber}</Text>
                </View>
              ) : null}

              {company.crNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>السجل التجاري</Text>
                    <Text style={styles.partyLineKeyEn}>/ CR No</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.crNumber}</Text>
                </View>
              ) : null}

              {formatAddress(company) ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>العنوان</Text>
                    <Text style={styles.partyLineKeyEn}>/ Address</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{formatAddress(company)}</Text>
                </View>
              ) : null}

              {company.phone ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الهاتف</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tel</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.phone}</Text>
                </View>
              ) : null}

              {company.email ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>البريد</Text>
                    <Text style={styles.partyLineKeyEn}>/ Email</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.email}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Customer (Buyer) */}
          <View style={styles.partyBox}>
            <View style={styles.partyBoxHeader}>
              <Text style={styles.partyBoxTitle}>العميل / Buyer (Bill To)</Text>
            </View>
            <View style={styles.partyBoxContent}>
              <Text style={styles.partyName}>{customer.nameAr}</Text>
              {customer.nameEn ? (
                <Text style={styles.partyNameEn}>{customer.nameEn}</Text>
              ) : null}

              {customer.vatNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الضريبي</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tax ID</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.vatNumber}</Text>
                </View>
              ) : null}

              {customer.unifiedNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الموحد / السجل</Text>
                    <Text style={styles.partyLineKeyEn}>/ Unified / CR</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.unifiedNumber}</Text>
                </View>
              ) : null}

              {customer.phone ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الهاتف</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tel</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.phone}</Text>
                </View>
              ) : null}

              {customer.email ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>البريد</Text>
                    <Text style={styles.partyLineKeyEn}>/ Email</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.email}</Text>
                </View>
              ) : null}

              {customer.addressCity || customer.addressStreet || customer.addressPostalCode ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>العنوان</Text>
                    <Text style={styles.partyLineKeyEn}>/ Address</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>
                    {[customer.addressStreet, customer.addressCity, customer.addressPostalCode]
                      .filter(Boolean)
                      .join("، ")}
                  </Text>
                </View>
              ) : null}
            </View>
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
              الوصف / Description
            </Text>
            <Text style={[styles.th, styles.colQty]}>الكمية / Qty</Text>
            <Text style={[styles.th, styles.colMoney]}>السعر / Price</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.colDiscount]}>الخصم / Disc.</Text>
            ) : null}
            <Text style={[styles.th, styles.colMoney]}>الضريبة / VAT</Text>
            <Text style={[styles.th, styles.colMoneyTotal]}>الإجمالي / Total</Text>
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
              <Text style={[styles.td, styles.colMoney]}>
                {formatExactAmount(item.unitPrice)}
              </Text>
              {hasDiscounts ? (
                <Text style={[styles.td, styles.colDiscount]}>
                  {item.lineDiscount > 0
                    ? formatExactAmount(item.lineDiscount)
                    : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.colMoney]}>
                {formatExactAmount(item.lineVat)}
              </Text>
              <Text style={[styles.td, styles.colMoneyTotal, styles.boldText]}>
                {formatExactAmount(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* 4. Tafqeet Banner Strip */}
        <View style={styles.tafqeetBanner} wrap={false}>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة / Amount in Words</Text>
          <Text style={styles.tafqeetColon}>:</Text>
          <Text style={styles.tafqeetVal}>{tafqeetText}</Text>
        </View>

        {/* 5. Bottom Section */}
        <View style={styles.bottomSection} wrap={false}>
          <View style={styles.bottomLeft}>
            <View style={styles.qrAndAuthRow}>
              <View style={styles.qrBox}>
                {qrDataUrl ? (
                  <Image src={qrDataUrl} style={styles.qrImage} />
                ) : (
                  <Text style={styles.draftWatermark}>مسودة DRAFT</Text>
                )}
              </View>

              <View style={styles.notesContainer}>
                {invoice.notes ? (
                  <View style={styles.noteItem}>
                    <Text style={styles.noteTitle}>ملاحظات / Notes:</Text>
                    <Text style={styles.noteText}>{invoice.notes}</Text>
                  </View>
                ) : null}
                {invoice.terms ? (
                  <View style={styles.noteItem}>
                    <Text style={styles.noteTitle}>الشروط / Terms:</Text>
                    <Text style={styles.noteText}>{invoice.terms}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Right: 7-Tier Totals Card */}
          <View style={styles.totalsCard}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>الإجمالي قبل الضريبة / Gross</Text>
              <Text style={styles.totalsVal}>{formatExactAmount(computedGross)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>مجموع الخصومات / Total Discounts</Text>
              <Text style={styles.totalsVal}>{formatExactAmount(computedDiscount)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المجموع الخاضع للضريبة / Taxable Amt</Text>
              <Text style={styles.totalsVal}>{formatExactAmount(taxableAmount)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>ضريبة القيمة المضافة (15%) / VAT</Text>
              <Text style={styles.totalsVal}>{formatExactAmount(totalVat)} SAR</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsKey, styles.grandTotalKey]}>
                إجمالي المبلغ المستحق / Total Due
              </Text>
              <Text style={[styles.totalsVal, styles.grandTotalVal]}>
                {formatExactAmount(grandTotal)} SAR
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المبلغ المدفوع / Paid Amount</Text>
              <Text style={styles.totalsVal}>{formatExactAmount(grandTotal)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المبلغ المتبقي / Balance Due</Text>
              <Text style={[styles.totalsVal, styles.boldText]}>0.00 SAR</Text>
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

function buildZatcaStyles(primary: string, accent: string) {
  return StyleSheet.create({
    page: {
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: 25,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 7.5,
      color: "#0f172a",
    },
    backgroundImage: {
      position: "absolute",
      top: "28%",
      left: "25%",
      width: "50%",
      opacity: 0.04,
      objectFit: "contain",
    },
    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1.5,
      borderBottomColor: primary,
      paddingBottom: 6,
      marginBottom: 6,
    },
    headerRight: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
    },
    logo: {
      width: 48,
      height: 48,
      objectFit: "contain",
    },
    titleAr: {
      fontSize: 13.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    titleEn: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
      marginTop: 1,
    },
    headerLeft: {
      width: "48%",
    },
    metaTable: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#f8fafc",
    },
    metaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 1.5,
      paddingHorizontal: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    metaKeyWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    metaKeyAr: {
      fontSize: 6.8,
      color: "#475569",
    },
    metaKeyEn: {
      fontSize: 5.5,
      color: "#94a3b8",
    },
    colon: {
      fontSize: 6.8,
      color: "#475569",
    },
    metaVal: {
      fontSize: 7.2,
      fontWeight: "bold",
      color: "#0f172a",
    },
    partiesGrid: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      marginBottom: 6,
      gap: 8,
    },
    partyBox: {
      width: "49%",
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
    },
    partyBoxHeader: {
      backgroundColor: "#f1f5f9",
      borderBottomWidth: 1,
      borderBottomColor: "#cbd5e1",
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    partyBoxTitle: {
      fontSize: 7,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    partyBoxContent: {
      padding: 5,
      alignItems: "flex-end",
    },
    partyName: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    partyNameEn: {
      fontSize: 6.8,
      color: "#64748b",
      textAlign: "right",
      marginBottom: 2,
    },
    partyLineRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
      marginTop: 1,
    },
    partyLineKeyWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 1,
    },
    partyLineKeyAr: {
      fontSize: 6.5,
      color: "#64748b",
    },
    partyLineKeyEn: {
      fontSize: 5.5,
      color: "#94a3b8",
    },
    partyLineVal: {
      fontSize: 6.8,
      color: "#0f172a",
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
      fontSize: 6.8,
      fontWeight: "bold",
      paddingVertical: 2,
      paddingHorizontal: 2,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "rgba(255, 255, 255, 0.3)",
    },
    td: {
      fontSize: 6.8,
      paddingVertical: 2,
      paddingHorizontal: 2,
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
    colPos: { width: "4%", textAlign: "center" },
    colDesc: { width: "42%", textAlign: "right" },
    colDescNarrow: { width: "34%", textAlign: "right" },
    colQty: { width: "8%", textAlign: "center" },
    colMoney: { width: "13%", textAlign: "center" },
    colDiscount: { width: "8%", textAlign: "center" },
    colMoneyTotal: { width: "14%", textAlign: "center" },
    discountBadge: {
      marginTop: 1,
      paddingHorizontal: 3,
      paddingVertical: 1,
      backgroundColor: "#fef2f2",
      borderRadius: 2,
      alignSelf: "flex-end",
    },
    discountBadgeText: {
      fontSize: 5,
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
      fontSize: 6.8,
      fontWeight: "bold",
      color: "#475569",
    },
    tafqeetColon: {
      fontSize: 6.8,
      color: "#475569",
    },
    tafqeetVal: {
      fontSize: 7.2,
      fontWeight: "bold",
      color: primary,
    },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 4,
    },
    bottomLeft: {
      flex: 1,
    },
    qrAndAuthRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 6,
    },
    qrBox: {
      width: 70,
      height: 70,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      padding: 2,
    },
    qrImage: {
      width: 66,
      height: 66,
    },
    draftWatermark: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "center",
    },
    notesContainer: {
      flex: 1,
      gap: 3,
    },
    noteItem: {
      padding: 3,
      backgroundColor: "#f8fafc",
      borderRightWidth: 2,
      borderRightColor: primary,
    },
    noteTitle: {
      fontSize: 6,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    noteText: {
      fontSize: 6,
      color: "#334155",
      textAlign: "right",
      marginTop: 1,
    },
    totalsCard: {
      width: 220,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
    },
    totalsRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 1.5,
      paddingHorizontal: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalsRowGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
    },
    totalsKey: {
      fontSize: 6.5,
      color: "#475569",
      textAlign: "right",
    },
    totalsVal: {
      fontSize: 7,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    grandTotalKey: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 7.2,
      textAlign: "right",
    },
    grandTotalVal: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8,
      textAlign: "left",
    },
    footer: {
      position: "absolute",
      bottom: 10,
      left: 20,
      right: 20,
      paddingTop: 3,
      borderTopWidth: 0.5,
      borderTopColor: "#e2e8f0",
      textAlign: "center",
    },
    footerText: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "center",
    },
  });
}
