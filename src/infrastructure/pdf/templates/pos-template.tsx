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

export interface PosTemplateProps {
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

export function PosTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  signatureDataUrl,
}: PosTemplateProps) {
  const isMonochrome = template.id === "pos_monochrome";
  const styles = buildPosStyles(template.primaryColor, isMonochrome);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";

  const isSimplified = invoice.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";

  const footerText =
    company.footerText?.trim() || "شكراً لزيارتكم — نتطلع لخدمتكم دائماً";

  return (
    <Document
      title={`POS Receipt ${numberLabel}`}
      author={company.nameAr}
      subject="POS INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={[226, 800]} style={styles.page}>
        {/* 1. Top Header: Logo + Company Info */}
        <View style={styles.header}>
          {logoDataUrl ? (
            <Image src={logoDataUrl} style={styles.logo} />
          ) : null}
          <Text style={styles.companyName}>{company.nameAr}</Text>
          {company.nameEn ? (
            <Text style={styles.companyNameEn}>{company.nameEn}</Text>
          ) : null}
          {company.vatNumber ? (
            <View style={styles.headerInfoRow}>
              <Text style={styles.vatText}>الرقم الضريبي</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.vatText}>{company.vatNumber}</Text>
            </View>
          ) : null}
          {formatAddress(company) ? (
            <Text style={styles.addressText}>{formatAddress(company)}</Text>
          ) : null}
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 2. Receipt Meta Info (RTL) */}
        <View style={styles.metaBox}>
          <Text style={styles.docTitle}>{titleAr}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>رقم الإيصال</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.metaVal}>{numberLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>التاريخ</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.metaVal}>{invoice.issueDate}</Text>
          </View>
          {customer.nameAr && customer.nameAr !== "عميل نقدي" ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>العميل</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.metaVal}>{customer.nameAr}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.solidDivider}>________________________________________</Text>

        {/* 3. Items Table (RTL: Product on Right, Total on Left) */}
        <View style={styles.itemsTable}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.colDesc, styles.textRight]}>المنتج</Text>
            <Text style={styles.colQty}>الكمية</Text>
            <Text style={styles.colPrice}>السعر</Text>
            <Text style={styles.colVat}>الضريبة</Text>
            <Text style={styles.colTotal}>الإجمالي</Text>
          </View>
          <Text style={styles.dashedDivider}>----------------------------------------</Text>

          {invoice.items.map((item, idx) => (
            <View key={item.position ?? idx} style={styles.itemRow}>
              <Text style={[styles.colDesc, styles.textRight]}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
              <Text style={styles.colVat}>{(item.vatRate * 100).toFixed(0)}%</Text>
              <Text style={[styles.colTotal, styles.boldText]}>
                {formatMoney(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 4. Financial Summary */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>المجموع الجزئي</Text>
            <Text style={styles.totalVal}>{formatMoney(invoice.subtotal)} SAR</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>القيمة المضافة</Text>
            <Text style={styles.totalVal}>{formatMoney(invoice.vatAmount)} SAR</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalKey, styles.boldText]}>الإجمالي</Text>
            <Text style={[styles.totalVal, styles.boldText]}>
              {formatMoneyWithSettings(invoice.total, settings)}
            </Text>
          </View>
        </View>

        <Text style={styles.dashedDivider}>----------------------------------------</Text>

        {/* 5. QR Code & Cashier Barcode */}
        <View style={styles.bottomSection}>
          {qrDataUrl ? (
            <View style={styles.qrContainer}>
              <Image src={qrDataUrl} style={styles.qrImage} />
            </View>
          ) : null}

          {/* Simple Simulated Barcode */}
          <View style={styles.barcodeBox}>
            <View style={styles.barcodeLines}>
              {[6, 2, 4, 1, 5, 2, 3, 4, 1, 3, 5, 2, 4, 1, 6, 2, 3, 5, 1, 4, 2].map(
                (w, i) => (
                  <View
                    key={i}
                    style={{
                      width: w,
                      height: 20,
                      backgroundColor: "#000000",
                      marginRight: 2,
                    }}
                  />
                )
              )}
            </View>
            <Text style={styles.barcodeNumber}>{numberLabel}</Text>
          </View>

          {invoice.terms ? (
            <Text style={styles.termsText}>{invoice.terms}</Text>
          ) : null}

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

function buildPosStyles(primary: string, isMonochrome: boolean) {
  const baseColor = isMonochrome ? "#000000" : primary;

  return StyleSheet.create({
    page: {
      padding: 10,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 7.5,
      color: "#000000",
    },
    header: {
      alignItems: "center",
      marginBottom: 4,
    },
    logo: {
      width: 40,
      height: 40,
      objectFit: "contain",
      marginBottom: 3,
    },
    companyName: {
      fontSize: 11,
      fontWeight: "bold",
      textAlign: "center",
      color: baseColor,
    },
    companyNameEn: {
      fontSize: 7,
      textAlign: "center",
      color: "#475569",
    },
    headerInfoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
      marginTop: 2,
    },
    vatText: {
      fontSize: 7,
      textAlign: "center",
    },
    colon: {
      fontSize: 7,
      textAlign: "center",
    },
    addressText: {
      fontSize: 6.5,
      textAlign: "center",
      color: "#334155",
    },
    dashedDivider: {
      fontSize: 7,
      textAlign: "center",
      color: "#94a3b8",
      marginVertical: 2,
    },
    solidDivider: {
      fontSize: 7,
      textAlign: "center",
      color: "#64748b",
      marginVertical: 2,
    },
    metaBox: {
      paddingVertical: 2,
    },
    docTitle: {
      fontSize: 9,
      fontWeight: "bold",
      textAlign: "center",
      color: baseColor,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 1,
    },
    metaKey: {
      fontSize: 7,
      textAlign: "right",
    },
    metaVal: {
      fontSize: 7,
      fontWeight: "bold",
      textAlign: "left",
    },
    itemsTable: {
      width: "100%",
    },
    itemsHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    itemRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    colDesc: { width: "42%", textAlign: "right" },
    colQty: { width: "12%", textAlign: "center" },
    colPrice: { width: "16%", textAlign: "center" },
    colVat: { width: "12%", textAlign: "center" },
    colTotal: { width: "18%", textAlign: "center" },
    textRight: {
      textAlign: "right",
    },
    boldText: {
      fontWeight: "bold",
    },
    totalsBox: {
      paddingVertical: 2,
    },
    totalRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 1.5,
    },
    totalKey: {
      fontSize: 7.5,
      textAlign: "right",
    },
    totalVal: {
      fontSize: 8,
      fontWeight: "bold",
      textAlign: "left",
    },
    bottomSection: {
      alignItems: "center",
      marginTop: 4,
    },
    qrContainer: {
      alignItems: "center",
      marginBottom: 4,
    },
    qrImage: {
      width: 58,
      height: 58,
    },
    barcodeBox: {
      alignItems: "center",
      marginVertical: 4,
    },
    barcodeLines: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    barcodeNumber: {
      fontSize: 6,
      textAlign: "center",
      marginTop: 1,
      fontFamily: "Amiri",
    },
    termsText: {
      fontSize: 6,
      textAlign: "center",
      color: "#475569",
      marginTop: 2,
    },
    footerText: {
      fontSize: 6.5,
      textAlign: "center",
      color: "#64748b",
      marginTop: 4,
    },
  });
}
