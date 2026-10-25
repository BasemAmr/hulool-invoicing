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

export interface FoodstuffsFmcgTemplateProps {
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

function formatQty(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0";
  return num.toString();
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

function formatDateFormatted(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return clean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FoodstuffsFmcgTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  backgroundDataUrl,
}: FoodstuffsFmcgTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Invoice Dates & Times
  const invoiceDateStr = formatDateFormatted(invoice.issueDate);
  const deliveryDateStr = formatDateFormatted(invoice.dueDate || invoice.issueDate);
  const paymentTypeStr = invoice.invoiceType === "simplified" ? "Cash" : "Cash Credit";
  const invoiceTimeStr = invoice.issueTime ? `${invoice.issueTime}:00` : "";

  // Items processing
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;
  let totalQty = 0;

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
    totalQty += qty;

    const itemCode = (item as { itemCode?: string }).itemCode || (item.savedProductId ? item.savedProductId.slice(0, 8) : "") || String(item.position ?? idx + 1);

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
  const totalDiscountVal = computedDiscount + invoiceDiscount;
  const totalAfterDiscount = Math.max(0, taxableAmount - invoiceDiscount);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  // Address assembly - strict dynamic data only
  const companyAddressEn = [
    company.addressStreet,
    company.addressDistrict,
  ].filter(Boolean).join(" ");
  const companyUnitEn = company.addressBuildingNumber ? `Unit No ${company.addressBuildingNumber}` : "";
  const companyCityZipEn = [company.addressCity, company.addressPostalCode, company.addressAdditionalNumber].filter(Boolean).join(" ");

  const companyAddressAr = [
    company.addressBuildingNumber,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressStreet,
  ].filter(Boolean).join(" - ");
  const companyUnitAr = company.addressBuildingNumber ? `وحدة رقم ${company.addressBuildingNumber}` : "";
  const companyCityZipAr = [company.addressCity, company.addressPostalCode, company.addressAdditionalNumber].filter(Boolean).join(" ");

  const customerAddress = [
    customer.addressBuildingNumber,
    customer.addressStreet,
    customer.addressDistrict,
  ].filter(Boolean).join(" ");

  // Dynamic single-page height sizing
  const extraItemsCount = Math.max(0, rows.length - 7);
  let extraHeight = extraItemsCount * 28;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoice.invoiceNumber ?? "DRAFT"}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Foodstuffs FMCG"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. CENTER TITLE ─── */}
        <View style={styles.titleSection}>
          <Text style={styles.titleAr}>فاتورة ضريبية</Text>
          <Text style={styles.titleEn}>Tax Invoice</Text>
        </View>

