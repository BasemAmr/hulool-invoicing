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

export interface ManahirPosTemplateProps {
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

// ─── Number to Arabic Words (Tafqeet) ───
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
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  text += " لا غير";
  return text;
}

/**
 * Format monetary amounts with full decimal precision — NEVER round, floor, or ceiling.
 * Preserves the exact raw decimal tail (e.g. 23.4646916641601264) and formats the integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
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
 * Strict date formatting: DD/MM/YYYY only — NO hours/time/shifts/due dates.
 */
function formatDateOnly(issueDate?: string | null, issuedAt?: string | null): string {
  const raw = issueDate || (issuedAt ? issuedAt.slice(0, 10) : "");
  if (!raw) return "";
  try {
    const clean = raw.slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * Centered 3-element metadata row helper for 80mm thermal roll:
 * [Arabic/Bilingual Label] + [':'] + [Value]
 * Strictly prevents React-PDF from wrapping lines or flipping colons backwards.
 */
function PosMetaLine({
  label,
  value,
  bold = false,
  marginTop = 0,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
  marginTop?: number;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={[styles.centerRow, marginTop ? { marginTop } : {}]}>
      <Text style={bold ? styles.centerLabelBold : styles.centerLabel}>{label}</Text>
      <Text style={bold ? styles.centerColonBold : styles.centerColon}>:</Text>
      <Text style={bold ? styles.centerValBold : styles.centerVal}>{String(value)}</Text>
    </View>
  );
}

export function ManahirPosTemplate({
  invoice,
  company,
  customer,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ManahirPosTemplateProps) {
  const invoiceNum = invoice.invoiceNumber ?? "";
  const dateStr = formatDateOnly(invoice.issueDate, invoice.issuedAt);

  const items = invoice.items || [];
  const hasAnyDiscount = items.some((it) => Number(it.discountAmount || 0) > 0);

  // Total quantity calculation
  const totalQty = items.reduce((acc, it) => acc + parseFloat(String(it.quantity || 0)), 0);

  // Calculate gross subtotal before any discount
  const grossSubtotal = items.reduce((acc, it) => {
    const q = parseFloat(String(it.quantity || 0));
    const p = parseFloat(String(it.unitPrice || 0));
    return acc + q * p;
  }, 0);

  // Total discount across items
  const totalDiscount = items.reduce((acc, it) => acc + parseFloat(String(it.discountAmount || 0)), 0);

  // Taxable subtotal after discount
  const taxableSubtotal =
    invoice.subtotal !== undefined && invoice.subtotal !== null
      ? parseFloat(String(invoice.subtotal))
      : Math.max(0, grossSubtotal - totalDiscount);

  // VAT Amount
  const totalVat =
    invoice.vatAmount !== undefined && invoice.vatAmount !== null
      ? parseFloat(String(invoice.vatAmount))
      : items.reduce((acc, it) => acc + parseFloat(String(it.lineVat || 0)), 0);

  // Grand total including VAT
  const totalIncVat =
    invoice.total !== undefined && invoice.total !== null
      ? parseFloat(String(invoice.total))
      : taxableSubtotal + totalVat;

  const companyAddress = [
    company.addressBuildingNumber,
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
    company.addressAdditionalNumber,
  ]
    .filter(Boolean)
    .join(" - ");

  const customerAddress = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .filter(Boolean)
    .join(" - ");

  const companyName = company.nameAr || "";
  const customerName = customer.nameAr || "";

  // ─── Accurate Dynamic Roll Height Calculation for 80mm Roll (226pt width) ───
  // Guarantees all content fits strictly on ONE continuous roll page without spilling to Page 2.
  let contentHeight = 40; // Base page padding (paddingVertical: 14 * 2 = 28 + margin)

  // Header
  const logoSource = logoDataUrl || company.logoUrl;
  if (logoSource) contentHeight += 58;
  contentHeight += 24; // Company title
  if (company.nameEn) contentHeight += 16;
  if (companyAddress) contentHeight += 22;
  if (company.vatNumber) contentHeight += 15;
  if (company.crNumber) contentHeight += 15;
  if (company.phone) contentHeight += 15;
  if (company.email) contentHeight += 15;
  if (company.website) contentHeight += 15;

  // Title box
  contentHeight += 46;

  // Metadata section (Invoice No & Issue Date)
  contentHeight += 40;

  // Customer section
  if (
    customerName ||
    customer.nameEn ||
    customer.vatNumber ||
    customer.unifiedNumber ||
    customerAddress ||
    customer.phone ||
    customer.email
  ) {
    contentHeight += 34; // Customer section title box
    if (customerName) contentHeight += 16;
    if (customer.nameEn) contentHeight += 14;
    if (customerAddress) contentHeight += 20;
    if (customer.vatNumber) contentHeight += 15;
    if (customer.unifiedNumber) contentHeight += 15;
    if (customer.phone) contentHeight += 15;
    if (customer.email) contentHeight += 15;
  }

  // Items table
  contentHeight += 28; // Table header
  items.forEach((item) => {
    let rowH = 38; // Description + numbers row
    if (item.description && item.description.length > 25) {
      rowH += Math.ceil(item.description.length / 25) * 12;
    }
    if (Number(item.discountAmount || 0) > 0) {
      rowH += 16;
    }
    contentHeight += rowH;
  });

  // Totals section (Account Summary)
  contentHeight += 110; // Header, Subtotal, Taxable, VAT, Net Total
  if (hasAnyDiscount) contentHeight += 20;
  contentHeight += 45; // Tafqeet box (spelled out amount)
  contentHeight += 40; // Payment box (Invoice Paid & Balance Due)

  // Items count summary bar
  contentHeight += 38;

  // Notes & Terms
  if (invoice.notes) {
    contentHeight += 28 + Math.min(invoice.notes.split("\n").length, 5) * 14;
  }
  if (invoice.terms) {
    contentHeight += 28 + Math.min(invoice.terms.split("\n").length, 5) * 14;
  }

  // Thank you wrap
  contentHeight += 34;

  // ZATCA QR Code (144x144 QR + margins)
  if (qrDataUrl) {
    contentHeight += 170;
  }

  // Footer text
  if (company.footerText) {
    contentHeight += 36;
    if (company.footerText.length > 40) {
      contentHeight += Math.ceil(company.footerText.length / 40) * 14;
    }
  }

  // Safety buffer to ensure no font metric variations trigger an accidental page break
  contentHeight += 90;

  const pageHeight = Math.max(780, Math.ceil(contentHeight));

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyName}
      subject="Tax Invoice POS"
      creator="Hulool Invoicing"
    >
      <Page size={[226, pageHeight]} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP LOGO & COMPANY HEADER ─── */}
        <View style={styles.header}>
          {logoDataUrl && (
            <Image src={logoDataUrl} style={styles.logoImg} />
          )}

          {companyName ? (
            <Text style={styles.companyTitle}>{companyName}</Text>
          ) : null}
          {company.nameEn ? (
            <Text style={styles.companySubTitle}>{company.nameEn}</Text>
          ) : null}
          {companyAddress ? (
            <Text style={styles.companyAddress}>{companyAddress}</Text>
          ) : null}

          {/* Company Tax & Contact Identifiers (Centered 3-element pattern) */}
          <PosMetaLine label="الرقم الضريبي / VAT" value={company.vatNumber} bold />
          <PosMetaLine label="السجل التجاري / CR" value={company.crNumber} />
          <PosMetaLine label="الهاتف / Tel" value={company.phone} />
          <PosMetaLine label="البريد / Email" value={company.email} />
          <PosMetaLine label="الموقع / Web" value={company.website} />
        </View>

        {/* ─── 2. CLEAR TAX INVOICE TITLE ─── */}
        <View style={styles.titleBox}>
          <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
          <Text style={styles.invoiceTitleEn}>Tax Invoice</Text>
        </View>

        {/* ─── 3. METADATA SECTION ─── */}
        <View style={styles.metaSection}>
          <PosMetaLine label="رقم الفاتورة / Invoice No" value={invoiceNum} bold />
          <PosMetaLine label="تاريخ الإصدار / Issue Date" value={dateStr} bold marginTop={1} />
        </View>

        {/* ─── 4. CUSTOMER DETAILS (CONDITIONAL) ─── */}
        {customerName || customerAddress || customer.vatNumber || customer.unifiedNumber || customer.phone || customer.email ? (
          <View style={styles.customerSection}>
            <View style={styles.sectionTitleBox}>
              <Text style={styles.sectionTitleAr}>بيانات العميل</Text>
              <Text style={styles.sectionTitleEn}>Customer Details</Text>
            </View>
            {customerName ? (
              <Text style={styles.customerNameText}>{customerName}</Text>
            ) : null}
            {customer.nameEn ? (
              <Text style={styles.customerNameEnText}>{customer.nameEn}</Text>
            ) : null}
            {customerAddress ? (
              <Text style={styles.customerAddressText}>{customerAddress}</Text>
            ) : null}
            <PosMetaLine label="الرقم الضريبي / VAT" value={customer.vatNumber} />
            <PosMetaLine label="الرقم الموحد / Unified No" value={customer.unifiedNumber} />
            <PosMetaLine label="الهاتف / Phone" value={customer.phone} />
            <PosMetaLine label="البريد / Email" value={customer.email} />
          </View>
        ) : null}

        {/* ─── 5. ITEMS SECTION / TABLE ─── */}
        <View style={styles.itemsSection}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. البيان / Description (Right-most in RTL) */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "26%" : "31%" }]}>
              <Text style={styles.thTextAr}>بيان الصنف</Text>
              <Text style={styles.thTextEn}>Item</Text>
            </View>

            {/* 2. الكمية / Qty */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "11%" : "12%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Qty</Text>
            </View>

            {/* 3. السعر / Unit Price */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "14%" : "17%" }]}>
              <Text style={styles.thTextAr}>السعر</Text>
              <Text style={styles.thTextEn}>Price</Text>
            </View>

            {/* Optional: الخصم / Discount */}
            {hasAnyDiscount && (
              <View style={[styles.thCell, { width: "13%" }]}>
                <Text style={styles.thTextAr}>الخصم</Text>
                <Text style={styles.thTextEn}>Disc</Text>
              </View>
            )}

            {/* 4. الضريبة / VAT */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "16%" : "18%" }]}>
              <Text style={styles.thTextAr}>الضريبة</Text>
              <Text style={styles.thTextEn}>VAT</Text>
            </View>

            {/* 5. الإجمالي شامل الضريبة / Total Inc VAT */}
            <View style={[styles.thCell, { width: hasAnyDiscount ? "20%" : "22%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextAr}>الإجمالي</Text>
              <Text style={styles.thTextEn}>Total</Text>
            </View>
          </View>

          {/* Item Rows */}
          {items.map((item, idx) => {
            const q = parseFloat(String(item.quantity || 0));
            const p = parseFloat(String(item.unitPrice || 0));
            const gross = q * p;
            const discount = parseFloat(String(item.discountAmount || 0));
            const net = Math.max(0, gross - discount);
            const vatRate = typeof item.vatRate === "number" ? item.vatRate : parseFloat(String(item.vatRate || 15));
            const vatPct = vatRate <= 1 ? vatRate * 100 : vatRate;
            const vat =
              item.lineVat !== undefined && item.lineVat !== null
                ? parseFloat(String(item.lineVat))
                : net * (vatPct / 100);
            const lineTotal =
              item.lineTotal !== undefined && item.lineTotal !== null
                ? parseFloat(String(item.lineTotal))
                : net + vat;

            const hasItemDiscount = discount > 0;

            return (
              <View
                key={item.position ?? idx}
                style={[
                  styles.itemRow,
                  idx === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. Description */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "26%" : "31%" }]}>
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. Quantity */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "11%" : "12%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "14%" : "17%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* Optional: Discount */}
                {hasAnyDiscount && (
                  <View style={[styles.tdCell, { width: "13%" }]}>
                    <Text style={styles.tdTextCenter}>
                      {hasItemDiscount ? formatExactAmount(item.discountAmount) : "0"}
                    </Text>
                  </View>
                )}

                {/* 4. VAT Amount & Rate */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "16%" : "18%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineVat ?? vat)}</Text>
                  <Text style={styles.tdSubCenter}>({vatPct}%)</Text>
                </View>

                {/* 5. Subtotal Inc VAT */}
                <View style={[styles.tdCell, { width: hasAnyDiscount ? "20%" : "22%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(item.lineTotal ?? lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 6. TOTALS BREAKDOWN ─── */}
        <View style={styles.totalsSection}>
          {hasAnyDiscount ? (
            <>
              <View style={styles.totalLine}>
                <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)} SAR</Text>
                <Text style={styles.totalLbl}>المجموع قبل الخصم / Gross Total:</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalVal}>{formatExactAmount(totalDiscount)} SAR</Text>
                <Text style={styles.totalLbl}>إجمالي الخصم / Total Discount:</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatExactAmount(taxableSubtotal)} SAR</Text>
            <Text style={styles.totalLbl}>المبلغ الخاضع للضريبة / Taxable Amount:</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalVal}>{formatExactAmount(totalVat)} SAR</Text>
            <Text style={styles.totalLbl}>ضريبة القيمة المضافة / VAT Total:</Text>
          </View>
          <View style={[styles.totalLine, styles.netTotalLine]}>
            <Text style={[styles.totalVal, styles.boldText, styles.netTotalVal]}>
              {formatExactAmount(totalIncVat)} SAR
            </Text>
            <Text style={[styles.totalLbl, styles.boldText, styles.netTotalLbl]}>
              الإجمالي شامل الضريبة / Total Inc. VAT:
            </Text>
          </View>

          {/* Tafqeet (Arabic spelled out amount for final total) */}
          <View style={styles.tafqeetWrap}>
            <Text style={styles.tafqeetText}>{tafqeet(totalIncVat)}</Text>
          </View>

          {/* Payment info (Invoice Paid & Zero Balance Due) */}
          <View style={styles.paymentBox}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLbl}>الفاتورة مدفوعة / Invoice Paid</Text>
              <Text style={styles.centerColonBold}>:</Text>
              <Text style={styles.paymentVal}>{formatExactAmount(totalIncVat)} SAR</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLbl}>الرصيد المستحق / Balance Due</Text>
              <Text style={styles.centerColonBold}>:</Text>
              <Text style={styles.paymentVal}>0.00 SAR</Text>
            </View>
          </View>
        </View>

        {/* ─── 7. ITEMS COUNT SUMMARY BAR ─── */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBarVal}>{items.length}</Text>
            <Text style={styles.summaryBarLbl}>عدد الأصناف / Items</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBarVal}>{formatExactAmount(totalQty)}</Text>
            <Text style={styles.summaryBarLbl}>إجمالي القطع / Total Qty</Text>
          </View>
        </View>

        {/* ─── 8. NOTES & TERMS ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesSection}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>ملاحظات / Notes:</Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>الشروط والأحكام / Terms:</Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 9. THANK YOU BANNER ─── */}
        <View style={styles.thankYouWrap}>
          <Text style={styles.thankYouText}>شكراً لتسوقكم</Text>
          <Text style={styles.thankYouSubText}>Thank You For Shopping</Text>
        </View>

        {/* ─── 10. ZATCA QR CODE ONLY ─── */}
        {qrDataUrl && (
          <View style={styles.qrWrap}>
            <Image src={qrDataUrl} style={styles.qrImage} />
          </View>
        )}

        {/* ─── 11. FOOTER TEXT ─── */}
        {company.footerText ? (
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
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
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "15%",
    width: "70%",
    opacity: 0.05,
  },

  // ─── Header ───
  header: {
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
  },
  logoImg: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    marginBottom: 1,
  },
  companySubTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 2,
    textAlign: "center",
  },
  companyAddress: {
    fontSize: 7.5,
    color: "#333333",
    marginBottom: 3,
    textAlign: "center",
    lineHeight: 1.2,
  },

  // ─── Centered 3-Element Metadata Row ───
  centerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 1.5,
  },
  centerLabel: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#222222",
    textAlign: "right",
  },
  centerColon: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#222222",
    textAlign: "center",
    marginLeft: 2,
    marginRight: 2,
  },
  centerVal: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    color: "#222222",
    textAlign: "left",
  },
  centerLabelBold: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  centerColonBold: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    marginLeft: 2,
    marginRight: 2,
  },
  centerValBold: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },

  // ─── Title Box ───
  titleBox: {
    marginVertical: 4,
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333333",
    width: "100%",
  },
  invoiceTitleAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  invoiceTitleEn: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    marginTop: 1,
  },

  // ─── Meta Section ───
  metaSection: {
    width: "100%",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    marginBottom: 4,
    alignItems: "center",
  },

  // ─── Customer Section ───
  customerSection: {
    width: "100%",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    marginBottom: 4,
    alignItems: "center",
  },
  sectionTitleBox: {
    alignItems: "center",
    marginBottom: 2,
  },
  sectionTitleAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textDecoration: "underline",
    textAlign: "center",
  },
  sectionTitleEn: {
    fontSize: 6.5,
    color: "#444444",
    textAlign: "center",
    marginBottom: 2,
  },
  customerNameText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    marginBottom: 1,
  },
  customerNameEnText: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "center",
    marginBottom: 1,
  },
  customerAddressText: {
    fontSize: 7,
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
    lineHeight: 1.2,
  },

  // ─── Items Table ───
  itemsSection: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#333333",
    marginVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    minHeight: 24,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#333333",
    paddingVertical: 2,
    paddingHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#444444",
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
    minHeight: 20,
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#DDDDDD",
    paddingVertical: 2.5,
    paddingHorizontal: 1,
    justifyContent: "center",
  },
  tdTextRight: {
    fontSize: 6.5,
    color: "#111111",
    textAlign: "right",
    lineHeight: 1.2,
  },
  tdTextCenter: {
    fontSize: 6.5,
    color: "#111111",
    textAlign: "center",
  },
  tdSubCenter: {
    fontSize: 5.5,
    color: "#555555",
    textAlign: "center",
  },

  // ─── Totals Breakdown ───
  totalsSection: {
    width: "100%",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#333333",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    marginVertical: 4,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  totalLbl: {
    fontSize: 7,
    color: "#222222",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7,
    color: "#222222",
    textAlign: "left",
  },
  netTotalLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#444444",
    marginTop: 2,
    paddingTop: 3,
    paddingBottom: 2,
  },
  netTotalLbl: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  netTotalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  boldText: {
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Tafqeet Box ───
  tafqeetWrap: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: "#F9FAFB",
    marginVertical: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  tafqeetText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    lineHeight: 1.2,
  },

  // ─── Payment Box ───
  paymentBox: {
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#CCCCCC",
    alignItems: "center",
  },
  paymentRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 1,
  },
  paymentLbl: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "right",
  },
  paymentVal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },

  // ─── Summary Bar ───
  summaryBar: {
    width: "100%",
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
    borderWidth: 0.5,
    borderColor: "#D1D5DB",
    marginVertical: 3,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryBarVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },
  summaryBarLbl: {
    fontSize: 6.5,
    color: "#444444",
    marginTop: 1,
  },

  // ─── Notes & Terms ───
  notesSection: {
    width: "100%",
    marginVertical: 3,
    padding: 4,
    borderWidth: 0.5,
    borderColor: "#CCCCCC",
  },
  noteBlock: {
    marginBottom: 3,
  },
  noteTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
    textAlign: "right",
  },
  noteBody: {
    fontSize: 6.5,
    color: "#333333",
    textAlign: "right",
    lineHeight: 1.2,
  },

  // ─── Thank You ───
  thankYouWrap: {
    marginVertical: 4,
    alignItems: "center",
  },
  thankYouText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  thankYouSubText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#444444",
    textAlign: "center",
    marginTop: 1,
  },

  // ─── ZATCA QR ───
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
    marginBottom: 4,
  },
  qrImage: {
    width: 144,
    height: 144,
  },
  qrPlaceholder: {
    width: 144,
    height: 144,
  },

  // ─── Footer Section ───
  footerSection: {
    width: "100%",
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#DDDDDD",
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#555555",
    textAlign: "center",
    lineHeight: 1.2,
  },
});
