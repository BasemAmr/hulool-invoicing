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

export interface BilingualZatcaTemplateProps {
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

export function BilingualZatcaTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: BilingualZatcaTemplateProps) {
  const styles = buildZatcaStyles(template.primaryColor, template.accentColor);
  const numberLabel = invoice.invoiceNumber ?? "DRAFT";

  const isSimplified = invoice.invoiceType === "simplified";
  const titleAr = isSimplified ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";
  const titleEn = isSimplified ? "SIMPLIFIED TAX INVOICE" : "TAX INVOICE";

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const hasDiscounts = invoice.items.some(
    (item) => item.discountAmount && item.discountAmount !== "0.00"
  );

  const footerText =
    company.footerText?.trim() ||
    "فاتورة ضريبية إلكترونية معتمدة — صادرة وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك بالمملكة العربية السعودية";

  return (
    <Document
      title={`Tax Invoice ${numberLabel}`}
      author={company.nameAr}
      subject="ZATCA TAX INVOICE"
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

        {/* 1. Dual Header: Left (Logo & Document Identification) + Right (Invoice Meta) */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.titleAr}>{titleAr}</Text>
              <Text style={styles.titleEn}>{titleEn}</Text>
            </View>
          </View>

          <View style={styles.headerLeft}>
            <View style={styles.metaTable}>
              <View style={styles.metaRow}>
                <View style={styles.metaKeyWrap}>
                  <Text style={styles.metaKeyAr}>رقم الفاتورة</Text>
                  <Text style={styles.metaKeyEn}>/ Invoice No</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{numberLabel}</Text>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaKeyWrap}>
                  <Text style={styles.metaKeyAr}>تاريخ الإصدار</Text>
                  <Text style={styles.metaKeyEn}>/ Issue Date</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{invoice.issueDate}</Text>
              </View>
              {invoice.dueDate ? (
                <View style={styles.metaRow}>
                  <View style={styles.metaKeyWrap}>
                    <Text style={styles.metaKeyAr}>تاريخ الاستحقاق</Text>
                    <Text style={styles.metaKeyEn}>/ Due Date</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.metaVal}>{invoice.dueDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* 2. Parties Box: Seller (Right) & Buyer (Left) */}
        <View style={styles.partiesGrid}>
          {/* Seller (Supplier) */}
          <View style={styles.partyBox}>
            <View style={styles.partyBoxHeader}>
              <Text style={styles.partyBoxTitle}>المورّد / Seller (Supplier)</Text>
            </View>
            <View style={styles.partyBoxContent}>
              <Text style={styles.partyName}>{company.nameAr}</Text>
              {company.nameEn ? (
                <Text style={styles.partyNameEn}>{company.nameEn}</Text>
              ) : null}

              {company.vatNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الضريبي</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tax ID</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.vatNumber}</Text>
                </View>
              ) : null}

              {formatAddress(company) ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>العنوان</Text>
                    <Text style={styles.partyLineKeyEn}>/ Address</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{formatAddress(company)}</Text>
                </View>
              ) : null}

              {company.phone ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الهاتف</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tel</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.phone}</Text>
                </View>
              ) : null}

              {company.email ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>البريد</Text>
                    <Text style={styles.partyLineKeyEn}>/ Email</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{company.email}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Customer (Buyer) */}
          <View style={styles.partyBox}>
            <View style={styles.partyBoxHeader}>
              <Text style={styles.partyBoxTitle}>العميل / Buyer (Bill To)</Text>
            </View>
            <View style={styles.partyBoxContent}>
              <Text style={styles.partyName}>{customer.nameAr}</Text>
              {customer.nameEn ? (
                <Text style={styles.partyNameEn}>{customer.nameEn}</Text>
              ) : null}

              {customer.vatNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الضريبي</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tax ID</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.vatNumber}</Text>
                </View>
              ) : null}

              {customer.unifiedNumber ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الرقم الموحد</Text>
                    <Text style={styles.partyLineKeyEn}>/ Unified No</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.unifiedNumber}</Text>
                </View>
              ) : null}

              {customer.phone ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>الهاتف</Text>
                    <Text style={styles.partyLineKeyEn}>/ Tel</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.phone}</Text>
                </View>
              ) : null}

              {customer.email ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>البريد</Text>
                    <Text style={styles.partyLineKeyEn}>/ Email</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>{customer.email}</Text>
                </View>
              ) : null}

              {customer.addressCity || customer.addressStreet || customer.addressPostalCode ? (
                <View style={styles.partyLineRow}>
                  <View style={styles.partyLineKeyWrap}>
                    <Text style={styles.partyLineKeyAr}>العنوان</Text>
                    <Text style={styles.partyLineKeyEn}>/ Address</Text>
                    <Text style={styles.colon}>:</Text>
                  </View>
                  <Text style={styles.partyLineVal}>
                    {[customer.addressStreet, customer.addressCity, customer.addressPostalCode]
                      .filter(Boolean)
                      .join("، ")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
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
              الوصف / Description
            </Text>
            <Text style={[styles.th, styles.colQty]}>الكمية / Qty</Text>
            <Text style={[styles.th, styles.colMoney]}>سعر الوحدة / Unit</Text>
            {hasDiscounts ? (
              <Text style={[styles.th, styles.colDiscount]}>الخصم / Disc.</Text>
            ) : null}
            <Text style={[styles.th, styles.colMoney]}>الضريبة / VAT</Text>
            <Text style={[styles.th, styles.colMoneyTotal]}>الإجمالي / Total</Text>
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
              <Text style={[styles.td, styles.colMoney]}>
                {formatMoney(item.unitPrice)}
              </Text>
              {hasDiscounts ? (
                <Text style={[styles.td, styles.colDiscount]}>
                  {parseFloat(item.discountAmount) > 0
                    ? formatMoney(item.discountAmount)
                    : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.colMoney]}>
                {formatMoney(item.lineVat)}
              </Text>
              <Text style={[styles.td, styles.colMoneyTotal, styles.boldText]}>
                {formatMoney(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* 4. Bottom Section */}
        <View style={styles.bottomSection} wrap={false}>
          <View style={styles.bottomLeft}>
            <View style={styles.qrAndAuthRow}>
              <View style={styles.qrBox}>
                {qrDataUrl ? (
                  <Image src={qrDataUrl} style={styles.qrImage} />
                ) : (
                  <Text style={styles.draftWatermark}>مسودة DRAFT</Text>
                )}
              </View>

              <View style={styles.notesContainer}>
                {invoice.notes ? (
                  <View style={styles.noteItem}>
                    <Text style={styles.noteTitle}>ملاحظات / Notes:</Text>
                    <Text style={styles.noteText}>{invoice.notes}</Text>
                  </View>
                ) : null}
                {invoice.terms ? (
                  <View style={styles.noteItem}>
                    <Text style={styles.noteTitle}>الشروط / Terms:</Text>
                    <Text style={styles.noteText}>{invoice.terms}</Text>
                  </View>
                ) : null}
              </View>

              {signatureDataUrl ? (
                <View style={styles.authItem}>
                  <Image src={signatureDataUrl} style={styles.authImage} />
                  <Text style={styles.authCaption}>الختم والتوقيع / Stamp</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Right: Totals Card */}
          <View style={styles.totalsCard}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>المجموع الخاضع للضريبة / Taxable Amt</Text>
              <Text style={styles.totalsVal}>{formatMoney(invoice.subtotal)} SAR</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>ضريبة القيمة المضافة (15%) / VAT</Text>
              <Text style={styles.totalsVal}>{formatMoney(invoice.vatAmount)} SAR</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsKey, styles.grandTotalKey]}>
                إجمالي المبلغ المستحق / Total Due
              </Text>
              <Text style={[styles.totalsVal, styles.grandTotalVal]}>
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

function formatAddress(company: CompanyRecord): string {
  const parts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.join("، ");
}

function buildZatcaStyles(primary: string, accent: string) {
  return StyleSheet.create({
    page: {
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: 25,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 7.5,
      color: "#0f172a",
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
    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1.5,
      borderBottomColor: primary,
      paddingBottom: 8,
      marginBottom: 6,
    },
    headerRight: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
    },
    logo: {
      width: 48,
      height: 48,
      objectFit: "contain",
    },
    titleAr: {
      fontSize: 14,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    titleEn: {
      fontSize: 7.5,
      color: "#64748b",
      textAlign: "right",
      marginTop: 1,
    },
    headerLeft: {
      width: "48%",
    },
    metaTable: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#f8fafc",
    },
    metaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    metaKeyWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    metaKeyAr: {
      fontSize: 6.5,
      color: "#475569",
      textAlign: "right",
    },
    metaKeyEn: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "right",
    },
    colon: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: "center",
    },
    metaVal: {
      fontSize: 7,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    partiesGrid: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 6,
    },
    partyBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#cbd5e1",
    },
    partyBoxHeader: {
      backgroundColor: primary,
      paddingVertical: 2,
      paddingHorizontal: 5,
    },
    partyBoxTitle: {
      fontSize: 7,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "right",
    },
    partyBoxContent: {
      padding: 5,
      backgroundColor: "#fafafa",
    },
    partyName: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    partyNameEn: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: "right",
    },
    partyLineRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    partyLineKeyWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    partyLineKeyAr: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: "right",
    },
    partyLineKeyEn: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "right",
    },
    partyLineVal: {
      fontSize: 6.5,
      color: "#0f172a",
      textAlign: "right",
      fontWeight: "bold",
    },
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 6,
      backgroundColor: "#ffffff",
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
      fontSize: 7,
      fontWeight: "bold",
      paddingVertical: 2.5,
      paddingHorizontal: 3,
      textAlign: "center",
      borderLeftWidth: 0.5,
      borderLeftColor: "rgba(255, 255, 255, 0.2)",
    },
    td: {
      fontSize: 7,
      paddingVertical: 2.5,
      paddingHorizontal: 3,
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
    colPos: { width: "4%", textAlign: "center" },
    colDesc: { width: "40%", textAlign: "right" },
    colDescNarrow: { width: "32%", textAlign: "right" },
    colQty: { width: "8%", textAlign: "center" },
    colMoney: { width: "16%", textAlign: "center" },
    colDiscount: { width: "8%", textAlign: "center" },
    colMoneyTotal: { width: "16%", textAlign: "center", borderLeftWidth: 0 },
    bottomSection: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 6,
    },
    bottomLeft: {
      flex: 1,
      flexDirection: "column",
      gap: 4,
    },
    qrAndAuthRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 6,
    },
    qrBox: {
      width: 72,
      height: 72,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      padding: 2,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      shrink: 0,
    },
    qrImage: {
      width: 66,
      height: 66,
    },
    draftWatermark: {
      fontSize: 10,
      color: "#94a3b8",
      fontWeight: "bold",
    },
    notesContainer: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#f8fafc",
      padding: 4,
      minHeight: 72,
      justifyContent: "center",
    },
    noteItem: {
      marginBottom: 2,
    },
    noteTitle: {
      fontSize: 7,
      fontWeight: "bold",
      color: primary,
      textAlign: "right",
    },
    noteText: {
      fontSize: 6.5,
      color: "#475569",
      textAlign: "right",
      lineHeight: 1.3,
    },
    authItem: {
      alignItems: "center",
      width: 45,
    },
    authImage: {
      width: 40,
      height: 40,
      objectFit: "contain",
    },
    authCaption: {
      fontSize: 6,
      color: "#64748b",
      marginTop: 1,
      textAlign: "center",
    },
    totalsCard: {
      width: 200,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
      shrink: 0,
    },
    totalsRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
    },
    totalsRowGrand: {
      backgroundColor: primary,
      borderBottomWidth: 0,
    },
    totalsKey: {
      fontSize: 6.5,
      color: "#475569",
      textAlign: "right",
    },
    totalsVal: {
      fontSize: 7,
      color: "#0f172a",
      fontWeight: "bold",
      textAlign: "left",
    },
    grandTotalKey: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 7.5,
      textAlign: "right",
    },
    grandTotalVal: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8.5,
      textAlign: "left",
    },
    footer: {
      position: "absolute",
      bottom: 10,
      left: 20,
      right: 20,
      borderTopWidth: 0.5,
      borderTopColor: "#e2e8f0",
      paddingTop: 3,
      textAlign: "center",
    },
    footerText: {
      fontSize: 6,
      color: "#94a3b8",
      textAlign: "center",
    },
  });
}
