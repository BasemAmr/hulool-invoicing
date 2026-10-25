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

export interface AlQahwaAlAlamiahTemplateProps {
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

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

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

function formatDateISO(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlQahwaAlAlamiahTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: AlQahwaAlAlamiahTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Dates
  const issueDateStr = formatDateISO(invoice.issueDate);
  const dueDateStr = formatDateISO(invoice.dueDate || invoice.issueDate);
  const sourceCode = (invoice as { sourceCode?: string }).sourceCode || (customer as { customerCode?: string }).customerCode || customer.clientEmployee || "-";
  const invNumber = invoice.invoiceNumber ?? "";

  // Calculations
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

    const itemCode = (item as { itemCode?: string }).itemCode || (item.savedProductId ? item.savedProductId.slice(0, 7) : "") || "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      code: itemCode,
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

  // Addresses - strict dynamic data only
  const companyAddressParts = [
    company.addressCity,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressPostalCode,
  ].filter(Boolean).join(" - ");

  const customerAddressLine1 = customer.addressStreet || "";
  const customerAddressLine2 = customer.addressDistrict || "";
  const customerCityZip = [customer.addressCity, customer.addressPostalCode].filter(Boolean).join(" ");
  const customerBuildingAdditional = [customer.addressBuildingNumber, customer.addressAdditionalNumber].filter(Boolean).join(" ");

  // Dynamic height sizing
  const extraItemsCount = Math.max(0, rows.length - 5);
  let extraHeight = extraItemsCount * 36;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invNumber}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="TAX INVOICE - AL QAHWA AL ALAMIAH"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP RIGHT COMPANY BLOCK WITH LOGO ─── */}
        <View style={styles.topRightHeaderRow}>
          <View style={styles.companyMetaCol}>
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            {company.nameAr ? <Text style={styles.companyNameAr}>{company.nameAr}</Text> : null}
            {companyAddressParts ? <Text style={styles.companyAddress}>{companyAddressParts}</Text> : null}
            {company.vatNumber ? <Text style={styles.companyVat}>VAT: {company.vatNumber}</Text> : null}
          </View>
          {logoSource ? (
            <View style={styles.logoWrap}>
              <Image src={logoSource} style={styles.logoImage} />
            </View>
          ) : null}
        </View>

        {/* ─── 2. MID SECTION: QR (LEFT) + BUYER INFO (RIGHT) ─── */}
        <View style={styles.midSectionRow}>
          {/* Left: Large ZATCA 2D QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.draftText}>DRAFT</Text>
              </View>
            )}
          </View>

          {/* Right: Buyer / Customer Info */}
          <View style={styles.buyerCol}>
            {customer.nameAr ? <Text style={styles.buyerNameAr}>{customer.nameAr}</Text> : null}
            {customerAddressLine1 ? <Text style={styles.buyerAddressLine}>{customerAddressLine1}</Text> : null}
            {customerAddressLine2 ? <Text style={styles.buyerAddressLine}>{customerAddressLine2}</Text> : null}
            {customerCityZip ? <Text style={styles.buyerAddressLine}>{customerCityZip}</Text> : null}
            {customerBuildingAdditional ? <Text style={styles.buyerAddressLine}>{customerBuildingAdditional}</Text> : null}
            <Text style={styles.buyerAddressLine}>المملكة العربية السعودية</Text>
            {customer.vatNumber ? (
              <View style={styles.buyerMetaGroup}>
                <Text style={styles.buyerMetaLabel}>رقم تسجيل ضريبة القيمة المضافة:</Text>
                <Text style={styles.buyerMetaVal}>{customer.vatNumber}</Text>
              </View>
            ) : null}
            {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber ? (
              <View style={styles.buyerMetaGroup}>
                <Text style={styles.buyerMetaLabel}>
                  رقم التسجيل التجاري: {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. TITLES & METADATA BAR ─── */}
        <View style={styles.titleMetaBar}>
          {/* Left: Tax Invoice Title */}
          <Text style={styles.taxInvoiceTitleAr}>فاتورة الضريبة</Text>

          {/* Center: Large Invoice Number */}
          <Text style={styles.invoiceNumberLarge}>{invNumber}</Text>

          {/* Right: Tax Invoice Title */}
          <Text style={styles.taxInvoiceTitleAr}>فاتورة ضريبية</Text>
        </View>

        {/* 3-Column Metadata Row (English / Value / Arabic) */}
        <View style={styles.metaGridRow}>
          {/* Invoice Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Invoice Date:</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ الفاتورة</Text>
          </View>

          {/* Due Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Due Date:</Text>
            <Text style={styles.metaVal}>{dueDateStr}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ الاستحقاق</Text>
          </View>

          {/* Supply Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Supply Date:</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
            <Text style={styles.metaLabelAr}>: تاريخ التوريد</Text>
          </View>

          {/* Source */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Source:</Text>
            <Text style={styles.metaVal}>{sourceCode}</Text>
            <Text style={styles.metaLabelAr}>: المصدر</Text>
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (RTL ORDER) ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL: Description on Right, Total Incl. VAT on Left) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Description / الوصف (Right) */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>

            {/* 2. Quantity / الكمية */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>

            {/* 3. Unit Price / سعر الوحدة */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit price</Text>
            </View>

            {/* 4. Taxes / نسبة الضريبة */}
            <View style={[styles.thCell, styles.colTaxes]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>Taxes</Text>
            </View>

            {/* 5. Subtotal Excl. VAT / المجموع الفرعي بدون الضريبة */}
            <View style={[styles.thCell, styles.colSubtotal]}>
              <Text style={styles.thAr}>المجموع الفرعي بدون الضريبة</Text>
              <Text style={styles.thEn}>Subtotal (exclusive of VAT)</Text>
            </View>

            {/* 6. VAT Amount / قيمة الضريبة */}
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>

            {/* 7. Subtotal Incl. VAT / المجموع شامل ضريبة القيمة المضافة (Left) */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thAr}>المجموع شامل ضريبة القيمة المضافة</Text>
              <Text style={styles.thEn}>Subtotal (inclusive of VAT)</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* Description */}
              <View style={[styles.tdCell, styles.colDesc]}>
                {row.code ? <Text style={styles.tdDescCode}>[{row.code}]</Text> : null}
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>

              {/* Quantity */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdQtyText}>{formatQty(row.qty)} الوحدات</Text>
              </View>

              {/* Unit Price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdAmountText}>{formatExactAmount(row.unitPrice)} SR</Text>
              </View>

              {/* Taxes */}
              <View style={[styles.tdCell, styles.colTaxes]}>
                <Text style={styles.tdTaxText}>Sales Tax</Text>
                <Text style={styles.tdTaxText}>{row.vatRate}%</Text>
              </View>

              {/* Subtotal Excl. VAT */}
              <View style={[styles.tdCell, styles.colSubtotal]}>
                <Text style={styles.tdAmountText}>{formatExactAmount(row.taxableSubtotal)} SR</Text>
              </View>

              {/* VAT Amount */}
              <View style={[styles.tdCell, styles.colVat]}>
                <Text style={styles.tdAmountText}>{formatExactAmount(row.lineVat)} SR</Text>
              </View>

              {/* Subtotal Incl. VAT */}
              <View style={[styles.tdCell, styles.colTotal]}>
                <Text style={styles.tdAmountBold}>{formatExactAmount(row.lineTotal)} SR</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 5. TOTALS CARD ─── */}
        <View style={styles.totalsCard} wrap={false}>
          {/* Row 1: Taxable Amount */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(taxableAmount)} SR</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelEn}>Invoice Taxable Amount /</Text>
              <Text style={styles.totalsLabelAr}>المبلغ الخاضع للضريبة غير شامل ضريبة القيمة المضافة</Text>
            </View>
          </View>

          {/* Row 2: VAT Amount */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(totalVat)} SR</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelAr}>ضريبة القيمة المضافة / Taxes 15%</Text>
            </View>
          </View>

          {/* Row 3: Grand Total (Highlighted in Orange) */}
          <View style={[styles.totalsRow, styles.totalsRowGrand]}>
            <Text style={[styles.totalsVal, styles.totalsValGrand]}>{formatExactAmount(grandTotal)} SR</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelOrange}>
                Invoice Total (inclusive of VAT) / إجمالي قيمة الفاتورة شامل ضريبة القيمة المضافة
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 6. PAYMENT REFERENCE FOOTER ─── */}
        <View style={styles.paymentRefRow} wrap={false}>
          <Text style={styles.paymentRefText}>Payment Reference: {invNumber}</Text>
          <Text style={styles.paymentRefText}>رقم إشارة الدفعة: {invNumber}</Text>
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
    opacity: 0.04,
  },

  // 1. Top Right Company Header
  topRightHeaderRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  companyMetaCol: {
    alignItems: "flex-end",
    textAlign: "right",
    marginRight: 10,
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#333333",
    marginBottom: 1,
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  companyAddress: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 2,
    textAlign: "right",
  },
  companyVat: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    textAlign: "right",
  },
  logoWrap: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 52,
    height: 52,
    objectFit: "contain",
  },

  // 2. Mid Section: QR Left & Buyer Right
  midSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  qrCol: {
    width: 100,
    alignItems: "flex-start",
  },
  qrImage: {
    width: 95,
    height: 95,
  },
  qrPlaceholder: {
    width: 95,
    height: 95,
    borderWidth: 1,
    borderColor: "#999999",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#999999",
  },
  buyerCol: {
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
  buyerAddressLine: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 1,
    textAlign: "right",
  },
  buyerMetaGroup: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  buyerMetaLabel: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    textAlign: "right",
  },
  buyerMetaVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "right",
  },

  // 3. Title & Meta Bar
  titleMetaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  taxInvoiceTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
  },
  invoiceNumberLarge: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 14,
    color: "#000000",
  },
  metaGridRow: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: 1,
    width: 260,
  },
  metaLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#0284C7",
    width: 80,
    textAlign: "left",
  },
  metaVal: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    width: 90,
    textAlign: "center",
  },
  metaLabelAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#0284C7",
    width: 90,
    textAlign: "right",
  },

  // 4. Line Items Table
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 4,
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderColor: "#E2E8F0",
    alignItems: "flex-start",
  },
  thCell: {
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdCell: {
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#333333",
    textAlign: "center",
  },
  tdDescCode: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  tdQtyText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  tdAmountText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  tdAmountBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  tdTaxText: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (Sum = 100%)
  colDesc: { width: "26%" },
  colQty: { width: "12%" },
  colPrice: { width: "13%" },
  colTaxes: { width: "11%" },
  colSubtotal: { width: "13%" },
  colVat: { width: "11%" },
  colTotal: { width: "14%" },

  // 5. Totals Card
  totalsCard: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalsRowGrand: {
    paddingVertical: 3,
  },
  totalsVal: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#000000",
    minWidth: 80,
    textAlign: "left",
  },
  totalsValGrand: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },
  totalsLabelGroup: {
    alignItems: "flex-end",
    textAlign: "right",
  },
  totalsLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#333333",
    textAlign: "right",
  },
  totalsLabelAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  totalsLabelOrange: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#D97706",
    textAlign: "right",
  },

  // 6. Payment Reference Footer
  paymentRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 4,
  },
  paymentRefText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
  },
});
