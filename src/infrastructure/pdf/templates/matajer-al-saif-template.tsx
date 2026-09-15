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

export interface MatajerAlSaifTemplateProps {
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

function formatDayDateTime(issuedAt?: string | null, issueDate?: string): { dateStr: string; timeStr: string } {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let d = new Date();
  if (issuedAt) {
    try {
      d = new Date(issuedAt);
    } catch {
      // fallback
    }
  } else if (issueDate) {
    try {
      d = new Date(issueDate);
    } catch {
      // fallback
    }
  }

  const dayName = days[d.getDay()] || "Tuesday";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "م" : "ص";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${dayName}, ${day}-${month}-${year}, ${hoursStr}:${mins} ${ampm}`,
  };
}

export function MatajerAlSaifTemplate({
  invoice,
  company,
  customer,
  qrDataUrl,
  logoDataUrl,
}: MatajerAlSaifTemplateProps) {
  const invoiceNum = invoice.invoiceNumber || "";
  const { dateStr, timeStr } = formatDayDateTime(invoice.issuedAt, invoice.issueDate);

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];

  // Dynamic height calculation for 80mm roll paper (226pt width)
  const pageHeight = Math.max(540, 420 + items.length * 44);

  // Barcode bars pattern
  const barcodeBars = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4];

  const companyAddress = [company.addressCity, company.addressDistrict].filter(Boolean).join(" - ");

  return (
    <Document
      title={`فاتورة ضريبية مبسطة ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Simplified Tax Invoice POS"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {/* ─── 1. TOP HEADER ─── */}
        <View style={styles.header}>
          {logoDataUrl && (
            <Image src={logoDataUrl} style={{ width: 48, height: 48, objectFit: "contain", marginBottom: 4 }} />
          )}
          <Text style={styles.companyTitle}>{company.nameAr || ""}</Text>
          {companyAddress ? (
            <Text style={styles.companySubtitle}>{companyAddress}</Text>
          ) : null}
          {company.vatNumber ? (
            <Text style={styles.vatText}>
              الرقم الضريبي : {company.vatNumber}
            </Text>
          ) : null}
        </View>

        {/* ─── 2. TITLE BOX ─── */}
        <View style={styles.titleBox}>
          <Text style={styles.titleAr}>فاتورة ضريبية مبسطة</Text>
          <Text style={styles.titleEn}>Simplified Tax Invoice</Text>
        </View>

        {/* ─── 3. SUB-BOX ─── */}
        <View style={styles.typeBox}>
          <Text style={styles.typeText}>مبيعات نقاط بيع / نقدي</Text>
        </View>

        {/* ─── 4. META ROW ─── */}
        <View style={styles.metaBox}>
          <Text style={styles.metaText}>{invoiceNum} : الرقم</Text>
          <Text style={styles.metaText}>{dateStr} : التاريخ</Text>
        </View>

        {/* ─── 5. 1D BARCODE ─── */}
        <View style={styles.barcodeWrap}>
          <View style={styles.barcodeLines}>
            {barcodeBars.map((w, idx) => (
              <View
                key={idx}
                style={[
                  styles.barcodeBar,
                  { width: w, backgroundColor: idx % 2 === 0 ? "#000000" : "transparent" },
                ]}
              />
            ))}
          </View>
        </View>

        {/* ─── 6. CUSTOMER & SELLER BOXES ─── */}
        {customer.nameAr ? (
          <View style={styles.infoRowBox}>
            <Text style={styles.infoRowText}>
              العميل : {customer.nameAr}
            </Text>
          </View>
        ) : null}

        {/* ─── 7. ITEMS TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Header Bar with Dark Burgundy Background */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, styles.colNet]}>الصافي</Text>
            <Text style={[styles.thCell, styles.colTax]}>الضريبة</Text>
            <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, styles.colPrice]}>سعر الوحدة</Text>
            <Text style={[styles.thCell, styles.colUnit]}>الوحدة</Text>
          </View>

          {/* Rows */}
          {items.map((item, idx) => {
            const qty = parseFloat(String(item.quantity || 1));
            const price = parseFloat(String(item.unitPrice || 0));
            const tax = parseFloat(String((item as any).taxAmount || (item as any).lineVat || price * qty * 0.15));
            const net = parseFloat(String((item as any).total || (item as any).lineTotal || price * qty + tax));
            const unit = (item as any).unitName || (item as any).unit || "حبة";

            return (
              <View key={idx} style={styles.itemRowWrap}>
                {/* Line 1: Item Description */}
                <View style={styles.itemNameLine}>
                  <Text style={styles.itemNameText}>{item.description}</Text>
                </View>

                {/* Line 2: Values */}
                <View style={styles.itemValuesLine}>
                  <Text style={[styles.tdCell, styles.colNet]}>{formatNumber(net, 2)}</Text>
                  <Text style={[styles.tdCell, styles.colTax]}>{formatNumber(tax, 2)}</Text>
                  <Text style={[styles.tdCell, styles.colQty]}>{qty}</Text>
                  <Text style={[styles.tdCell, styles.colPrice]}>{formatNumber(price, 2)}</Text>
                  <Text style={[styles.tdCell, styles.colUnit]}>{unit}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 8. TOTALS BOX ─── */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatNumber(subtotalVal, 2)}</Text>
            <Text style={styles.totalLbl}>الإجمالي غير شامل ضريبة القيمة المضافة</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatNumber(discountVal, 2)}</Text>
            <Text style={styles.totalLbl}>إجمالي الخصم</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatNumber(taxVal, 2)}</Text>
            <Text style={styles.totalLbl}>يشمل ضريبة القيمة المضافة 15 %</Text>
          </View>
          <View style={[styles.totalRow, styles.netTotalRow]}>
            <Text style={styles.netTotalVal}>{formatNumber(totalVal, 2)}</Text>
            <Text style={styles.netTotalLbl}>صافي الفاتورة</Text>
          </View>
        </View>

        {/* ─── 9. QR CODE ─── */}
        <View style={styles.qrSection}>
          {qrDataUrl && <Image src={qrDataUrl} style={styles.qrImage} />}
        </View>

        {/* ─── 10. FOOTER ─── */}
        <View style={styles.footerSection}>
          <Text style={styles.dateTimeBottom}>{timeStr}</Text>
          <Text style={styles.legalNotice}>
            الأسعار شاملة الضريبة على الأصناف الخاضعة للضريبة
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
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 8,
    color: "#111111",
    alignItems: "center",
  },

  // ─── Header ───
  header: {
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  companyTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "center",
  },
  companySubtitle: {
    fontSize: 10,
    color: "#333333",
    marginBottom: 3,
    textAlign: "center",
  },
  vatText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },

  // ─── Title Box ───
  titleBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingVertical: 4,
    alignItems: "center",
    marginBottom: 4,
  },
  titleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
  },
  titleEn: {
    fontSize: 8,
    color: "#444444",
  },

  // ─── Type Box ───
  typeBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingVertical: 3,
    alignItems: "center",
    marginBottom: 4,
  },
  typeText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#222222",
  },

  // ─── Meta Box ───
  metaBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  metaText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
  },

  // ─── 1D Barcode ───
  barcodeWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  barcodeLines: {
    flexDirection: "row",
    height: 28,
    alignItems: "stretch",
    justifyContent: "center",
  },
  barcodeBar: {
    height: "100%",
    marginRight: 1.5,
  },

  // ─── Info Row Box ───
  infoRowBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: "flex-end",
    marginBottom: 4,
  },
  infoRowText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "right",
  },

  // ─── Items Table ───
  tableContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#4E1A24", // Deep dark maroon
    paddingVertical: 3,
    alignItems: "center",
  },
  thCell: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  itemRowWrap: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#666666",
    paddingVertical: 3,
  },
  itemNameLine: {
    paddingHorizontal: 6,
    marginBottom: 2,
    alignItems: "flex-end",
  },
  itemNameText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  itemValuesLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  tdCell: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "center",
  },

  colNet: { width: "23%" },
  colTax: { width: "20%" },
  colQty: { width: "17%" },
  colPrice: { width: "22%" },
  colUnit: { width: "18%" },

  // ─── Totals Box ───
  totalsContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: "#666666",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  totalLbl: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "left",
  },
  netTotalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#FAFAFA",
    paddingVertical: 3.5,
  },
  netTotalLbl: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  netTotalVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },

  // ─── QR Section ───
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  qrImage: {
    width: 105,
    height: 105,
  },

  // ─── Footer ───
  footerSection: {
    alignItems: "center",
    width: "100%",
  },
  dateTimeBottom: {
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 3,
    textAlign: "center",
  },
  legalNotice: {
    fontSize: 7,
    color: "#444444",
    textAlign: "center",
  },
});
