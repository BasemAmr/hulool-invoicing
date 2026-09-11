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

export interface ClassicTemplateProps {
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

export function ClassicTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: ClassicTemplateProps) {
  const styles = buildClassicStyles(template.primaryColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";

  const isSimplified = invoice.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const footerText =
    company.footerText?.trim() ||
    "فاتورة تجارية معتمدة — نشكركم لتعاملكم معنا";

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

        {/* Outer Frame */}
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            {/* 1. Header: Document Title & Meta Box (Left) + Company Info (Right) */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.docTitle}>{titleAr}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>الرقم</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaVal}>{numberLabel}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>التاريخ</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.metaVal}>{invoice.issueDate}</Text>
                </View>
                {invoice.dueDate ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>الاستحقاق</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.metaVal}>{invoice.dueDate}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.headerRight}>
                {logoDataUrl ? (
                  <Image src={logoDataUrl} style={styles.logo} />
                ) : null}
                <Text style={styles.companyName}>{company.nameAr}</Text>
                {company.vatNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>الرقم الضريبي</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.detailVal}>{company.vatNumber}</Text>
                  </View>
                ) : null}
                {formatAddress(company) ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>العنوان</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.detailVal}>{formatAddress(company)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. Customer Section */}
            <View style={styles.customerBox}>
              <Text style={styles.customerHeader}>بيانات العميل (المشتري)</Text>
              <Text style={styles.customerName}>{customer.nameAr}</Text>
              {customer.vatNumber ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>الرقم الضريبي</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.vatNumber}</Text>
                </View>
              ) : null}
              {customer.phone ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>الهاتف</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.phone}</Text>
                </View>
              ) : null}
              {customer.email ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>البريد</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.detailVal}>{customer.email}</Text>
                </View>
              ) : null}
            </View>

            {/* 3. Items Table (RTL) */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.colPos]}>#</Text>
                <Text style={[styles.th, styles.colDesc]}>البيان / الصنف</Text>
                <Text style={[styles.th, styles.colQty]}>الكمية</Text>
                <Text style={[styles.th, styles.colPrice]}>السعر</Text>
                <Text style={[styles.th, styles.colVat]}>الضريبة</Text>
                <Text style={[styles.th, styles.colTotal]}>المجموع</Text>
              </View>

              {invoice.items.map((item, idx) => (
                <View
                  key={item.position ?? idx}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : undefined]}
                  wrap={false}
                >
                  <Text style={[styles.td, styles.colPos]}>{item.position}</Text>
                  <Text style={[styles.td, styles.colDesc, styles.textRight]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                  <Text style={[styles.td, styles.colPrice]}>
                    {formatMoney(item.unitPrice)}
                  </Text>
                  <Text style={[styles.td, styles.colVat]}>
                    {formatMoney(item.lineVat)}
                  </Text>
                  <Text style={[styles.td, styles.colTotal, styles.boldText]}>
                    {formatMoney(item.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>

            {/* 4. Bottom Section: QR, Notes & Totals */}
            <View style={styles.bottomSection} wrap={false}>
              <View style={styles.bottomLeft}>
                {qrDataUrl ? (
                  <View style={styles.qrBox}>
                    <Image src={qrDataUrl} style={styles.qrImage} />
                  </View>
                ) : null}

                {signatureDataUrl ? (
                  <View style={styles.signatureBox}>
                    <Image src={signatureDataUrl} style={styles.signatureImage} />
                    <Text style={styles.signatureCaption}>الختم والتوقيع</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>المجموع الفرعي</Text>
                  <Text style={styles.totalVal}>{formatMoney(invoice.subtotal)} SAR</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>ضريبة القيمة المضافة (15%)</Text>
                  <Text style={styles.totalVal}>{formatMoney(invoice.vatAmount)} SAR</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalKey}>الإجمالي النهائي</Text>
                  <Text style={styles.grandTotalVal}>
                    {formatMoneyWithSettings(invoice.total, settings)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            {invoice.notes || invoice.terms ? (
              <View style={styles.notesSection}>
                {invoice.notes && <Text style={styles.notesText}>{`ملاحظات: ${invoice.notes}`}</Text>}
                {invoice.terms && <Text style={styles.notesText}>{`الشروط: ${invoice.terms}`}</Text>}
              </View>
            ) : null}
          </View>
        </View>

        {/* Footer */}
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
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.join("، ");
}

function buildClassicStyles(primary: string) {
  return StyleSheet.create({
    page: {
      padding: 20,
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
    outerFrame: {
      borderWidth: 2,
      borderColor: primary,
      padding: 3,
      flex: 1,
    },
    innerFrame: {
      borderWidth: 1,
      borderColor: primary,
      padding: 12,
      flex: 1,
    },
    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingBottom: 10,
      borderBottomWidth: 1.5,
      borderBottomColor: primary,
      marginBottom: 8,
    },
    headerRight: {
      width: "55%",
      alignItems: "flex-end",
    },
    logo: {
      width: 44,
      height: 44,
      objectFit: "contain",
      marginBottom: 3,
    },
    companyName: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    detailRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    detailKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    detailVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    headerLeft: {
      width: "40%",
      alignItems: "flex-start",
    },
    docTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: primary,
      textAlign: "left",
      marginBottom: 3,
    },
    metaRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    metaKey: {
      fontSize: 7.5,
      color: "#475569",
      textAlign: "right",
    },
    metaVal: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "left",
    },
    customerBox: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      padding: 6,
      backgroundColor: "#fafafa",
      alignItems: "flex-end",
      marginBottom: 8,
    },
    customerHeader: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
      marginBottom: 2,
    },
    customerName: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 8,
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
      fontSize: 7.5,
      fontWeight: "bold",
      paddingVertical: 2.5,
      paddingHorizontal: 4,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "rgba(255, 255, 255, 0.3)",
    },
    td: {
      fontSize: 7.5,
      paddingVertical: 2.5,
      paddingHorizontal: 4,
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
    colPos: { width: "5%", textAlign: "center" },
    colDesc: { width: "45%", textAlign: "right" },
    colQty: { width: "10%", textAlign: "center" },
    colPrice: { width: "13%", textAlign: "center" },
    colVat: { width: "12%", textAlign: "center" },
    colTotal: { width: "15%", textAlign: "center", borderLeftWidth: 0 },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 2,
    },
    bottomLeft: {
      flexDirection: "row-reverse",
      gap: 8,
      alignItems: "flex-start",
    },
    qrBox: {
      width: 60,
      height: 60,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      padding: 2,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
    },
    qrImage: {
      width: 50,
      height: 50,
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
    totalsBox: {
      width: 180,
      borderWidth: 1,
      borderColor: primary,
      backgroundColor: "#ffffff",
    },
    totalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    grandTotalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: primary,
    },
    totalKey: {
      fontSize: 7,
      color: "#475569",
      textAlign: "right",
    },
    totalVal: {
      fontSize: 7.5,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    grandTotalKey: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "right",
    },
    grandTotalVal: {
      fontSize: 8.5,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "left",
    },
    notesSection: {
      marginTop: 6,
      padding: 4,
      borderTopWidth: 0.5,
      borderTopColor: "#e2e8f0",
    },
    notesText: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: "right",
    },
    footer: {
      position: "absolute",
      bottom: 6,
      left: 20,
      right: 20,
      textAlign: "center",
    },
    footerText: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "center",
    },
  });
}
