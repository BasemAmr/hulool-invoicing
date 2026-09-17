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

export interface Template1AlAsmaProps {
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

// ─── Helpers ───
interface ItemUnitExtensions {
  unit?: string | null;
  unitName?: string | null;
  uom?: string | null;
}

function getItemUnit(item: InvoiceItemDto): string {
  const rec = item as InvoiceItemDto & Partial<ItemUnitExtensions>;
  return rec.unit ?? rec.unitName ?? rec.uom ?? "";
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(
  val: string | number | null | undefined,
  decimals = 2,
): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateFormatted(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return clean;
}

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toEasternArabicDigits(str: string): string {
  return str.replace(/\d/g, (d) => EASTERN_DIGITS[Number(d)] ?? d);
}

export function Template1AlAsma({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
}: Template1AlAsmaProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // Header dynamic lines
  const companyTitle = company.nameEn || company.nameAr || "";
  const branchName = company.addressDistrict ? `${company.addressDistrict.toUpperCase()} BRANCH` : "";
  const addressLine = [
    company.addressStreet ? company.addressStreet.toUpperCase() : "",
    company.addressCity ? company.addressCity.toUpperCase() : "",
  ]
    .filter(Boolean)
    .join(" - ");
  const headOfficeLine = addressLine ? `HEAD OFFICE ${addressLine}` : (company.addressCity ? `HEAD OFFICE ${company.addressCity.toUpperCase()}` : "");
  const companyPhone = company.phone || "";
  const companyEmail = company.email ? company.email.toUpperCase() : "";

  // Customer & Invoice Details
  const customerName = customer.nameEn || customer.nameAr || "";
  const customerAddress = [customer.addressStreet, customer.addressCity]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const customerVat = customer.vatNumber || "";
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateFormatted(invoice.issueDate);
  const issueDateAr = issueDateStr ? toEasternArabicDigits(issueDateStr) : "";

  // Items
  const items = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const vat = toNumber(item.lineVat);
    const total = toNumber(item.lineTotal);
    return {
      key: item.position ?? idx,
      si: String(idx + 1),
      desc: item.description || "",
      unit: getItemUnit(item),
      qty,
      unitPrice,
      gross,
      vat,
      total,
    };
  });

  const sumGross = rows.reduce((a, r) => a + r.gross, 0);
  const sumDisc = items.reduce((a, item) => a + toNumber(item.discountAmount), 0);
  const sumVat = rows.reduce((a, r) => a + r.vat, 0);
  const sumTotal = rows.reduce((a, r) => a + r.total, 0);

