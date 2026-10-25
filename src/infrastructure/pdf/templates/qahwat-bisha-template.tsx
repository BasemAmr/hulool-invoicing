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

export interface QahwatBishaTemplateProps {
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
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0";
  return num.toString();
}

function formatDateFormatted(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QahwatBishaTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: QahwatBishaTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateFormatted = formatDateFormatted(invoice.issueDate);

  // Address assembly - strict dynamic data only
  const companyAddressLine1 = company.addressStreet || "";
  const companyAddressLine2 = [company.addressDistrict ? `حي ${company.addressDistrict}` : null, company.addressCity].filter(Boolean).join(" ");

  const customerAddress = [
    customer.addressStreet,
    customer.addressDistrict,
    customer.addressCity,
    customer.addressBuildingNumber,
    customer.addressPostalCode,
    customer.addressAdditionalNumber,
  ].filter(Boolean).join(" - ");

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
  const extraItemsCount = Math.max(0, rows.length - 6);
  let extraHeight = extraItemsCount * 28;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoiceNumber}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Qahwat Bisha"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: TITLE & QR (LEFT) | COMPANY INFO & LOGO (RIGHT) ─── */}
        <View style={styles.topHeaderRow}>
          {/* Left: Titles & ZATCA QR Code */}
          <View style={styles.topLeftCol}>
            <Text style={styles.taxInvoiceTitleAr}>فاتورة ضريبية</Text>
            <Text style={styles.taxInvoiceTitleEn}>TAX Invoice</Text>
            <View style={styles.qrWrap}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Company Info & Circular Logo */}
          <View style={styles.topRightCol}>
            <View style={styles.companyInfoCol}>
              {company.nameAr ? <Text style={styles.companyNameAr}>{company.nameAr}</Text> : null}
              {company.vatNumber ? (
                <Text style={styles.companyMetaText}>الرقم الضريبي : {company.vatNumber}</Text>
              ) : null}
              {company.phone ? (
                <Text style={styles.companyMetaText}>هاتف : {company.phone}</Text>
              ) : null}
              {companyAddressLine1 ? (
                <Text style={styles.companyMetaText}>{companyAddressLine1}</Text>
              ) : null}
              {companyAddressLine2 ? (
                <Text style={styles.companyMetaText}>{companyAddressLine2}</Text>
              ) : null}
            </View>
            {logoSource ? (
              <View style={styles.logoWrap}>
                <Image src={logoSource} style={styles.logoImage} />
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. SOLID BLACK HORIZONTAL DIVIDER ─── */}
        <View style={styles.blackDivider} />

        {/* ─── 3. INVOICE META (LEFT) & CLIENT DETAILS (RIGHT) ─── */}
        <View style={styles.metaAndClientRow}>
          {/* Left: Invoice Number & Date */}
          <View style={styles.invoiceMetaCol}>
            {/* Invoice No */}
            <View style={styles.metaRow}>
              <Text style={styles.metaValBold}>{invoiceNumber}</Text>
              <View style={styles.metaLabelStack}>
                <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
                <Text style={styles.metaLabelEn}>Invoice NO</Text>
              </View>
            </View>
            {/* Invoice Date */}
            <View style={styles.metaRow}>
              <Text style={styles.metaVal}>{issueDateFormatted}</Text>
              <View style={styles.metaLabelStack}>
                <Text style={styles.metaLabelAr}>تاريخ الفاتورة</Text>
                <Text style={styles.metaLabelEn}>Invoice Date</Text>
              </View>
            </View>
          </View>

          {/* Right: Client Header & Details */}
          <View style={styles.clientCol}>
            <View style={styles.clientDetailsGroup}>
              {customer.nameAr ? (
                <Text style={styles.clientNameAr}>{customer.nameAr}</Text>
              ) : customer.nameEn ? (
                <Text style={styles.clientNameAr}>{customer.nameEn}</Text>
              ) : null}
              {customer.vatNumber ? (
                <Text style={styles.clientMetaText}>الرقم الضريبي: {customer.vatNumber}</Text>
              ) : null}
              {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber ? (
                <Text style={styles.clientMetaText}>
                  سجل تجاري/ رقم موحد: {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber}
                </Text>
              ) : null}
              {customerAddress ? (
                <Text style={styles.clientMetaText}>العنوان: {customerAddress}</Text>
              ) : null}
            </View>
            <View style={styles.clientBadgeCol}>
              <Text style={styles.clientBadgeAr}>العميل</Text>
              <Text style={styles.clientBadgeEn}>Client</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (RTL ORDER) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Item Index & Description (Right) */}
            <View style={[styles.thCell, styles.colIndex]}>
              <Text style={styles.thAr}>البند</Text>
              <Text style={styles.thEn}>Item</Text>
            </View>
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>

            {/* 2. Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>

            {/* 3. Price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thAr}>السعر</Text>
              <Text style={styles.thEn}>Price</Text>
            </View>

            {/* 4. Total Before Tax */}
            <View style={[styles.thCell, styles.colSubtotal]}>
              <Text style={styles.thAr}>المجموع قبل الضريبة</Text>
              <Text style={styles.thEn}>Total Before Tax</Text>
            </View>

            {/* 5. VAT % */}
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>VAT 15%</Text>
            </View>

            {/* 6. VAT Amount */}
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>

            {/* 7. Total With VAT (Left) */}
            <View style={[styles.thCell, styles.colTotal, { borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المجموع مع الضريبة</Text>
              <Text style={styles.thEn}>Total With VAT</Text>
            </View>
          </View>

          {/* Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* Item Index */}
              <View style={[styles.tdCell, styles.colIndex]}>
                <Text style={styles.tdCenterText}>{row.index}</Text>
              </View>

              {/* Description */}
              <View style={[styles.tdCell, styles.colDesc]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>

              {/* Quantity */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterText}>{formatQty(row.qty)}</Text>
              </View>

              {/* Price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>

              {/* Total Before Tax */}
              <View style={[styles.tdCell, styles.colSubtotal]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.taxableSubtotal)}</Text>
              </View>

              {/* VAT % */}
              <View style={[styles.tdCell, styles.colVatRate]}>
                <Text style={styles.tdCenterText}>{row.vatRate}%</Text>
              </View>

              {/* VAT Amount */}
              <View style={[styles.tdCell, styles.colVatAmount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineVat)}</Text>
              </View>

              {/* Total With VAT */}
              <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineTotal)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 5. TOTALS CARD (ALIGNED TO LEFT) ─── */}
        <View style={styles.totalsCard} wrap={false}>
          {/* Row 1: Total Before VAT */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(taxableAmount)} ﷼</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelAr}>الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalsLabelEn}>Total Before VAT</Text>
            </View>
          </View>

          {/* Row 2: VAT Amount */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>{formatExactAmount(totalVat)} ﷼</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelAr}>(VAT (15%))</Text>
            </View>
          </View>

          {/* Row 3: Total After VAT (Shaded Grey) */}
          <View style={[styles.totalsRow, styles.totalsRowShaded]}>
            <Text style={[styles.totalsVal, styles.bold]}>{formatExactAmount(grandTotal)} ﷼</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={[styles.totalsLabelAr, styles.bold]}>الإجمالي بعد الضريبة</Text>
              <Text style={styles.totalsLabelEn}>Total After VAT</Text>
            </View>
          </View>

          {/* Row 4: Paid */}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsVal}>0.00 ﷼</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsLabelAr}>مدفوع</Text>
              <Text style={styles.totalsLabelEn}>Paid</Text>
            </View>
          </View>

          {/* Row 5: Due Amount (Double bottom line) */}
          <View style={[styles.totalsRow, styles.totalsRowDouble]}>
            <Text style={[styles.totalsVal, styles.bold]}>{formatExactAmount(grandTotal)} ﷼</Text>
            <View style={styles.totalsLabelGroup}>
              <Text style={[styles.totalsLabelAr, styles.bold]}>الرصيد المستحق</Text>
              <Text style={styles.totalsLabelEn}>Due Amount</Text>
            </View>
          </View>
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
    marginBottom: 12,
  },
  topLeftCol: {
    alignItems: "flex-start",
  },
  taxInvoiceTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
  },
  taxInvoiceTitleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
    marginBottom: 6,
  },
  qrWrap: {
    width: 82,
    height: 82,
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
    fontSize: 8,
    color: "#999999",
  },

  topRightCol: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  companyInfoCol: {
    alignItems: "flex-end",
    textAlign: "right",
    marginRight: 10,
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 11,
    color: "#000000",
    marginBottom: 3,
    textAlign: "right",
  },
  companyMetaText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 1.5,
    textAlign: "right",
  },
  logoWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 58,
    height: 58,
    objectFit: "contain",
  },

  // 2. Solid Black Horizontal Divider
  blackDivider: {
    height: 2.5,
    backgroundColor: "#000000",
    marginVertical: 10,
  },

  // 3. Meta & Client Row
  metaAndClientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  invoiceMetaCol: {
    flexDirection: "column",
    width: "35%",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  metaValBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#000000",
    width: 75,
    textAlign: "left",
  },
  metaVal: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#000000",
    width: 75,
    textAlign: "left",
  },
  metaLabelStack: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  metaLabelAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  metaLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#444444",
  },

  clientCol: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    maxWidth: "60%",
  },
  clientDetailsGroup: {
    alignItems: "flex-end",
    textAlign: "right",
    marginRight: 8,
  },
  clientNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  clientMetaText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 1.5,
    textAlign: "right",
  },
  clientBadgeCol: {
    alignItems: "center",
    paddingTop: 1,
  },
  clientBadgeAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },
  clientBadgeEn: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#444444",
  },

  // 4. Line Items Table
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 26,
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 22,
    alignItems: "center",
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
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontSize: 6.2,
    color: "#333333",
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
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths (Sum = 100%)
  colIndex: { width: "4%" },
  colDesc: { width: "26%" },
  colQty: { width: "9%" },
  colPrice: { width: "11%" },
  colSubtotal: { width: "14%" },
  colVatRate: { width: "11%" },
  colVatAmount: { width: "12%" },
  colTotal: { width: "13%" },

  // 5. Totals Card
  totalsCard: {
    width: "44%",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  totalsRowShaded: {
    backgroundColor: "#F3F4F6",
  },
  totalsRowDouble: {
    borderBottomWidth: 2,
    borderColor: "#000000",
  },
  totalsVal: {
    fontFamily: "Tajawal",
    fontSize: 7.8,
    color: "#000000",
    textAlign: "left",
  },
  totalsLabelGroup: {
    alignItems: "flex-end",
    textAlign: "right",
  },
  totalsLabelAr: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  totalsLabelEn: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#444444",
    textAlign: "right",
  },
});
