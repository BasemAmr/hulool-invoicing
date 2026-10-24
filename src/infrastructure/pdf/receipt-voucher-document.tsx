import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

import type { DocumentTemplateConfig } from "@/domain/contracts";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { ReceiptVoucherRecord } from "@/application/ports/receipt-voucher-repository";
import type { InvoiceDto } from "@/application/dto";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import { formatMoneyWithSettings } from "@/lib/format";
import { getReceiptTemplateById } from "./templates/registry";
import { DesignWorkReceiptTemplate } from "./templates/design-work-receipt-template";
import { JoyPaymentVoucherTemplate } from "./templates/joy-payment-voucher-template";

export interface ReceiptVoucherDocumentProps {
  voucher: ReceiptVoucherRecord;
  company: CompanyRecord;
  customer: CustomerRecord;
  invoice?: InvoiceDto | null;
  settings?: CompanySettingsRecord | null;
  template?: DocumentTemplateConfig | null;
  templateId?: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl: string | null;
}

const PAYMENT_METHODS_AR: Record<string, string> = {
  cash: "نقداً (Cash)",
  bank_transfer: "تحويل بنكي (Bank Transfer)",
  card: "بطاقة دفع (Card)",
  check: "شيك (Cheque)",
  other: "أخرى (Other)",
};

