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

export interface MadinaPlasticsTemplateProps {
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

function formatNumber(val: string | number | undefined, decimals = 2): string {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateTime(issuedAt?: string | null, issueDate?: string): string {
  if (issuedAt) {
    try {
      const d = new Date(issuedAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      const secs = String(d.getSeconds()).padStart(2, "0");
      return `${year}/${month}/${day} ${hours}:${mins}:${secs}`;
    } catch {
      // fallback
    }
  }
  if (issueDate) {
    const parts = issueDate.slice(0, 10).split("-");
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return issueDate;
  }
  return "";
}

export function MadinaPlasticsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: MadinaPlasticsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const dateTimeStr = formatDateTime(invoice.issuedAt, invoice.issueDate);

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const afterDiscountVal = Math.max(0, subtotalVal - discountVal);
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];

  const customerAddress = [
    customer.addressStreet,
    customer.addressCity,
    customer.addressPostalCode,
  ].filter(Boolean).join(" - ");

  const cashierName = company.clientEmployee || "";

  return (
    <Document
      title={`فاتورة ضريبية مبسطة ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Simplified Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER (3 Columns: English Left, Logo Center, Arabic Right) ─── */}
        <View style={styles.headerRow}>
          {/* Left: English / Numbers */}
          <View style={styles.headerLeft}>
            {company.vatNumber ? (
              <Text style={styles.headerLeftText}>
                {company.vatNumber} الرقم الضريبي
              </Text>
            ) : null}
            {company.addressBuildingNumber ? (
              <Text style={styles.headerLeftText}>
                {company.addressBuildingNumber},
              </Text>
            ) : null}
            {company.addressAdditionalNumber ? (
              <Text style={styles.headerLeftText}>
                {company.addressAdditionalNumber},
              </Text>
            ) : null}
            {company.addressPostalCode ? (
              <Text style={styles.headerLeftText}>
                {company.addressPostalCode},
              </Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerLeftText}>
                Mobile : {company.phone}
              </Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.headerLeftText}>
                C.R : {company.crNumber}
              </Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerLeftText}>
                VAT No: {company.vatNumber}
              </Text>
            ) : null}
          </View>

          {/* Center: Logo */}
          <View style={styles.headerCenter}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : null}
          </View>

          {/* Right: Arabic */}
          <View style={styles.headerRight}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.addressStreet || company.addressBuildingNumber ? (
              <Text style={styles.headerRightText}>
                {[company.addressStreet, company.addressBuildingNumber].filter(Boolean).join(" ")}
              </Text>
            ) : null}
            {company.addressDistrict || company.addressAdditionalNumber ? (
              <Text style={styles.headerRightText}>
                {[
                  company.addressDistrict ? `حي ${company.addressDistrict}` : "",
                  company.addressAdditionalNumber || "",
                ].filter(Boolean).join(" ")}
              </Text>
            ) : null}
            {company.addressCity || company.addressPostalCode ? (
              <Text style={styles.headerRightText}>
                {[company.addressCity, company.addressPostalCode].filter(Boolean).join(" ")}
              </Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerRightText}>
                جوال : {company.phone}
              </Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.headerRightText}>
                س.ت : {company.crNumber}
              </Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerRightText}>
                الرقم الضريبي : {company.vatNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. INVOICE META ROW (Date Right, Title Center, Payment Left) ─── */}
        <View style={styles.metaRow}>
          {/* Payment Method on Left */}
          <View style={styles.metaLeft}>
            <Text style={styles.paymentMethodBadge}>
              {(invoice as any).paymentMethod === "credit"
                ? "آجل"
                : (invoice as any).paymentMethod === "transfer"
                ? "تحويل"
                : (invoice as any).paymentMethod || "نقدي"}
            </Text>
          </View>

          {/* Title & Number in Center */}
          <View style={styles.metaCenter}>
            <Text style={styles.invoiceTitle}>فاتورة ضريبية مبسطة</Text>
            <Text style={styles.invoiceNumberText}>{invoiceNum}</Text>
          </View>

          {/* Date & Time on Right */}
          <View style={styles.metaRight}>
            <Text style={styles.dateTimeText}>{dateTimeStr}</Text>
          </View>
        </View>

        {/* ─── 3. CUSTOMER DETAILS BOX (4 Rows, 3 Columns) ─── */}
        <View style={styles.customerBox}>
          {/* Row 1: Name */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Arabic Customer</Text>
            <Text style={styles.custColValue}>{customer.nameAr || ""}</Text>
            <Text style={styles.custColAr}>العميل عربي</Text>
          </View>

          {/* Row 2: Tax Number */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Tax Identification Number</Text>
            <Text style={styles.custColValue}>{customer.vatNumber || ""}</Text>
            <Text style={styles.custColAr}>الرقم الضريبي</Text>
          </View>

          {/* Row 3: Mobile */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Mobile</Text>
            <Text style={styles.custColValue}>{customer.phone || ""}</Text>
            <Text style={styles.custColAr}>الجوال</Text>
          </View>

          {/* Row 4: Address */}
          <View style={[styles.customerRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.custColEn}>Address</Text>
            <Text style={styles.custColValue}>{customerAddress}</Text>
            <Text style={styles.custColAr}>العنوان</Text>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (8 Columns: م, الكود, الوصف, الكمية, الوحدة, السعر, الضريبة, الإجمالي) ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header (RTL) */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, styles.colTotal]}>الإجمالي</Text>
            <Text style={[styles.thCell, styles.colTax]}>الضريبة</Text>
            <Text style={[styles.thCell, styles.colPrice]}>السعر</Text>
            <Text style={[styles.thCell, styles.colUnit]}>الوحدة</Text>
            <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, styles.colDesc]}>الوصف</Text>
            <Text style={[styles.thCell, styles.colCode]}>الكود</Text>
            <Text style={[styles.thCell, styles.colIndex]}>م</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, idx) => {
            const lineQty = parseFloat(String(item.quantity || 1));
            const linePrice = parseFloat(String(item.unitPrice || 0));
            const lineTotal = parseFloat(String(item.lineTotal || (item as any).total || lineQty * linePrice));
            const taxPct = (item as any).vatRate !== undefined
              ? `${(item as any).vatRate}%`
              : (item as any).taxRate !== undefined
              ? `${(item as any).taxRate}%`
              : "15%";
            const itemCode = (item as any).barcode || (item as any).itemCode || (item as any).code || "";
            const unit = (item as any).unitName || (item as any).unit || "حبة";

            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tdCell, styles.colTotal]}>
                  {formatNumber(lineTotal, 2)}
                </Text>
                <Text style={[styles.tdCell, styles.colTax]}>{taxPct}</Text>
                <Text style={[styles.tdCell, styles.colPrice]}>
                  {formatNumber(linePrice, 2)}
                </Text>
                <Text style={[styles.tdCell, styles.colUnit]}>{unit}</Text>
                <Text style={[styles.tdCell, styles.colQty]}>{lineQty}</Text>
                <Text style={[styles.tdCell, styles.colDesc, styles.textRight]}>
                  {item.description || ""}
                </Text>
                <Text style={[styles.tdCell, styles.colCode]}>{itemCode}</Text>
                <Text style={[styles.tdCell, styles.colIndex]}>{idx + 1}</Text>
              </View>
            );
          })}
        </View>

        {/* Cashier Info */}
        {cashierName ? (
          <View style={styles.cashierRow}>
            <Text style={styles.cashierText}>كاشير : {cashierName}</Text>
          </View>
        ) : null}

        {/* ─── 5. SUMMARY & QR CODE (Totals Left, QR Center) ─── */}
        <View style={styles.summarySection}>
          {/* Left: Totals Breakdown */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>{formatNumber(subtotalVal, 2)} ريال سعودي</Text>
              <Text style={styles.totalLabel}>المجموع قبل الضريبة :</Text>
            </View>

            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>{formatNumber(discountVal, 2)} ريال سعودي</Text>
              <Text style={styles.totalLabel}>الخصم :</Text>
            </View>

            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>{formatNumber(afterDiscountVal, 2)} ريال سعودي</Text>
              <Text style={styles.totalLabel}>المجموع بعد الخصم :</Text>
            </View>

            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>{formatNumber(taxVal, 2)} ريال سعودي</Text>
              <Text style={styles.totalLabel}>ضريبة القيمة المضافة :</Text>
            </View>

            <View style={[styles.totalLine, styles.netLine]}>
              <Text style={[styles.totalValue, styles.netBold]}>{formatNumber(totalVal, 2)} ريال سعودي</Text>
              <Text style={[styles.totalLabel, styles.netBold]}>الصافي :</Text>
            </View>
          </View>

          {/* Center: Large ZATCA QR Code */}
          <View style={styles.qrContainer}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 6. FOOTER NOTICE ─── */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerNotice}>
            البضاعة المباعة تستبدل خلال اسبوع من تاريخ الشراء وتكون بحالتها السليمة
          </Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    fontSize: 8.5,
    color: "#222222",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    width: "35%",
    alignItems: "flex-start",
  },
  headerLeftText: {
    fontSize: 8,
    color: "#333333",
    lineHeight: 1.35,
    textAlign: "left",
  },
  headerCenter: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  headerRight: {
    width: "35%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "right",
  },
  headerRightText: {
    fontSize: 8,
    color: "#333333",
    lineHeight: 1.35,
    textAlign: "right",
  },

  // ─── Meta Row ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  metaLeft: {
    width: "25%",
    alignItems: "flex-start",
  },
  paymentMethodBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333333",
  },
  metaCenter: {
    width: "50%",
    alignItems: "center",
  },
  invoiceTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 3,
  },
  invoiceNumberText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#222222",
  },
  metaRight: {
    width: "25%",
    alignItems: "flex-end",
  },
  dateTimeText: {
    fontSize: 8.5,
    color: "#444444",
  },

  // ─── Customer Box ───
  customerBox: {
    borderWidth: 1,
    borderColor: "#A0A0A0",
    borderRadius: 2,
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#C0C0C0",
    minHeight: 18,
    alignItems: "center",
  },
  custColEn: {
    width: "25%",
    fontSize: 8,
    color: "#555555",
    paddingLeft: 8,
    textAlign: "left",
    borderRightWidth: 0.75,
    borderRightColor: "#C0C0C0",
    height: "100%",
    paddingVertical: 3,
  },
  custColValue: {
    width: "55%",
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
    height: "100%",
    paddingVertical: 3,
  },
  custColAr: {
    width: "20%",
    fontSize: 8,
    color: "#555555",
    paddingRight: 8,
    textAlign: "right",
    borderLeftWidth: 0.75,
    borderLeftColor: "#C0C0C0",
    height: "100%",
    paddingVertical: 3,
  },

  // ─── Items Table ───
  tableContainer: {
    borderWidth: 1,
    borderColor: "#A0A0A0",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#D9D9D9",
    borderBottomWidth: 1,
    borderBottomColor: "#A0A0A0",
    minHeight: 20,
    alignItems: "center",
  },
  thCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#A0A0A0",
    height: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#C0C0C0",
    minHeight: 18,
    alignItems: "center",
  },
  tdCell: {
    fontSize: 8,
    color: "#222222",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#C0C0C0",
    height: "100%",
  },
  textRight: {
    textAlign: "right",
    paddingRight: 6,
  },

  // Column Widths (8 columns, total 100%)
  colTotal: { width: "13%" },
  colTax: { width: "7%" },
  colPrice: { width: "10%" },
  colUnit: { width: "7%" },
  colQty: { width: "7%" },
  colDesc: { width: "36%" },
  colCode: { width: "15%" },
  colIndex: { width: "5%", borderRightWidth: 0 },

  cashierRow: {
    alignItems: "flex-end",
    marginBottom: 12,
    paddingRight: 4,
  },
  cashierText: {
    fontSize: 8,
    color: "#555555",
  },

  // ─── Summary & QR Section ───
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 8,
  },
  totalsContainer: {
    width: "48%",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalLabel: {
    fontSize: 8.5,
    color: "#222222",
    textAlign: "right",
  },
  totalValue: {
    fontSize: 8.5,
    color: "#222222",
    textAlign: "left",
  },
  netLine: {
    marginTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#C0C0C0",
    paddingTop: 4,
  },
  netBold: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#111111",
  },

  qrContainer: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 120,
    height: 120,
  },

  // ─── Footer ───
  footerWrap: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#E0E0E0",
    alignItems: "center",
  },
  footerNotice: {
    fontSize: 7.5,
    color: "#666666",
    textAlign: "center",
  },
});
