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

export interface ShamiTradingTemplateProps {
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

export function ShamiTradingTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ShamiTradingTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);
  const dueDateStr = formatDate(invoice.dueDate || invoice.issueDate);

  const companyName = company.nameAr || "";
  const companyCity = company.addressCity || "";
  const companyDistrictStreet = [
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressStreet || "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerName = customer.nameAr || "";
  const customerStreet = customer.addressStreet || "";
  const customerCityLine = [
    customer.addressCity,
    "المملكة العربية السعودية",
    customer.addressPostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const items = invoice.items || [];

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyName}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO (LEFT) & COMPANY DETAILS (RIGHT) ─── */}
        <View style={styles.topHeaderContainer}>
          <View style={styles.companyLogoWrap}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.companyLogo} />
            ) : null}
          </View>
          <View style={styles.companyHeaderWrap}>
            {companyName ? <Text style={styles.companyNameText}>{companyName}</Text> : null}
            {companyCity ? <Text style={styles.companySubText}>{companyCity}</Text> : null}
            {companyDistrictStreet ? <Text style={styles.companySubText}>{companyDistrictStreet}</Text> : null}
            {company.crNumber ? (
              <View style={styles.kvRowRight}>
                <Text style={styles.companySubText}>. {company.crNumber} .</Text>
                <Text style={styles.companySubText}>رقم الموحد للسجل</Text>
              </View>
            ) : null}
            {company.email ? (
              <View style={styles.kvRowRight}>
                <Text style={styles.companySubText}>{company.email}</Text>
                <Text style={styles.companySubText}>:الإيميل</Text>
              </View>
            ) : null}
            {company.vatNumber ? (
              <View style={styles.kvRowRight}>
                <Text style={styles.companySubText}>{company.vatNumber}</Text>
                <Text style={styles.companySubText}>:رقم تعريف ضريبة القيمة المضافة</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. CENTER: TITLE AND CENTERED ZATCA QR CODE ─── */}
        <View style={styles.centerTitleAndQrSection}>
          <View style={styles.centeredInvoiceTitleWrap}>
            {invoiceNum ? <Text style={styles.centeredInvoiceTitle}>{invoiceNum}</Text> : null}
            <Text style={styles.centeredInvoiceTitle}>فاتورة ضريبية</Text>
          </View>
          {qrDataUrl ? (
            <View style={styles.qrContainer}>
              <Image src={qrDataUrl} style={styles.qrImage} />
            </View>
          ) : null}
        </View>

        {/* ─── 3. MIDDLE SECTION: LEFT DATES BOX & RIGHT CLIENT DETAILS ─── */}
        <View style={styles.middleSectionRow}>
          {/* Left: 3-Row Bordered Box for Dates & Amount Due */}
          <View style={styles.datesBox}>
            <View style={styles.datesBoxRow}>
              <Text style={styles.datesBoxVal}>{issueDateStr}</Text>
              <Text style={styles.datesBoxKey}>تاريخ الفاتورة</Text>
            </View>
            <View style={styles.datesBoxRow}>
              <Text style={styles.datesBoxVal}>{dueDateStr}</Text>
              <Text style={styles.datesBoxKey}>تاريخ الاستحقاق</Text>
            </View>
            <View style={[styles.datesBoxRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.datesBoxVal, styles.bold]}>0 SAR</Text>
              <Text style={[styles.datesBoxKey, styles.bold]}>المبلغ المستحق</Text>
            </View>
          </View>

          {/* Right: Client Information */}
          <View style={styles.clientSection}>
            <Text style={styles.clientTitleUnderline}>حررت الفاتورة إلى:</Text>
            {customerName ? <Text style={styles.clientNameText}>{customerName}</Text> : null}
            {customerStreet ? <Text style={styles.clientDetailText}>{customerStreet}</Text> : null}
            {customerCityLine ? <Text style={styles.clientDetailText}>{customerCityLine}</Text> : null}
            {customer.phone ? (
              <View style={styles.kvRowRight}>
                <Text style={styles.clientDetailText}>{customer.phone}</Text>
                <Text style={styles.clientDetailText}>:هاتف</Text>
              </View>
            ) : null}
            {customer.vatNumber ? (
              <View style={styles.kvRowRight}>
                <Text style={styles.clientDetailText}>{customer.vatNumber}</Text>
                <Text style={styles.clientDetailText}>:رقم التعريف الضريبي</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (WHITE BACKGROUND, CLEAN GRID) ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Sequence Number */}
            <View style={[styles.thCell, { width: "4%" }]}>
              <Text style={styles.thText}></Text>
            </View>

            {/* 2. السلع أو الخدمات */}
            <View style={[styles.thCell, { width: "36%" }]}>
              <Text style={styles.thText}>السلع أو الخدمات</Text>
            </View>

            {/* 3. الكمية */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 4. سعر الوحدة */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>سعر</Text>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* 5. المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع</Text>
              <Text style={styles.thText}>للضريبة</Text>
            </View>

            {/* 6. معدل ضريبة القيمة */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>معدل</Text>
              <Text style={styles.thText}>ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 7. مبلغ ضريبة القيمة */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>مبلغ</Text>
              <Text style={styles.thText}>ضريبة</Text>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 8. المجموع الجزئي (بما في ذلك ضريبة القيمة المضافة) */}
            <View style={[styles.thCell, { width: "18%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextBold}>المجموع</Text>
              <Text style={styles.thTextBold}>الجزئي</Text>
              <Text style={styles.thTextSmall}>(بما في ذلك ضريبة القيمة</Text>
              <Text style={styles.thTextSmall}>المضافة)</Text>
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
                {/* 1. Sequence Number */}
                <View style={[styles.tdCell, { width: "4%" }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>

                {/* 2. Goods / Description */}
                <View style={[styles.tdCell, { width: "36%" }]}>
                  <Text style={styles.tdRight}>{item.description}</Text>
                </View>

                {/* 3. Quantity */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.quantity)}</Text>
                </View>

                {/* 4. Unit Price */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 5. Taxable Amount */}
                <View style={[styles.tdCell, { width: "14%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.lineSubtotal)}</Text>
                </View>

                {/* 6. VAT Rate */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{vatPct}%</Text>
                </View>

                {/* 7. VAT Amount */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.lineVat, 2)}</Text>
                </View>

                {/* 8. Line Subtotal */}
                <View style={[styles.tdCell, { width: "18%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.lineTotal, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. BOTTOM SECTION: PAYMENT METHOD (RIGHT) & TOTALS (LEFT) ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Totals Breakdown */}
          <View style={styles.totalsContainer}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(invoice.subtotal)} SAR</Text>
              <Text style={styles.totalLabel}>الاجمالي (غير شاملة ضريبة القيمة المضافة):</Text>
            </View>

            {/* Row 2: VAT Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(invoice.vatAmount)} SAR</Text>
              <Text style={styles.totalLabel}>مجموع ضريبة القيمة المضافة:</Text>
            </View>

            {/* Row 3: Total With VAT */}
            <View style={[styles.totalRow, styles.totalRowBordered]}>
              <Text style={styles.totalValBold}>{formatNumber(invoice.total)} SAR</Text>
              <Text style={styles.totalLabelBold}>الاجمالي (بما في ذلك ضريبة القيمة المضافة):</Text>
            </View>

            {/* Row 4: Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalValBold}>{formatNumber(invoice.total)} SAR</Text>
              <Text style={styles.totalLabel}>الفاتورة مدفوعة:</Text>
            </View>
          </View>

          {/* Right: Payment Method */}
          <View style={styles.paymentContainer}>
            <Text style={styles.paymentTitle}>طريقة الدفع</Text>
            <Text style={styles.paymentValue}>
              {(invoice as any).paymentMethod === "card"
                ? "بطاقة مدى / ائتمان"
                : (invoice as any).paymentMethod === "transfer"
                ? "تحويل بنكي"
                : "نقدي"}
            </Text>
          </View>
        </View>

        {/* Optional notes if provided */}
        {invoice.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>ملاحظات:</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 26,
    paddingBottom: 26,
    paddingLeft: 32,
    paddingRight: 32,
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

  // ─── Company Header (Top) ───
  topHeaderContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  companyLogoWrap: {
    maxWidth: 120,
    maxHeight: 60,
  },
  companyLogo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: "contain",
  },
  companyHeaderWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  companyNameText: {
    fontSize: 11.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  companySubText: {
    fontSize: 8.5,
    textAlign: "right",
    marginBottom: 1.5,
  },
  kvRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginBottom: 1.5,
  },

  // ─── Center Title and QR Code ───
  centerTitleAndQrSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  centeredInvoiceTitleWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  centeredInvoiceTitle: {
    fontSize: 14.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  qrContainer: {
    width: 88,
    height: 88,
  },
  qrImage: {
    width: 88,
    height: 88,
  },

  // ─── Middle Section ───
  middleSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  datesBox: {
    width: "35%",
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "column",
  },
  datesBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  datesBoxKey: {
    fontSize: 8.5,
    textAlign: "right",
  },
  datesBoxVal: {
    fontSize: 8.5,
    textAlign: "left",
  },
  bold: {
    fontWeight: "bold",
  },

  clientSection: {
    width: "58%",
    alignItems: "flex-end",
  },
  clientTitleUnderline: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    textDecoration: "underline",
    marginBottom: 2,
  },
  clientNameText: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 1.5,
  },
  clientDetailText: {
    fontSize: 8.5,
    textAlign: "right",
    marginBottom: 1,
  },

  // ─── Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFFFF",
    minHeight: 34,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextSmall: {
    fontSize: 6,
    textAlign: "center",
    marginTop: 0.5,
  },

  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 24,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 8,
    textAlign: "center",
  },
  tdRight: {
    fontSize: 8,
    textAlign: "right",
  },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paymentContainer: {
    alignItems: "flex-end",
    paddingTop: 12,
  },
  paymentTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  paymentValue: {
    fontSize: 9,
    textAlign: "right",
  },

  totalsContainer: {
    width: "44%",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalRowBordered: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 3,
    marginVertical: 1,
  },
  totalLabel: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8,
    textAlign: "left",
  },
  totalValBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "left",
  },
  notesSection: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#D1D5DB",
    alignItems: "flex-end",
  },
  notesTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    textAlign: "right",
    color: "#374151",
  },
});
