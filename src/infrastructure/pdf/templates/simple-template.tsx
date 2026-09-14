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
import { formatMoney, formatMoneyWithSettings } from "@/lib/format";

export interface SimpleTemplateProps {
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

export function SimpleTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: SimpleTemplateProps) {
  const styles = buildSimpleStyles(template.primaryColor, template.accentColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";

  const isSimplified = invoice.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const hasDiscounts = invoice.items.some(
    (item) => item.discountAmount && item.discountAmount !== "0.00"
  );

  const footerText =
    company.footerText?.trim() ||
    "شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا بموجب الشروط والأحكام";

  return (
    <Document
      title={`Invoice ${numberLabel}`}
      author={company.nameAr}
      subject={titleAr}
      creator="Hulool Invoicing"
    >
      <Page
        size={paperSize as any}
        orientation={paperOrientation as any}
        style={styles.page}
      >
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* 1. Header: Document Title & Meta Box (Left) + Company Info & Logo (Right) */}
        <View style={styles.headerBox}>
          {/* Left: Invoice Title & Meta Box */}
          <View style={styles.headerLeft}>
            <View style={styles.invoiceTitleWrap}>
              <Text style={styles.invoiceTitle}>{titleAr}</Text>
              <Text style={styles.invoiceNumber}>{numberLabel}</Text>
            </View>

            {/* Meta Table Box */}
            <View style={styles.metaTable}>
              <View style={styles.metaTableRow}>
                <Text style={styles.metaTableKey}>تاريخ الفاتورة</Text>
                <Text style={styles.metaTableVal}>{invoice.issueDate}</Text>
              </View>
              {invoice.dueDate ? (
                <View style={styles.metaTableRow}>
                  <Text style={styles.metaTableKey}>تاريخ الاستحقاق</Text>
                  <Text style={styles.metaTableVal}>{invoice.dueDate}</Text>
                </View>
              ) : null}
              <View style={[styles.metaTableRow, styles.metaTableRowLast]}>
                <Text style={styles.metaTableKey}>المبلغ المستحق</Text>
                <Text style={[styles.metaTableVal, styles.boldText]}>
                  {formatMoneyWithSettings("0.00", settings)}
                </Text>
              </View>
            </View>
          </View>

          {/* Right: Company Logo & Info */}
          <View style={styles.headerRight}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : null}
            <Text style={styles.companyName}>{company.nameAr}</Text>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}

            {company.vatNumber ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.vatNumber}</Text>
              </View>
            ) : null}

            {company.crNumber ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>السجل التجاري</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.crNumber}</Text>
              </View>
            ) : null}

            {formatAddress(company) ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>العنوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{formatAddress(company)}</Text>
              </View>
            ) : null}

            {company.phone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>هاتف</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.phone}</Text>
              </View>
            ) : null}

            {company.email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>البريد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.infoVal}>{company.email}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 2. Customer Section */}
        <View style={styles.customerSection}>
          <Text style={styles.customerSectionTitle}>حررت الفاتورة إلى</Text>
          <Text style={styles.customerName}>{customer.nameAr}</Text>
          {customer.nameEn ? (
            <Text style={styles.customerNameEn}>{customer.nameEn}</Text>
          ) : null}

          {customer.vatNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>الرقم الضريبي</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.vatNumber}</Text>
            </View>
          ) : null}

          {customer.unifiedNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>الرقم الموحد</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.unifiedNumber}</Text>
            </View>
          ) : null}

          {customer.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>هاتف/جوال</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.phone}</Text>
            </View>
          ) : null}

          {customer.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>البريد</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>{customer.email}</Text>
            </View>
          ) : null}

          {customer.addressCity || customer.addressStreet || customer.addressPostalCode ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>العنوان</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoVal}>
                {[customer.addressStreet, customer.addressCity, customer.addressPostalCode]
                  .filter(Boolean)
                  .join("، ")}
              </Text>
            </View>
          ) : null}
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

          {invoice.items.map((item, idx) => (
            <View
              key={item.position ?? idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : undefined]}
              wrap={false}
            >
              <Text style={[styles.td, styles.colPos]}>{item.position}</Text>
              <Text
                style={[
                  styles.td,
                  hasDiscounts ? styles.colDescNarrow : styles.colDesc,
                  styles.textRight,
                ]}
              >
                {item.description}
              </Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>
                {formatMoney(item.unitPrice)}
              </Text>
              {hasDiscounts ? (
                <Text style={[styles.td, styles.colDisc]}>
                  {parseFloat(item.discountAmount) > 0
                    ? formatMoney(item.discountAmount)
                    : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.colVatRate]}>
                {(item.vatRate * 100).toFixed(0)}%
              </Text>
              <Text style={[styles.td, styles.colVatAmount]}>
                {formatMoney(item.lineVat)}
              </Text>
              <Text style={[styles.td, styles.colTotal, styles.boldText]}>
                {formatMoney(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* 4. Bottom Section: QR & Notes (Left) + Financial Summary (Right) */}
        <View style={styles.bottomSection} wrap={false}>
          {/* Left Side: QR Code + Terms/Notes + Signature */}
          <View style={styles.bottomLeft}>
            <View style={styles.qrAndNotesRow}>
              {qrDataUrl ? (
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                  <Text style={styles.qrCaption}>فاتورة ضريبية إلكترونية</Text>
                </View>
              ) : (
                <View style={styles.qrBox}>
                  <Text style={styles.draftText}>مسودة غير معتمدة</Text>
                </View>
              )}

              <View style={styles.notesBox}>
                {invoice.notes ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteTitle}>ملاحظات:</Text>
                    <Text style={styles.noteContent}>{invoice.notes}</Text>
                  </View>
                ) : null}
                {invoice.terms ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteTitle}>الشروط والأحكام:</Text>
                    <Text style={styles.noteContent}>{invoice.terms}</Text>
                  </View>
                ) : null}
              </View>

              {signatureDataUrl ? (
                <View style={styles.signatureBox}>
                  <Image src={signatureDataUrl} style={styles.signatureImage} />
                  <Text style={styles.signatureCaption}>التوقيع المعتمد</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Right Side: Totals Summary */}
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المجموع الفرعي (غير شامل الضريبة)</Text>
              <Text style={styles.totalsVal}>{formatMoney(invoice.subtotal)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>مجموع ضريبة القيمة المضافة (15%)</Text>
              <Text style={styles.totalsVal}>{formatMoney(invoice.vatAmount)} SAR</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsKey, styles.grandTotalKey]}>
                إجمالي المبلغ
              </Text>
              <Text style={[styles.totalsVal, styles.grandTotalVal]}>
                {formatMoneyWithSettings(invoice.total, settings)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Footer Text */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
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

function buildSimpleStyles(primary: string, accent: string) {
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
      top: "22%",
      left: "15%",
      width: "70%",
      height: "55%",
      opacity: 0.05,
      objectFit: "contain",
    },
    topBar: {
      height: 3,
      backgroundColor: primary,
      marginBottom: 10,
    },
    headerBox: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
      marginBottom: 8,
    },
    headerRight: {
      width: "55%",
      alignItems: "flex-end",
    },
    logoImage: {
      width: 46,
      height: 46,
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
      marginBottom: 1,
    },
    infoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    infoKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    infoVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    headerLeft: {
      width: "42%",
      alignItems: "flex-start",
    },
    invoiceTitleWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginBottom: 5,
    },
    invoiceTitle: {
      fontSize: 13,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    invoiceNumber: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#334155",
      textAlign: "left",
    },
    metaTable: {
      width: "100%",
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#f8fafc",
    },
    metaTableRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    metaTableRowLast: {
      borderBottomWidth: 0,
      backgroundColor: "#f1f5f9",
    },
    metaTableKey: {
      fontSize: 7,
      color: "#475569",
      textAlign: "right",
    },
    metaTableVal: {
      fontSize: 7.5,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    customerSection: {
      alignItems: "flex-end",
      marginBottom: 10,
    },
    customerSectionTitle: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#475569",
      textAlign: "right",
      marginBottom: 1,
    },
    customerName: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    customerNameEn: {
      fontSize: 7.5,
      color: "#64748b",
      textAlign: "right",
    },
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 8,
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
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
      alignItems: "center",
      minHeight: 17,
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
      borderLeftWidth: 1,
      borderLeftColor: "rgba(255, 255, 255, 0.25)",
    },
    td: {
      fontSize: 7.5,
      paddingVertical: 2.5,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 1,
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
    colPrice: { width: "12%", textAlign: "center" },
    colDisc: { width: "8%", textAlign: "center" },
    colVatRate: { width: "11%", textAlign: "center" },
    colVatAmount: { width: "11%", textAlign: "center" },
    colTotal: { width: "12%", textAlign: "center", borderLeftWidth: 0 },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
    },
    bottomLeft: {
      flex: 1,
    },
    qrAndNotesRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 8,
    },
    qrBox: {
      width: 76,
      alignItems: "center",
      justifyContent: "center",
      shrink: 0,
    },
    qrImage: {
      width: 76,
      height: 76,
    },
    qrCaption: {
      fontSize: 5.5,
      color: "#64748b",
      textAlign: "center",
      marginTop: 2,
    },
    draftText: {
      fontSize: 8,
      color: "#94a3b8",
      textAlign: "center",
    },
    notesBox: {
      flex: 1,
      gap: 4,
    },
    noteBlock: {
      padding: 4,
      backgroundColor: "#f8fafc",
      borderRightWidth: 2,
      borderRightColor: primary,
    },
    noteTitle: {
      fontSize: 6.5,
      fontWeight: "bold",
      color: "#475569",
      textAlign: "right",
    },
    noteContent: {
      fontSize: 6.5,
      color: "#1e293b",
      textAlign: "right",
      marginTop: 1,
    },
    signatureBox: {
      alignItems: "center",
      justifyContent: "center",
      width: 65,
      height: 50,
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderStyle: "dashed",
      padding: 2,
    },
    signatureImage: {
      width: 55,
      height: 35,
      objectFit: "contain",
    },
    signatureCaption: {
      fontSize: 5.5,
      color: "#64748b",
      marginTop: 1,
    },
    totalsTable: {
      width: 210,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
    },
    totalsRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2.5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalsRowGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
    },
    totalsKey: {
      fontSize: 7,
      color: "#475569",
      textAlign: "right",
    },
    totalsVal: {
      fontSize: 7.5,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    grandTotalKey: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8,
      textAlign: "right",
    },
    grandTotalVal: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 9,
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
