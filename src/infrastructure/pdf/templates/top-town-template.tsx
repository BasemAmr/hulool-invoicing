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

export interface TopTownTemplateProps {
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

function tafqeetTopTown(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const hundreds = ["", "ثلاثمائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

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

  result += " ريالاً سعودياً";

  if (decimalPart > 0) {
    result += ` و ${convertGroup(decimalPart)} هللة`;
  }

  return `${result} فقط لا غير`;
}

export function TopTownTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: TopTownTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDate = invoice.issueDate ? invoice.issueDate.slice(0, 10) : "";

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];
  const tafqeetText = tafqeetTopTown(totalVal);

  const customerTaxId = customer.vatNumber || "";
  const customerNo = (customer as any).customerNumber || (customer as any).code || "";
  const customerAddress = [
    customer.addressCity,
    customer.addressStreet,
  ].filter(Boolean).join(" - ");

  const bankAccount = (company as any).bankAccount || "";
  // NOTE: company.clientEmployee ("تابع للعميل") is admin-only and must never
  // appear on invoice/receipt PDFs — salesman row removed.

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if provided */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER BOX WITH LOGO ─── */}
        <View style={styles.headerBox}>
          {/* Company Texts */}
          <View style={logoDataUrl ? styles.headerTextWrapWithLogo : styles.headerTextWrapFull}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.activityText}>س ت - {company.crNumber}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.vatText}>
                الرقم الضريبي VAT: {company.vatNumber}
              </Text>
            ) : null}
          </View>

          {/* Optional Logo */}
          {logoDataUrl ? (
            <View style={styles.headerLogoWrap}>
              <Image src={logoDataUrl} style={styles.logoImg} />
            </View>
          ) : null}
        </View>

        {/* ─── 2. METADATA 3-BOX GRID ─── */}
        <View style={styles.metaRow}>
          {/* Box 1: Left (Address, Phone, Output Slip, Notes) */}
          <View style={styles.metaBoxLeft}>
            <View style={styles.metaLine}>
              <Text style={styles.metaVal}>{customerAddress}</Text>
              <Text style={styles.metaLbl}>: العنوان</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaVal}>{customer.phone || ""}</Text>
              <Text style={styles.metaLbl}>: التليفون</Text>
            </View>
            {(invoice as any).outputSlip || (invoice as any).slipNumber ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaVal}>
                  {(invoice as any).outputSlip || (invoice as any).slipNumber}
                </Text>
                <Text style={styles.metaLbl}>: سند إخراج</Text>
              </View>
            ) : null}
            <View style={[styles.metaLine, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaVal}>{invoice.notes || ""}</Text>
              <Text style={styles.metaLbl}>: ملاحظات</Text>
            </View>
          </View>

          {/* Box 2: Middle (Invoice No, Title, Payment Type, Tax ID) */}
          <View style={styles.metaBoxCenter}>
            <View style={styles.metaLine}>
              <Text style={styles.metaValBold}>{invoiceNum}</Text>
              <Text style={styles.metaLbl}>: رقم الفاتورة</Text>
            </View>
            <View style={styles.metaTitleLine}>
              <Text style={styles.metaTitleText}>فاتورة ضريبية</Text>
            </View>
            {(invoice as any).paymentMethod || (invoice as any).paymentType ? (
              <View style={styles.metaPaymentLine}>
                <Text style={styles.metaPaymentText}>
                  {(invoice as any).paymentMethod === "credit" || (invoice as any).paymentType === "credit"
                    ? "أجل"
                    : (invoice as any).paymentMethod === "cash" || (invoice as any).paymentType === "cash"
                    ? "نقد"
                    : (invoice as any).paymentMethod === "transfer" || (invoice as any).paymentType === "transfer"
                    ? "تحويل"
                    : (invoice as any).paymentMethod || (invoice as any).paymentType || ""}
                </Text>
              </View>
            ) : null}
            <View style={[styles.metaLine, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaVal}>{customerTaxId}</Text>
              <Text style={styles.metaLbl}>: الرقم الضريبي</Text>
            </View>
          </View>

          {/* Box 3: Right (Date, Customer No, Customer Name) */}
          <View style={styles.metaBoxRight}>
            <View style={styles.metaLine}>
              <Text style={styles.metaVal}>{issueDate}</Text>
              <Text style={styles.metaLbl}>: التاريخ</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaVal}>{customerNo}</Text>
              <Text style={styles.metaLbl}>: رقم العميل</Text>
            </View>
            <View style={[styles.metaLine, { borderBottomWidth: 0, minHeight: 28 }]}>
              <Text style={styles.metaValBold}>{customer.nameAr || ""}</Text>
              <Text style={styles.metaLbl}>: اسم العميل</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE ─── */}
        <View style={styles.tableWrap}>
          {/* Table Header (RTL) */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, styles.colTotal]}>القيمة الإجمالية</Text>
            <Text style={[styles.thCell, styles.colDiscount]}>الخصم</Text>
            <Text style={[styles.thCell, styles.colPrice]}>السعر</Text>
            <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, styles.colUnit]}>الوحدة</Text>
            <Text style={[styles.thCell, styles.colDesc]}>البيـــــــــــــــــــــــــــــــــان</Text>
            <Text style={[styles.thCell, styles.colCode]}>رقم الصنف</Text>
            <Text style={[styles.thCell, styles.colIndex]}>تسلسل</Text>
          </View>

          {/* Table Rows */}
          <View style={styles.tableBody}>
            {items.map((item, idx) => {
              const qty = parseFloat(String(item.quantity || 1));
              const price = parseFloat(String(item.unitPrice || 0));
              const lineDiscount = parseFloat(String(item.discountAmount || (item as any).discount || 0));
              const lineTotal = parseFloat(String(item.lineTotal || (item as any).total || qty * price));
              const code = (item as any).barcode || (item as any).itemCode || (item as any).code || "";
              const unit = (item as any).unitName || (item as any).unit || "";

              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdCell, styles.colTotal]}>
                    {formatNumber(lineTotal, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colDiscount]}>
                    {formatNumber(lineDiscount, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colPrice]}>
                    {formatNumber(price, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colQty]}>
                    {formatNumber(qty, 2)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colUnit]}>{unit}</Text>
                  <Text style={[styles.tdCell, styles.colDesc, styles.textRight]}>
                    {item.description || ""}
                  </Text>
                  <Text style={[styles.tdCell, styles.colCode]}>{code}</Text>
                  <Text style={[styles.tdCell, styles.colIndex]}>{idx + 1}</Text>
                </View>
              );
            })}
          </View>

          {/* Vertical Bank Account text along the right margin if present */}
          {bankAccount ? (
            <View style={styles.verticalBankBox}>
              <Text style={styles.verticalBankText}>
                رقم الحساب {bankAccount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ─── 4. TOTALS & QR SECTION ─── */}
        <View style={styles.bottomSection}>
          {/* Left: ZATCA QR Code */}
          <View style={styles.qrWrap}>
            {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrImg} /> : null}
          </View>

          {/* Right: Totals Table */}
          <View style={styles.totalsTableWrap}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsValCell}>{formatNumber(subtotalVal, 2)}</Text>
              <Text style={styles.totalsLblCell}>المجمـــــــــوع</Text>
            </View>

            {/* Row 2: VAT Amount */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsValCell}>{formatNumber(taxVal, 2)}</Text>
              <Text style={styles.totalsLblCell}>القيمة المضافة</Text>
            </View>

            {/* Row 3: Discount with Tafqeet inline */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsValCell}>{formatNumber(discountVal, 2)}</Text>
              <Text style={styles.totalsLblCell}>الخصم</Text>
              <View style={styles.tafqeetInlineWrap}>
                <Text style={styles.tafqeetInlineText}>{tafqeetText}</Text>
              </View>
            </View>

            {/* Row 4: Grand Total */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalsValBold}>{formatNumber(totalVal, 2)}</Text>
              <Text style={styles.totalsLblBold}>الإجمـــــــــــــــــــــــــالي</Text>
            </View>
          </View>
        </View>

        {/* ─── 5. BOTTOM SIGNATURES ─── */}
        <View style={styles.signaturesRow}>
          <Text style={styles.sigItem}>توقيع المشتري: ..........................</Text>
          <Text style={styles.sigItem}>المشتري: ..........................</Text>
          <Text style={styles.sigItem}>المندوب: ..........................</Text>
          <Text style={styles.sigItem}>البائع: ..........................</Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontSize: 8,
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
  headerBox: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerTextWrapWithLogo: {
    width: "78%",
    alignItems: "center",
  },
  headerTextWrapFull: {
    width: "100%",
    alignItems: "center",
  },
  companyNameAr: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "center",
  },
  companyNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 3,
    textAlign: "center",
  },
  activityText: {
    fontSize: 8,
    color: "#333333",
    marginBottom: 2,
    textAlign: "center",
  },
  vatText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  headerLogoWrap: {
    width: "20%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },

  // ─── Metadata 3-Box Grid ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 6,
    gap: 4,
  },
  metaBoxLeft: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  metaBoxCenter: {
    width: "34%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: "center",
  },
  metaBoxRight: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  metaLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    paddingVertical: 2,
  },
  metaLbl: {
    fontSize: 7.5,
    color: "#444444",
  },
  metaVal: {
    fontSize: 7.5,
    color: "#111111",
  },
  metaValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },
  metaTitleLine: {
    paddingVertical: 2,
    alignItems: "center",
  },
  metaTitleText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
  },
  metaPaymentLine: {
    paddingVertical: 1,
    alignItems: "center",
  },
  metaPaymentText: {
    fontSize: 8,
    color: "#222222",
  },

  // ─── Items Table ───
  tableWrap: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 2,
    position: "relative",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderBottomWidth: 1,
    borderBottomColor: "#4A4A4A",
    minHeight: 20,
    alignItems: "center",
  },
  thCell: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
    paddingVertical: 3,
    borderRightWidth: 0.75,
    borderRightColor: "#4A4A4A",
    height: "100%",
  },
  tableBody: {
    minHeight: 180,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 18,
    alignItems: "center",
  },
  tdCell: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#777777",
    height: "100%",
  },
  textRight: {
    textAlign: "right",
    paddingRight: 6,
  },

  // Column Widths (RTL order)
  colTotal: { width: "13%" },
  colDiscount: { width: "8%" },
  colPrice: { width: "10%" },
  colQty: { width: "8%" },
  colUnit: { width: "8%" },
  colDesc: { width: "34%" },
  colCode: { width: "14%" },
  colIndex: { width: "5%", borderRightWidth: 0 },

  // Vertical text along side
  verticalBankBox: {
    position: "absolute",
    bottom: 6,
    right: 4,
    transform: "rotate(-90deg)",
    transformOrigin: "right bottom",
  },
  verticalBankText: {
    fontSize: 6.5,
    color: "#555555",
  },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    marginBottom: 6,
  },
  qrWrap: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: "#4A4A4A",
  },
  qrImg: {
    width: 75,
    height: 75,
  },
  totalsTableWrap: {
    width: "75%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#555555",
    paddingVertical: 3,
    paddingHorizontal: 8,
    position: "relative",
  },
  totalsLblCell: {
    width: "24%",
    fontSize: 8,
    color: "#222222",
    textAlign: "right",
  },
  totalsValCell: {
    width: "18%",
    fontSize: 8,
    color: "#111111",
    textAlign: "left",
  },
  totalsLblBold: {
    width: "24%",
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  totalsValBold: {
    width: "18%",
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },
  tafqeetInlineWrap: {
    position: "absolute",
    left: 8,
    top: 3,
  },
  tafqeetInlineText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
  },
  salesmanRow: {
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  salesmanText: {
    fontSize: 7,
    color: "#555555",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#A0A0A0",
  },
  sigItem: {
    fontSize: 7.5,
    color: "#333333",
  },
});
