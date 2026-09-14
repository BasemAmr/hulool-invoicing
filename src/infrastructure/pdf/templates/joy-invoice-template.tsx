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

export interface JoyInvoiceTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
  isPurchase?: boolean;
}

function formatNumber(val: string | number, decimals: number = 2): string {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "10:30 09/09/2026";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return iso;
  }
}

export function JoyInvoiceTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  backgroundDataUrl,
  isPurchase = false,
}: JoyInvoiceTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const poRef = (invoice as any).poReference || "";
  const dateTimeStr = formatDateTime(invoice.issueDate);

  // Labels based on Purchase vs Sales
  const titleText = isPurchase
    ? "Purchase Invoice / فاتورة مشتريات"
    : "Tax Invoice / فاتورة ضريبية";
  const invoiceTypeStatus = isPurchase ? "فاتورة مشتريات" : "فاتورة ضريبية";

  // Parties
  // Issuer (من / From): In purchase, it is supplier/vendor; in sales, it is company.
  const issuerName = isPurchase ? (customer.nameAr || "") : (company.nameAr || "");
  const issuerCity = isPurchase ? (customer.addressCity || "") : (company.addressCity || "");
  const issuerVat = isPurchase ? (customer.vatNumber || "") : (company.vatNumber || "");
  const issuerPhone = isPurchase ? (customer.phone || "") : (company.phone || "");
  const issuerEmail = isPurchase ? (customer.email || "") : (company.email || "");

  // Receiver (إلى / To): In purchase, it is company; in sales, it is customer.
  const receiverName = isPurchase ? (company.nameAr || "") : (customer.nameAr || "");
  const receiverStreet = isPurchase ? (company.addressStreet || "") : (customer.addressStreet || "");
  const receiverVat = isPurchase ? (company.vatNumber || "") : (customer.vatNumber || "");

  // Numbers & Calculations
  const itemCount = invoice.items.length;
  const totalQty = invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotalVal = Number(invoice.subtotal || 0);
  const discountVal = Number((invoice as any).discountTotal || 0);
  const vatVal = Number(invoice.vatAmount || 0);
  const totalVal = Number(invoice.total || 0);


  return (
    <Document
      title={`${titleText} ${invoiceNum}`}
      author={issuerName}
      subject="INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: TITLE ─── */}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText}>{titleText}</Text>
        </View>

        {/* ─── 2. QR CODE & METADATA SECTION ─── */}
        <View style={styles.metaSection}>
          {/* Left: Real QR Code */}
          <View style={styles.barcodeBox}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>

          {/* Right: Invoice Metadata */}
          <View style={styles.metaInfoBox}>
            <Text style={styles.metaText}>تاريخ الإصدار : {dateTimeStr}</Text>
            <Text style={styles.metaText}>الرقم التسلسلي للفاتوره : {invoiceNum}</Text>
            <Text style={styles.metaText}>الرقم المرجعي : {poRef}</Text>
            <Text style={styles.metaText}>الحالة : {invoiceTypeStatus}</Text>
            <Text style={styles.metaText}>حالة الدفع : مدفوع</Text>
          </View>
        </View>

        {/* ─── 3. PARTIES: ISSUER (من) & RECIPIENT (إلى) ─── */}
        <View style={styles.partiesSection}>
          {/* Left: إلى : Recipient */}
          <View style={styles.receiverCol}>
            <Text style={styles.partyRoleLabel}>: إلى</Text>
            <Text style={styles.partyNameBold}>{receiverName}</Text>
            <Text style={styles.partyDetail}>{receiverStreet}</Text>
            {receiverVat ? (
              <Text style={styles.partyDetail}>رقم التسجيل الضريبي : {receiverVat}</Text>
            ) : null}
          </View>

          {/* Right: من : Issuer */}
          <View style={styles.issuerCol}>
            <Text style={styles.partyRoleLabel}>: من</Text>
            <Text style={styles.partyNameBold}>{issuerName}</Text>
            <Text style={styles.partyDetail}>{issuerCity}</Text>
            <Text style={styles.partyDetail}>{issuerCity} {issuerCity}</Text>
            <Text style={styles.partyDetail}>رقم التسجيل الضريبي : {issuerVat}</Text>
            <Text style={styles.partyDetail}>الهاتف : {issuerPhone}</Text>
            <Text style={styles.partyDetail}>البريد الإلكتروني : {issuerEmail}</Text>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (LIGHT BLUE ACCENT) ─── */}
        <View style={styles.table}>
          {/* Table Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. السعر الإجمالي / Total Price */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thTextAr}>السعر الإجمالي</Text>
              <Text style={styles.thTextEn}>Total Price</Text>
            </View>

            {/* 2. قيمة خصم العرض / Discount */}
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thTextAr}>قيمة خصم العرض</Text>
              <Text style={styles.thTextEn}>Discount</Text>
            </View>

            {/* 3. السعر قبل الضريبة / Unit Price */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thTextAr}>السعر قبل الضريبة</Text>
              <Text style={styles.thTextEn}>Unit Price</Text>
            </View>

            {/* 4. الكمية / QTY */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>QTY</Text>
            </View>

            {/* 5. الوحدة / Unit */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>الوحدة</Text>
              <Text style={styles.thTextEn}>Unit</Text>
            </View>

            {/* 6. وصف الصنف / Description */}
            <View style={[styles.thCell, { width: "34%" }]}>
              <Text style={styles.thTextAr}>وصف الصنف</Text>
              <Text style={styles.thTextEn}>Description</Text>
            </View>

            {/* 7. مسلسل / Sr. No */}
            <View style={[styles.thCell, { width: "8%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextAr}>مسلسل</Text>
              <Text style={styles.thTextEn}>Sr. No</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {invoice.items.map((item, index) => {
            const itemCode = (item as any).itemCode || (item as any).sku || "81486553";
            const unitName = (item as any).unit || "واحد";
            const lineTotal = Number(item.lineTotal || (Number(item.unitPrice || 0) * Number(item.quantity || 1)));

            return (
              <View key={item.position ?? index} style={styles.tableBodyRow}>
                {/* 1. Total Price */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(lineTotal)}</Text>
                </View>

                {/* 2. Discount */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdCenter}>0.00</Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 4. QTY */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.quantity)}</Text>
                </View>

                {/* 5. Unit */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{unitName}</Text>
                </View>

                {/* 6. Description */}
                <View style={[styles.tdCell, { width: "34%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdCodeText}>كود : {itemCode}</Text>
                  <Text style={styles.tdDescText}>{item.description}</Text>
                </View>

                {/* 7. Sr. No */}
                <View style={[styles.tdCell, { width: "8%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>
              </View>
            );
          })}

          {/* Total Quantity Sub-Bar */}
          <View style={styles.totalQtyRow}>
            <Text style={styles.totalQtyVal}>{formatNumber(totalQty)}</Text>
            <Text style={styles.totalQtyLabel}>Total Quantity / اجمالي الكمية</Text>
          </View>
        </View>

        {/* ─── 5. BOTTOM SECTION: DUAL SUMMARY CARDS ─── */}
        <View style={styles.bottomCardsWrap}>
          {/* Card 1 (Left): Amounts & Taxes Breakdown */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardRow}>
              <Text style={styles.cardVal}>{itemCount}</Text>
              <Text style={styles.cardKey}>Item Purchase Total</Text>
              <Text style={styles.cardKeyAr}>عدد الأصناف المشتراه</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardVal}>{formatNumber(discountVal)}</Text>
              <Text style={styles.cardKey}>Total Discounts</Text>
              <Text style={styles.cardKeyAr}>إجمالي خصم العروض</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatNumber(subtotalVal)}</Text>
              <Text style={styles.cardKey}>Total Before VAT</Text>
              <Text style={styles.cardKeyAr}>الإجمالي قبل الضريبة</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatNumber(vatVal)}</Text>
              <Text style={styles.cardKey}>VAT</Text>
              <Text style={styles.cardKeyAr}>ضريبة القيمة المضافة</Text>
            </View>

            <View style={[styles.summaryCardRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.cardValBold}>﷼ {formatNumber(totalVal)}</Text>
              <Text style={styles.cardKey}>Total Amount</Text>
              <Text style={styles.cardKeyAr}>المبلغ الكلي</Text>
            </View>
          </View>

          {/* Card 2 (Right): Payment Details */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatNumber(totalVal)}</Text>
              <Text style={styles.cardKey}>Paid</Text>
              <Text style={styles.cardKeyAr}>مدفوع</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatNumber(totalVal)} (نقدا)</Text>
              <Text style={styles.cardKey}>Paid by</Text>
              <Text style={styles.cardKeyAr}>مدفوع بواسطة</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardVal}>{dateTimeStr}</Text>
              <Text style={styles.cardKey}>Paid Date</Text>
              <Text style={styles.cardKeyAr}>تاريخ الدفع</Text>
            </View>

            <View style={[styles.summaryCardRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.cardVal}>0.00</Text>
              <Text style={styles.cardKey}>Balance</Text>
              <Text style={styles.cardKeyAr}>الرصيد</Text>
            </View>
          </View>
        </View>

        {/* ─── 6. AUDIT / CREATOR FOOTER BOX ─── */}
        <View style={styles.auditBox}>
          {company.clientEmployee ? (
            <Text style={styles.auditText}>تم الانشاء بواسطة : {company.clientEmployee}</Text>
          ) : null}
          <Text style={styles.auditText}>تاريخ : {dateTimeStr}</Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header Title ───
  headerTitleWrap: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },

  // ─── Barcode & Metadata ───
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  barcodeBox: {
    width: 64,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
  },
  qrImage: {
    width: 64,
    height: 64,
    objectFit: "contain",
  },
  metaInfoBox: {
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 8,
    color: "#1E293B",
    marginBottom: 2,
    textAlign: "right",
  },

  // ─── Parties ───
  partiesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  receiverCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  issuerCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  partyRoleLabel: {
    fontSize: 8,
    color: "#64748B",
    textAlign: "right",
    marginBottom: 2,
  },
  partyNameBold: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 8,
    color: "#334155",
    textAlign: "right",
    marginBottom: 1.5,
  },

  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#DCEAF5",
    borderBottomWidth: 1,
    borderBottomColor: "#93C5FD",
    minHeight: 28,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#CBD5E1",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    minHeight: 28,
    alignItems: "center",
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 8,
    color: "#1E293B",
    textAlign: "center",
  },
  tdCodeText: {
    fontSize: 7.5,
    color: "#64748B",
    textAlign: "right",
    marginBottom: 1,
  },
  tdDescText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },

  totalQtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
  },
  totalQtyVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1E293B",
  },
  totalQtyLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1E293B",
  },

  // ─── Bottom Summary Cards ───
  bottomCardsWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  summaryCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  cardKey: {
    fontSize: 7,
    color: "#475569",
    textAlign: "left",
  },
  cardKeyAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },
  cardVal: {
    fontSize: 7.5,
    color: "#0F172A",
    textAlign: "left",
  },
  cardValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "left",
  },

  // ─── Audit Footer Box ───
  auditBox: {
    width: 200,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 6,
    alignItems: "flex-end",
    backgroundColor: "#FAFAFA",
  },
  auditText: {
    fontSize: 7.5,
    color: "#475569",
    textAlign: "right",
    marginBottom: 1.5,
  },
});