export function ReceiptVoucherDocument({
  voucher,
  company,
  customer,
  invoice,
  settings,
  template,
  templateId,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: ReceiptVoucherDocumentProps) {
  const receiptDef = templateId ? getReceiptTemplateById(templateId) : null;

  if (receiptDef?.id === "receipt_design_work" || templateId === "receipt_design_work") {
    return (
      <DesignWorkReceiptTemplate
        voucher={voucher}
        company={company}
        customer={customer}
        invoice={invoice}
        settings={settings}
        template={receiptDef || template}
        templateId={templateId}
        logoDataUrl={logoDataUrl}
        backgroundDataUrl={backgroundDataUrl}
        signatureDataUrl={signatureDataUrl}
      />
    );
  }

  if (receiptDef?.id === "receipt_joy_payment" || templateId === "receipt_joy_payment") {
    return (
      <JoyPaymentVoucherTemplate
        voucher={voucher}
        company={company}
        customer={customer}
        invoice={invoice}
        settings={settings}
        template={receiptDef || template}
        templateId={templateId}
        logoDataUrl={logoDataUrl}
        backgroundDataUrl={backgroundDataUrl}
        signatureDataUrl={signatureDataUrl}
        mode="payment"
      />
    );
  }

  if (receiptDef?.id === "receipt_joy_receipt" || templateId === "receipt_joy_receipt") {
    return (
      <JoyPaymentVoucherTemplate
        voucher={voucher}
        company={company}
        customer={customer}
        invoice={invoice}
        settings={settings}
        template={receiptDef || template}
        templateId={templateId}
        logoDataUrl={logoDataUrl}
        backgroundDataUrl={backgroundDataUrl}
        signatureDataUrl={signatureDataUrl}
        mode="receipt"
      />
    );
  }

  const primaryColor = receiptDef?.primaryColor || template?.primaryColor || "#0284C7";
  const accentColor = receiptDef?.accentColor || template?.accentColor || "#0369A1";
  const styles = buildStyles(primaryColor, accentColor);

  const amountStr = (voucher.amount / 100).toFixed(2);
  const formattedAmount = formatMoneyWithSettings(amountStr, settings);

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const footerText =
    company.footerText?.trim() ||
    template?.footerNoteAr ||
    `سند قبض مالي معتمد — ${company.nameAr}`;

  return (
    <Document
      title={`Receipt Voucher ${voucher.voucherNumber}`}
      author={company.nameAr}
      subject="RECEIPT VOUCHER"
      creator="Hulool Invoicing"
    >
      <Page
        size={paperSize as any}
        orientation={paperOrientation as any}
        style={styles.page}
      >
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image
            src={backgroundDataUrl}
            style={{
              position: "absolute",
              top: "22%",
              left: "15%",
              width: "70%",
              height: "55%",
              opacity: 0.05,
              objectFit: "contain",
            }}
          />
        ) : null}

        {/* 1. Header Box: 3-Column Layout (Company Info Right/Start, Title Center, Voucher Meta Left/End) */}
        <View style={styles.headerBox}>
          {/* Header Start (Right in RTL): Company Logo & Details */}
          <View style={styles.headerCompanyCol}>
            <View style={styles.companyTop}>
              {logoDataUrl ? (
                <Image src={logoDataUrl} style={styles.logo} />
              ) : null}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.companyNameAr}>{company.nameAr}</Text>
                {company.nameEn ? (
                  <Text style={styles.companyNameEn}>{company.nameEn}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.companyMeta}>
              {company.vatNumber ? (
                <View style={styles.companyInfoRow}>
                  <Text style={styles.companyMetaKey}>الرقم الضريبي</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.companyMetaVal}>{company.vatNumber}</Text>
                </View>
              ) : null}

              {company.crNumber ? (
                <View style={styles.companyInfoRow}>
                  <Text style={styles.companyMetaKey}>السجل التجاري</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.companyMetaVal}>{company.crNumber}</Text>
                </View>
              ) : null}

              {company.addressCity ? (
                <View style={styles.companyInfoRow}>
                  <Text style={styles.companyMetaKey}>المدينة</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.companyMetaVal}>{company.addressCity}</Text>
                </View>
              ) : null}

              {company.phone ? (
                <View style={styles.companyInfoRow}>
                  <Text style={styles.companyMetaKey}>الهاتف</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.companyMetaVal}>{company.phone}</Text>
                </View>
              ) : null}

              {company.email ? (
                <View style={styles.companyInfoRow}>
                  <Text style={styles.companyMetaKey}>البريد</Text>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.companyMetaVal}>{company.email}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Header Center: Title */}
          <View style={styles.headerCenterCol}>
            <Text style={styles.titleAr}>سند قبض</Text>
            <Text style={styles.titleEn}>RECEIPT VOUCHER</Text>
          </View>

          {/* Header End (Left in RTL): Voucher Number Badge & Metadata */}
          <View style={styles.headerMetaCol}>
            <View style={styles.voucherBadge}>
              <Text style={styles.voucherBadgeText}>{voucher.voucherNumber}</Text>
            </View>

            {/* Date Row */}
            <View style={styles.metaRow}>
              <View style={styles.metaLabelGroup}>
                <Text style={styles.metaLabel}>التاريخ</Text>
                <Text style={styles.metaLabelEn}>(Date)</Text>
                <Text style={styles.colon}>:</Text>
              </View>
              <Text style={styles.metaValue}>{voucher.voucherDate}</Text>
            </View>

            {/* Linked Invoice if present */}
            {invoice?.invoiceNumber ? (
              <View style={styles.metaRow}>
                <View style={styles.metaLabelGroup}>
                  <Text style={styles.metaLabel}>الفاتورة</Text>
                  <Text style={styles.metaLabelEn}>(Invoice)</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Thin primary accent bar below header row, directly above the content frame */}
        <View style={styles.topBar} />

        {/* Content Box with outer frame border enclosing Amount, Details, Signatures, and Footer */}
        <View style={styles.outerFrame}>
          {/* 2. Amount Box */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>المبلغ المستلم / Received Amount</Text>
            <Text style={styles.amountValue}>{formattedAmount}</Text>
          </View>

          {/* 3. Details Card (RTL: Label on Right, Colon, Value starts immediately after colon) */}
          <View style={styles.detailsCard}>
            {/* Customer Name */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <Text style={styles.detailLabel}>استلمنا من المكرم</Text>
                <Text style={styles.detailLabelEn}>/ Received From</Text>
                <Text style={styles.colon}>:</Text>
              </View>
              <Text style={styles.detailValueBold}>{customer.nameAr}</Text>
            </View>

            {/* Customer VAT if present */}
            {customer.vatNumber ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Text style={styles.detailLabel}>الرقم الضريبي للعميل</Text>
                  <Text style={styles.detailLabelEn}>/ Customer VAT</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.detailValue}>{customer.vatNumber}</Text>
              </View>
            ) : null}

            {/* Customer Unified No if present */}
            {customer.unifiedNumber ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Text style={styles.detailLabel}>الرقم الموحد</Text>
                  <Text style={styles.detailLabelEn}>/ Unified No</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.detailValue}>{customer.unifiedNumber}</Text>
              </View>
            ) : null}

            {/* Payment Method */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <Text style={styles.detailLabel}>طريقة الدفع</Text>
                <Text style={styles.detailLabelEn}>/ Payment Method</Text>
                <Text style={styles.colon}>:</Text>
              </View>
              <Text style={styles.detailValue}>
                {PAYMENT_METHODS_AR[voucher.paymentMethod] ?? voucher.paymentMethod}
              </Text>
            </View>

            {/* Reference No if present */}
            {voucher.reference ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Text style={styles.detailLabel}>رقم المرجع / الحوالة</Text>
                  <Text style={styles.detailLabelEn}>/ Reference</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.detailValue}>{voucher.reference}</Text>
              </View>
            ) : null}

            {/* Notes / For Description if present */}
            {voucher.notes ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Text style={styles.detailLabel}>وذلك عن (البيان)</Text>
                  <Text style={styles.detailLabelEn}>/ For</Text>
                  <Text style={styles.colon}>:</Text>
                </View>
                <Text style={styles.detailValue}>{voucher.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* 4. Signature & Stamp Area */}
          <View style={styles.signaturesBox}>
            {/* Receiver Signature */}
            <View style={styles.sigCol}>
              <Text style={styles.sigTitle}>توقيع المستلم / Receiver Signature</Text>
              <View style={styles.sigLine}>
                {signatureDataUrl ? (
                  <Image src={signatureDataUrl} style={styles.sigImage} />
                ) : null}
              </View>
            </View>

            {/* Company Endorsement */}
            <View style={styles.sigCol}>
              <Text style={styles.sigTitle}>اعتماد المنشأة / Approved</Text>
              <View style={styles.sigLine}>
                <Text style={{ fontSize: 8, color: "#94A3B8" }}>
                  {company.nameAr}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Footer (outside outerFrame at bottom of page) */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

function buildStyles(primaryColor: string, accentColor: string) {
  return StyleSheet.create({
    page: {
      padding: 16,
      fontFamily: "Amiri",
      backgroundColor: "#FFFFFF",
      fontSize: 9,
      color: "#1E293B",
    },
    outerFrame: {
      borderWidth: 1,
      borderColor: "#000000",
      borderRadius: 4,
      padding: 18,
      paddingBottom: 22,
    },
    topBar: {
      height: 1.5,
      backgroundColor: primaryColor,
      marginBottom: 8,
    },
    headerBox: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: 10,
      marginBottom: 0,
    },
    headerCompanyCol: {
      width: "36%",
      alignItems: "flex-end",
    },
    companyTop: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    logo: {
      width: 44,
      height: 44,
      objectFit: "contain",
    },
    companyNameAr: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#0F172A",
      textAlign: "right",
    },
    companyNameEn: {
      fontSize: 7.5,
      color: "#64748B",
      textAlign: "right",
    },
    companyMeta: {
      marginTop: 4,
      alignItems: "flex-end",
    },
    companyInfoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    companyMetaKey: {
      fontSize: 7.5,
      color: "#64748B",
      textAlign: "right",
    },
    colon: {
      fontSize: 7.5,
      color: "#64748B",
      textAlign: "center",
    },
    companyMetaVal: {
      fontSize: 7.5,
      color: "#0F172A",
      fontWeight: "bold",
      textAlign: "right",
    },
    headerCenterCol: {
      width: "28%",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 4,
    },
    headerMetaCol: {
      width: "34%",
      alignItems: "flex-start",
    },
    titleAr: {
      fontSize: 18,
      fontWeight: "bold",
      color: primaryColor,
      textAlign: "center",
    },
    titleEn: {
      fontSize: 8.5,
      color: "#64748B",
      textAlign: "center",
      marginTop: 2,
    },
    voucherBadge: {
      backgroundColor: "#F1F5F9",
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 2,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      alignSelf: "flex-start",
      marginBottom: 6,
    },
    voucherBadgeText: {
      fontFamily: "Amiri",
      fontWeight: "bold",
      fontSize: 10,
      color: "#0F172A",
    },
    metaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginTop: 2,
    },
    metaLabelGroup: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 2,
    },
    metaLabel: {
      fontSize: 7.5,
      color: "#64748B",
      textAlign: "right",
    },
    metaLabelEn: {
      fontSize: 7,
      color: "#94A3B8",
      textAlign: "right",
    },
    metaValue: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#0F172A",
      textAlign: "left",
    },
    amountBox: {
      backgroundColor: "#F8FAFC",
      borderWidth: 1.5,
      borderColor: primaryColor,
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 8.5,
      color: "#64748B",
      marginBottom: 2,
    },
    amountValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: primaryColor,
    },
    detailsCard: {
      borderWidth: 1,
      borderColor: "#E2E8F0",
      padding: 12,
      marginBottom: 20,
      backgroundColor: "#FAFAFA",
    },
    detailRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingVertical: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#E2E8F0",
    },
    detailLabelWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      width: 170,
      gap: 2,
      shrink: 0,
    },
    detailLabel: {
      fontSize: 8.5,
      color: "#475569",
      textAlign: "right",
    },
    detailLabelEn: {
      fontSize: 7.5,
      color: "#94A3B8",
      textAlign: "right",
    },
    detailValue: {
      fontSize: 8.5,
      color: "#0F172A",
      flex: 1,
      textAlign: "right",
    },
    detailValueBold: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#0F172A",
      flex: 1,
      textAlign: "right",
    },
    signaturesBox: {
      flexDirection: "row-reverse",
      justifyContent: "space-around",
      marginTop: 20,
      paddingTop: 16,
    },
    sigCol: {
      width: "40%",
      alignItems: "center",
    },
    sigTitle: {
      fontSize: 8.5,
      fontWeight: "bold",
      color: "#334155",
      marginBottom: 8,
    },
    sigLine: {
      width: "100%",
      height: 48,
      borderBottomWidth: 1,
      borderBottomColor: "#94A3B8",
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    sigImage: {
      width: 70,
      height: 40,
      objectFit: "contain",
    },
    footer: {
      marginTop: "auto",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "#E2E8F0",
      alignItems: "center",
    },
    footerText: {
      fontSize: 7.5,
      color: "#94A3B8",
      textAlign: "center",
    },
  });
}
