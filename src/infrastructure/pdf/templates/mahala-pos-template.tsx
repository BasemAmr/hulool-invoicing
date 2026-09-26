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

function formatDateOnly(issueDate?: string): string {
  if (issueDate) {
    const parts = issueDate.slice(0, 10).split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return issueDate;
  }
  return "";
}

function PosMetaLine({
  label,
  value,
  bold = false,
  marginTop = 0,
}: {
  label: string;
  value: string | null | undefined;
  bold?: boolean;
  marginTop?: number;
}) {
  if (!value) return null;
  return (
    <View style={[styles.centerRow, marginTop ? { marginTop } : {}]}>
      <Text style={bold ? styles.centerLabelBold : styles.centerLabel}>{label}</Text>
      <Text style={bold ? styles.centerColonBold : styles.centerColon}>:</Text>
      <Text style={bold ? styles.centerValBold : styles.centerVal}>{value}</Text>
    </View>
  );
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
  const dateStr = formatDateOnly(invoice.issueDate);
  const items = invoice.items || [];
  const hasAnyDiscount = items.some((it) => Number(it.discountAmount || 0) > 0);

  const companyAddress = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
  ].filter(Boolean).join(" - ");

  const customerAddress = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ].filter(Boolean).join(" - ");

  const companyName = company.nameAr || "";
  const customerName = customer.nameAr || "";

  // Dynamic height calculation for 80mm roll paper (226pt width) to guarantee single continuous page
  let contentHeight = 320; // Top padding, title, company name, address, basic contacts
  if (logoDataUrl) contentHeight += 55;
  if (company.nameEn) contentHeight += 14;
  if (customerName || customer.vatNumber || customer.phone || customer.unifiedNumber) {
    contentHeight += 110;
  }
  contentHeight += Math.max(1, items.length) * 38; // Table rows
  contentHeight += 120; // Totals block + Paid / Balance
  if (invoice.notes) {
    contentHeight += 35 + invoice.notes.split("\n").length * 14;
  }
  if (invoice.terms) {
    contentHeight += 35 + invoice.terms.split("\n").length * 14;
  }
  if (qrDataUrl) {
    contentHeight += 140; // 105pt QR + margins
  }
  if (company.footerText) {
    contentHeight += 35;
  }
  contentHeight += 60; // Bottom padding and breathing room

  const pageHeight = Math.max(900, contentHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyName}
      subject="THERMAL POS INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. STORE & RECEIPT HEADER (NATIVE CENTERED POS) ─── */}
        <View style={styles.headerSection}>
          {logoDataUrl ? (
            <Image src={logoDataUrl} style={styles.logo} />
          ) : null}
          <Text style={styles.posTitleHeader}>فاتورة ضريبية</Text>
          <PosMetaLine label="رقم الفاتورة" value={invoiceNum} bold />
          {companyName ? (
            <Text style={styles.companyName}>
              {companyName}
            </Text>
          ) : null}
          {company.nameEn ? (
            <Text style={styles.centerLineEn}>
              {company.nameEn}
            </Text>
          ) : null}
          {companyAddress ? <Text style={styles.centerLine}>{companyAddress}</Text> : null}
          <PosMetaLine label="السجل التجاري / الرقم الموحد" value={company.crNumber} />
          <PosMetaLine label="الرقم الضريبي" value={company.vatNumber} />
          <PosMetaLine label="الهاتف" value={company.phone} />
          <PosMetaLine label="البريد" value={company.email} />
          <PosMetaLine label="الموقع" value={company.website} />
          <PosMetaLine label="تاريخ الفاتورة" value={dateStr} bold marginTop={2} />

          {/* Customer Details */}
          {customerName || customerAddress || customer.vatNumber || customer.unifiedNumber || customer.phone || customer.email ? (
            <View style={{ width: "100%", alignItems: "center", marginTop: 4 }}>
              <Text style={styles.clientTitleUnderline}>حررت الفاتورة إلى</Text>
              {customerName ? (
                <Text style={styles.clientName}>{customerName}</Text>
              ) : null}
              {customerAddress ? <Text style={styles.centerLine}>{customerAddress}</Text> : null}
              <PosMetaLine label="الرقم الضريبي" value={customer.vatNumber} />
              <PosMetaLine label="الرقم الموحد" value={customer.unifiedNumber} />
              <PosMetaLine label="الهاتف" value={customer.phone} />
              <PosMetaLine label="البريد" value={customer.email} />
            </View>
          ) : null}
        </View>

        {/* ─── 2. ITEMS TABLE ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. السلع أو الخدمات (Right-most) */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "26%" : "32%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 2. الكمية */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 3. سعر الوحدة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "10%" : "12%" }]}>
              <Text style={styles.thText}>سعر</Text>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* Optional: الخصم */}
            {hasAnyDiscount ? (
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thText}>الخصم</Text>
              </View>
            ) : null}

            {/* 4. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "13%" : "14%" }]}>
              <Text style={styles.thText}>المبلغ</Text>
              <Text style={styles.thText}>الخاضع</Text>
            </View>

            {/* 5. ضريبة القيمة المضافة */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "15%" : "16%" }]}>
              <Text style={styles.thText}>ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 6. الاجمالي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.thCell, { width: "16%", borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>الاجمالي</Text>
              <Text style={styles.thTextSmall}>(شامل الضريبة)</Text>
            </View>
          </View>

          {/* Body Rows */}
          {invoice.items.map((item, index) => {
            const vatPct = Number(item.vatRate || 0.15) * 100;
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
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "26%" : "32%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. الكمية */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 3. سعر الوحدة */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "10%" : "12%" }]}>
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

                {/* 5. مبلغ ومعدل الضريبة */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "15%" : "16%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineVat)}</Text>
                  <Text style={styles.tdTextCenter}>({vatPct}%)</Text>
                </View>

                {/* 6. الاجمالي مع الضريبة */}
                <View style={[styles.tdCell, { width: "16%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 3. TOTALS SECTION ─── */}
        <View style={styles.totalsSection}>
          {/* Row 1: غير شاملة الضريبة */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatExactAmount(invoice.subtotal)} SAR</Text>
            <Text style={styles.totalLabel}>الاجمالي (غير شاملة الضريبة):</Text>
          </View>

          {/* Row 2: مجموع الضريبة */}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatExactAmount(invoice.vatAmount)} SAR</Text>
            <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة:</Text>
          </View>

          {/* Row 3: الاجمالي بما في ذلك الضريبة */}
          <View style={[styles.totalRow, { borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 3 }]}>
            <Text style={styles.totalVal}>{formatExactAmount(invoice.total)} SAR</Text>
            <Text style={styles.totalLabel}>الاجمالي (شامل الضريبة):</Text>
          </View>

          {/* Paid and Balance */}
          <View style={styles.paymentBox}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>الفاتورة مدفوعة</Text>
              <Text style={styles.centerColonBold}>:</Text>
              <Text style={styles.paymentVal}>{formatExactAmount(invoice.total)} SAR</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>الرصيد المستحق</Text>
              <Text style={styles.centerColonBold}>:</Text>
              <Text style={styles.paymentVal}>0 SAR</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. NOTES & TERMS ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesSection}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>ملاحظات:</Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>الشروط والأحكام:</Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 5. ZATCA QR CODE ONLY ─── */}
        {qrDataUrl ? (
          <View style={styles.qrSection}>
            <Image src={qrDataUrl} style={styles.qrImage} />
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
  posTitleHeader: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  invoiceNumberHeader: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  centerLineEn: {
    fontSize: 7.5,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 1,
  },
  centerLine: {
    fontSize: 7.5,
    textAlign: "center",
    marginBottom: 1,
  },
  centerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 1.5,
  },
  centerLabel: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#000000",
    textAlign: "right",
  },
  centerColon: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#000000",
    textAlign: "center",
    marginLeft: 2,
    marginRight: 2,
  },
  centerVal: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#000000",
    textAlign: "left",
  },
  centerLabelBold: {
    fontSize: 8.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  centerColonBold: {
    fontSize: 8.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginLeft: 2,
    marginRight: 2,
  },
  centerValBold: {
    fontSize: 8.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
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
    marginBottom: 2,
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
    width: 160,
    height: 160,
  },

  // ─── Notes & Terms Section ───
  notesSection: {
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    paddingTop: 4,
    flexDirection: "column",
    gap: 4,
  },
  noteBlock: {
    flexDirection: "column",
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 1,
  },
  noteBody: {
    fontSize: 6.5,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.2,
  },

  // ─── Footer Section ───
  footerSection: {
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#9CA3AF",
    paddingTop: 4,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#6B7280",
    textAlign: "center",
  },
});
