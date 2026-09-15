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

export interface StructuredBilingualTemplateProps {
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

export function StructuredBilingualTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: StructuredBilingualTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);
  const supplyDateStr = formatDate(invoice.dueDate || invoice.issueDate);

  // Seller Details
  const sellerName = company.nameAr || "";
  const sellerBuilding = company.addressBuildingNumber || "";
  const sellerStreet = company.addressStreet || "";
  const sellerDistrict = company.addressDistrict || "";
  const sellerCity = company.addressCity || "";
  const sellerState = "";
  const sellerCountry = "المملكة العربية السعودية";
  const sellerPostalCode = company.addressPostalCode || "";
  const sellerAdditionalNo = company.addressAdditionalNumber || "";
  const sellerVat = company.vatNumber || "";
  // Admin-only clientEmployee ("تابع للعميل") must never print on PDFs —
  // Other Seller ID falls back to the commercial registration only.
  const sellerOtherId = company.crNumber || "";

  // Buyer Details
  const buyerName = customer.nameAr || "";
  const buyerBuilding = "";
  const buyerStreet = customer.addressStreet || "";
  const buyerDistrict = "";
  const buyerCity = customer.addressCity || "";
  const buyerState = "";
  const buyerCountry = "المملكة العربية السعودية";
  const buyerPostalCode = customer.addressPostalCode || "";
  const buyerAdditionalNo = "";
  const buyerVat = customer.vatNumber || "";
  const buyerOtherId = customer.unifiedNumber || "";

  const items = invoice.items || [];

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={sellerName}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ─── */}
        <View style={styles.headerRow}>
          {/* Left: Invoice Metadata */}
          <View style={styles.headerLeftMeta}>
            {/* Row 1: Invoice Number */}
            <View style={styles.metaRow}>
              <Text style={styles.metaKeyEn}>Invoice Number</Text>
              <Text style={styles.metaVal}>{invoiceNum}</Text>
              <Text style={styles.metaKeyAr}>رقم الفاتورة</Text>
            </View>

            {/* Row 2: Invoice Issue Date */}
            <View style={styles.metaRow}>
              <Text style={styles.metaKeyEn}>Invoice Issue Date</Text>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
              <Text style={styles.metaKeyAr}>تاريخ إصدار الفاتورة</Text>
            </View>

            {/* Row 3: Date of Supply */}
            <View style={styles.metaRow}>
              <Text style={styles.metaKeyEn}>Date of Supply</Text>
              <Text style={styles.metaVal}>{supplyDateStr}</Text>
              <Text style={styles.metaKeyAr}>تاريخ التوريد</Text>
            </View>
          </View>

          {/* Center: Main Title and optional Logo */}
          <View style={styles.headerCenterTitle}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.headerLogo} />
            ) : null}
            <Text style={styles.titleAr}>فاتورة ضريبية</Text>
            <Text style={styles.titleEn}>Tax Invoice</Text>
          </View>

          {/* Right: Frameless ZATCA QR Code */}
          <View style={styles.headerRightQr}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 2. DUAL PARTY CARDS: SELLER & BUYER ─── */}
        <View style={styles.partiesTable}>
          {/* Header Row: Seller | Buyer */}
          <View style={styles.partiesHeaderRow}>
            {/* Left: Seller Header */}
            <View style={styles.partyHeaderHalf}>
              <Text style={styles.partyHeaderEn}>Seller</Text>
              <Text style={styles.partyHeaderAr}>تاجر</Text>
            </View>

            {/* Right: Buyer Header */}
            <View style={[styles.partyHeaderHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
              <Text style={styles.partyHeaderEn}>Buyer</Text>
              <Text style={styles.partyHeaderAr}>العميل</Text>
            </View>
          </View>

          {/* Body: 11 Structured Rows */}
          <View style={styles.partiesBody}>
            {/* Row 1: Name */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Name</Text>
                <Text style={styles.partyValCenter}>{sellerName}</Text>
                <Text style={styles.partyKeyAr}>اسم</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Name</Text>
                <Text style={styles.partyValCenter}>{buyerName}</Text>
                <Text style={styles.partyKeyAr}>اسم</Text>
              </View>
            </View>

            {/* Row 2: Building No. */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Building No.</Text>
                <Text style={styles.partyValCenter}>{sellerBuilding}</Text>
                <Text style={styles.partyKeyAr}>رقم المبنى</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Building No.</Text>
                <Text style={styles.partyValCenter}>{buyerBuilding}</Text>
                <Text style={styles.partyKeyAr}>رقم المبنى</Text>
              </View>
            </View>

            {/* Row 3: Street Name */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Street Name</Text>
                <Text style={styles.partyValCenter}>{sellerStreet}</Text>
                <Text style={styles.partyKeyAr}>اسم الشارع</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Street Name</Text>
                <Text style={styles.partyValCenter}>{buyerStreet}</Text>
                <Text style={styles.partyKeyAr}>اسم الشارع</Text>
              </View>
            </View>

            {/* Row 4: District */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>District</Text>
                <Text style={styles.partyValCenter}>{sellerDistrict}</Text>
                <Text style={styles.partyKeyAr}>المنطقة</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>District</Text>
                <Text style={styles.partyValCenter}>{buyerDistrict}</Text>
                <Text style={styles.partyKeyAr}>المنطقة</Text>
              </View>
            </View>

            {/* Row 5: City */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>City</Text>
                <Text style={styles.partyValCenter}>{sellerCity}</Text>
                <Text style={styles.partyKeyAr}>مدينة</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>City</Text>
                <Text style={styles.partyValCenter}>{buyerCity}</Text>
                <Text style={styles.partyKeyAr}>مدينة</Text>
              </View>
            </View>

            {/* Row 6: Province/State */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Province/State</Text>
                <Text style={styles.partyValCenter}>{sellerState}</Text>
                <Text style={styles.partyKeyAr}>الولاية/المقاطعة</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Province/State</Text>
                <Text style={styles.partyValCenter}>{buyerState}</Text>
                <Text style={styles.partyKeyAr}>الولاية/المقاطعة</Text>
              </View>
            </View>

            {/* Row 7: Country */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Country</Text>
                <Text style={styles.partyValCenter}>{sellerCountry}</Text>
                <Text style={styles.partyKeyAr}>دولة</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Country</Text>
                <Text style={styles.partyValCenter}>{buyerCountry}</Text>
                <Text style={styles.partyKeyAr}>دولة</Text>
              </View>
            </View>

            {/* Row 8: Postal Code */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Postal Code</Text>
                <Text style={styles.partyValCenter}>{sellerPostalCode}</Text>
                <Text style={styles.partyKeyAr}>رمز بريدي</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Postal Code</Text>
                <Text style={styles.partyValCenter}>{buyerPostalCode}</Text>
                <Text style={styles.partyKeyAr}>رمز بريدي</Text>
              </View>
            </View>

            {/* Row 9: Additional No. */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Additional No.</Text>
                <Text style={styles.partyValCenter}>{sellerAdditionalNo}</Text>
                <Text style={styles.partyKeyAr}>رقم إضافي</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Additional No.</Text>
                <Text style={styles.partyValCenter}>{buyerAdditionalNo}</Text>
                <Text style={styles.partyKeyAr}>رقم إضافي</Text>
              </View>
            </View>

            {/* Row 10: VAT Number */}
            <View style={styles.partyRow}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>VAT Number</Text>
                <Text style={styles.partyValCenter}>{sellerVat}</Text>
                <Text style={styles.partyKeyAr}>رقم ضريبة القيمة المضافة</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>VAT Number</Text>
                <Text style={styles.partyValCenter}>{buyerVat}</Text>
                <Text style={styles.partyKeyAr}>رقم ضريبة القيمة المضافة</Text>
              </View>
            </View>

            {/* Row 11: Other ID */}
            <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
              <View style={styles.partyCellHalf}>
                <Text style={styles.partyKeyEn}>Other Seller ID</Text>
                <Text style={styles.partyValCenter}>{sellerOtherId}</Text>
                <Text style={styles.partyKeyAr}>معرف آخر</Text>
              </View>
              <View style={[styles.partyCellHalf, { borderLeftWidth: 1, borderLeftColor: "#000000" }]}>
                <Text style={styles.partyKeyEn}>Other Buyer ID</Text>
                <Text style={styles.partyValCenter}>{buyerOtherId}</Text>
                <Text style={styles.partyKeyAr}>معرف آخر</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE (GREY HEADER) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Goods or Services */}
            <View style={[styles.thCell, { width: "24%" }]}>
              <Text style={styles.thEn}>Goods or Services</Text>
              <Text style={styles.thAr}>السلع أو الخدمات</Text>
            </View>

            {/* 2. Qty */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thEn}>Qty</Text>
              <Text style={styles.thAr}>الكمية</Text>
            </View>

            {/* 3. Unit Price */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thEn}>Unit Price</Text>
              <Text style={styles.thAr}>سعر الوحدة</Text>
            </View>

            {/* 4. Taxable Amount */}
            <View style={[styles.thCell, { width: "16%" }]}>
              <Text style={styles.thEn}>Taxable Amount</Text>
              <Text style={styles.thAr}>المبلغ الخاضع للضريبة</Text>
            </View>

            {/* 5. Tax Rate */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thEn}>Tax Rate</Text>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
            </View>

            {/* 6. Tax Amount */}
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thEn}>Tax Amount</Text>
              <Text style={styles.thAr}>مبلغ الضريبة</Text>
            </View>

            {/* 7. Subtotal (Including VAT) */}
            <View style={[styles.thCell, { width: "20%", borderRightWidth: 0 }]}>
              <Text style={styles.thEnBold}>Subtotal</Text>
              <Text style={styles.thEnSmall}>(Including VAT)</Text>
              <Text style={styles.thArBold}>المجموع الجزئي</Text>
              <Text style={styles.thArSmall}>(بما في ذلك ضريبة القيمة المضافة)</Text>
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
                {/* 1. Goods or Services */}
                <View style={[styles.tdCell, { width: "24%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. Qty */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdTextCenter}>{item.quantity}</Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 4. Taxable Amount */}
                <View style={[styles.tdCell, { width: "16%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineSubtotal)}</Text>
                </View>

                {/* 5. Tax Rate */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdTextCenter}>{vatPct}%</Text>
                </View>

                {/* 6. Tax Amount */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineVat, 2)}</Text>
                </View>

                {/* 7. Subtotal */}
                <View style={[styles.tdCell, { width: "20%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatNumber(item.lineTotal, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 4. BOTTOM AREA: PAYMENT METHOD & TOTALS ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Payment Method */}
          <View style={styles.paymentMethodCol}>
            <Text style={styles.paymentMethodEn}>Payment method</Text>
            <Text style={styles.paymentMethodAr}>طريقة الدفع او السداد</Text>
            <Text style={styles.paymentMethodVal}>
              {(invoice as any).paymentMethod === "card"
                ? "بطاقة ائتمان / مدى (Card)"
                : (invoice as any).paymentMethod === "transfer"
                ? "تحويل بنكي (Bank Transfer)"
                : "نقدي (Cash)"}
            </Text>
          </View>

          {/* Right: Totals Breakdown */}
          <View style={styles.totalsCol}>
            {/* Row 1: Total (Excluding VAT) */}
            <View style={styles.totalRow}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Total (Excluding VAT)</Text>
                <Text style={styles.totalLabelAr}>الاجمالي (غير شاملة ضريبة القمة المضافة)</Text>
              </View>
              <Text style={styles.totalVal}>{formatNumber(invoice.subtotal)} SAR</Text>
            </View>

            {/* Row 2: Total VAT */}
            <View style={[styles.totalRow, { borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 4 }]}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Total VAT</Text>
                <Text style={styles.totalLabelAr}>مجموع ضريبة القيمة المضافة</Text>
              </View>
              <Text style={styles.totalVal}>{formatNumber(invoice.vatAmount)} SAR</Text>
            </View>

            {/* Row 3: Total (Including VAT) */}
            <View style={[styles.totalRow, { borderBottomWidth: 1, borderBottomColor: "#000000", paddingVertical: 4 }]}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEnBold}>Total (Including VAT)</Text>
                <Text style={styles.totalLabelArBold}>الاجمالي (بما في ذلك ضريبة القيمة المضافة)</Text>
              </View>
              <Text style={styles.totalValBold}>{formatNumber(invoice.total)} SAR</Text>
            </View>

            {/* Row 4: Invoice Paid */}
            <View style={[styles.totalRow, { borderBottomWidth: 1, borderBottomColor: "#000000", paddingVertical: 4 }]}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Invoice Paid</Text>
                <Text style={styles.totalLabelAr}>الفاتورة مدفوعة</Text>
              </View>
              <Text style={styles.totalVal}>{formatNumber(invoice.total)} SAR</Text>
            </View>

            {/* Row 5: Balance Due (Grey Shaded Box) */}
            <View style={styles.balanceDueBox}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.balanceDueEn}>Balance Due</Text>
                <Text style={styles.balanceDueAr}>إجمالي المبلغ المستحق</Text>
              </View>
              <Text style={styles.balanceDueVal}>0 SAR</Text>
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
    fontSize: 8.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── 1. Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeftMeta: {
    width: "36%",
    flexDirection: "column",
    gap: 4,
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaKeyEn: {
    fontSize: 8,
    textAlign: "left",
    width: "42%",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    width: "28%",
  },
  metaKeyAr: {
    fontSize: 8,
    textAlign: "right",
    width: "30%",
  },

  headerCenterTitle: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  headerLogo: {
    maxWidth: 100,
    maxHeight: 50,
    objectFit: "contain",
    marginBottom: 4,
  },
  titleAr: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  titleEn: {
    fontSize: 13,
    textAlign: "center",
  },

  headerRightQr: {
    width: "25%",
    alignItems: "flex-end",
  },
  qrImage: {
    width: 86,
    height: 86,
  },

  // ─── 2. Dual Party Table ───
  partiesTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 14,
  },
  partiesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D1D5DB",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 18,
  },
  partyHeaderHalf: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  partyHeaderEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "left",
  },
  partyHeaderAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },

  partiesBody: {
    flexDirection: "column",
  },
  partyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 13,
  },
  partyCellHalf: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  partyKeyEn: {
    fontSize: 7,
    textAlign: "left",
    width: "28%",
  },
  partyValCenter: {
    fontSize: 7,
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
  partyKeyAr: {
    fontSize: 7,
    textAlign: "right",
    width: "32%",
  },

  // ─── 3. Items Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D1D5DB",
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thEn: {
    fontSize: 7.5,
    textAlign: "center",
    marginBottom: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEnBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEnSmall: {
    fontSize: 5.5,
    textAlign: "center",
  },
  thArBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thArSmall: {
    fontSize: 5.5,
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 24,
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdTextRight: {
    fontSize: 7.5,
    textAlign: "right",
  },
  tdTextCenter: {
    fontSize: 7.5,
    textAlign: "center",
  },

  // ─── 4. Bottom Area ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paymentMethodCol: {
    width: "40%",
    flexDirection: "column",
    alignItems: "flex-start",
    paddingTop: 10,
  },
  paymentMethodEn: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 1,
  },
  paymentMethodAr: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 2,
  },
  paymentMethodVal: {
    fontSize: 8.5,
    textAlign: "left",
  },

  totalsCol: {
    width: "46%",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalLabelGroup: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  totalLabelEn: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelAr: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelEnBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelArBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8,
    textAlign: "right",
  },
  totalValBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },

  balanceDueBox: {
    backgroundColor: "#D1D5DB",
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 3,
  },
  balanceDueEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  balanceDueAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  balanceDueVal: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
});
