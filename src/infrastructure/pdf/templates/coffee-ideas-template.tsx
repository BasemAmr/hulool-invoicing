import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Circle,
} from "@react-pdf/renderer";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface CoffeeIdeasTemplateProps {
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

function tafqeetCoffee(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  function convertGroup(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const o = rem % 10;

    const parts: string[] = [];
    if (h > 0 && hundreds[h]) parts.push(hundreds[h] as string);
    if (rem >= 10 && rem <= 19 && teens[rem - 10]) {
      parts.push(teens[rem - 10] as string);
    } else {
      if (o > 0 && ones[o]) parts.push(ones[o] as string);
      if (t > 0 && tens[t]) parts.push(tens[t] as string);
    }
    return parts.join(" و ");
  }

  let result = "";
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    result += convertGroup(millions) + (millions === 1 ? " مليون" : millions === 2 ? " مليونان" : " ملايين");
  }
  const rem1 = integerPart % 1000000;
  if (rem1 >= 1000) {
    const thousands = Math.floor(rem1 / 1000);
    const thText = convertGroup(thousands) + (thousands === 1 ? " ألف" : thousands === 2 ? " ألفان" : " آلاف");
    result += (result ? " و " : "") + thText;
  }
  const rem2 = rem1 % 1000;
  if (rem2 > 0) {
    result += (result ? " و " : "") + convertGroup(rem2);
  }

  if (decimalPart > 0) {
    result += ` و ${convertGroup(decimalPart)} هللة`;
  }

  return result.trim();
}