  return (
    <Document
      title={`Simplified Tax Invoice ${docNo}`}
      author={toText(companyTitle)}
      subject="Simplified Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* Main Outer Box with Rounded Corners */}
        <View style={styles.mainContainer}>
          {/* ─── Header: Company Info (Left) & QR Code (Right) ─── */}
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              {companyTitle ? (
                <Text style={styles.companyName}>{companyTitle}</Text>
              ) : null}
              {branchName ? (
                <Text style={styles.companyMeta}>{branchName}</Text>
              ) : null}
              {headOfficeLine ? (
                <Text style={styles.companyMeta}>{headOfficeLine}</Text>
              ) : null}
              {companyPhone ? (
                <Text style={styles.companyMeta}>{companyPhone}</Text>
              ) : null}
              {companyEmail ? (
                <Text style={styles.companyMeta}>{companyEmail}</Text>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              {qrDataUrl ? (
                <View style={styles.qrContainer}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </View>
              ) : null}
            </View>
          </View>

          {/* Top Divider */}
          <View style={styles.horizontalDivider} />

          {/* ─── Customer & Invoice Info Grid ─── */}
          <View style={styles.infoSection}>
            {/* Row 1: Customer Name & Invoice No */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <Text style={styles.infoLabel}>Customer Name : </Text>
                <Text style={styles.infoValueBold}>{customerName}</Text>
              </View>
              <View style={styles.infoColRight}>
                <Text style={styles.infoLabel}>Invoice No : </Text>
                <Text style={styles.infoValueBold}>{docNo}</Text>
              </View>
            </View>

            {/* Row 2: Address & Date (Gregorian and Eastern Arabic) */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <Text style={styles.infoLabel}>Address : </Text>
                <Text style={styles.infoValueBold}>{customerAddress}</Text>
              </View>
              <View style={styles.infoColRight}>
                <Text style={styles.infoLabel}>Date : </Text>
                <View style={styles.dateValuesCol}>
                  {issueDateAr ? (
                    <Text style={styles.infoValueBold}>{issueDateAr}</Text>
                  ) : null}
                  {issueDateStr ? (
                    <Text style={styles.infoValueBold}>{issueDateStr}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Row 3: VAT Number & Supply Date label */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <Text style={styles.infoLabel}>VAT Number : </Text>
                <Text style={styles.infoValueBold}>{customerVat}</Text>
              </View>
              <View style={styles.infoColRight}>
                <Text style={styles.supplyDateLabel}>تاريخ التوريد : </Text>
              </View>
            </View>

            {/* Centered Document Title */}
            <View style={styles.titleWrapper}>
              <Text style={styles.documentTitle}>
                Simplified Tax Invoice - فاتورة ضريبية مبسطة
              </Text>
            </View>
          </View>

          {/* ─── Items Table ─── */}
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>رقم</Text>
                <Text style={styles.thEn}>SI</Text>
              </View>
              <View style={[styles.thCell, { width: "35%" }]}>
                <Text style={styles.thAr}>وصف</Text>
                <Text style={styles.thEn}>Description</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "8%" }]}>
                <Text style={styles.thAr}>وحدة</Text>
                <Text style={styles.thEn}>Unit</Text>
              </View>
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thAr}>السعر</Text>
                <Text style={styles.thEn}>Unit Price</Text>
              </View>
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thAr}>إجمالي</Text>
                <Text style={styles.thEn}>Gross</Text>
              </View>
              <View style={[styles.thCell, { width: "11%" }]}>
                <Text style={styles.thAr}>ضريبة</Text>
                <Text style={styles.thEn}>VAT Amount</Text>
              </View>
              <View style={[styles.thCell, { width: "11%", borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>مجموع</Text>
                <Text style={styles.thEn}>Total</Text>
              </View>
            </View>

            {/* Table Body */}
            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdEmpty}>No items / لا توجد أصناف</Text>
                </View>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <View style={[styles.tdCell, styles.alignCenter, { width: "6%" }]}>
                    <Text style={styles.tdText}>{row.si}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignLeft, { width: "35%" }]}>
                    <Text style={styles.tdDescription}>{row.desc}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "9%" }]}>
                    <Text style={styles.tdText}>{formatQty(row.qty)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignCenter, { width: "8%" }]}>
                    <Text style={styles.tdText}>{row.unit}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "10%" }]}>
                    <Text style={styles.tdText}>{formatNumber(row.unitPrice)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "10%" }]}>
                    <Text style={styles.tdText}>{formatNumber(row.gross)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "11%" }]}>
                    <Text style={styles.tdText}>{formatNumber(row.vat)}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.alignRight, { width: "11%", borderRightWidth: 0 }]}>
                    <Text style={styles.tdText}>{formatNumber(row.total)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ─── Footer: Amount in Words & Totals Box ─── */}
          <View style={styles.footerContainer}>
            {/* Amount in Words (Left) */}
            <View style={styles.wordsContainer}>
              <View style={styles.wordsLabelRow}>
                <Text style={styles.wordsLabel}>Amount in Words : </Text>
                <Text style={styles.wordsLabelAr}>المبلغ بالكلمات</Text>
              </View>
              {toText(invoice.notes) ? (
                <Text style={styles.wordsValue}>{toText(invoice.notes)}</Text>
              ) : null}
            </View>

            {/* Totals Summary Box (Right) */}
            <View style={styles.totalsTable}>
              {/* Total Gross */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelEn}>Total Gross</Text>
                  <Text style={styles.totalLabelAr}>مجموع إجمالي</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatNumber(sumGross)}</Text>
                </View>
              </View>

              {/* Total Discount */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelEn}>Total Discount</Text>
                  <Text style={styles.totalLabelAr}>إجمالي الخصم</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatNumber(sumDisc)}</Text>
                </View>
              </View>

              {/* Total VAT */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.totalLabelEn}>Total VAT</Text>
                  <Text style={styles.totalLabelAr}>مجموع الضريبة</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.totalValueText}>{formatNumber(sumVat)}</Text>
                </View>
              </View>

              {/* Grand Total */}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <View style={styles.totalLabelCell}>
                  <Text style={styles.grandTotalLabelEn}>Grand Total</Text>
                  <Text style={styles.grandTotalLabelAr}>صافي إجمال</Text>
                </View>
                <View style={styles.totalValueCell}>
                  <Text style={styles.grandTotalValueText}>{formatNumber(sumTotal)}</Text>
                </View>
              </View>
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
    backgroundColor: "#FFFFFF",
    padding: 16,
    fontSize: 8,
    color: "#000000",
  },
  mainContainer: {
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 0,
    overflow: "hidden",
  },
  // Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    width: "65%",
  },
  companyName: {
    fontSize: 12,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
  },
  companyMeta: {
    fontSize: 7.5,
    color: "#333333",
    lineHeight: 1.3,
  },
  headerRight: {
    width: "35%",
    alignItems: "flex-end",
  },
  qrContainer: {
    borderWidth: 0.75,
    borderColor: "#000000",
    padding: 3,
  },
  qrImage: {
    width: 68,
    height: 68,
  },
  horizontalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    width: "100%",
  },
  // Info Section
  infoSection: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoColLeft: {
    flexDirection: "row",
    alignItems: "center",
    width: "55%",
  },
  infoColRight: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "45%",
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  infoValueBold: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  dateValuesCol: {
    flexDirection: "column",
  },
  supplyDateLabel: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  titleWrapper: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 8.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  // Items Table
  tableContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    marginHorizontal: 0,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#000000",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    color: "#FFFFFF",
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
  },
  thEn: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 18,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#CCCCCC",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  alignCenter: {
    alignItems: "center",
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  tdText: {
    fontSize: 7.5,
    color: "#000000",
  },
  tdDescription: {
    fontSize: 7.5,
    color: "#000000",
    lineHeight: 1.2,
  },
  tdEmpty: {
    fontSize: 7.5,
    color: "#666666",
    textAlign: "center",
    paddingVertical: 6,
  },
  // Footer
  footerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  wordsContainer: {
    width: "55%",
    paddingLeft: 12,
    paddingTop: 8,
  },
  wordsLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordsLabel: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  wordsLabelAr: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  wordsValue: {
    fontSize: 7.5,
    color: "#333333",
    marginTop: 4,
  },
  // Summary Totals
  totalsTable: {
    width: "45%",
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
  },
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    minHeight: 16,
    alignItems: "center",
  },
  totalLabelCell: {
    width: "60%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  totalLabelEn: {
    fontSize: 7.5,
    color: "#000000",
  },
  totalLabelAr: {
    fontSize: 7.5,
    color: "#000000",
  },
  totalValueCell: {
    width: "40%",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderLeftWidth: 0.5,
    borderLeftColor: "#CCCCCC",
  },
  totalValueText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  grandTotalRow: {
    borderBottomWidth: 0,
  },
  grandTotalLabelEn: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  grandTotalLabelAr: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },
  grandTotalValueText: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
});
