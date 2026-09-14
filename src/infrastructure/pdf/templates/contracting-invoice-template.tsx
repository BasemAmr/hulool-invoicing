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

function formatNumber(val: string | number, decimals?: number): string {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  if (decimals !== undefined) {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return num % 1 === 0
    ? num.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // Address formatting
  const companyAddress = [
    company.addressCity,
    company.addressDistrict,
    company.addressStreet,
    company.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddress = [
    customer.addressCity,
    customer.addressStreet,
    customer.addressPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);

  const companyName = company.nameAr || "";
  const customerName = customer.nameAr || "";
  const items = invoice.items || [];

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyName}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {/* Optional Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION ─── */}
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

          {/* Center Logo if present */}
          {logoDataUrl ? (
            <View style={styles.centerLogoWrap}>
              <Image src={logoDataUrl} style={styles.companyLogo} />
            </View>
          ) : null}

          {/* Right: Company Name & Tax Details */}
          <View style={styles.topRight}>
            {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
            {company.vatNumber ? (
              <Text style={styles.companyDetailLine}>
                الرقم الضريبي : {company.vatNumber}
              </Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.companyDetailLine}>
                رقم سجل الموحد {company.crNumber}
              </Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.companyDetailLine}>
                العنوان {companyAddress}
              </Text>
            ) : null}
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
              {customer.vatNumber ? (
                <Text style={styles.clientDetailLine}>
                  الرقم الضريبي: {customer.vatNumber}
                </Text>
              ) : null}
              {customerAddress ? (
                <Text style={styles.clientDetailLine}>
                  {customerAddress}
                </Text>
              ) : null}
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
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>البند</Text>
              <Text style={styles.thEn}>Item</Text>
            </View>

            {/* 2. الوصف / Description */}
            <View style={[styles.thCell, { width: "16%" }]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>

            {/* 3. السعر / Price */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>السعر</Text>
              <Text style={styles.thEn}>Price</Text>
            </View>

            {/* 4. الكمية / Qty */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>

            {/* 5. المجموع قبل الضريبة / Total Before Tax */}
            <View style={[styles.thCell, { width: "17%" }]}>
              <Text style={styles.thAr}>المجموع قبل</Text>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>Total Before Tax</Text>
            </View>

            {/* 6. نسبة الضريبة / VAT 15% */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>VAT 15%</Text>
            </View>

            {/* 7. قيمة الضريبة / VAT Amount */}
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>

            {/* 8. المجموع مع الضريبة / Total With VAT (Left-most) */}
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المجموع مع الضريبة</Text>
              <Text style={styles.thEn}>Total With VAT</Text>
            </View>
          </View>

          {/* Table Rows */}
          {invoice.items.map((item, index) => {
            const lineVatPct = Math.round(Number(item.vatRate || 0.15) * 100);
            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === invoice.items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. البند / Item */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdText}>{item.description}</Text>
                </View>

                {/* 2. الوصف / Description */}
                <View style={[styles.tdCell, { width: "16%" }]}>
                  <Text style={styles.tdText}> </Text>
                </View>

                {/* 3. السعر / Price */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdText}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 4. الكمية / Qty */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdText}>{formatNumber(item.quantity)}</Text>
                </View>

                {/* 5. المجموع قبل الضريبة / Total Before Tax */}
                <View style={[styles.tdCell, { width: "17%" }]}>
                  <Text style={styles.tdText}>{formatNumber(item.lineSubtotal, 2)}</Text>
                </View>

                {/* 6. نسبة الضريبة / VAT 15% */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdText}>{lineVatPct}%</Text>
                </View>

                {/* 7. قيمة الضريبة / VAT Amount */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdText}>{formatNumber(item.lineVat)}</Text>
                </View>

                {/* 8. المجموع مع الضريبة / Total With VAT */}
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdText}>{formatNumber(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION (ALIGNED TO LEFT / UNDER AMOUNTS) ─── */}
        <View style={styles.totalsContainer}>
          {/* Row 1: Subtotal Before VAT */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ {formatNumber(invoice.subtotal)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelAr}>الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalLabelEn}>Total Before VAT</Text>
            </View>
          </View>

          {/* Row 2: VAT Amount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ {formatNumber(invoice.vatAmount)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelSingle}>(VAT (15%</Text>
            </View>
          </View>

          {/* Row 3: Total After VAT (Highlighted Bar) */}
          <View style={[styles.totalRow, styles.totalRowHighlight]}>
            <Text style={styles.totalValBold}>﷼ {formatNumber(invoice.total)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>الإجمالي بعد الضريبة</Text>
              <Text style={styles.totalLabelEnBold}>Total After VAT</Text>
            </View>
          </View>

          {/* Row 4: Paid Amount (مدفوع) */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>﷼ -{formatNumber(invoice.total)}</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>مدفوع</Text>
              <Text style={styles.totalLabelEnBold}>Paid</Text>
            </View>
          </View>

          {/* Row 5: Due Balance (الرصيد المستحق) */}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalVal}>﷼ 0.00</Text>
            <View style={styles.totalLabelWrap}>
              <Text style={styles.totalLabelArBold}>الرصيد المستحق</Text>
              <Text style={styles.totalLabelEnBold}>Due Amount</Text>
            </View>
          </View>
        </View>
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
    width: 82,
    height: 82,
  },
  qrImage: {
    width: 82,
    height: 82,
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
});
