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

export interface SahmInvoiceTemplateProps {
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

function SahmDetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailColon}>:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function SahmInvoiceTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: SahmInvoiceTemplateProps) {
  const companyAddress = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
    "المملكة العربية السعودية",
  ].filter(Boolean).join(" - ");

  const customerAddressParts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي ${customer.addressAdditionalNumber}` : null,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
    customer.addressCity,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.length > 0
    ? [...customerAddressParts, "المملكة العربية السعودية"].join(" - ")
    : "";

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);

  const companyName = company.nameAr || "";
  const customerName = customer.nameAr || "";
  const items = invoice.items || [];
  const hasAnyDiscount = items.some((it) => Number(it.discountAmount || 0) > 0);

  // Dynamic single-page height calculation so the invoice NEVER spills onto a 2nd page
  const baseA4Height = 842;
  let extraHeight = Math.max(0, items.length - 4) * 38;
  if (invoice.notes) extraHeight += 40 + invoice.notes.split("\n").length * 14;
  if (invoice.terms) extraHeight += 40 + invoice.terms.split("\n").length * 14;
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

        {/* ─── 1. TOP HEADER SECTION (TITLE + QR LEFT, LOGO CENTER, COMPANY RIGHT) ─── */}
        <View style={styles.topSection}>
          {/* Top Left: Title + ZATCA QR Code */}
          <View style={styles.topLeft}>
            <Text style={styles.invoiceTitle}>فاتورة ضريبية</Text>
            {invoiceNum ? (
              <Text style={styles.invoiceNumberSub}>رقم الفاتورة: {invoiceNum}</Text>
            ) : null}
            {qrDataUrl ? (
              <View style={styles.qrContainer}>
                <Image src={qrDataUrl} style={styles.qrImage} />
              </View>
            ) : null}
          </View>

          {/* Top Center: Logo */}
          {logoDataUrl ? (
            <View style={styles.centerLogoWrap}>
              <Image src={logoDataUrl} style={styles.companyLogo} />
            </View>
          ) : null}

          {/* Top Right: Company Details */}
          <View style={styles.topRight}>
            {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            {companyAddress ? <Text style={styles.companyDetailLine}>{companyAddress}</Text> : null}
            <SahmDetailRow label="الرقم الضريبي" value={company.vatNumber} />
            <SahmDetailRow label="السجل التجاري" value={company.crNumber} />
            <SahmDetailRow label="الهاتف" value={company.phone} />
            <SahmDetailRow label="البريد" value={company.email} />
            <SahmDetailRow label="الموقع" value={company.website} />
          </View>
        </View>

        {/* ─── 2. MIDDLE CLIENT & METADATA CARD (BORDERED BOX) ─── */}
        <View style={styles.infoBox}>
          {/* Left Block: Coral Red Box for Issue Date */}
          <View style={styles.coralDateBox}>
            <View style={styles.coralRow}>
              <Text style={styles.coralVal}>{issueDateStr}</Text>
              <Text style={styles.coralLabel}>تاريخ الفاتورة</Text>
            </View>
          </View>

          {/* Right Column: Customer Info */}
          <View style={styles.clientBox}>
            <Text style={styles.clientHeader}>حررت الفاتورة إلى</Text>
            {customerName ? <Text style={styles.clientName}>{customerName}</Text> : null}
            {customerAddress ? <Text style={styles.clientDetailLine}>{customerAddress}</Text> : null}
            <SahmDetailRow label="الرقم الضريبي" value={customer.vatNumber} />
            <SahmDetailRow label="الرقم الموحد" value={customer.unifiedNumber} />
            <SahmDetailRow label="الهاتف" value={customer.phone} />
            <SahmDetailRow label="البريد" value={customer.email} />
          </View>
        </View>

        {/* ─── 3. LINE ITEMS TABLE (CORAL HEADER) ─── */}
        <View style={styles.table}>
          {/* Table Header (Right to Left) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. السلع أو الخدمات (Right-most) */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "22%" : "27%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 2. الكمية */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 3. سعر الوحدة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "11%" : "13%" }]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>

            {/* Optional: الخصم */}
            {hasAnyDiscount ? (
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thText}>الخصم</Text>
              </View>
            ) : null}

            {/* 4. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "13%" : "14%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع</Text>
              <Text style={styles.thText}>للضريبة</Text>
            </View>

            {/* 5. معدل ضريبة القيمة */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>معدل</Text>
              <Text style={styles.thText}>الضريبة</Text>
            </View>

            {/* 6. مبلغ ضريبة القيمة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "12%" : "13%" }]}>
              <Text style={styles.thText}>مبلغ ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 7. المجموع الجزئي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextBold}>المجموع الجزئي</Text>
              <Text style={styles.thTextSmall}>(شامل الضريبة)</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {invoice.items.map((item, index) => {
            const lineVatPct = Number(item.vatRate || 0.15) * 100;
            const hasItemDiscount = Number(item.discountAmount || 0) > 0;
            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === invoice.items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. السلع أو الخدمات */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "22%" : "27%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. الكمية */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 3. سعر الوحدة */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "11%" : "13%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* Optional: الخصم */}
                {hasAnyDiscount ? (
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    <Text style={styles.tdTextCenter}>
                      {hasItemDiscount ? formatExactAmount(item.discountAmount) : "0"}
                    </Text>
                  </View>
                ) : null}

                {/* 4. المبلغ الخاضع للضريبة */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "13%" : "14%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineSubtotal)}</Text>
                </View>

                {/* 5. معدل ضريبة القيمة */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdTextCenter}>{lineVatPct}%</Text>
                </View>

                {/* 6. مبلغ ضريبة القيمة */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "12%" : "13%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineVat)}</Text>
                </View>

                {/* 7. المجموع الجزئي */}
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 4. BOTTOM SECTION (TOTALS) ─── */}
        <View style={styles.bottomSection}>
          {/* Left Side: جدول الإجماليات */}
          <View style={styles.totalsCol}>
            {/* 1. الاجمالي (غير شاملة ضريبة القيمة المضافة) */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(invoice.subtotal)} SAR</Text>
              <Text style={styles.totalLabel}>الاجمالي (غير شاملة ضريبة القيمة المضافة)</Text>
            </View>

            {/* 2. مجموع ضريبة القيمة المضافة */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(invoice.vatAmount)} SAR</Text>
              <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة</Text>
            </View>

            {/* 3. الاجمالي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.totalRow, styles.totalRowBorderTop]}>
              <Text style={styles.totalValBold}>{formatExactAmount(invoice.total)} SAR</Text>
              <Text style={styles.totalLabelBold}>الاجمالي (شامل ضريبة القيمة المضافة)</Text>
            </View>

            {/* 4. الفاتورة مدفوعة */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(invoice.total)} SAR</Text>
              <Text style={styles.totalLabel}>الفاتورة مدفوعة</Text>
            </View>

            {/* 5. إجمالي المبلغ المستحق */}
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalValBold}>0 SAR</Text>
              <Text style={styles.totalLabelFinal}>إجمالي المبلغ المستحق</Text>
            </View>
          </View>
        </View>

        {/* ─── 5. NOTES & TERMS ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesSection}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>ملاحظات</Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 6. FOOTER TEXT ─── */}
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
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 34,
    paddingRight: 34,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 9,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── 1. Header ───
  topSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topLeft: {
    width: 150,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 2,
    color: "#E05A47",
  },
  invoiceNumberSub: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 6,
    color: "#1F2937",
  },
  qrContainer: {
    width: 131,
    height: 131,
  },
  qrImage: {
    width: 131,
    height: 131,
  },
  centerLogoWrap: {
    maxWidth: 120,
    maxHeight: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  companyLogo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: "contain",
  },
  topRight: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-end",
    paddingTop: 2,
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  companyCity: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 1.5,
  },
  companyDetailLine: {
    fontSize: 8.5,
    textAlign: "right",
    marginBottom: 1.5,
  },
  detailRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    color: "#374151",
  },
  detailColon: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
    color: "#374151",
    marginHorizontal: 2,
  },
  detailValue: {
    fontSize: 8.5,
    textAlign: "left",
    color: "#111827",
  },

  // ─── 2. Middle Client & Metadata Card ───
  infoBox: {
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "row",
    marginTop: 18,
    marginBottom: 16,
    minHeight: 60,
  },
  coralDateBox: {
    width: "26%",
    backgroundColor: "#E26D5C",
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "column",
    justifyContent: "center",
  },
  coralRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coralLabel: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  coralVal: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "left",
  },
  agentBox: {
    width: "14%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  agentLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  agentLine: {
    fontSize: 8,
    textAlign: "right",
    color: "#333333",
  },
  clientBox: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  clientHeader: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    textDecoration: "underline",
  },
  clientName: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "right",
    marginTop: 1.5,
    marginBottom: 1.5,
  },
  clientDetailLine: {
    fontSize: 8,
    textAlign: "right",
    marginBottom: 1,
  },

  // ─── 3. Line Items Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#E26D5C",
    minHeight: 36,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextBold: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextSmall: {
    color: "#FFFFFF",
    fontSize: 6.5,
    textAlign: "center",
    marginTop: 1,
  },

  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 25,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdTextRight: {
    fontSize: 8,
    textAlign: "right",
  },
  tdTextCenter: {
    fontSize: 8,
    textAlign: "center",
  },

  // ─── 4. Bottom Area ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  paymentMethodCol: {
    alignItems: "flex-end",
    paddingTop: 12,
  },
  paymentMethodTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 3,
  },
  paymentMethodValue: {
    fontSize: 9.5,
    textAlign: "right",
  },
  totalsCol: {
    width: "44%",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  totalRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingVertical: 3,
  },
  totalRowFinal: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingVertical: 3.5,
  },
  totalLabel: {
    fontSize: 8,
    textAlign: "right",
  },
  totalLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelFinal: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8.5,
    textAlign: "left",
  },
  totalValBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "left",
  },

  companyNameEn: {
    fontSize: 9,
    color: "#4B5563",
    textAlign: "right",
    marginBottom: 2,
  },

  // ─── Notes & Terms Section ───
  notesSection: {
    marginTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: "#E05A47",
    paddingTop: 8,
    flexDirection: "column",
    gap: 6,
  },
  noteBlock: {
    flexDirection: "column",
    marginBottom: 4,
  },
  noteTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    color: "#E05A47",
    marginBottom: 2,
  },
  noteBody: {
    fontSize: 8,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.3,
  },

  // ─── Footer Section ───
  footerSection: {
    marginTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
});
