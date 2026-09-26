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

export interface ContractingInvoiceTemplateProps {
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

function ContractingMetaRow({
  label,
  value,
  isClient = false,
}: {
  label: string;
  value: string | null | undefined;
  isClient?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={isClient ? styles.clientDetailRow : styles.companyDetailRow}>
      <Text style={isClient ? styles.clientDetailLabel : styles.companyDetailLabel}>{label}</Text>
      <Text style={isClient ? styles.clientDetailColon : styles.companyDetailColon}>:</Text>
      <Text style={isClient ? styles.clientDetailValue : styles.companyDetailValue}>{value}</Text>
    </View>
  );
}

export function ContractingInvoiceTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ContractingInvoiceTemplateProps) {
  const companyAddress = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
    "المملكة العربية السعودية",
  ].filter(Boolean).join(" - ");

  const customerAddress = [
    customer.addressAdditionalNumber ? `الرقم الإضافي ${customer.addressAdditionalNumber}` : null,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
    customer.addressCity,
  ].filter(Boolean).join(" - ");

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
  const pageHeight = Math.max(baseA4Height, baseA4Height + extraHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyName}
      subject="TAX INVOICE - ADVANCE"
      creator="Hulool Invoicing"
    >
      <Page size={[595.28, pageHeight]} style={styles.page}>
        {/* Background Watermark if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (LOGO CENTER, COMPANY RIGHT, ADVANCE LEFT) ─── */}
        <View style={styles.topSection}>
          {/* Left: TAX Invoice Title & Frameless QR Code */}
          <View style={styles.topLeft}>
            <Text style={styles.taxInvoiceTitleAr}>فاتورة ضريبية</Text>
            <Text style={styles.taxInvoiceTitleEn}>TAX Invoice</Text>
            {qrDataUrl ? (
              <View style={styles.qrContainer}>
                <Image src={qrDataUrl} style={styles.qrImage} />
              </View>
            ) : null}
          </View>

          {/* Center: Company Logo */}
          {logoDataUrl ? (
            <View style={styles.centerLogoWrap}>
              <Image src={logoDataUrl} style={styles.companyLogo} />
            </View>
          ) : null}

          {/* Right: Company Name & Tax Details */}
          <View style={styles.topRight}>
            {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            <ContractingMetaRow label="الرقم الضريبي" value={company.vatNumber} />
            <ContractingMetaRow label="السجل التجاري" value={company.crNumber} />
            <ContractingMetaRow label="العنوان" value={companyAddress} />
            <ContractingMetaRow label="الهاتف" value={company.phone} />
            <ContractingMetaRow label="البريد" value={company.email} />
            <ContractingMetaRow label="الموقع" value={company.website} />
          </View>
        </View>

        {/* ─── 2. SOLID DIVIDER LINE ─── */}
        <View style={styles.horizontalDivider} />

        {/* ─── 3. METADATA & CLIENT ROW ─── */}
        <View style={styles.metaAndClientSection}>
          {/* Left Block: Invoice Number & Date */}
          <View style={styles.metaBlock}>
            {/* Invoice No */}
            <View style={styles.metaRow}>
              <Text style={styles.metaVal}>{invoiceNum}</Text>
              <View style={styles.metaLabelCol}>
                <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
                <Text style={styles.metaLabelEn}>Invoice NO</Text>
              </View>
            </View>

            {/* Invoice Date */}
            <View style={styles.metaRow}>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
              <View style={styles.metaLabelCol}>
                <Text style={styles.metaLabelAr}>تاريخ الفاتورة</Text>
                <Text style={styles.metaLabelEn}>Invoice Date</Text>
              </View>
            </View>
          </View>

          {/* Right Block: Customer Info & Label */}
          <View style={styles.clientBlock}>
            <View style={styles.clientDetailsCol}>
              {customerName ? <Text style={styles.clientName}>{customerName}</Text> : null}
              <ContractingMetaRow label="الرقم الضريبي" value={customer.vatNumber} isClient />
              <ContractingMetaRow label="الرقم الموحد" value={customer.unifiedNumber} isClient />
              <ContractingMetaRow label="العنوان" value={customerAddress} isClient />
              <ContractingMetaRow label="الهاتف" value={customer.phone} isClient />
              <ContractingMetaRow label="البريد" value={customer.email} isClient />
            </View>
            <View style={styles.clientLabelCol}>
              <Text style={styles.clientLabelAr}>العميل</Text>
              <Text style={styles.clientLabelEn}>Client</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE ─── */}
        <View style={styles.table}>
          {/* Table Header (Right to Left) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. البند / Item (Right-most) */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "20%" : "26%" }]}>
              <Text style={styles.thAr}>البند / الوصف</Text>
              <Text style={styles.thEn}>Item / Description</Text>
            </View>

            {/* 2. الكمية / Qty */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>

            {/* 3. السعر / Price */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "10%" : "12%" }]}>
              <Text style={styles.thAr}>السعر</Text>
              <Text style={styles.thEn}>Price</Text>
            </View>

            {/* Optional: الخصم / Discount */}
            {hasAnyDiscount ? (
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thAr}>الخصم</Text>
                <Text style={styles.thEn}>Discount</Text>
              </View>
            ) : null}

            {/* 4. المجموع قبل الضريبة / Total Before Tax */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "14%" : "16%" }]}>
              <Text style={styles.thAr}>المجموع قبل</Text>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>Total Excl. VAT</Text>
            </View>

            {/* 5. نسبة الضريبة / VAT % */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>VAT %</Text>
            </View>

            {/* 6. قيمة الضريبة / VAT Amount */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "12%" : "13%" }]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>

            {/* 7. المجموع مع الضريبة / Total With VAT (Left-most) */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "16%" : "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المجموع شامل</Text>
              <Text style={styles.thEn}>Total Incl. VAT</Text>
            </View>
          </View>

          {/* Table Rows */}
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
                {/* 1. البند / Item */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "20%" : "26%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. الكمية / Qty */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdText}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 3. السعر / Price */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "10%" : "12%" }]}>
                  <Text style={styles.tdText}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* Optional: الخصم / Discount */}
                {hasAnyDiscount ? (
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    <Text style={styles.tdText}>
                      {hasItemDiscount ? formatExactAmount(item.discountAmount) : "0"}
                    </Text>
                  </View>
                ) : null}

                {/* 4. المجموع قبل الضريبة / Total Before Tax */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "14%" : "16%" }]}>
                  <Text style={styles.tdText}>{formatExactAmount(item.lineSubtotal)}</Text>
                </View>

                {/* 5. نسبة الضريبة / VAT % */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdText}>{lineVatPct}%</Text>
                </View>

                {/* 6. قيمة الضريبة / VAT Amount */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "12%" : "13%" }]}>
                  <Text style={styles.tdText}>{formatExactAmount(item.lineVat)}</Text>
                </View>

                {/* 7. المجموع مع الضريبة / Total With VAT */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "16%" : "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdText}>{formatExactAmount(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION (ALIGNED TO LEFT / UNDER AMOUNTS) ─── */}
        <View style={styles.totalsContainer}>
          {/* Row 1: Subtotal Before VAT */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ {formatExactAmount(invoice.subtotal)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelAr}>الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalLabelEn}>Total Before VAT</Text>
            </View>
          </View>

          {/* Row 2: VAT Amount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ {formatExactAmount(invoice.vatAmount)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelSingle}>ضريبة القيمة المضافة (VAT)</Text>
            </View>
          </View>

          {/* Row 3: Total After VAT (Highlighted Bar) */}
          <View style={[styles.totalRow, styles.totalRowHighlight]}>
            <Text style={styles.totalValBold}>﷼ {formatExactAmount(invoice.total)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>الإجمالي بعد الضريبة</Text>
              <Text style={styles.totalLabelEnBold}>Total After VAT</Text>
            </View>
          </View>

          {/* Row 4: Paid Amount (مدفوع) */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ -{formatExactAmount(invoice.total)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>الفاتورة مدفوعة</Text>
              <Text style={styles.totalLabelEnBold}>Paid</Text>
            </View>
          </View>

          {/* Row 5: Due Balance (الرصيد المستحق) */}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalVal}>﷼ 0</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>الرصيد المستحق</Text>
              <Text style={styles.totalLabelEnBold}>Due Amount</Text>
            </View>
          </View>
        </View>

        {/* ─── 6. NOTES & TERMS ─── */}
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

        {/* ─── 7. FOOTER TEXT ─── */}
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
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 38,
    paddingRight: 38,
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

  // ─── Header ───
  topSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topLeft: {
    width: 140,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  taxInvoiceTitleAr: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 2,
  },
  taxInvoiceTitleEn: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 4,
  },
  companyDetailLine: {
    fontSize: 9.5,
    textAlign: "right",
    marginBottom: 2,
  },
  companyDetailRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  companyDetailLabel: {
    fontSize: 9.5,
    fontFamily: "Amiri",
    textAlign: "right",
  },
  companyDetailColon: {
    fontSize: 9.5,
    fontFamily: "Amiri",
    textAlign: "center",
    marginHorizontal: 2,
  },
  companyDetailValue: {
    fontSize: 9.5,
    fontFamily: "Amiri",
    textAlign: "left",
  },

  // ─── Horizontal Divider Line ───
  horizontalDivider: {
    marginTop: 14,
    marginBottom: 14,
    borderBottomWidth: 2.2,
    borderBottomColor: "#000000",
  },

  // ─── Metadata & Client Row ───
  metaAndClientSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  metaBlock: {
    width: 180,
    flexDirection: "column",
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metaVal: {
    fontSize: 9.5,
    textAlign: "left",
    width: 85,
  },
  metaLabelCol: {
    alignItems: "flex-end",
    width: 85,
  },
  metaLabelAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  metaLabelEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },

  clientBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    gap: 12,
  },
  clientDetailsCol: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  clientName: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  clientDetailLine: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 2,
  },
  clientDetailRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  clientDetailLabel: {
    fontSize: 9,
    fontFamily: "Amiri",
    textAlign: "right",
  },
  clientDetailColon: {
    fontSize: 9,
    fontFamily: "Amiri",
    textAlign: "center",
    marginHorizontal: 2,
  },
  clientDetailValue: {
    fontSize: 9,
    fontFamily: "Amiri",
    textAlign: "left",
  },
  clientLabelCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    width: 42,
  },
  clientLabelAr: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
  },
  clientLabelEn: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },

  // ─── Table ───
  table: {
    width: "100%",
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#E5E7EB",
    minHeight: 32,
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEn: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 0.75,
    borderTopColor: "#000000",
    minHeight: 28,
  },
  tdCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#000000",
    paddingVertical: 5,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  tdText: {
    fontSize: 8.5,
    textAlign: "center",
  },

  // ─── Totals Section ───
  totalsContainer: {
    width: "48%",
    alignSelf: "flex-start",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.2,
    borderBottomColor: "#000000",
    paddingVertical: 3.5,
    paddingHorizontal: 3,
  },
  totalRowHighlight: {
    backgroundColor: "#D1D5DB",
  },
  totalRowFinal: {
    borderBottomWidth: 2.5,
    borderBottomColor: "#000000",
  },
  totalVal: {
    fontSize: 9.5,
    textAlign: "left",
  },
  totalValBold: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "left",
  },
  totalLabelWrap: {
    alignItems: "flex-end",
  },
  totalLabelAr: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelSingle: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelArBold: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelEnBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },

  companyNameEn: {
    fontSize: 9,
    color: "#374151",
    textAlign: "right",
    marginBottom: 2,
  },

  tdTextRight: {
    fontSize: 8.5,
    textAlign: "right",
    paddingHorizontal: 2,
  },

  // ─── Notes & Terms Section ───
  notesSection: {
    marginTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: "#D1D5DB",
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
