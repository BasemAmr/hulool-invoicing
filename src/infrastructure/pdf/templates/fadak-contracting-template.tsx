import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface FadakContractingTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

// ─── Number & Date Helpers ────────────────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  let str: string;
  if (typeof val === "number") {
    str = Number.isFinite(val) ? String(Number(val.toFixed(10))) : "0.00";
  } else {
    str = String(val).trim();
  }
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1];
  if (decPart === undefined) {
    decPart = "00";
  } else if (decPart.length === 1) {
    decPart = `${decPart}0`;
  }
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = `${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

function formatQty(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateSlash(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FadakContractingTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: FadakContractingTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateFormatted = formatDateSlash(invoice.issueDate);
  const dueDateFormatted = formatDateSlash(invoice.dueDate || invoice.issueDate);

  // Address assembly - strict dynamic data only
  const companyAddressLine1 = company.addressStreet || "";
  const companyAddressLine2 = [
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
  ].filter(Boolean).join(" - ");

  const companyRegLine = [
    company.crNumber ? `سجل تجاري ${company.crNumber}` : null,
    company.vatNumber ? `رقم ضريبي ${company.vatNumber}` : null,
  ].filter(Boolean).join(" - ");

  const customerCityPostal = [
    customer.addressCity ? `RUH ${customer.addressCity}` : null,
    customer.addressPostalCode,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
  ].filter(Boolean).join(" ");

  const customerBuildingAdditional = [
    customer.addressBuildingNumber,
    customer.addressAdditionalNumber,
  ].filter(Boolean).join(" ");

  // Line Items processing
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate = item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  // Dynamic height sizing
  const extraItemsCount = Math.max(0, rows.length - 4);
  let extraHeight = extraItemsCount * 28;
  if (invoice.notes) {
    extraHeight += 20 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  }
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoiceNumber}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Fadak Contracting"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO (LEFT) | COMPANY DETAILS (RIGHT) ─── */}
        <View style={styles.topHeaderRow}>
          {/* Logo (Top Left) */}
          <View style={styles.logoCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>

          {/* Company Info (Top Right) */}
          <View style={styles.companyInfoCol}>
            {company.nameAr ? <Text style={styles.companyNameAr}>{company.nameAr}</Text> : null}
            {companyAddressLine1 ? <Text style={styles.companyMetaText}>{companyAddressLine1}</Text> : null}
            {companyAddressLine2 ? <Text style={styles.companyMetaText}>{companyAddressLine2}</Text> : null}
            {companyRegLine ? <Text style={styles.companyMetaText}>{companyRegLine}</Text> : null}
          </View>
        </View>

        {/* ─── 2. MID SECTION: QR (LEFT) | BUYER INFO (RIGHT) ─── */}
        <View style={styles.midSectionRow}>
          {/* Left: QR Code & Title */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.draftText}>DRAFT</Text>
              </View>
            )}
            <Text style={styles.qrTaxInvoiceText}>Tax Invoice</Text>
          </View>

          {/* Right: Buyer / Customer Info */}
          <View style={styles.buyerInfoCol}>
            {customer.nameAr ? <Text style={styles.buyerNameAr}>{customer.nameAr}</Text> : null}
            {customer.addressStreet ? (
              <Text style={styles.buyerAddressText}>{customer.addressStreet}</Text>
            ) : null}
            {customer.addressDistrict ? (
              <Text style={styles.buyerAddressText}>حي {customer.addressDistrict}</Text>
            ) : null}
            {customerCityPostal ? (
              <Text style={styles.buyerAddressText}>{customerCityPostal}</Text>
            ) : null}
            {customerBuildingAdditional ? (
              <Text style={styles.buyerAddressText}>{customerBuildingAdditional}</Text>
            ) : null}
            <Text style={styles.buyerAddressText}>Saudi Arabia</Text>
            {customer.vatNumber ? (
              <Text style={styles.buyerVatText}>VAT Number: {customer.vatNumber}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── 3. TITLES & METADATA BAR ─── */}
        <View style={styles.titleMetaBar}>
          {/* Center: Large Invoice Number */}
          <Text style={styles.invoiceNumberLarge}>{invoiceNumber}</Text>

          {/* Right: Tax Invoice Arabic */}
          <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
        </View>

        {/* 3-Row Metadata Table below Invoice Number */}
        <View style={styles.metaTable}>
          {/* Invoice Date */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaLabelEn}>Invoice Date:</Text>
            <Text style={styles.metaVal}>{issueDateFormatted}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ الفاتورة</Text>
          </View>
          {/* Due Date */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaLabelEn}>Due Date:</Text>
            <Text style={styles.metaVal}>{dueDateFormatted}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ الاستحقاق</Text>
          </View>
          {/* Delivery Date */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaLabelEn}>Delivery Date:</Text>
            <Text style={styles.metaVal}>{issueDateFormatted}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ التوصيل</Text>
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (7 COLUMNS, RTL ORDER) ─── */}
        <View style={styles.table}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Description (Right) */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>DESCRIPTION</Text>
            </View>

            {/* 2. Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>QUANTITY</Text>
            </View>

            {/* 3. Unit Price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>UNIT PRICE</Text>
            </View>

            {/* 4. Taxes */}
            <View style={[styles.thCell, styles.colTaxes]}>
              <Text style={styles.thAr}>الضرائب</Text>
              <Text style={styles.thEn}>TAXES</Text>
            </View>

            {/* 5. Amount */}
            <View style={[styles.thCell, styles.colAmount]}>
              <Text style={styles.thAr}>مبلغ</Text>
              <Text style={styles.thEn}>AMOUNT</Text>
            </View>

            {/* 6. VAT Amount */}
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT AMOUNT</Text>
            </View>

            {/* 7. Total Price (Left) */}
            <View style={[styles.thCell, styles.colTotal, { borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>السعر الاجمالي</Text>
              <Text style={styles.thEn}>TOTAL PRICE</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* Description */}
              <View style={[styles.tdCell, styles.colDesc]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>

              {/* Quantity */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterText}>{formatQty(row.qty)} Units</Text>
              </View>

              {/* Unit Price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>

              {/* Taxes */}
              <View style={[styles.tdCell, styles.colTaxes]}>
                <Text style={styles.tdCenterText}>Sales Tax {row.vatRate}%</Text>
              </View>

              {/* Amount */}
              <View style={[styles.tdCell, styles.colAmount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.taxableSubtotal)} SR</Text>
              </View>

              {/* VAT Amount */}
              <View style={[styles.tdCell, styles.colVat]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineVat)}</Text>
              </View>

              {/* Total Price */}
              <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineTotal)} SR</Text>
              </View>
            </View>
          ))}

          {/* Optional In-Table Notes Row */}
          {invoice.notes ? (
            <View style={styles.tableNotesRow} wrap={false}>
              <Text style={styles.tableNotesText}>{invoice.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ─── 5. TOTALS CARD (ALIGNED TO LEFT) ─── */}
        <View style={styles.totalsCard} wrap={false}>
          {/* Row 1: Subtotal */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(taxableAmount)} SR</Text>
            <Text style={styles.totalsLabel}>Subtotal / الإجمالي الفرعي</Text>
          </View>

          {/* Row 2: VAT Taxes */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(totalVat)} SR</Text>
            <Text style={styles.totalsLabel}>VAT Taxes</Text>
          </View>

          {/* Row 3: Total (Shaded Grey) */}
          <View style={[styles.totalsRow, styles.totalsRowShaded]}>
            <Text style={[styles.totalsVal, styles.bold]}>{formatExactAmount(grandTotal)} SR</Text>
            <Text style={[styles.totalsLabel, styles.bold]}>Total / المجموع</Text>
          </View>
        </View>

        {/* ─── 6. PAYMENT REFERENCE ─── */}
        <View style={styles.paymentRefRow} wrap={false}>
          <Text style={styles.paymentRefText}>Payment Reference :</Text>
          <Text style={styles.paymentRefVal}>{invoiceNumber}</Text>
          <Text style={styles.paymentRefText}>: رقم إشارة الدفعة</Text>
        </View>

        {/* ─── 7. BOTTOM FOOTER & DIVIDER ─── */}
        <View style={styles.footerWrap} wrap={false}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerPageText}>Page: 1 / 1</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES (PURE TAJAWAL TYPOGRAPHY) ─────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 26,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  bold: {
    fontWeight: "bold",
  },

  // 1. Top Header Row
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logoCol: {
    width: 80,
    alignItems: "flex-start",
  },
  logoImage: {
    width: 65,
    height: 65,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
  },
  companyInfoCol: {
    alignItems: "flex-end",
    textAlign: "right",
    maxWidth: "70%",
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10,
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  companyMetaText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#222222",
    marginBottom: 1.5,
    textAlign: "right",
  },

  // 2. Mid Section (QR & Buyer Info)
  midSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  qrCol: {
    width: 85,
    alignItems: "flex-start",
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: "#999999",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 7.5,
    color: "#999999",
  },
  qrTaxInvoiceText: {
    fontFamily: "Tajawal",
    fontSize: 10,
    color: "#000000",
    marginTop: 3,
  },
  buyerInfoCol: {
    alignItems: "flex-end",
    textAlign: "right",
    maxWidth: "65%",
  },
  buyerNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  buyerAddressText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#222222",
    marginBottom: 1,
    textAlign: "right",
  },
  buyerVatText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    marginTop: 2,
    textAlign: "right",
  },

  // 3. Title & Metadata Bar
  titleMetaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingLeft: 140,
  },
  invoiceNumberLarge: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
  },
  invoiceTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
  },
  metaTable: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  metaTableRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: 1,
    width: 240,
  },
  metaLabelEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    width: 80,
    textAlign: "left",
  },
  metaVal: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    width: 80,
    textAlign: "center",
  },
  metaLabelAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    width: 80,
    textAlign: "right",
  },

  // 4. Line Items Table
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 24,
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 20,
    alignItems: "center",
  },
  tableNotesRow: {
    flexDirection: "row-reverse",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableNotesText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  thCell: {
    borderLeftWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths (Sum = 100%)
  colDesc: { width: "18%" },
  colQty: { width: "15%" },
  colPrice: { width: "12%" },
  colTaxes: { width: "15%" },
  colAmount: { width: "13%" },
  colVat: { width: "12%" },
  colTotal: { width: "15%" },

  // 5. Totals Card
  totalsCard: {
    width: "45%",
    borderWidth: 1,
    borderColor: "#000000",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  totalsRowShaded: {
    backgroundColor: "#D1D5DB",
    borderBottomWidth: 0,
  },
  totalsVal: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  totalsLabel: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  // 6. Payment Reference
  paymentRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  paymentRefText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
  },
  paymentRefVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },

  // 7. Footer
  footerWrap: {
    marginTop: "auto",
    alignItems: "center",
  },
  footerDivider: {
    width: "100%",
    height: 1.8,
    backgroundColor: "#000000",
    marginBottom: 4,
  },
  footerPageText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
});
