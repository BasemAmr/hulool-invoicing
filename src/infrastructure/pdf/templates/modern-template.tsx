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

export interface ModernTemplateProps {
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

export function ModernTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: ModernTemplateProps) {
  const styles = buildModernStyles(template.primaryColor, template.accentColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";

  const isSimplified = invoice.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const footerText =
    company.footerText?.trim() ||
    "فاتورة ضريبية معتمدة صادرة إلكترونياً وفق متطلبات هيئة الزكاة والضريبة والجمارك";

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

        {/* 1. Header: Logo & Company Name (Right) + Invoice Title & Ribbons (Left) */}
        <View style={styles.headerRow}>
          {/* Left: Invoice Title & Status Badge */}
          <View style={styles.headerLeft}>
            <Text style={styles.invoiceTitle}>{titleAr}</Text>
            <Text style={styles.invoiceNumber}>{numberLabel}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {invoice.status === "issued" ? "معتمدة ومصدرة" : "مسودة"}
              </Text>
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
          </View>
        </View>

        {/* 2. Top Color Banner: Invoice Metadata (Left) + Client Info (Right) */}
        <View style={styles.bannerGrid}>
          {/* Banner Left: Metadata Grid */}
          <View style={styles.bannerMetaCol}>
            <View style={styles.bannerMetaRow}>
              <View style={styles.labelWithColon}>
                <Text style={styles.bannerMetaKey}>تاريخ الإصدار</Text>
                <Text style={styles.colon}>:</Text>
              </View>
              <Text style={styles.bannerMetaVal}>{invoice.issueDate}</Text>
            </View>
            {invoice.dueDate ? (
              <View style={styles.bannerMetaRow}>
                <View style={styles.labelWithColon}>
                  <Text style={styles.bannerMetaKey}>تاريخ الاستحقاق</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.bannerMetaVal}>{invoice.dueDate}</Text>
              </View>
            ) : null}
            {company.vatNumber ? (
              <View style={styles.bannerMetaRow}>
                <View style={styles.labelWithColon}>
                  <Text style={styles.bannerMetaKey}>الرقم الضريبي للمنشأة</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.bannerMetaVal}>{company.vatNumber}</Text>
              </View>
            ) : null}
          </View>

          {/* Banner Right: Client Info */}
          <View style={styles.bannerClientCol}>
            <Text style={styles.bannerClientTitle}>حررت الفاتورة إلى</Text>
            <Text style={styles.bannerClientName}>{customer.nameAr}</Text>
            {customer.nameEn ? (
              <Text style={styles.bannerClientNameEn}>{customer.nameEn}</Text>
            ) : null}

            {customer.vatNumber ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>الرقم الضريبي</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.vatNumber}</Text>
              </View>
            ) : null}

            {customer.phone ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>جوال</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.phone}</Text>
              </View>
            ) : null}

            {customer.email ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>البريد</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>{customer.email}</Text>
              </View>
            ) : null}

            {customer.addressCity || customer.addressStreet ? (
              <View style={styles.bannerClientRow}>
                <Text style={styles.bannerClientKey}>العنوان</Text>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.bannerClientVal}>
                  {[customer.addressStreet, customer.addressCity].filter(Boolean).join("، ")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 3. Items Table (RTL: # on Right, Total on Left) */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colDesc, styles.textRight]}>المنتج / الوصف</Text>
            <Text style={[styles.th, styles.colQty]}>الكمية</Text>
            <Text style={[styles.th, styles.colPrice]}>السعر</Text>
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
              <Text style={[styles.td, styles.colDesc, styles.textRight]}>
                {item.description}
              </Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>
                {formatMoney(item.unitPrice)}
              </Text>
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

        {/* 4. Bottom Section */}
        <View style={styles.bottomSection} wrap={false}>
          {/* Left: Notes & QR */}
          <View style={styles.bottomLeft}>
            {qrDataUrl ? (
              <View style={styles.qrRow}>
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </View>
                <View style={styles.notesContainer}>
                  {invoice.notes ? (
                    <View style={styles.noteItem}>
                      <Text style={styles.noteTitle}>ملاحظات للعميل</Text>
                      <Text style={styles.noteText}>{invoice.notes}</Text>
                    </View>
                  ) : null}
                  {invoice.terms ? (
                    <View style={styles.noteItem}>
                      <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                      <Text style={styles.noteText}>{invoice.terms}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {signatureDataUrl ? (
              <View style={styles.signatureWrap}>
                <Image src={signatureDataUrl} style={styles.signatureImg} />
                <Text style={styles.signatureLabel}>التوقيع المعتمد</Text>
              </View>
            ) : null}
          </View>

          {/* Right: Totals Card */}
          <View style={styles.totalsCard}>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>المجموع الجزئي</Text>
              <Text style={styles.totalVal}>{formatMoney(invoice.subtotal)} SAR</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalKey}>القيمة المضافة (15%)</Text>
              <Text style={styles.totalVal}>{formatMoney(invoice.vatAmount)} SAR</Text>
            </View>
            <View style={[styles.totalLine, styles.totalLineGrand]}>
              <Text style={[styles.totalKey, styles.grandTotalKey]}>
                الإجمالي الكلي
              </Text>
              <Text style={[styles.totalVal, styles.grandTotalText]}>
                {formatMoneyWithSettings(invoice.total, settings)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildModernStyles(primary: string, accent: string) {
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
    headerRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    headerRight: {
      alignItems: "flex-end",
    },
    logoImage: {
      width: 48,
      height: 48,
      objectFit: "contain",
      marginBottom: 3,
    },
    companyName: {
      fontSize: 13,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    companyNameEn: {
      fontSize: 7.5,
      color: "#64748b",
      textAlign: "right",
    },
    headerLeft: {
      alignItems: "flex-start",
    },
    invoiceTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: primary,
      textAlign: "left",
    },
    invoiceNumber: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#334155",
      marginTop: 1,
    },
    statusBadge: {
      marginTop: 3,
      paddingVertical: 1.5,
      paddingHorizontal: 6,
      backgroundColor: "#f1f5f9",
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderRadius: 2,
    },
    statusBadgeText: {
      fontSize: 6.5,
      color: "#475569",
      fontWeight: "bold",
    },
    bannerGrid: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderTopWidth: 2,
      borderTopColor: primary,
      padding: 8,
      marginBottom: 10,
    },
    bannerClientCol: {
      width: "48%",
      alignItems: "flex-end",
    },
    bannerClientTitle: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
      marginBottom: 2,
    },
    bannerClientName: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    bannerClientNameEn: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
      marginBottom: 1,
    },
    bannerClientRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    bannerClientKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    colon: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
    },
    bannerClientVal: {
      fontSize: 7,
      color: "#0f172a",
      textAlign: "right",
    },
    bannerMetaCol: {
      width: "48%",
      alignItems: "flex-start",
    },
    bannerMetaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingVertical: 1.5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    labelWithColon: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    bannerMetaKey: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "right",
    },
    bannerMetaVal: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "left",
    },
    table: {
      marginBottom: 10,
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
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
      alignItems: "center",
      minHeight: 18,
    },
    tableRowAlt: {
      backgroundColor: "#f8fafc",
    },
    th: {
      color: "#ffffff",
      fontSize: 7.5,
      fontWeight: "bold",
      paddingVertical: 3,
      paddingHorizontal: 4,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "rgba(255, 255, 255, 0.2)",
    },
    td: {
      fontSize: 7.5,
      paddingVertical: 3,
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
    colDesc: { width: "41%", textAlign: "right" },
    colQty: { width: "8%", textAlign: "center" },
    colPrice: { width: "12%", textAlign: "center" },
    colVatRate: { width: "11%", textAlign: "center" },
    colVatAmount: { width: "11%", textAlign: "center" },
    colTotal: { width: "12%", textAlign: "center", borderLeftWidth: 0 },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 2,
    },
    bottomLeft: {
      flex: 1,
    },
    qrRow: {
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
    notesContainer: {
      flex: 1,
      gap: 4,
    },
    noteItem: {
      padding: 4,
      backgroundColor: "#f8fafc",
      borderRightWidth: 2,
      borderRightColor: primary,
    },
    noteTitle: {
      fontSize: 6.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    noteText: {
      fontSize: 6.5,
      color: "#334155",
      textAlign: "right",
      marginTop: 1,
    },
    signatureWrap: {
      marginTop: 8,
      alignItems: "flex-end",
    },
    signatureImg: {
      width: 60,
      height: 35,
      objectFit: "contain",
    },
    signatureLabel: {
      fontSize: 6,
      color: "#64748b",
      marginTop: 1,
    },
    totalsCard: {
      width: 190,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
    },
    totalLine: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2.5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalLineGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
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
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8,
      textAlign: "right",
    },
    grandTotalText: {
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
