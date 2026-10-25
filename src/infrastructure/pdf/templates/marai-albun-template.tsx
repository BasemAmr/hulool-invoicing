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

export interface MaraiAlbunTemplateProps {
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

export function MaraiAlbunTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  backgroundDataUrl,
}: MaraiAlbunTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateFormatted = formatDateSlash(invoice.issueDate);
  const issueDateRaw = invoice.issueDate ? invoice.issueDate.slice(0, 10) : "";
  const paymentMethodText = invoice.invoiceType === "simplified" ? "نقدى" : "آجل";

  // Branch info if present
  const branchNum = company.prefix || "";
  const branchName = company.organizationType || company.clientEmployee || "";

  // Items Processing
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

    // Unit is generic per user instruction (not hardcoded to كيس)
    const unit = (item as { unit?: string }).unit || "وحدة";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      unit,
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
  const taxableAfterDiscount = Math.max(0, taxableAmount - invoiceDiscount);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  // Address assembly
  const companyAddressStr = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ].filter(Boolean).join(" ") || "SAU";

  const customerAddressStr = [
    customer.addressStreet,
    customer.addressDistrict,
    customer.addressCity,
    customer.addressPostalCode,
    customer.addressBuildingNumber,
  ].filter(Boolean).join(" ") || "SAU";

  // Dynamic height sizing
  const extraItemsCount = Math.max(0, rows.length - 4);
  let extraHeight = extraItemsCount * 28;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoiceNumber}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Marai Al-Bun"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (QR | TITLE & BRANCH | META TABLE) ─── */}
        <View style={styles.topHeaderRow}>
          {/* Left: Large ZATCA QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.draftText}>DRAFT</Text>
              </View>
            )}
          </View>

          {/* Center: Title & Branch Info */}
          <View style={styles.titleBranchCol}>
            <Text style={styles.taxInvoiceTitleEn}>Tax Invoice</Text>
            <Text style={styles.taxInvoiceTitleAr}>فاتورة ضريبية</Text>

            {branchNum ? (
              <View style={styles.branchRow}>
                <Text style={styles.branchVal}>{branchNum}</Text>
                <Text style={styles.branchLabel}>: رقم الفرع</Text>
              </View>
            ) : null}

            {branchName ? (
              <View style={styles.branchRow}>
                <Text style={styles.branchVal}>{branchName}</Text>
                <Text style={styles.branchLabel}>: أسم الفرع</Text>
              </View>
            ) : null}

            {issueDateRaw ? (
              <View style={styles.branchRow}>
                <Text style={styles.branchVal}>{issueDateRaw}</Text>
                <Text style={styles.branchLabel}>: بتاريخ</Text>
              </View>
            ) : null}
          </View>

          {/* Right: 4-Row Meta Table */}
          <View style={styles.metaTable}>
            {/* Invoice No */}
            <View style={styles.metaTableRow}>
              <Text style={styles.metaCellEn}>Invoice</Text>
              <Text style={styles.metaCellValBold}>{invoiceNumber}</Text>
              <Text style={styles.metaCellAr}>رقم الفاتورة</Text>
            </View>

            {/* Invoice Issue Date */}
            <View style={styles.metaTableRow}>
              <Text style={styles.metaCellEn}>Invoice Issue Date</Text>
              <Text style={styles.metaCellVal}>{issueDateFormatted}</Text>
              <Text style={styles.metaCellAr}>تاريخ اصدار الفاتورة</Text>
            </View>

            {/* Payment Method */}
            <View style={styles.metaTableRow}>
              <Text style={styles.metaCellEn}>Payment Method</Text>
              <Text style={styles.metaCellVal}>{paymentMethodText}</Text>
              <Text style={styles.metaCellAr}>طريقه الدفع</Text>
            </View>

            {/* Transaction Type */}
            <View style={[styles.metaTableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaCellEn}>Transaction Type</Text>
              <Text style={styles.metaCellVal}>Sales order</Text>
              <Text style={styles.metaCellAr}>نوع المعاملة</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. VENDOR & CUSTOMER DUAL GRID ─── */}
        <View style={styles.partiesGrid}>
          {/* Row 1: ID - empty per user instruction */}
          <View style={styles.gridRow}>
            {/* Vendor ID */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Vendor ID</Text>
              <Text style={styles.gridValCenter}></Text>
              <Text style={styles.gridLabelAr}>كود المورد</Text>
            </View>
            {/* Customer ID */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Cust ID</Text>
              <Text style={styles.gridValCenter}></Text>
              <Text style={styles.gridLabelAr}>كود العميل</Text>
            </View>
          </View>

          {/* Row 2: Name */}
          <View style={styles.gridRow}>
            {/* Vendor Name */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Vendor Name</Text>
              <Text style={styles.gridValCenterBold}>
                {company.nameEn || company.nameAr || ""}
              </Text>
              <Text style={styles.gridLabelAr}>أسم المورد</Text>
            </View>
            {/* Customer Name */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Cust Name</Text>
              <Text style={styles.gridValCenterBold}>
                {customer.nameAr || customer.nameEn || ""}
              </Text>
              <Text style={styles.gridLabelAr}>أسم العميل</Text>
            </View>
          </View>

          {/* Row 3: Address */}
          <View style={styles.gridRow}>
            {/* Vendor Address */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Vendor Address</Text>
              <Text style={styles.gridValCenter}>{companyAddressStr}</Text>
              <Text style={styles.gridLabelAr}>عنوان المورد</Text>
            </View>
            {/* Customer Address */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Cust Address</Text>
              <Text style={styles.gridValCenter}>{customerAddressStr}</Text>
              <Text style={styles.gridLabelAr}>عنوان العميل</Text>
            </View>
          </View>

          {/* Row 4: Phone */}
          <View style={styles.gridRow}>
            {/* Vendor Phone */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Phone</Text>
              <Text style={styles.gridValCenter}>{company.phone || ""}</Text>
              <Text style={styles.gridLabelAr}>هاتف</Text>
            </View>
            {/* Customer Phone */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>Phone</Text>
              <Text style={styles.gridValCenter}>{customer.phone || ""}</Text>
              <Text style={styles.gridLabelAr}>هاتف</Text>
            </View>
          </View>

          {/* Row 5: VAT Number */}
          <View style={styles.gridRow}>
            {/* Vendor VAT */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>VAT Number</Text>
              <Text style={styles.gridValCenterBold}>{company.vatNumber || ""}</Text>
              <Text style={styles.gridLabelAr}>الرقم الضريبي</Text>
            </View>
            {/* Customer VAT */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>VAT Number</Text>
              <Text style={styles.gridValCenterBold}>{customer.vatNumber || ""}</Text>
              <Text style={styles.gridLabelAr}>الرقم الضريبي</Text>
            </View>
          </View>

          {/* Row 6: CRN */}
          <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
            {/* Vendor CRN */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>CRN</Text>
              <Text style={styles.gridValCenter}>{company.crNumber || ""}</Text>
              <Text style={styles.gridLabelAr}>السجل التجارى</Text>
            </View>
            {/* Customer CRN */}
            <View style={styles.halfCol}>
              <Text style={styles.gridLabelEn}>CRN</Text>
              <Text style={styles.gridValCenter}>
                {customer.unifiedNumber || (customer as { crNumber?: string }).crNumber || ""}
              </Text>
              <Text style={styles.gridLabelAr}>السجل التجارى</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE (10 COLUMNS) ─── */}
        <View style={styles.table}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. # */}
            <View style={[styles.thCell, styles.colNo]}>
              <Text style={styles.thEn}>#</Text>
              <Text style={styles.thAr}>الرقم</Text>
            </View>

            {/* 2. Item ID - cell empty per instruction */}
            <View style={[styles.thCell, styles.colItemId]}>
              <Text style={styles.thEn}>Item ID</Text>
              <Text style={styles.thAr}>رقم الصنف</Text>
            </View>

            {/* 3. Item Name */}
            <View style={[styles.thCell, styles.colItemName]}>
              <Text style={styles.thEn}>Item Name</Text>
              <Text style={styles.thAr}>أسم الصنف</Text>
            </View>

            {/* 4. Unit */}
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thEn}>Unit</Text>
              <Text style={styles.thAr}>الوحدة</Text>
            </View>

            {/* 5. Quanity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thEn}>Quanity</Text>
              <Text style={styles.thAr}>الكمية</Text>
            </View>

            {/* 6. unit price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thEn}>unit price</Text>
              <Text style={styles.thAr}>سعر الوحدة</Text>
            </View>

            {/* 7. Discount */}
            <View style={[styles.thCell, styles.colDiscount]}>
              <Text style={styles.thEn}>Discount</Text>
              <Text style={styles.thAr}>الخصم</Text>
            </View>

            {/* 8. Taxable amount */}
            <View style={[styles.thCell, styles.colTaxable]}>
              <Text style={styles.thEn}>Taxable amount</Text>
              <Text style={styles.thAr}>المبلغ الخاضع للضريبة</Text>
            </View>

            {/* 9. Tax */}
            <View style={[styles.thCell, styles.colTax]}>
              <Text style={styles.thEn}>Tax</Text>
              <Text style={styles.thAr}>الضريبة</Text>
            </View>

            {/* 10. Total (Including VAT) */}
            <View style={[styles.thCell, styles.colTotal, { borderRightWidth: 0 }]}>
              <Text style={styles.thEn}>Total (Including VAT)</Text>
              <Text style={styles.thAr}>الاجمالي (شامل الضريبة)</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* 1. # */}
              <View style={[styles.tdCell, styles.colNo]}>
                <Text style={styles.tdCenterText}>{row.index}</Text>
              </View>

              {/* 2. Item ID - empty per instruction */}
              <View style={[styles.tdCell, styles.colItemId]}>
                <Text style={styles.tdCenterText}></Text>
              </View>

              {/* 3. Item Name */}
              <View style={[styles.tdCell, styles.colItemName]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>

              {/* 4. Unit */}
              <View style={[styles.tdCell, styles.colUnit]}>
                <Text style={styles.tdCenterText}>{row.unit}</Text>
              </View>

              {/* 5. Quantity */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterBold}>{formatQty(row.qty)}</Text>
              </View>

              {/* 6. unit price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>

              {/* 7. Discount */}
              <View style={[styles.tdCell, styles.colDiscount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineDiscount)}</Text>
              </View>

              {/* 8. Taxable amount */}
              <View style={[styles.tdCell, styles.colTaxable]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.taxableSubtotal)}</Text>
              </View>

              {/* 9. Tax */}
              <View style={[styles.tdCell, styles.colTax]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineVat)}</Text>
              </View>

              {/* 10. Total (Including VAT) */}
              <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineTotal)}</Text>
              </View>
            </View>
          ))}

          {/* Table Footer Total Qty Row */}
          <View style={styles.tableTotalRow} wrap={false}>
            <View style={{ width: "45%", paddingHorizontal: 4 }}>
              <Text style={styles.totalRowTextBold}>Total</Text>
            </View>
            <View style={{ width: "8%", alignItems: "center" }}>
              <Text style={styles.totalRowTextBold}>{Math.round(totalQty)}</Text>
            </View>
            <View style={{ width: "47%", alignItems: "flex-end", paddingHorizontal: 4 }}>
              <Text style={styles.totalRowTextBold}>الأجمالي</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. SUMMARY TOTALS LIST ─── */}
        <View style={styles.summaryTotalsSection} wrap={false}>
          {/* Row 1: Total Amount */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total Amount</Text>
            <Text style={styles.summaryLabelAr}>المبلغ الاجمالى</Text>
            <Text style={styles.summaryVal}>
              {formatExactAmount(computedGross || taxableAmount)} SAR
            </Text>
          </View>

          {/* Row 2: Total Taxable Amount (Excluding VAT) */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total Taxable Amount (Excluding VAT)</Text>
            <Text style={styles.summaryLabelAr}>اجمالى المبلغ غير شامل ضريبة القيمة المضافة</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(taxableAmount)} SAR</Text>
          </View>

          {/* Row 3: Total Discount */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total Discount</Text>
            <Text style={styles.summaryLabelAr}>اجمالى الخصم</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(totalDiscountVal)} SAR</Text>
          </View>

          {/* Row 4: Total charges */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total charges</Text>
            <Text style={styles.summaryLabelAr}>اجمالى الأعباء</Text>
            <Text style={styles.summaryVal}>0 SAR</Text>
          </View>

          {/* Row 5: Total Taxable Amount (After Discount) */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total Taxable Amount (After Discount)</Text>
            <Text style={styles.summaryLabelAr}>اجمالى المبلغ الخاضع للضريبة (بعد الخصم)</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(taxableAfterDiscount)} SAR</Text>
          </View>

          {/* Row 6: Total VAT */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total VAT</Text>
            <Text style={styles.summaryLabelAr}>مجموع ضريبة القيمة المضافة</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(totalVat)} SAR</Text>
          </View>

          {/* Row 7: Total With VAT */}
          <View style={[styles.summaryRow, { marginTop: 2 }]}>
            <Text style={[styles.summaryLabelEn, styles.bold]}>Total With VAT</Text>
            <Text style={[styles.summaryLabelAr, styles.bold]}>الاجمالى شامل ضريبة القيمة المضافة</Text>
            <Text style={[styles.summaryVal, styles.bold]}>{formatExactAmount(grandTotal)} SAR</Text>
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
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 18,
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
  qrCol: {
    width: 96,
    alignItems: "flex-start",
  },
  qrImage: {
    width: 92,
    height: 92,
  },
  qrPlaceholder: {
    width: 92,
    height: 92,
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
  titleBranchCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  taxInvoiceTitleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 11,
    color: "#000000",
  },
  taxInvoiceTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#000000",
    marginBottom: 4,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  branchVal: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    marginRight: 4,
  },
  branchLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  metaTable: {
    width: 210,
    borderWidth: 1,
    borderColor: "#000000",
  },
  metaTableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 14,
  },
  metaCellEn: {
    width: "35%",
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "left",
  },
  metaCellVal: {
    width: "35%",
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 2,
    height: "100%",
    justifyContent: "center",
  },
  metaCellValBold: {
    width: "35%",
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 2,
    height: "100%",
    justifyContent: "center",
  },
  metaCellAr: {
    width: "30%",
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "right",
  },

  // 2. Vendor & Customer Grid
  partiesGrid: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 14,
  },
  halfCol: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: "#000000",
  },
  gridLabelEn: {
    width: "28%",
    fontFamily: "Tajawal",
    fontSize: 6.5,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "left",
  },
  gridValCenter: {
    width: "46%",
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 2,
    textAlign: "center",
    height: "100%",
    justifyContent: "center",
  },
  gridValCenterBold: {
    width: "46%",
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 2,
    textAlign: "center",
    height: "100%",
    justifyContent: "center",
  },
  gridLabelAr: {
    width: "26%",
    fontFamily: "Tajawal",
    fontSize: 6.5,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "right",
  },

  // 3. Line Items Table
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    minHeight: 22,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    minHeight: 16,
  },
  tableTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    minHeight: 16,
  },
  totalRowTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
  },
  thCell: {
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 2,
  },
  tdCell: {
    borderRightWidth: 1,
    borderColor: "#000000",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  thEn: {
    fontFamily: "Tajawal",
    fontSize: 6.2,
    color: "#000000",
    textAlign: "center",
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths (Sum = 100%)
  colNo: { width: "3.5%" },
  colItemId: { width: "7.5%" },
  colItemName: { width: "28%" },
  colUnit: { width: "6%" },
  colQty: { width: "8%" },
  colPrice: { width: "9%" },
  colDiscount: { width: "7%" },
  colTaxable: { width: "11%" },
  colTax: { width: "9%" },
  colTotal: { width: "11%" },

  // 4. Summary Totals Section
  summaryTotalsSection: {
    width: "100%",
    flexDirection: "column",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  summaryLabelEn: {
    width: "35%",
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "left",
  },
  summaryLabelAr: {
    width: "45%",
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
    paddingRight: 10,
  },
  summaryVal: {
    width: "20%",
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
});