        {/* ─── 2. DUAL COMPANY HEADER (EN LEFT / AR RIGHT) ─── */}
        <View style={styles.companyHeaderRow}>
          {/* Left: English Company Info */}
          <View style={styles.companyColEn}>
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            {companyAddressEn ? <Text style={styles.headerLineEn}>{companyAddressEn}</Text> : null}
            {companyUnitEn ? <Text style={styles.headerLineEn}>{companyUnitEn}</Text> : null}
            {companyCityZipEn ? <Text style={styles.headerLineEn}>{companyCityZipEn}</Text> : null}
            <Text style={styles.headerLineEn}>Kingdom of Saudi Arabia</Text>
            {company.crNumber ? (
              <Text style={styles.headerLineEn}>CR Reg No. : {company.crNumber}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerLineEn}>VAT Registration No : {company.vatNumber}</Text>
            ) : null}
          </View>

          {/* Right: Arabic Company Info */}
          <View style={styles.companyColAr}>
            {company.nameAr ? <Text style={styles.companyNameAr}>{company.nameAr}</Text> : null}
            {companyAddressAr ? <Text style={styles.headerLineAr}>{companyAddressAr}</Text> : null}
            {companyUnitAr ? <Text style={styles.headerLineAr}>{companyUnitAr}</Text> : null}
            {companyCityZipAr ? <Text style={styles.headerLineAr}>{companyCityZipAr}</Text> : null}
            <Text style={styles.headerLineAr}>المملكة العربية السعودية</Text>
            {company.crNumber ? (
              <Text style={styles.headerLineAr}>رقم السجل التجاري: {company.crNumber}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerLineAr}>
                رقم تسجيل ضريبة القيمة المضافة: {company.vatNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Dashed Separator */}
        <View style={styles.dashedDivider} />

        {/* ─── 3. INVOICE METADATA BLOCK ─── */}
        <View style={styles.metaBlock}>
          {/* Row 1: Invoice No */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Invoice No</Text>
            <Text style={styles.metaVal}>{invoice.invoiceNumber ?? ""}</Text>
            <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
          </View>

          {/* Row 2: Invoice Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Invoice Date</Text>
            <Text style={styles.metaVal}>{invoiceDateStr}</Text>
            <Text style={styles.metaLabelAr}>تاريخ الفاتورة</Text>
          </View>

          {/* Row 3: Delivery Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Delivery Date</Text>
            <Text style={styles.metaVal}>{deliveryDateStr}</Text>
            <Text style={styles.metaLabelAr}>تاريخ التسليم</Text>
          </View>

          {/* Row 4: Payment Type */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Payment Type</Text>
            <Text style={styles.metaVal}>{paymentTypeStr}</Text>
            <Text style={styles.metaLabelAr}>طريقة الدفع</Text>
          </View>

          {/* Row 5: Time */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabelEn}>Time</Text>
            <Text style={styles.metaVal}>{invoiceTimeStr}</Text>
            <Text style={styles.metaLabelAr}>الوقت</Text>
          </View>
        </View>

        {/* Dashed Separator */}
        <View style={styles.dashedDivider} />

        {/* ─── 4. BUYER INFORMATION BLOCK ─── */}
        <View style={styles.buyerHeaderRow}>
          <Text style={styles.buyerTitleEn}>Buyer Information</Text>
          <Text style={styles.buyerTitleAr}>معلومات المشتري</Text>
        </View>

        <View style={styles.buyerDetailsBlock}>
          {/* Name */}
          <View style={styles.buyerRow}>
            <Text style={styles.buyerLabelEn}>Name</Text>
            <Text style={styles.buyerVal}>{customer.nameEn || customer.nameAr || ""}</Text>
            <Text style={styles.buyerLabelAr}>الاسم</Text>
          </View>

          {/* Address */}
          {customerAddress ? (
            <View style={styles.buyerRow}>
              <Text style={styles.buyerLabelEn}>Address</Text>
              <Text style={styles.buyerVal}>{customerAddress}</Text>
              <Text style={styles.buyerLabelAr}>العنوان</Text>
            </View>
          ) : null}

          {/* City */}
          {customer.addressCity ? (
            <View style={styles.buyerRow}>
              <Text style={styles.buyerLabelEn}>City</Text>
              <Text style={styles.buyerVal}>{customer.addressCity}</Text>
              <Text style={styles.buyerLabelAr}>المدينة</Text>
            </View>
          ) : null}

          {/* Country */}
          <View style={styles.buyerRow}>
            <Text style={styles.buyerLabelEn}>Country</Text>
            <Text style={styles.buyerVal}>SAUDI ARABIA</Text>
            <Text style={styles.buyerLabelAr}>البلد</Text>
          </View>

          {/* VAT Reg No */}
          {customer.vatNumber ? (
            <View style={styles.buyerRow}>
              <Text style={styles.buyerLabelEn}>VAT Reg No</Text>
              <Text style={styles.buyerVal}>{customer.vatNumber}</Text>
              <Text style={styles.buyerLabelAr}>رقم تسجيل ضريبة القيمة المضافة</Text>
            </View>
          ) : null}

          {/* CR Reg No */}
          {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber ? (
            <View style={styles.buyerRow}>
              <Text style={styles.buyerLabelEn}>CR Reg No</Text>
              <Text style={styles.buyerVal}>{customer.unifiedNumber || (customer as { crNumber?: string }).crNumber}</Text>
              <Text style={styles.buyerLabelAr}>رقم السجل التجاري</Text>
            </View>
          ) : null}
        </View>

        {/* Dotted Separator */}
        <View style={styles.dottedDivider} />

        {/* ─── 5. LINE ITEMS TABLE ─── */}
        <View style={styles.table}>
          {/* Header Row 1: English */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thText, styles.colCode]}>ITEM Code</Text>
            <Text style={[styles.thText, styles.colDesc]}>Description</Text>
            <Text style={[styles.thTextCenter, styles.colQty]}>Qty{"\n"}(MC/OP)</Text>
            <Text style={[styles.thTextRight, styles.colPrice]}>Price Per{"\n"}Unit</Text>
            <Text style={[styles.thTextRight, styles.colSubtotal]}>Total Exclu{"\n"}VAT</Text>
            <Text style={[styles.thTextRight, styles.colDiscount]}>Total{"\n"}Discount</Text>
          </View>

          {/* Header Row 2: Arabic */}
          <View style={[styles.tableHeaderRow, { marginTop: 2, marginBottom: 4 }]}>
            <Text style={[styles.thText, styles.colCode]}>رقم الصنف</Text>
            <Text style={[styles.thText, styles.colDesc]}>اسم الصنف</Text>
            <Text style={[styles.thTextCenter, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thTextRight, styles.colPrice]}>سعر الوحدة</Text>
            <Text style={[styles.thTextRight, styles.colSubtotal]}>إجمالي{"\n"}بدون ضريبة</Text>
            <Text style={[styles.thTextRight, styles.colDiscount]}>اجمالي{"\n"}الخصم</Text>
          </View>

          {/* Dashed Separator below headers */}
          <View style={styles.dashedDivider} />

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              <Text style={[styles.tdText, styles.colCode]}>{row.code}</Text>
              <Text style={[styles.tdText, styles.colDesc]}>{row.desc}</Text>
              <Text style={[styles.tdTextCenter, styles.colQty]}>{formatQty(row.qty)}</Text>
              <Text style={[styles.tdTextRight, styles.colPrice]}>{formatExactAmount(row.unitPrice)}</Text>
              <Text style={[styles.tdTextRight, styles.colSubtotal]}>{formatExactAmount(row.taxableSubtotal)}</Text>
              <Text style={[styles.tdTextRight, styles.colDiscount]}>{formatExactAmount(row.lineDiscount)}</Text>
            </View>
          ))}
        </View>

        {/* Dashed Separator */}
        <View style={styles.dashedDivider} />

        {/* ─── 6. TOTALS BREAKDOWN SECTION ─── */}
        <View style={styles.totalsSection} wrap={false}>
          {/* Row 1: Total Quantity */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>Total Quantity:</Text>
            <Text style={styles.totalVal}>{formatQty(totalQty)}</Text>
            <Text style={styles.totalLabelAr}>إجمالي الكمية</Text>
          </View>

          {/* Row 2: Total Excluding VAT */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>Total Excluding VAT (SAR)</Text>
            <Text style={styles.totalVal}>{formatExactAmount(taxableAmount)}</Text>
            <Text style={styles.totalLabelAr}>الإجمالي باستثناء الضريبة</Text>
          </View>

          {/* Row 3: Total Discount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>Total Discount (SAR)</Text>
            <Text style={styles.totalVal}>{formatExactAmount(totalDiscountVal)}</Text>
            <Text style={styles.totalLabelAr}>اجمالي الخصم</Text>
          </View>

          {/* Row 4: Total After Discount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>Total After Discount (SAR)</Text>
            <Text style={styles.totalVal}>{formatExactAmount(totalAfterDiscount)}</Text>
            <Text style={styles.totalLabelAr}>المجموع بعد الخصم</Text>
          </View>

          {/* Row 5: VAT (15%) */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>VAT (15%) (SAR)</Text>
            <Text style={styles.totalVal}>{formatExactAmount(totalVat)}</Text>
            <Text style={styles.totalLabelAr}>ضريبة (15%)</Text>
          </View>

          {/* Row 6: Total with VAT */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelEn}>Total with VAT(SAR)</Text>
            <Text style={[styles.totalVal, styles.bold]}>{formatExactAmount(grandTotal)}</Text>
            <Text style={[styles.totalLabelAr, styles.bold]}>مجموع</Text>
          </View>
        </View>

        {/* Dashed Separator */}
        <View style={styles.dashedDivider} />

        {/* ─── 7. CENTERED ZATCA QR CODE ─── */}
        <View style={styles.qrSection} wrap={false}>
          {qrDataUrl ? (
            <Image src={qrDataUrl} style={styles.qrImage} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.draftText}>DRAFT</Text>
            </View>
          )}
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
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 22,
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

  // 1. Title Section
  titleSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  titleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10,
    color: "#000000",
  },
  titleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
  },

  // 2. Dual Company Header
  companyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  companyColEn: {
    width: "48%",
    alignItems: "flex-start",
  },
  companyColAr: {
    width: "48%",
    alignItems: "flex-end",
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    marginBottom: 1,
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },
  headerLineEn: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    marginBottom: 1,
  },
  headerLineAr: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },

  // Dividers
  dashedDivider: {
    borderBottomWidth: 0.8,
    borderColor: "#000000",
    borderStyle: "dashed",
    marginVertical: 4,
  },
  dottedDivider: {
    borderBottomWidth: 0.8,
    borderColor: "#888888",
    borderStyle: "dotted",
    marginVertical: 4,
  },

  // 3. Invoice Metadata Block
  metaBlock: {
    flexDirection: "column",
    paddingVertical: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1,
  },
  metaLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "25%",
  },
  metaVal: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "50%",
    textAlign: "center",
  },
  metaLabelAr: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "25%",
    textAlign: "right",
  },

  // 4. Buyer Information
  buyerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  buyerTitleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
  },
  buyerTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
  },
  buyerDetailsBlock: {
    flexDirection: "column",
  },
  buyerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 1,
  },
  buyerLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    width: "20%",
  },
  buyerVal: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    width: "55%",
    textAlign: "center",
  },
  buyerLabelAr: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    width: "25%",
    textAlign: "right",
  },

  // 5. Table
  table: {
    width: "100%",
    marginVertical: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 2,
  },
  thText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
  },
  thTextCenter: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  thTextRight: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
  },
  tdText: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
  },
  tdTextCenter: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdTextRight: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths
  colCode: { width: "15%" },
  colDesc: { width: "37%" },
  colQty: { width: "11%" },
  colPrice: { width: "12%" },
  colSubtotal: { width: "13%" },
  colDiscount: { width: "12%" },

  // 6. Totals Section
  totalsSection: {
    flexDirection: "column",
    paddingVertical: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1,
  },
  totalLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "35%",
  },
  totalVal: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "30%",
    textAlign: "center",
  },
  totalLabelAr: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    width: "35%",
    textAlign: "right",
  },

  // 7. QR Code Section
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  qrImage: {
    width: 130,
    height: 130,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
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
});
