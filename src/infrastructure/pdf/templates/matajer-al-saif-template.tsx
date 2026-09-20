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

// ─── Tafqeet (Spelled-out Arabic numbers for currency) ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertGroup(n: number): string {
  let res = "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0) res += HUNDREDS[h];
  if (rem > 0) {
    if (res) res += " و ";
    if (rem <= 10) res += ONES[rem];
    else if (rem < 20) res += TEENS[rem - 10];
    else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      if (u > 0) res += ONES[u] + " و " + TENS[t];
      else res += TENS[t];
    }
  }
  return res;
}

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);
  let out = "";

  if (millions > 0) {
    if (millions === 1) out += "مليون";
    else if (millions === 2) out += "مليونان";
    else if (millions >= 3 && millions <= 10) out += convertGroup(millions) + " ملايين";
    else out += convertGroup(millions) + " مليون";
  }

  if (thousands > 0) {
    if (out) out += " و ";
    if (thousands === 1) out += "ألف";
    else if (thousands === 2) out += "ألفان";
    else if (thousands >= 3 && thousands <= 10) out += convertGroup(thousands) + " آلاف";
    else out += convertGroup(thousands) + " ألف";
  }

  if (remainder > 0) {
    if (out) out += " و ";
    out += convertGroup(remainder);
  }

  return out;
}

