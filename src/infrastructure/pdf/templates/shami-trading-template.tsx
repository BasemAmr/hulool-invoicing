import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface ShamiTradingTemplateProps {
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

/**
 * Format date string to DD/MM/YYYY only (no hours or time components).
 */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * Format monetary amount with full decimal precision — NEVER floor, ceiling, or round.
 * Preserves the exact decimal tail (e.g. 23.4646916641601264) and formats the integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
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

/**
 * Strict React-PDF BiDi detail row:
 * Container: row-reverse
 * 1. Arabic label on RIGHT (no trailing colon)
 * 2. Independent middle colon ':' with horizontal margin
 * 3. Value on LEFT
 */
function ShamiDetailRow({
  label,
  value,
  style,
}: {
  label: string;
  value: string | null | undefined;
  style?: any;
}) {
  if (!value) return null;
  return (
    <View style={[styles.shamiDetailRow, style]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailColon}>:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ShamiTradingTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ShamiTradingTemplateProps) {
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);

  const companyName = company.nameAr || "";
  const companyAddress = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressStreet,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
    "المملكة العربية السعودية",
  ]
    .filter(Boolean)
    .join(" - ");

  const customerName = customer.nameAr || "";
  const customerAddress = [
    customer.addressStreet,
    customer.addressCity,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    "المملكة العربية السعودية",
  ]
    .filter(Boolean)
    .join(" - ");

  const items = invoice.items || [];
  const hasAnyDiscount = items.some((it) => Number(it.discountAmount || 0) > 0);
  const totalDiscount = items.reduce(
    (acc, it) => acc + Number(it.discountAmount || 0),
    0
  );

  // Single-page guarantee: dynamically calculate page height so content fits in ONE continuous page
  const baseA4Height = 842;
  let extraHeight = Math.max(0, items.length - 4) * 36;
  if (invoice.notes) extraHeight += 35 + invoice.notes.split("\n").length * 13;
  if (invoice.terms) extraHeight += 35 + invoice.terms.split("\n").length * 13;
  if (company.footerText) extraHeight += 30;
  const dynamicPageHeight = Math.max(baseA4Height, baseA4Height + extraHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyName}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={[595.28, dynamicPageHeight]} orientation="portrait" style={styles.page}>
        {/* Optional Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO (LEFT) & COMPANY DETAILS (RIGHT) ─── */}
        <View style={styles.topHeaderContainer}>
          <View style={styles.companyLogoWrap}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.companyLogo} />
            ) : null}
          </View>
          <View style={styles.companyHeaderWrap}>
            {companyName ? <Text style={styles.companyNameText}>{companyName}</Text> : null}
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            {companyAddress ? <Text style={styles.companySubText}>{companyAddress}</Text> : null}
            <ShamiDetailRow label="الرقم الموحد للسجل" value={company.crNumber} />
            <ShamiDetailRow label="رقم تعريف ضريبة القيمة المضافة" value={company.vatNumber} />
            <ShamiDetailRow label="الهاتف" value={company.phone} />
            <ShamiDetailRow label="البريد الإلكتروني" value={company.email} />
            <ShamiDetailRow label="الموقع الإلكتروني" value={company.website} />
          </View>
        </View>

        {/* ─── 2. CENTER: TITLE AND CENTERED ZATCA QR CODE ─── */}
        <View style={styles.centerTitleAndQrSection}>
          <View style={styles.centeredInvoiceTitleWrap}>
            <Text style={styles.centeredInvoiceTitle}>فاتورة ضريبية</Text>
            {invoiceNum ? (
              <Text style={styles.centeredInvoiceTitleSub}>رقم {invoiceNum}</Text>
            ) : null}
          </View>
          {qrDataUrl ? (
            <View style={styles.qrContainer}>
              <Image src={qrDataUrl} style={styles.qrImage} />
            </View>
          ) : null}
        </View>

        {/* ─── 3. MIDDLE SECTION: LEFT DATES BOX & RIGHT CLIENT DETAILS ─── */}
        <View style={styles.middleSectionRow}>
          {/* Left: 2-Row Bordered Box for Date & Amount Due */}
          <View style={styles.datesBox}>
            <View style={styles.datesBoxRow}>
              <Text style={styles.datesBoxVal}>{issueDateStr}</Text>
              <Text style={styles.datesBoxKey}>تاريخ الفاتورة</Text>
            </View>
            <View style={[styles.datesBoxRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.datesBoxVal, styles.bold]}>0 SAR</Text>
              <Text style={[styles.datesBoxKey, styles.bold]}>المبلغ المستحق</Text>
            </View>
          </View>

          {/* Right: Client Information */}
          <View style={styles.clientSection}>
            <Text style={styles.clientTitleUnderline}>حررت الفاتورة إلى</Text>
            {customerName ? <Text style={styles.clientNameText}>{customerName}</Text> : null}
            {customer.nameEn ? <Text style={styles.clientSubText}>{customer.nameEn}</Text> : null}
            {customerAddress ? <Text style={styles.clientDetailText}>{customerAddress}</Text> : null}
            <ShamiDetailRow label="رقم التعريف الضريبي" value={customer.vatNumber} />
            <ShamiDetailRow label="الرقم الموحد" value={customer.unifiedNumber} />
            <ShamiDetailRow label="الهاتف" value={customer.phone} />
            <ShamiDetailRow label="البريد الإلكتروني" value={customer.email} />
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (WHITE BACKGROUND, CLEAN CRISP GRID) ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Sequence Number */}
            <View style={[styles.thCell, { width: "4%" }]}>
              <Text style={styles.thText}>م</Text>
            </View>

            {/* 2. السلع أو الخدمات */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "32%" : "36%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 3. الكمية */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 4. سعر الوحدة */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>سعر</Text>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* Optional: الخصم */}
            {hasAnyDiscount ? (
              <View style={[styles.thCell, { width: "8%" }]}>
                <Text style={styles.thText}>الخصم</Text>
              </View>
            ) : null}

            {/* 5. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "11%" : "13%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع</Text>
              <Text style={styles.thText}>للضريبة</Text>
            </View>

            {/* 6. معدل ضريبة القيمة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "8%" : "9%" }]}>
              <Text style={styles.thText}>معدل</Text>
              <Text style={styles.thText}>الضريبة</Text>
            </View>

            {/* 7. مبلغ ضريبة القيمة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "9%" : "10%" }]}>
              <Text style={styles.thText}>مبلغ</Text>
              <Text style={styles.thText}>الضريبة</Text>
            </View>

            {/* 8. المجموع شامل ضريبة القيمة المضافة */}
            <View style={[styles.thCell, { width: "10%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextBold}>المجموع</Text>
              <Text style={styles.thTextBold}>شامل الضريبة</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item, index) => {
            const vatPct = Math.round(Number(item.vatRate || 0.15) * 100);
            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. Sequence Number */}
                <View style={[styles.tdCell, { width: "4%" }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>

                {/* 2. Goods / Description */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "32%" : "36%" }]}>
                  <Text style={styles.tdRight}>{item.description}</Text>
                </View>

                {/* 3. Quantity */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 4. Unit Price */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* Optional: Discount */}
                {hasAnyDiscount ? (
                  <View style={[styles.tdCell, { width: "8%" }]}>
                    <Text style={styles.tdCenter}>
                      {Number(item.discountAmount || 0) > 0
                        ? formatExactAmount(item.discountAmount)
                        : "0"}
                    </Text>
                  </View>
                ) : null}

                {/* 5. Taxable Amount */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "11%" : "13%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.lineSubtotal)}</Text>
                </View>

                {/* 6. VAT Rate */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "8%" : "9%" }]}>
                  <Text style={styles.tdCenter}>{vatPct}%</Text>
                </View>

                {/* 7. VAT Amount */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "9%" : "10%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.lineVat)}</Text>
                </View>

                {/* 8. Line Subtotal */}
                <View style={[styles.tdCell, { width: "10%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. BOTTOM SECTION: PAYMENT/NOTES (RIGHT) & TOTALS (LEFT) ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Totals Breakdown */}
          <View style={styles.totalsContainer}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(invoice.subtotal)} SAR</Text>
              <Text style={styles.totalLabel}>الاجمالي (غير شاملة ضريبة القيمة المضافة)</Text>
            </View>

            {/* Row 2: Discount if applicable */}
            {hasAnyDiscount || totalDiscount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>-{formatExactAmount(totalDiscount)} SAR</Text>
                <Text style={styles.totalLabel}>إجمالي الخصم</Text>
              </View>
            ) : null}

            {/* Row 3: VAT Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(invoice.vatAmount)} SAR</Text>
              <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة</Text>
            </View>

            {/* Row 4: Total With VAT */}
            <View style={[styles.totalRow, styles.totalRowBordered]}>
              <Text style={styles.totalValBold}>{formatExactAmount(invoice.total)} SAR</Text>
              <Text style={styles.totalLabelBold}>الاجمالي (بما في ذلك ضريبة القيمة المضافة)</Text>
            </View>

            {/* Row 5: Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalValBold}>{formatExactAmount(invoice.total)} SAR</Text>
              <Text style={styles.totalLabel}>الفاتورة مدفوعة</Text>
            </View>

            {/* Row 6: Balance Due */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>0 SAR</Text>
              <Text style={styles.totalLabel}>الرصيد المستحق</Text>
            </View>
          </View>

          {/* Right: Notes, Terms */}
          <View style={styles.bottomRightContainer}>

            {/* Optional Notes */}
            {invoice.notes ? (
              <View style={styles.notesSection}>
                <Text style={styles.notesTitle}>ملاحظات</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Optional Terms */}
            {invoice.terms ? (
              <View style={styles.termsSection}>
                <Text style={styles.notesTitle}>الشروط والأحكام</Text>
                <Text style={styles.notesText}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Optional Custom Footer Text */}
        {company.footerText ? (
          <View style={styles.footerSection}>
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
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 30,
    paddingRight: 30,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Company Header (Top) ───
  topHeaderContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  companyLogoWrap: {
    maxWidth: 120,
    maxHeight: 65,
  },
  companyLogo: {
    maxWidth: 120,
    maxHeight: 65,
    objectFit: "contain",
  },
  companyHeaderWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  companyNameText: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEn: {
    fontSize: 9,
    textAlign: "right",
    color: "#4B5563",
    marginBottom: 2,
  },
  companySubText: {
    fontSize: 8.5,
    textAlign: "right",
    marginBottom: 2,
    color: "#1F2937",
  },

  // ─── Detail Row (BiDi Pattern) ───
  shamiDetailRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 8.5,
    textAlign: "right",
    color: "#000000",
  },
  detailColon: {
    fontSize: 8.5,
    marginHorizontal: 2,
    textAlign: "center",
    color: "#000000",
  },
  detailValue: {
    fontSize: 8.5,
    textAlign: "left",
    color: "#000000",
  },

  // ─── Center Title and QR Code ───
  centerTitleAndQrSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  centeredInvoiceTitleWrap: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  centeredInvoiceTitle: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  centeredInvoiceTitleSub: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    color: "#374151",
  },
  qrContainer: {
    width: 84,
    height: 84,
  },
  qrImage: {
    width: 84,
    height: 84,
  },

  // ─── Middle Section ───
  middleSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  datesBox: {
    width: "36%",
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "column",
  },
  datesBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  datesBoxKey: {
    fontSize: 8.5,
    textAlign: "right",
  },
  datesBoxVal: {
    fontSize: 8.5,
    textAlign: "left",
  },
  bold: {
    fontWeight: "bold",
  },

  clientSection: {
    width: "58%",
    alignItems: "flex-end",
  },
  clientTitleUnderline: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
    textDecoration: "underline",
    marginBottom: 3,
  },
  clientNameText: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 1.5,
  },
  clientSubText: {
    fontSize: 8.5,
    textAlign: "right",
    color: "#4B5563",
    marginBottom: 1.5,
  },
  clientDetailText: {
    fontSize: 8.5,
    textAlign: "right",
    marginBottom: 1.5,
    color: "#1F2937",
  },

  // ─── Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFFFF",
    minHeight: 32,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 24,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 8,
    textAlign: "center",
  },
  tdRight: {
    fontSize: 8,
    textAlign: "right",
  },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bottomRightContainer: {
    width: "48%",
    alignItems: "flex-end",
  },


  notesSection: {
    width: "100%",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#D1D5DB",
    alignItems: "flex-end",
  },
  termsSection: {
    width: "100%",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#D1D5DB",
    alignItems: "flex-end",
  },
  notesTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    textAlign: "right",
    color: "#374151",
  },

  totalsContainer: {
    width: "46%",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalRowBordered: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 3,
    marginVertical: 1,
  },
  totalLabel: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8,
    textAlign: "left",
  },
  totalValBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "left",
  },

  footerSection: {
    width: "100%",
    marginTop: 12,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
});
