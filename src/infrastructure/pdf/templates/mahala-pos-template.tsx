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

export interface MahalaPosTemplateProps {
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

function formatDateTime(issuedAt?: string | null, issueDate?: string): string {
  if (issuedAt) {
    try {
      const d = new Date(issuedAt);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        const secs = String(d.getSeconds()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
      }
    } catch {
      // fallback
    }
  }
  if (issueDate) {
    const parts = issueDate.slice(0, 10).split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return issueDate;
  }
  return "";
}

export function MahalaPosTemplate({
  invoice,
  company,
  customer,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: MahalaPosTemplateProps) {
  const invoiceNum = invoice.invoiceNumber ?? "";
  const dateTimeStr = formatDateTime(invoice.issuedAt, invoice.issueDate);

  // Dynamic height calculation for 80mm roll paper (226pt width)
  const items = invoice.items || [];
  const pageHeight = Math.max(680, 520 + items.length * 38);

  const companyAddressLine1 = [
    company.addressCity,
    company.addressDistrict,
  ]
    .filter(Boolean)
    .join(" - ");

  const companyAddressLine2 = [
    company.addressStreet,
    company.addressBuildingNumber,
    company.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddressStreet = customer.addressStreet || "";
  const customerAddressCity = [
    customer.addressCity,
    "المملكة العربية السعودية",
    customer.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const companyName = company.nameAr || "";
  const customerName = customer.nameAr || "";
  // NOTE: company.clientEmployee ("تابع للعميل") is admin-only and must never
  // appear on invoice/receipt PDFs — seller/cashier lines removed.

  return (
    <Document
      title={`POS Invoice ${invoiceNum}`}
      author={companyName}
      subject="THERMAL POS INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (CENTERED) ─── */}
        <View style={styles.headerSection}>
          {logoDataUrl ? (
            <Image src={logoDataUrl} style={styles.logo} />
          ) : null}
          {invoiceNum ? (
            <Text style={styles.invoiceNumberHeader}>
              الفاتورة {invoiceNum}
            </Text>
          ) : null}
          {companyName ? (
            <Text style={styles.companyName}>
              {companyName}
            </Text>
          ) : null}

          {/* Company Details */}
          {companyAddressLine1 ? <Text style={styles.centerLine}>{companyAddressLine1}</Text> : null}
          {companyAddressLine2 ? <Text style={styles.centerLine}>{companyAddressLine2}</Text> : null}
          {company.crNumber ? (
            <Text style={styles.centerLine}>
              . {company.crNumber} رقم الموحد
            </Text>
          ) : null}
          {company.email ? <Text style={styles.centerLine}>{company.email}</Text> : null}
          {company.vatNumber ? (
            <Text style={styles.centerLine}>
              رقم التعريف الضريبي: {company.vatNumber}
            </Text>
          ) : null}

          {/* Date and Time */}
          {dateTimeStr ? (
            <>
              <Text style={[styles.centerLine, { marginTop: 4, fontWeight: "bold" }]}>
                :تاريخ الفاتورة
              </Text>
              <Text style={styles.centerLine}>{dateTimeStr}</Text>
            </>
          ) : null}

          {/* Customer Details */}
          {customerName || customerAddressStreet || customer.vatNumber || customer.phone ? (
            <>
              <Text style={styles.clientTitleUnderline}>حررت الفاتورة إلى:</Text>
              {customerName ? (
                <Text style={styles.clientName}>
                  {customerName}
                </Text>
              ) : null}
              {customerAddressStreet ? <Text style={styles.centerLine}>{customerAddressStreet}</Text> : null}
              {customerAddressCity ? <Text style={styles.centerLine}>{customerAddressCity}</Text> : null}
              {customer.phone ? (
                <Text style={styles.centerLine}>{customer.phone} :هاتف</Text>
              ) : null}
              {customer.vatNumber ? (
                <Text style={styles.centerLine}>
                  رقم التعريف الضريبي: {customer.vatNumber}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {/* ─── 2. ITEMS TABLE ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. السلع أو الخدمات (Right-most) */}
            <View style={[styles.thCell, { width: "34%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 2. الكمية */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 3. سعر الوحدة */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>سعر</Text>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* 4. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thText}>المبلغ</Text>
              <Text style={styles.thText}>الخاضع</Text>
              <Text style={styles.thText}>للضريبة</Text>
            </View>

            {/* 5. مبلغ ومعدل ضريبة القيمة المضافة */}
            <View style={[styles.thCell, { width: "16%" }]}>
              <Text style={styles.thText}>مبلغ</Text>
              <Text style={styles.thText}>ومعدل</Text>
              <Text style={styles.thText}>ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
              <Text style={styles.thText}>المضافة</Text>
            </View>

            {/* 6. الاجمالي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.thCell, { width: "16%", borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>الاجمالي</Text>
              <Text style={styles.thTextSmall}>(بما في ذلك ضريبة</Text>
              <Text style={styles.thTextSmall}>القيمة المضافة)</Text>
            </View>
          </View>

          {/* Body Rows */}
          {invoice.items.map((item, index) => {
            const vatPct = Math.round(Number(item.vatRate || 0.15) * 100);
            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === invoice.items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. السلع أو الخدمات */}
                <View style={[styles.tdCell, { width: "34%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. الكمية */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.quantity)}</Text>
                </View>

                {/* 3. سعر الوحدة */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 4. المبلغ الخاضع للضريبة */}
                <View style={[styles.tdCell, { width: "14%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineSubtotal)}</Text>
                </View>

                {/* 5. مبلغ ومعدل الضريبة */}
                <View style={[styles.tdCell, { width: "16%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineVat, 2)}</Text>
                  <Text style={styles.tdTextCenter}>({vatPct}%)</Text>
                </View>

                {/* 6. الاجمالي مع الضريبة */}
                <View style={[styles.tdCell, { width: "16%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineTotal, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 3. TOTALS SECTION ─── */}
        <View style={styles.totalsSection}>
          {/* Row 1: غير شاملة الضريبة */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatNumber(invoice.subtotal)} SAR</Text>
            <Text style={styles.totalLabel}>الاجمالي (غير شاملة ضريبة القيمة المضافة):</Text>
          </View>

          {/* Row 2: مجموع الضريبة */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatNumber(invoice.vatAmount)} SAR</Text>
            <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة:</Text>
          </View>

          {/* Row 3: الاجمالي بما في ذلك الضريبة */}
          <View style={[styles.totalRow, { borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 3 }]}>
            <Text style={styles.totalVal}>{formatNumber(invoice.total)} SAR</Text>
            <Text style={styles.totalLabel}>الاجمالي (بما في ذلك ضريبة القيمة المضافة):</Text>
          </View>

          {/* Paid and Balance */}
          <View style={styles.paymentBox}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentVal}>{formatNumber(invoice.total)} SAR</Text>
              <Text style={styles.paymentLabel}>المبلغ المدفوع</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentVal}>0 SAR</Text>
              <Text style={styles.paymentLabel}>الباقي</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ZATCA QR CODE ONLY (NO LINEAR BARCODE AS REQUESTED) ─── */}
        {qrDataUrl ? (
          <View style={styles.qrSection}>
            <Image src={qrDataUrl} style={styles.qrImage} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 14,
    paddingBottom: 20,
    paddingLeft: 8,
    paddingRight: 8,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "20%",
    width: "60%",
    opacity: 0.05,
  },
  logo: {
    maxWidth: 90,
    maxHeight: 50,
    objectFit: "contain",
    marginBottom: 6,
  },

  // ─── Header ───
  headerSection: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 8,
  },
  invoiceNumberHeader: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 12.5,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  centerLine: {
    fontSize: 7.5,
    textAlign: "center",
    marginBottom: 1,
  },
  clientTitleUnderline: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    textDecoration: "underline",
    marginTop: 4,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 1,
  },

  // ─── Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginTop: 6,
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFFFF",
    minHeight: 28,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextSmall: {
    fontSize: 5.5,
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 22,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdTextRight: {
    fontSize: 6.5,
    textAlign: "right",
  },
  tdTextCenter: {
    fontSize: 6.5,
    textAlign: "center",
  },

  // ─── Totals ───
  totalsSection: {
    width: "100%",
    flexDirection: "column",
    marginTop: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  totalLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "left",
  },

  paymentBox: {
    flexDirection: "column",
    paddingVertical: 3,
    alignItems: "center",
  },
  paymentRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 1,
  },
  paymentLabel: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
  },
  paymentVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "left",
  },
  cashierLine: {
    fontSize: 7,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },

  // ─── QR Section (Without linear barcode) ───
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  qrImage: {
    width: 105,
    height: 105,
  },
});