function tafqeet(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (num <= 0) return "صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

/**
 * Format monetary amount with exact raw string/number representation — NEVER floor, ceiling, or round.
 * Preserves the exact raw decimal tail (e.g. 23.4646916641601264) and formats the integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

/**
 * Strict date formatting: DD/MM/YYYY only — NO hours, minutes, seconds, supply date, or due date.
 */
function formatDateOnly(iso?: string | null): string {
  if (!iso) return "";
  try {
    const clean = iso.slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    return clean;
  } catch {
    return iso || "";
  }
}

/**
 * Centered 3-element pattern for thermal POS roll receipts:
 * Renders in row-reverse: [Label (right)] + [Colon (middle)] + [Value (left)]
 * Completely prevents colon flipping and line breaking on narrow paper.
 */
function CenteredMetaLine({
  label,
  value,
  bold = false,
  style,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
  style?: any;
}) {
  if (!value) return null;
  return (
    <View style={[styles.centerRow, style]}>
      <Text style={bold ? styles.centerLabelBold : styles.centerLabel}>{label}</Text>
      <Text style={bold ? styles.centerColonBold : styles.centerColon}>:</Text>
      <Text style={bold ? styles.centerValBold : styles.centerVal}>{String(value)}</Text>
    </View>
  );
}

export function MatajerAlSaifTemplate({
  invoice,
  company,
  customer,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: MatajerAlSaifTemplateProps) {
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDateOnly(invoice.issueDate || invoice.issuedAt);

  // ─── Company Address ───
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
  ].filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  const companyCrOrUnified = company.crNumber || (company as any).unifiedNumber || "";
  const companyUnifiedNo = (company as any).unifiedNumber || "";

  // ─── Customer Details ───
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerAddressParts = [
    customer.addressStreet,
    (customer as any).addressDistrict || (customer as any).district,
    customer.addressCity,
    customer.addressPostalCode,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";

  // ─── Items & Totals Calculations ───
  const items = invoice.items || [];
  const hasAnyDiscount = items.some(
    (item) => Number(item.discountAmount || (item as any).discount || 0) > 0
  );

  const discountVal =
    (invoice as any).discountTotal ??
    items.reduce(
      (sum, it) => sum + Number(it.discountAmount || (it as any).discount || 0),
      0
    );

  const rawSubtotalCalc = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  );

  const grossSubtotal =
    Number(discountVal) > 0
      ? rawSubtotalCalc > 0
        ? rawSubtotalCalc
        : Number(invoice.subtotal || 0) + Number(discountVal)
      : Number(invoice.subtotal || 0);

  const taxableVal =
    invoice.subtotal !== undefined && Number(invoice.subtotal) === Number(grossSubtotal) - Number(discountVal)
      ? invoice.subtotal
      : Number(discountVal) > 0
        ? Math.max(0, Number(grossSubtotal) - Number(discountVal))
        : invoice.subtotal ?? grossSubtotal;

  const vatVal =
    invoice.vatAmount ??
    items.reduce((sum, it) => sum + Number(it.lineVat || 0), 0);

  const totalVal = invoice.total ?? Number(taxableVal) + Number(vatVal);

  const firstItemVatRate = items.find(
    (it) => it.vatRate !== undefined && it.vatRate !== null
  )?.vatRate;
  const vatRatePercentage =
    firstItemVatRate !== undefined ? `${Number(firstItemVatRate)}%` : "15%";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Dynamic Height Calculation for 80mm Roll (226pt width) ───
  let contentHeight = 180; // Top/bottom padding & base header
  const logoSource = logoDataUrl || company.logoUrl;
  if (logoSource) contentHeight += 52;
  if (company.nameEn) contentHeight += 12;
  if (companyAddress) contentHeight += 16;
  if (company.vatNumber) contentHeight += 12;
  if (companyCrOrUnified) contentHeight += 12;
  if (company.phone) contentHeight += 12;
  if (company.email) contentHeight += 12;
  if (company.website) contentHeight += 12;

  // Title box and POS sales sub-box
  contentHeight += 65;

  // Meta box (Invoice Number & Issue Date)
  contentHeight += 40;

  // Customer box
  if (
    customerName ||
    customer.vatNumber ||
    customerCrOrUnified ||
    customerAddress ||
    customer.phone ||
    customer.email
  ) {
    contentHeight += 32;
    if (customerName) contentHeight += 14;
    if (customer.vatNumber) contentHeight += 14;
    if (customerCrOrUnified) contentHeight += 14;
    if (customerAddress) contentHeight += 14;
    if (customer.phone) contentHeight += 14;
    if (customer.email) contentHeight += 14;
  }

  // Items table
  contentHeight += 26; // table header
  items.forEach((item) => {
    contentHeight += 34; // item description + values row
    if (item.description && item.description.length > 30) {
      contentHeight += 12;
    }
  });

  // Totals box
  contentHeight += 80;
  if (hasAnyDiscount) contentHeight += 32;
  if (tafqeetText) contentHeight += 22;
  contentHeight += 32; // Paid & Balance

  // Notes & Terms
  if (invoice.notes) {
    contentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 12;
  }
  if (invoice.terms) {
    contentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 12;
  }

  // ZATCA QR Code
  if (qrDataUrl) {
    contentHeight += 125;
  }

  // Footer & safety margin
  if (company.footerText) contentHeight += 24;
  contentHeight += 40; // Legal notice & breathing room

  const pageHeight = Math.max(560, Math.ceil(contentHeight));

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice POS Receipt"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER (COMPANY DETAILS) ─── */}
        <View style={styles.header}>
          {logoSource ? (
            <Image src={logoSource} style={styles.logo} />
          ) : null}
          <Text style={styles.companyTitle}>{company.nameAr || ""}</Text>
          {company.nameEn ? (
            <Text style={styles.companySubtitleEn}>{company.nameEn}</Text>
          ) : null}
          {companyAddress ? (
            <Text style={styles.companySubtitle}>{companyAddress}</Text>
          ) : null}
          <CenteredMetaLine label="الرقم الضريبي" value={company.vatNumber} bold />
          <CenteredMetaLine label="السجل التجاري" value={company.crNumber} />
          {companyUnifiedNo && companyUnifiedNo !== company.crNumber ? (
            <CenteredMetaLine label="الرقم الموحد" value={companyUnifiedNo} />
          ) : null}
          <CenteredMetaLine label="الهاتف" value={company.phone} />
          <CenteredMetaLine label="البريد" value={company.email} />
          <CenteredMetaLine label="الموقع" value={company.website} />
        </View>

        {/* ─── 2. TITLE BOX ─── */}
        <View style={styles.titleBox}>
          <Text style={styles.titleAr}>فاتورة ضريبية</Text>
          <Text style={styles.titleEn}>Tax Invoice</Text>
        </View>

        {/* ─── 3. SUB-BOX (POS SALES METADATA - NO PAYMENT METHOD) ─── */}
        <View style={styles.typeBox}>
          <Text style={styles.typeText}>مبيعات نقاط بيع / POS Sales</Text>
        </View>

        {/* ─── 4. META BOX (INVOICE NUMBER & ISSUE DATE) ─── */}
        <View style={styles.metaBox}>
          <CenteredMetaLine label="رقم الفاتورة" value={invoiceNum} bold />
          <CenteredMetaLine label="تاريخ الفاتورة" value={issueDateStr} bold style={{ marginTop: 2 }} />
        </View>

        {/* ─── 5. CUSTOMER DETAILS BOX (IF PRESENT) ─── */}
        {customerName ||
        customer.vatNumber ||
        customerCrOrUnified ||
        customerAddress ||
        customer.phone ||
        customer.email ? (
          <View style={styles.infoBox}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.infoBoxTitle}>بيانات العميل / Customer Details</Text>
            </View>
            <CenteredMetaLine label="العميل" value={customerName} bold />
            <CenteredMetaLine label="الرقم الضريبي" value={customer.vatNumber} />
            <CenteredMetaLine label="الرقم الموحد" value={customerCrOrUnified} />
            <CenteredMetaLine label="العنوان" value={customerAddress} />
            <CenteredMetaLine label="الهاتف" value={customer.phone} />
            <CenteredMetaLine label="البريد" value={customer.email} />
          </View>
        ) : null}

        {/* ─── 6. ITEMS TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Header Bar with Dark Burgundy Background (#4E1A24) */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, hasAnyDiscount ? styles.colQtyDisc : styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, hasAnyDiscount ? styles.colPriceDisc : styles.colPrice]}>سعر الوحدة</Text>
            {hasAnyDiscount ? (
              <Text style={[styles.thCell, styles.colDiscount]}>الخصم</Text>
            ) : null}
            <Text style={[styles.thCell, hasAnyDiscount ? styles.colTaxableDisc : styles.colTaxable]}>المبلغ الخاضع</Text>
            <Text style={[styles.thCell, hasAnyDiscount ? styles.colTaxDisc : styles.colTax]}>الضريبة</Text>
            <Text style={[styles.thCell, hasAnyDiscount ? styles.colTotalDisc : styles.colTotal]}>الإجمالي</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, idx) => {
            const qty = Number(item.quantity || 0);
            const price = Number(item.unitPrice || 0);
            const itemDiscount = Number(item.discountAmount || (item as any).discount || 0);
            const lineSub =
              item.lineSubtotal !== undefined && item.lineSubtotal !== null
                ? Number(item.lineSubtotal)
                : Math.max(0, qty * price - itemDiscount);
            const lineVat =
              item.lineVat !== undefined && item.lineVat !== null
                ? Number(item.lineVat)
                : lineSub * Number(item.vatRate || 0.15);
            const lineTot =
              item.lineTotal !== undefined && item.lineTotal !== null
                ? Number(item.lineTotal)
                : lineSub + lineVat;
            const vatRateNum = item.vatRate !== undefined && item.vatRate !== null
              ? Number(item.vatRate)
              : 15;
            const itemVatPct = vatRateNum <= 1 && vatRateNum > 0 ? vatRateNum * 100 : vatRateNum;

            return (
              <View key={item.position ?? idx} style={styles.itemRowWrap}>
                {/* Line 1: Item Description */}
                <View style={styles.itemNameLine}>
                  <Text style={styles.itemNameText}>{item.description}</Text>
                </View>

                {/* Line 2: Values Row */}
                <View style={styles.itemValuesLine}>
                  <Text style={[styles.tdCell, hasAnyDiscount ? styles.colQtyDisc : styles.colQty]}>
                    {formatExactAmount(item.quantity)}
                  </Text>
                  <Text style={[styles.tdCell, hasAnyDiscount ? styles.colPriceDisc : styles.colPrice]}>
                    {formatExactAmount(item.unitPrice)}
                  </Text>
                  {hasAnyDiscount ? (
                    <Text style={[styles.tdCell, styles.colDiscount]}>
                      {itemDiscount > 0 ? formatExactAmount(item.discountAmount ?? itemDiscount) : "0.00"}
                    </Text>
                  ) : null}
                  <Text style={[styles.tdCell, hasAnyDiscount ? styles.colTaxableDisc : styles.colTaxable]}>
                    {formatExactAmount(item.lineSubtotal ?? lineSub)}
                  </Text>
                  <View style={[styles.tdCellStack, hasAnyDiscount ? styles.colTaxDisc : styles.colTax]}>
                    <Text style={styles.tdCell}>
                      {formatExactAmount(item.lineVat ?? lineVat)}
                    </Text>
                    <Text style={styles.tdTaxRate}>({itemVatPct}%)</Text>
                  </View>
                  <Text style={[styles.tdCellBold, hasAnyDiscount ? styles.colTotalDisc : styles.colTotal]}>
                    {formatExactAmount(item.lineTotal ?? lineTot)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 7. TOTALS BOX ─── */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)} SAR</Text>
            <Text style={styles.totalLbl}>الإجمالي غير شامل الضريبة</Text>
          </View>
          {hasAnyDiscount ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>{formatExactAmount(discountVal)} SAR</Text>
                <Text style={styles.totalLbl}>إجمالي الخصم</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>{formatExactAmount(taxableVal)} SAR</Text>
                <Text style={styles.totalLbl}>المبلغ الخاضع للضريبة</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatExactAmount(vatVal)} SAR</Text>
            <Text style={styles.totalLbl}>ضريبة القيمة المضافة ({vatRatePercentage})</Text>
          </View>
          <View style={[styles.totalRow, styles.netTotalRow]}>
            <Text style={styles.netTotalVal}>{formatExactAmount(totalVal)} SAR</Text>
            <Text style={styles.netTotalLbl}>صافي الفاتورة (شامل الضريبة)</Text>
          </View>
          {tafqeetText ? (
            <View style={styles.tafqeetRow}>
              <Text style={styles.tafqeetText}>{tafqeetText}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalVal}>{formatExactAmount(totalVal)} SAR</Text>
            <Text style={styles.totalLbl}>المبلغ المدفوع</Text>
          </View>
          <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.totalVal}>0.00 SAR</Text>
            <Text style={styles.totalLbl}>الرصيد المستحق</Text>
          </View>
        </View>

        {/* ─── 8. NOTES & TERMS ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesContainer}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>ملاحظات</Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={[styles.noteBlock, invoice.notes ? { marginTop: 4 } : {}]}>
                <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 9. ONLY ZATCA QR CODE (NO 1D BARCODES) ─── */}
        {qrDataUrl ? (
          <View style={styles.qrSection}>
            <Image src={qrDataUrl} style={styles.qrImage} />
          </View>
        ) : null}

        {/* ─── 10. FOOTER ─── */}
        <View style={styles.footerSection}>
          <Text style={styles.legalNotice}>
            الأسعار شاملة ضريبة القيمة المضافة على الأصناف الخاضعة للضريبة
          </Text>
          {company.footerText ? (
            <Text style={styles.footerText}>{company.footerText}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 8,
    color: "#111111",
    alignItems: "center",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "15%",
    width: "70%",
    opacity: 0.07,
  },

  // ─── Header ───
  header: {
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "center",
  },
  companySubtitleEn: {
    fontSize: 8.5,
    color: "#3B141C",
    marginBottom: 2,
    textAlign: "center",
  },
  companySubtitle: {
    fontSize: 8,
    color: "#333333",
    marginBottom: 3,
    textAlign: "center",
    paddingHorizontal: 4,
  },

  // ─── Centered 3-Element Metadata Row ───
  centerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 1,
    width: "100%",
  },
  centerLabel: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "right",
  },
  centerLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  centerColon: {
    fontSize: 7.5,
    color: "#333333",
    marginHorizontal: 3,
  },
  centerColonBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    marginHorizontal: 3,
  },
  centerVal: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "left",
  },
  centerValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },

  // ─── Title Box ───
  titleBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingVertical: 3,
    alignItems: "center",
    marginBottom: 3,
  },
  titleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
  },
  titleEn: {
    fontSize: 7.5,
    color: "#444444",
  },

  // ─── Type Box ───
  typeBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingVertical: 2.5,
    alignItems: "center",
    marginBottom: 3,
    backgroundColor: "#FAF7F8",
  },
  typeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#3B141C",
  },

  // ─── Meta Box ───
  metaBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: "center",
    marginBottom: 4,
  },

  // ─── Customer Details Box ───
  infoBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: "center",
    marginBottom: 4,
    backgroundColor: "#FFFFFF",
  },
  infoTitleRow: {
    width: "100%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#666666",
    paddingBottom: 2,
    marginBottom: 3,
    alignItems: "center",
  },
  infoBoxTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4E1A24",
    textAlign: "center",
  },

  // ─── Items Table ───
  tableContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#4E1A24", // Deep dark maroon
    paddingVertical: 3,
    alignItems: "center",
  },
  thCell: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  itemRowWrap: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#888888",
    paddingVertical: 3,
  },
  itemNameLine: {
    paddingHorizontal: 4,
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
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  tdCell: {
    fontSize: 7,
    color: "#222222",
    textAlign: "center",
  },
  tdCellBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  tdCellStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  tdTaxRate: {
    fontSize: 6,
    color: "#555555",
    textAlign: "center",
  },

  // Columns without discount (5 columns)
  colQty: { width: "14%" },
  colPrice: { width: "20%" },
  colTaxable: { width: "21%" },
  colTax: { width: "22%" },
  colTotal: { width: "23%" },

  // Columns with discount (6 columns)
  colQtyDisc: { width: "12%" },
  colPriceDisc: { width: "17%" },
  colDiscount: { width: "16%" },
  colTaxableDisc: { width: "17%" },
  colTaxDisc: { width: "18%" },
  colTotalDisc: { width: "20%" },

  // ─── Totals Box ───
  totalsContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: "#888888",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    alignItems: "center",
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
    backgroundColor: "#FAF2F4",
    paddingVertical: 3.5,
  },
  netTotalLbl: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#4E1A24",
    textAlign: "right",
  },
  netTotalVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#4E1A24",
    textAlign: "left",
  },
  tafqeetRow: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.75,
    borderBottomColor: "#888888",
    alignItems: "center",
  },
  tafqeetText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#3B141C",
    textAlign: "center",
  },

  // ─── Notes & Terms ───
  notesContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 6,
  },
  noteBlock: {
    width: "100%",
  },
  noteTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#4E1A24",
    textAlign: "right",
    marginBottom: 1,
  },
  noteBody: {
    fontSize: 7,
    color: "#333333",
    textAlign: "right",
  },

  // ─── QR Section ───
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  qrImage: {
    width: 100,
    height: 100,
  },

  // ─── Footer ───
  footerSection: {
    alignItems: "center",
    width: "100%",
  },
  legalNotice: {
    fontSize: 7,
    color: "#444444",
    textAlign: "center",
    marginBottom: 2,
  },
  footerText: {
    fontSize: 7,
    color: "#555555",
    textAlign: "center",
  },
});