export function CoffeeIdeasTemplate({
  invoice,
  company,
  customer,
  template,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: CoffeeIdeasTemplateProps) {
  const paperSize = "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDate = invoice.issueDate ? invoice.issueDate.slice(0, 10).replace(/-/g, "/") : "";

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];

  const tafqeetText = totalVal > 0 ? tafqeetCoffee(totalVal) : "";

  // Bank Info from settings or company
  const bankAccount = (company as any).bankAccount || "";
  const ibanNumber = (company as any).iban || "";

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="landscape" style={styles.page}>
        {backgroundDataUrl && (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        )}
        <View style={styles.outerBorder}>
          {/* ─── 1. TOP HEADER BOX (Rounded border) ─── */}
          <View style={styles.headerBox}>
            {/* Left: English company info */}
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitleEn}>{company.nameEn || ""}</Text>
              {company.phone ? (
                <Text style={styles.headerFieldEn}>phon_No    {company.phone}</Text>
              ) : null}
              {company.vatNumber ? (
                <Text style={styles.headerFieldEn}>Text_No    {company.vatNumber}</Text>
              ) : null}
            </View>

            {/* Center: Logo */}
            <View style={styles.headerCenter}>
              {logoDataUrl ? (
                <Image src={logoDataUrl} style={styles.logoImg} />
              ) : null}
            </View>

            {/* Right: Arabic company info */}
            <View style={styles.headerRight}>
              <Text style={styles.headerTitleAr}>{company.nameAr || ""}</Text>
              {company.phone ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.phone}</Text>
                  <Text style={styles.fieldLblAr}>/ رقم التلفون</Text>
                </View>
              ) : null}
              {(company as any).fax ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{(company as any).fax}</Text>
                  <Text style={styles.fieldLblAr}>/ رقم الفاكس</Text>
                </View>
              ) : null}
              {company.vatNumber ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.vatNumber}</Text>
                  <Text style={styles.fieldLblAr}>/ الرقم الضريبي</Text>
                </View>
              ) : null}
              {company.crNumber ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.crNumber}</Text>
                  <Text style={styles.fieldLblAr}>/ السجل التجاري</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── 2. INVOICE META BAR (Single row across) ─── */}
          <View style={styles.metaRow}>
            {/* Left: Invoice Number */}
            <View style={styles.metaLeft}>
              <Text style={styles.metaText}>{invoiceNum} : رقم الفاتورة</Text>
            </View>

            {/* Payment Method */}
            <View style={styles.metaCenterLeft}>
              <Text style={styles.metaText}>نقدا</Text>
            </View>

            {/* Center: Title */}
            <View style={styles.metaCenter}>
              <Text style={styles.metaTitleText}>فاتورة ضريبية</Text>
            </View>

            {/* Right: Invoice Date */}
            <View style={styles.metaRight}>
              <Text style={styles.metaText}>{issueDate} : تاريخ الفاتورة</Text>
            </View>
          </View>

          {/* ─── 3. ITEMS TABLE (9 Columns) ─── */}
          <View style={styles.tableContainer}>
            {/* Header Row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, styles.colTotal]}>الإجمالي شامل الضريبة</Text>
              <Text style={[styles.thCell, styles.colPriceAfter]}>السعر بعد الضريبة</Text>
              <Text style={[styles.thCell, styles.colTax]}>الضريبة</Text>
              <Text style={[styles.thCell, styles.colPriceBefore]}>السعر قبل الضريبة</Text>
              <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
              <Text style={[styles.thCell, styles.colUnit]}>الوحدة</Text>
              <Text style={[styles.thCell, styles.colName]}>إسم الصنف</Text>
              <Text style={[styles.thCell, styles.colCode]}>رقم الصنف</Text>
              <Text style={[styles.thCell, styles.colIdx]}>#</Text>
            </View>

            {/* Table Rows */}
            {items.map((item, idx) => {
              const qty = parseFloat(String(item.quantity || 1));
              const priceBefore = parseFloat(String(item.unitPrice || 0));
              const taxRate = parseFloat(String((item as any).vatRate || (item as any).taxRate || 15)) / 100;
              const unitTax = priceBefore * taxRate;
              const priceAfter = priceBefore + unitTax;
              const lineTotal = parseFloat(String((item as any).total || (item as any).lineTotal || qty * priceAfter));
              const code = (item as any).barcode || (item as any).itemCode || `10300${idx + 1}`;
              const unit = (item as any).unitName || (item as any).unit || "حبه";

              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdCell, styles.colTotal]}>
                    {formatNumber(lineTotal, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colPriceAfter]}>
                    {formatNumber(priceAfter, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colTax]}>
                    {formatNumber(unitTax * qty, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colPriceBefore]}>
                    {formatNumber(priceBefore, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colQty]}>{qty}</Text>
                  <Text style={[styles.tdCell, styles.colUnit]}>{unit}</Text>
                  <Text style={[styles.tdCell, styles.colName, styles.textRight]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.tdCell, styles.colCode]}>{code}</Text>
                  <Text style={[styles.tdCell, styles.colIdx]}>{idx + 1}</Text>
                </View>
              );
            })}
          </View>

          {/* ─── 4. LOWER SECTION: Left Totals, Middle Bank & Tafqeet, Right QR ─── */}
          <View style={styles.bottomSection}>
            {/* Left Column: Totals Table */}
            <View style={styles.totalsTable}>
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatNumber(subtotalVal, 2)}</Text>
                <Text style={styles.totalsTableLbl}>الإجمالي</Text>
              </View>
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatNumber(discountVal, 2)}</Text>
                <Text style={styles.totalsTableLbl}>إجمالي التخفيض</Text>
              </View>
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>-</Text>
                <Text style={styles.totalsTableLbl}>إجمالي الأعباء</Text>
              </View>
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatNumber(taxVal, 2)}</Text>
                <Text style={styles.totalsTableLbl}>إجمالي الضريبة 15 %</Text>
              </View>
              <View style={[styles.totalsTableRow, styles.netRow]}>
                <Text style={styles.netValText}>{formatNumber(totalVal, 2)} SAR</Text>
                <Text style={styles.netLblText}>الصافي</Text>
              </View>
            </View>

            {/* Middle Column: Bank Accounts & Tafqeet */}
            <View style={styles.bankAndTafqeet}>
              <View style={styles.bankCard}>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankValText}>{bankAccount}</Text>
                  <Text style={styles.bankLblText}>: رقم الحساب</Text>
                </View>
                <View style={[styles.bankCardRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.bankValText}>{ibanNumber}</Text>
                  <Text style={styles.bankLblText}>: رقم الآيبان</Text>
                </View>
              </View>

              <View style={styles.tafqeetWrap}>
                <Text style={styles.tafqeetText}>{tafqeetText} لا غير</Text>
              </View>
            </View>

            {/* Right Column: QR Code */}
            <View style={styles.qrColumn}>
              {qrDataUrl && <Image src={qrDataUrl} style={styles.qrImg} />}
            </View>
          </View>

          {/* ─── 5. SIGNATURES ROW ─── */}
          <View style={styles.signaturesRow}>
            <Text style={styles.sigText}>
              المندوب: .....................................................
            </Text>
            <Text style={styles.sigText}>
              المستلم: .....................................................
            </Text>
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
    fontSize: 8.5,
    color: "#222222",
  },
  backgroundImage: {
    position: "absolute",
    top: "20%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  outerBorder: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 6,
    padding: 10,
    flex: 1,
    justifyContent: "space-between",
  },

  // ─── Header Box ───
  headerBox: {
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    width: "35%",
    alignItems: "flex-start",
  },
  headerTitleEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
  },
  headerSubEn: {
    fontSize: 8,
    color: "#333333",
    marginBottom: 4,
  },
  headerFieldEn: {
    fontSize: 8,
    color: "#444444",
    lineHeight: 1.3,
  },

  headerCenter: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 68,
    height: 60,
    objectFit: "contain",
  },
  logoFallbackWrap: {
    alignItems: "center",
  },
  logoSvg: {
    width: 48,
    height: 48,
  },
  logoBadge: {
    backgroundColor: "#111111",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: -8,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "bold",
  },

  headerRight: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerTitleAr: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "right",
  },
  headerSubAr: {
    fontSize: 8,
    color: "#333333",
    marginBottom: 4,
    textAlign: "right",
  },
  headerRightFieldRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 2,
  },
  fieldValAr: {
    fontSize: 8,
    color: "#222222",
    marginRight: 4,
  },
  fieldLblAr: {
    fontSize: 8,
    color: "#444444",
  },

  // ─── Meta Row ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
  },
  metaLeft: {
    width: "25%",
    alignItems: "flex-start",
  },
  metaCenterLeft: {
    width: "15%",
    alignItems: "center",
  },
  metaCenter: {
    width: "30%",
    alignItems: "center",
  },
  metaTitleText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
  },
  metaRight: {
    width: "30%",
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#222222",
  },

  // ─── Table ───
  tableContainer: {
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#E8E8E8",
    borderBottomWidth: 1,
    borderBottomColor: "#555555",
    minHeight: 22,
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
    borderRightColor: "#555555",
    height: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#777777",
    minHeight: 20,
    alignItems: "center",
  },
  tdCell: {
    fontSize: 8,
    color: "#222222",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#777777",
    height: "100%",
  },
  textRight: {
    textAlign: "right",
    paddingRight: 6,
  },

  colTotal: { width: "13%" },
  colPriceAfter: { width: "10%" },
  colTax: { width: "8%" },
  colPriceBefore: { width: "10%" },
  colQty: { width: "7%" },
  colUnit: { width: "7%" },
  colName: { width: "30%" },
  colCode: { width: "11%" },
  colIdx: { width: "4%", borderRightWidth: 0 },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  // Left Totals Table
  totalsTable: {
    width: "30%",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: "#777777",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  totalsTableLbl: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  totalsTableVal: {
    fontSize: 8,
    color: "#111111",
    textAlign: "left",
  },
  netRow: {
    borderBottomWidth: 0,
    backgroundColor: "#F2F2F2",
    paddingVertical: 5,
  },
  netLblText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
  },
  netValText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
  },

  // Middle Column
  bankAndTafqeet: {
    width: "42%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  bankCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    marginBottom: 8,
  },
  bankCardRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: "#777777",
  },
  bankValText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
    marginRight: 6,
  },
  bankLblText: {
    fontSize: 8,
    color: "#444444",
  },
  tafqeetWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 4,
  },
  tafqeetText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },

  // Right QR
  qrColumn: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImg: {
    width: 95,
    height: 95,
  },

  // Signatures
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#A0A0A0",
  },
  sigText: {
    fontSize: 8,
    color: "#333333",
  },
});
