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

export function SahmInvoiceTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: SahmInvoiceTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const companyAddress = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddressStreet = customer.addressStreet || "";
  const customerCityLine = [
    customer.addressCity,
    "المملكة العربية السعودية",
    customer.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);
  const dueDateStr = formatDate(invoice.dueDate || invoice.issueDate);

  const companyName = company.nameAr || "";
  const companyCity = company.addressCity || "";
  const customerName = customer.nameAr || "";
  const sellerEmployee = company.clientEmployee || "";
  const items = invoice.items || [];

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyName}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION ─── */}
        <View style={styles.topSection}>
          {/* Top Left: Invoice Number with Title & Frameless QR */}
          <View style={styles.topLeft}>
            <Text style={styles.invoiceTitleNumber}>
              {invoiceNum ? `${invoiceNum} ` : ""}فاتورة ضريبية
            </Text>
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

          {/* Top Right: Company Details */}
          <View style={styles.topRight}>
            {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
            {companyCity ? <Text style={styles.companyCity}>{companyCity}</Text> : null}
            {companyAddress ? <Text style={styles.companyDetailLine}>{companyAddress}</Text> : null}
            {company.crNumber ? (
              <Text style={styles.companyDetailLine}>
                سجل التجاري رقم . {company.crNumber} .
              </Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.companyDetailLine}>
                هاتف: {company.phone}
              </Text>
            ) : null}
            {company.email ? (
              <Text style={styles.companyDetailLine}>
                الإيميل: {company.email}
              </Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.companyDetailLine}>
                رقم تعريف ضريبة القيمة المضافة: {company.vatNumber}
              </Text>
            ) : null}
            {sellerEmployee ? (
              <Text style={styles.companyDetailLine}>
                معرف آخر للبائع: {sellerEmployee}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. MIDDLE CLIENT & METADATA CARD (BORDERED BOX) ─── */}
        <View style={styles.infoBox}>
          {/* Left Block: Coral Red Box for Dates and Due */}
          <View style={styles.coralDateBox}>
            <View style={styles.coralRow}>
              <Text style={styles.coralVal}>{issueDateStr}</Text>
              <Text style={styles.coralLabel}>تاريخ الفاتورة</Text>
            </View>
            <View style={styles.coralRow}>
              <Text style={styles.coralVal}>{dueDateStr}</Text>
              <Text style={styles.coralLabel}>تاريخ الاستحقاق</Text>
            </View>
            <View style={styles.coralRow}>
              <Text style={styles.coralVal}>0 SAR</Text>
              <Text style={styles.coralLabel}>المبلغ المستحق</Text>
            </View>
          </View>

          {/* Middle Column: Agent / Responsible */}
          <View style={styles.agentBox}>
            <Text style={styles.agentLabel}>المسؤول</Text>
            <Text style={styles.agentLine}>{sellerEmployee}</Text>
          </View>

          {/* Right Column: Customer Info */}
          <View style={styles.clientBox}>
            <Text style={styles.clientHeader}>حررت الفاتورة إلى:</Text>
            {customerName ? <Text style={styles.clientName}>{customerName}</Text> : null}
            {customerAddressStreet ? <Text style={styles.clientDetailLine}>{customerAddressStreet}</Text> : null}
            {customerCityLine ? <Text style={styles.clientDetailLine}>{customerCityLine}</Text> : null}
            {customer.phone ? (
              <Text style={styles.clientDetailLine}>{customer.phone} :هاتف</Text>
            ) : null}
            {customer.vatNumber ? (
              <Text style={styles.clientDetailLine}>
                رقم التعريف الضريبي: {customer.vatNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── 3. LINE ITEMS TABLE (CORAL HEADER) ─── */}
        <View style={styles.table}>
          {/* Table Header (Right to Left) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. السلع أو الخدمات (Right-most) */}
            <View style={[styles.thCell, { width: "27%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 2. الكمية */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 3. سعر الوحدة */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>

            {/* 4. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع</Text>
              <Text style={styles.thText}>للضريبة</Text>
            </View>

            {/* 5. معدل ضريبة القيمة */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>معدل</Text>
              <Text style={styles.thText}>ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 6. مبلغ ضريبة القيمة */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thText}>مبلغ ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 7. المجموع الجزئي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextBold}>المجموع الجزئي</Text>
              <Text style={styles.thTextSmall}>(بما في ذلك ضريبة القيمة المضافة)</Text>
            </View>
          </View>

          {/* Table Body Rows */}
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
                {/* 1. السلع أو الخدمات */}
                <View style={[styles.tdCell, { width: "27%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. الكمية */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.quantity)}</Text>
                </View>

                {/* 3. سعر الوحدة */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 4. المبلغ الخاضع للضريبة */}
                <View style={[styles.tdCell, { width: "14%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineSubtotal)}</Text>
                </View>

                {/* 5. معدل ضريبة القيمة */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{lineVatPct}%</Text>
                </View>

                {/* 6. مبلغ ضريبة القيمة */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineVat, 2)}</Text>
                </View>

                {/* 7. المجموع الجزئي */}
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineTotal, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 4. BOTTOM SECTION (PAYMENT METHOD & TOTALS) ─── */}
        <View style={styles.bottomSection}>
          {/* Right Side: طريقة الدفع */}
          <View style={styles.paymentMethodCol}>
            <Text style={styles.paymentMethodTitle}>طريقة الدفع</Text>
            <Text style={styles.paymentMethodValue}>
              {(invoice as any).paymentMethod === "card"
                ? "بطاقة مدى / ائتمان"
                : (invoice as any).paymentMethod === "transfer"
                ? "تحويل بنكي"
                : "نقدي"}
            </Text>
          </View>

          {/* Left Side: جدول الإجماليات */}
          <View style={styles.totalsCol}>
            {/* 1. الاجمالي (غير شاملة ضريبة القيمة المضافة) */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(invoice.subtotal)} SAR</Text>
              <Text style={styles.totalLabel}>الاجمالي (غير شاملة ضريبة القيمة المضافة):</Text>
            </View>

            {/* 2. مجموع ضريبة القيمة المضافة */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(invoice.vatAmount)} SAR</Text>
              <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة:</Text>
            </View>

            {/* 3. الاجمالي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.totalRow, styles.totalRowBorderTop]}>
              <Text style={styles.totalValBold}>{formatNumber(invoice.total)} SAR</Text>
              <Text style={styles.totalLabelBold}>الاجمالي (بما في ذلك ضريبة القيمة المضافة):</Text>
            </View>

            {/* 4. الفاتورة مدفوعة */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(invoice.total)} SAR</Text>
              <Text style={styles.totalLabel}>الفاتورة مدفوعة:</Text>
            </View>

            {/* 5. إجمالي المبلغ المستحق */}
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalValBold}>0 SAR</Text>
              <Text style={styles.totalLabelFinal}>إجمالي المبلغ المستحق:</Text>
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
  invoiceTitleNumber: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 6,
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

  // ─── 2. Middle Client & Metadata Card ───
  infoBox: {
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "row",
    marginTop: 18,
    marginBottom: 16,
    minHeight: 76,
  },
  coralDateBox: {
    width: "26%",
    backgroundColor: "#E26D5C",
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "column",
    justifyContent: "space-between",
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
    justifyContent: "space-between",
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
});
