import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Circle,
  Path,
} from "@react-pdf/renderer";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface ManahirPosTemplateProps {
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

function formatDateTimeManahir(issuedAt?: string | null, issueDate?: string): { dateStr: string; timeStr: string } {
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

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");

  return {
    dateStr: `${day}/${month}/${year}`,
    timeStr: `${hoursStr}:${mins}:${secs}${ampm}`,
  };
}

export function ManahirPosTemplate({
  invoice,
  company,
  customer,
  qrDataUrl,
  logoDataUrl,
}: ManahirPosTemplateProps) {
  const invoiceNum = invoice.invoiceNumber || "";
  const { dateStr, timeStr } = formatDateTimeManahir(invoice.issuedAt, invoice.issueDate);

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];

  // Total quantity calculation
  const totalQty = items.reduce((acc, it) => acc + parseFloat(String(it.quantity || 0)), 0);

  // Paid & change
  const paidVal = totalVal > 0 ? totalVal : 0;
  const changeVal = 0;

  // Dynamic height calculation for 80mm roll paper (226pt width)
  const pageHeight = Math.max(520, 380 + items.length * 36);

  const companyAddress = [company.addressStreet, company.addressDistrict, company.addressCity].filter(Boolean).join(" - ");

  return (
    <Document
      title={`فاتورة ضريبية مبسطة ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Simplified Tax Invoice POS"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {/* ─── 1. TOP LOGO & HEADER ─── */}
        <View style={styles.header}>
          {logoDataUrl && (
            <Image src={logoDataUrl} style={styles.logoImg} />
          )}

          <Text style={styles.companyTitle}>
            {company.nameAr || ""}
          </Text>
          {company.nameEn ? (
            <Text style={styles.companySubTitle}>{company.nameEn}</Text>
          ) : null}
          {companyAddress ? (
            <Text style={styles.companyAddress}>{companyAddress}</Text>
          ) : null}
          {company.phone ? (
            <Text style={styles.companyContact}>هاتف رقم : {company.phone}</Text>
          ) : null}
          {company.vatNumber ? (
            <Text style={styles.companyMeta}>الرقم الضريبي : {company.vatNumber}</Text>
          ) : null}
          {company.crNumber ? (
            <Text style={styles.companyMeta}>رقم السجل التجاري : {company.crNumber}</Text>
          ) : null}
        </View>

        {/* ─── 2. TRANSACTION & CASHIER META ─── */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaVal}>{timeStr}</Text>
            <Text style={styles.metaVal}>{dateStr}</Text>
          </View>
          {invoiceNum ? <Text style={styles.metaLine}>Trans No. {invoiceNum}</Text> : null}
          {company.clientEmployee ? (
            <Text style={styles.metaLine}>Cashier. {company.clientEmployee}</Text>
          ) : null}
          {(company as any).branch ? (
            <Text style={styles.metaLine}>Store. {(company as any).branch}</Text>
          ) : null}
          <Text style={[styles.metaLine, { fontWeight: "bold" }]}>نقداً</Text>
          {customer.nameAr ? (
            <View style={styles.metaCustomerRow}>
              <Text style={styles.metaVal}>{customer.nameAr}</Text>
              <Text style={styles.metaLbl}>: اسم العميل</Text>
            </View>
          ) : null}
          {customer.vatNumber ? (
            <View style={styles.metaCustomerRow}>
              <Text style={styles.metaVal}>{customer.vatNumber}</Text>
              <Text style={styles.metaLbl}>: الرقم الضريبي للعميل</Text>
            </View>
          ) : null}
        </View>

        {/* ─── 3. TITLE ─── */}
        <View style={styles.titleWrap}>
          <Text style={styles.invoiceTitle}>فاتورة ضريبية مبسطة</Text>
        </View>

        {/* ─── 4. ITEMS SECTION ─── */}
        <View style={styles.itemsSection}>
          {/* Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thCell, styles.colTotal]}>الإجمالي</Text>
            <Text style={[styles.thCell, styles.colPrice]}>السعر</Text>
            <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, styles.colDesc]}>بيان الصنف</Text>
          </View>

          {/* Rows */}
          {items.map((item, idx) => {
            const qty = parseFloat(String(item.quantity || 1));
            const price = parseFloat(String(item.unitPrice || 0));
            const total = parseFloat(String((item as any).total || (item as any).lineTotal || qty * price));
            const barcode = (item as any).barcode || (item as any).itemCode || "";
            const unit = (item as any).unitName || (item as any).unit || "";

            return (
              <View key={idx} style={styles.itemRow}>
                {/* Line 1: Numbers & Barcode */}
                <View style={styles.itemRowLine1}>
                  <Text style={[styles.tdCell, styles.colTotal]}>{formatNumber(total, 2)}</Text>
                  <Text style={[styles.tdCell, styles.colPrice]}>{formatNumber(price, 2)}</Text>
                  <Text style={[styles.tdCell, styles.colQty]}>{qty}</Text>
                  <Text style={[styles.tdCell, styles.colDesc, styles.barcodeText]}>{barcode}</Text>
                </View>
                {/* Line 2: Name & Unit */}
                <View style={styles.itemRowLine2}>
                  <Text style={styles.itemDescText}>{item.description}</Text>
                  {unit ? <Text style={styles.itemUnitText}>{unit}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS BREAKDOWN ─── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatNumber(discountVal, 2)} ر.س</Text>
            <Text style={styles.totalLbl}>الخصم :</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatNumber(taxVal, 2)} ر.س</Text>
            <Text style={styles.totalLbl}>ضريبة القيمة المضافة :</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatNumber(totalVal, 2)} ر.س</Text>
            <Text style={styles.totalLbl}>الإجمالي النهائي :</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatNumber(paidVal, 2)} ر.س</Text>
            <Text style={styles.totalLbl}>إجمالي المدفوع :</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={[styles.totalVal, styles.boldText]}>{formatNumber(totalVal, 2)} ر.س</Text>
            <Text style={[styles.totalLbl, styles.boldText]}>الصافي :</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatNumber(changeVal, 2)} ر.س</Text>
            <Text style={styles.totalLbl}>الباقي :</Text>
          </View>
        </View>

        {/* ─── 6. PAID & ITEMS SUMMARY ─── */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryBarVal}>{totalQty}</Text>
          <Text style={styles.summaryBarLbl}>عدد القطع</Text>
          <Text style={styles.summaryBarVal}>{formatNumber(paidVal, 2)}</Text>
          <Text style={styles.summaryBarLbl}>المبلغ المدفوع نقداً</Text>
        </View>

        {/* ─── 7. THANK YOU ─── */}
        <View style={styles.thankYouWrap}>
          <Text style={styles.thankYouText}>شكراً لتسوقكم</Text>
        </View>

        {/* ─── 8. ZATCA QR CODE ─── */}
        <View style={styles.qrWrap}>
          {qrDataUrl && <Image src={qrDataUrl} style={styles.qrImage} />}
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
  logoImg: {
    width: 44,
    height: 44,
    objectFit: "contain",
    marginBottom: 4,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  logoSvg: {
    width: 38,
    height: 38,
  },
  logoText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#333333",
    marginTop: -16,
  },
  companyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    marginTop: 8,
    textAlign: "center",
  },
  companySubTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "center",
  },
  companyAddress: {
    fontSize: 8,
    color: "#333333",
    marginBottom: 2,
    textAlign: "center",
  },
  companyContact: {
    fontSize: 8,
    color: "#333333",
    textAlign: "center",
  },
  companyMeta: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },

  // ─── Meta Section ───
  metaSection: {
    width: "100%",
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#DDDDDD",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 7.5,
    color: "#333333",
  },
  metaLine: {
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 1,
    textAlign: "left",
  },
  metaCustomerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 1,
  },
  metaLbl: {
    fontSize: 7.5,
    color: "#333333",
    marginLeft: 4,
  },

  // ─── Title & Barcode ───
  titleWrap: {
    marginVertical: 4,
    alignItems: "center",
  },
  invoiceTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
  },
  barcodeWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  barcodeLines: {
    flexDirection: "row",
    height: 26,
    alignItems: "stretch",
    justifyContent: "center",
  },
  barcodeBar: {
    height: "100%",
    marginRight: 1.5,
  },

  // ─── Items Section ───
  itemsSection: {
    width: "100%",
    marginVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#444444",
    paddingBottom: 2,
    marginBottom: 3,
  },
  thCell: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },
  itemRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    paddingVertical: 3,
  },
  itemRowLine1: {
    flexDirection: "row",
    alignItems: "center",
  },
  tdCell: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "center",
  },
  barcodeText: {
    textAlign: "right",
    fontSize: 7.5,
    fontWeight: "bold",
  },
  itemRowLine2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    paddingHorizontal: 2,
  },
  itemDescText: {
    fontSize: 7,
    color: "#222222",
    textAlign: "right",
    width: "82%",
  },
  itemUnitText: {
    fontSize: 7,
    color: "#666666",
    textAlign: "left",
    width: "18%",
  },

  colTotal: { width: "22%" },
  colPrice: { width: "20%" },
  colQty: { width: "16%" },
  colDesc: { width: "42%" },

  // ─── Totals Section ───
  totalsSection: {
    width: "100%",
    paddingVertical: 4,
    borderTopWidth: 0.75,
    borderTopColor: "#444444",
    borderBottomWidth: 0.75,
    borderBottomColor: "#444444",
    marginVertical: 4,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  totalLbl: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "left",
  },
  boldText: {
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Summary Bar ───
  summaryBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  summaryBarLbl: {
    fontSize: 7.5,
    color: "#333333",
  },
  summaryBarVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
  },

  // ─── Thank You & QR ───
  thankYouWrap: {
    marginVertical: 6,
    alignItems: "center",
  },
  thankYouText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
  },
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  qrImage: {
    width: 95,
    height: 95,
  },
});
