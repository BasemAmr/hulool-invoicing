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

// ─── Arabic Words (Tafqeet) ───
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
  if (num <= 0) return "صفر ريال سعودي";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

/**
 * Format monetary amount with exact decimal representation — NEVER floor, ceiling, or round.
 * Preserves the exact raw decimal tail (e.g. 23.4646916641601264) and formats integer part with commas.
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
 * Strict date formatting: DD/MM/YYYY only — NO hours/time/HHMMSS.
 */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const clean = iso.slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return iso || "";
  }
}

export function CoffeeIdeasTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: CoffeeIdeasTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);

  // ─── Company Address Formatting ───
  // Additional No. - Postal Code - Street - Building No. - District - City - Country
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressAr = companyAddressParts.join(" - ");

  const companyCrOrUnified = company.crNumber || (company as any).unifiedNumber || "";
  const companyUnifiedNo = (company as any).unifiedNumber || "";
  const companyWebsite = (company as any).website || "";

  // ─── Customer Details ───
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerAddress = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet || "",
    customer.addressBuildingNumber ? `مبنى: ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : "",
    customer.addressCity || "",
  ].filter(Boolean).join(" - ");
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";

  // ─── Bank Info ───
  const bankAccount = (company as any).bankAccount || (settings as any)?.bankAccount || "";
  const ibanNumber = (company as any).iban || (settings as any)?.ibanNumber || "";

  // ─── Items & Totals Calculations ───
  const items = invoice.items || [];
  const hasAnyDiscount = items.some(
    (item) => Number(item.discountAmount || (item as any).discount || 0) > 0
  );

  const discountVal =
    (invoice as any).discountTotal ??
    items.reduce(
      (s, it) => s + Number(it.discountAmount || (it as any).discount || 0),
      0
    );

  const rawSubtotalCalc = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  );

  const grossSubtotal =
    Number(discountVal) > 0
      ? rawSubtotalCalc > 0
        ? rawSubtotalCalc
        : Number(invoice.subtotal || 0) + Number(discountVal)
      : Number(invoice.subtotal || 0);

  const taxableVal =
    invoice.subtotal ?? Math.max(0, grossSubtotal - Number(discountVal));
  const vatVal =
    invoice.vatAmount ??
    items.reduce((s, it) => s + Number(it.lineVat || 0), 0);
  const totalVal = invoice.total ?? Number(taxableVal) + Number(vatVal);

  const firstItemVatRate = items.find(
    (it) => it.vatRate !== undefined && it.vatRate !== null
  )?.vatRate;
  const vatRatePercentage =
    firstItemVatRate !== undefined ? `${Number(firstItemVatRate)}%` : "15%";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Single-Page Dynamic Height Guarantee (Landscape) ───
  const basePageWidth = paperSize === "Letter" ? 792 : 841.89;
  const basePageHeight = paperSize === "Letter" ? 612 : 595.28;
  const itemRowHeight = 24;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  if (invoice.terms)
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  if (company.footerText) extraContentHeight += 18;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="landscape" style={styles.page}>
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
                <View style={styles.headerFieldRowEn}>
                  <Text style={styles.headerFieldLblEn}>Phone No.</Text>
                  <Text style={styles.headerFieldColonEn}>: </Text>
                  <Text style={styles.headerFieldValEn}>{company.phone}</Text>
                </View>
              ) : null}
              {company.vatNumber ? (
                <View style={styles.headerFieldRowEn}>
                  <Text style={styles.headerFieldLblEn}>Tax No.</Text>
                  <Text style={styles.headerFieldColonEn}>: </Text>
                  <Text style={styles.headerFieldValEn}>{company.vatNumber}</Text>
                </View>
              ) : null}
              {companyCrOrUnified ? (
                <View style={styles.headerFieldRowEn}>
                  <Text style={styles.headerFieldLblEn}>C.R. No.</Text>
                  <Text style={styles.headerFieldColonEn}>: </Text>
                  <Text style={styles.headerFieldValEn}>{companyCrOrUnified}</Text>
                </View>
              ) : null}
              {company.email ? (
                <View style={styles.headerFieldRowEn}>
                  <Text style={styles.headerFieldLblEn}>Email</Text>
                  <Text style={styles.headerFieldColonEn}>: </Text>
                  <Text style={styles.headerFieldValEn}>{company.email}</Text>
                </View>
              ) : null}
              {companyWebsite ? (
                <View style={styles.headerFieldRowEn}>
                  <Text style={styles.headerFieldLblEn}>Website</Text>
                  <Text style={styles.headerFieldColonEn}>: </Text>
                  <Text style={styles.headerFieldValEn}>{companyWebsite}</Text>
                </View>
              ) : null}
            </View>

            {/* Center: Logo */}
            <View style={styles.headerCenter}>
              {logoSource ? (
                <Image src={logoSource} style={styles.logoImg} />
              ) : null}
            </View>

            {/* Right: Arabic company info */}
            <View style={styles.headerRight}>
              <Text style={styles.headerTitleAr}>{company.nameAr || ""}</Text>
              {companyAddressAr ? (
                <Text style={styles.headerAddressAr}>{companyAddressAr}</Text>
              ) : null}
              {company.vatNumber ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.vatNumber}</Text>
                  <Text style={styles.fieldColon}>:</Text>
                  <Text style={styles.fieldLblAr}>الرقم الضريبي</Text>
                </View>
              ) : null}
              {companyCrOrUnified ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{companyCrOrUnified}</Text>
                  <Text style={styles.fieldColon}>:</Text>
                  <Text style={styles.fieldLblAr}>السجل التجاري / الرقم الموحد</Text>
                </View>
              ) : null}
              {company.phone ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.phone}</Text>
                  <Text style={styles.fieldColon}>:</Text>
                  <Text style={styles.fieldLblAr}>رقم الهاتف</Text>
                </View>
              ) : null}
              {company.email ? (
                <View style={styles.headerRightFieldRow}>
                  <Text style={styles.fieldValAr}>{company.email}</Text>
                  <Text style={styles.fieldColon}>:</Text>
                  <Text style={styles.fieldLblAr}>البريد الإلكتروني</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── 2. INVOICE META BAR (Single row across) ─── */}
          <View style={styles.metaRow}>
            {/* Left: Invoice Number */}
            <View style={styles.metaCol}>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.metaLbl}>رقم الفاتورة / Invoice No.</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaVal}>{invoiceNum}</Text>
              </View>
            </View>

            {/* Center: Title */}
            <View style={styles.metaCenter}>
              <Text style={styles.metaTitleText}>فاتورة ضريبية / Tax Invoice</Text>
            </View>

            {/* Right: Invoice Date */}
            <View style={styles.metaCol}>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.metaLbl}>تاريخ الإصدار / Issue Date</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaVal}>{issueDateStr}</Text>
              </View>
            </View>
          </View>

          {/* ─── 3. CUSTOMER INFORMATION CARD (Rounded border box) ─── */}
          <View style={styles.customerCard}>
            {/* Right Column: Customer Name & Address */}
            <View style={styles.customerColRight}>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>العميل / Customer</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custValBold}>{customerNameAr || "—"}</Text>
              </View>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>العنوان / Address</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customerAddress || "—"}</Text>
              </View>
            </View>

            {/* Center Column: Customer Tax & CR */}
            <View style={styles.customerColCenter}>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>الرقم الضريبي / VAT No.</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customer.vatNumber || "—"}</Text>
              </View>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>الرقم الموحد / CR No.</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customerCrOrUnified || "—"}</Text>
              </View>
            </View>

            {/* Left Column: Customer Contacts */}
            <View style={styles.customerColLeft}>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>الهاتف / Phone</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customer.phone || "—"}</Text>
              </View>
              <View style={styles.bidiRowReverse}>
                <Text style={styles.custLbl}>البريد / Email</Text>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customer.email || "—"}</Text>
              </View>
            </View>
          </View>

          {/* ─── 4. ITEMS TABLE (7 Columns) ─── */}
          <View style={styles.tableContainer}>
            {/* Header Row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, styles.colTotal]}>الإجمالي شامل الضريبة{"\n"}Total Inc. VAT</Text>
              <Text style={[styles.thCell, styles.colVatAmount]}>مبلغ الضريبة{"\n"}VAT Amount</Text>
              <Text style={[styles.thCell, styles.colVatRate]}>نسبة الضريبة{"\n"}VAT Rate</Text>
              <Text style={[styles.thCell, styles.colUnitPrice]}>سعر الوحدة{"\n"}Unit Price</Text>
              <Text style={[styles.thCell, styles.colQty]}>الكمية{"\n"}Qty</Text>
              <Text style={[styles.thCell, styles.colDesc]}>إسم الصنف والوصف{"\n"}Item Description</Text>
              <Text style={[styles.thCell, styles.colIdx]}>م{"\n"}#</Text>
            </View>

            {/* Table Rows */}
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const unitPrice = Number(item.unitPrice || 0);
              const rawLineSubtotal = qty * unitPrice;
              const itemDiscount = Number(item.discountAmount || (item as any).discount || 0);
              const taxableSubtotal = Math.max(0, rawLineSubtotal - itemDiscount);

              const vatRateNum =
                item.vatRate !== undefined && item.vatRate !== null
                  ? Number(item.vatRate)
                  : (item as any).taxRate !== undefined && (item as any).taxRate !== null
                  ? Number((item as any).taxRate)
                  : 15;

              const itemVat =
                (item as any).lineVat !== undefined && (item as any).lineVat !== null
                  ? Number((item as any).lineVat)
                  : (taxableSubtotal * vatRateNum) / 100;

              const itemTotal =
                (item as any).lineTotal !== undefined && (item as any).lineTotal !== null
                  ? Number((item as any).lineTotal)
                  : taxableSubtotal + itemVat;

              return (
                <View key={idx} style={styles.tableRow}>
                  {/* Total Inc. VAT */}
                  <View style={[styles.tdCellWrap, styles.colTotal]}>
                    <Text style={styles.tdTextBold}>
                      {formatExactAmount(itemTotal)}
                    </Text>
                  </View>

                  {/* VAT Amount */}
                  <View style={[styles.tdCellWrap, styles.colVatAmount]}>
                    <Text style={styles.tdText}>
                      {formatExactAmount(itemVat)}
                    </Text>
                  </View>

                  {/* VAT Rate */}
                  <View style={[styles.tdCellWrap, styles.colVatRate]}>
                    <Text style={styles.tdText}>
                      {vatRateNum}%
                    </Text>
                  </View>

                  {/* Unit Price */}
                  <View style={[styles.tdCellWrap, styles.colUnitPrice]}>
                    <Text style={styles.tdText}>
                      {formatExactAmount(unitPrice)}
                    </Text>
                  </View>

                  {/* Quantity */}
                  <View style={[styles.tdCellWrap, styles.colQty]}>
                    <Text style={styles.tdText}>{qty}</Text>
                  </View>

                  {/* Description & Line-Level Discount Info */}
                  <View style={[styles.tdCellWrap, styles.colDesc, styles.tdDescWrap]}>
                    <Text style={styles.descTitle}>{item.description}</Text>
                    {itemDiscount > 0 && (
                      <Text style={styles.discountNote}>
                        قبل الخصم: {formatExactAmount(rawLineSubtotal)} | خصم: {formatExactAmount(itemDiscount)} | بعد الخصم: {formatExactAmount(taxableSubtotal)}
                      </Text>
                    )}
                  </View>

                  {/* Index */}
                  <View style={[styles.tdCellWrap, styles.colIdx, { borderRightWidth: 0 }]}>
                    <Text style={styles.tdText}>{idx + 1}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ─── 5. LOWER SECTION: Left Totals, Middle Bank & Tafqeet, Right QR ─── */}
          <View style={styles.bottomSection}>
            {/* Left Column: Totals Table */}
            <View style={styles.totalsTable}>
              {/* Gross Subtotal before discount */}
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatExactAmount(grossSubtotal)}</Text>
                <Text style={styles.totalsTableLbl}>الإجمالي غير شامل الضريبة</Text>
              </View>

              {/* Discount Row (if any) */}
              {Number(discountVal) > 0 && (
                <View style={styles.totalsTableRow}>
                  <Text style={[styles.totalsTableVal, { color: "#C026D3" }]}>
                    -{formatExactAmount(discountVal)}
                  </Text>
                  <Text style={styles.totalsTableLbl}>إجمالي التخفيض / Discount</Text>
                </View>
              )}

              {/* Taxable Subtotal */}
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatExactAmount(taxableVal)}</Text>
                <Text style={styles.totalsTableLbl}>المبلغ الخاضع للضريبة</Text>
              </View>

              {/* VAT Row */}
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatExactAmount(vatVal)}</Text>
                <Text style={styles.totalsTableLbl}>إجمالي الضريبة ({vatRatePercentage})</Text>
              </View>

              {/* Net Total Inc. VAT */}
              <View style={[styles.totalsTableRow, styles.netRow]}>
                <Text style={styles.netValText}>{formatExactAmount(totalVal)} SAR</Text>
                <Text style={styles.netLblText}>الصافي شامل الضريبة</Text>
              </View>

              {/* Paid Amount */}
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsTableVal}>{formatExactAmount(totalVal)} SAR</Text>
                <Text style={styles.totalsTableLbl}>المدفوع / Paid</Text>
              </View>

              {/* Balance Due */}
              <View style={[styles.totalsTableRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.totalsTableVal, { fontWeight: "bold" }]}>0.00 SAR</Text>
                <Text style={styles.totalsTableLbl}>المتبقي / Balance Due</Text>
              </View>
            </View>

            {/* Middle Column: Bank Accounts & Tafqeet */}
            <View style={styles.bankAndTafqeet}>
              <View style={styles.bankCard}>
                <View style={styles.bankCardRow}>
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.bankLblText}>رقم الحساب / Bank Account</Text>
                    <Text style={styles.bankColon}>:</Text>
                    <Text style={styles.bankValText}>{bankAccount || "—"}</Text>
                  </View>
                </View>
                <View style={[styles.bankCardRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.bankLblText}>رقم الآيبان / IBAN</Text>
                    <Text style={styles.bankColon}>:</Text>
                    <Text style={styles.bankValText}>{ibanNumber || "—"}</Text>
                  </View>
                </View>
              </View>

              {/* Tafqeet card */}
              <View style={styles.tafqeetWrap}>
                <Text style={styles.tafqeetText}>{tafqeetText}</Text>
              </View>
            </View>

            {/* Right Column: QR Code */}
            <View style={styles.qrColumn}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImg} />
              ) : (
                <View style={styles.qrPlaceholder} />
              )}
            </View>
          </View>

          {/* ─── 6. NOTES & TERMS SECTION (if present) ─── */}
          {(invoice.notes || invoice.terms) && (
            <View style={styles.notesTermsBox}>
              {invoice.notes && (
                <View style={styles.noteItem}>
                  <Text style={styles.noteTitle}>ملاحظات / Notes:</Text>
                  <Text style={styles.noteText}>{invoice.notes}</Text>
                </View>
              )}
              {invoice.terms && (
                <View style={styles.noteItem}>
                  <Text style={styles.noteTitle}>الشروط والأحكام / Terms & Conditions:</Text>
                  <Text style={styles.noteText}>{invoice.terms}</Text>
                </View>
              )}
            </View>
          )}

          {/* ─── 7. FOOTER TEXT (if present) ─── */}
          {company.footerText && (
            <View style={styles.footerTextBox}>
              <Text style={styles.footerTextContent}>{company.footerText}</Text>
            </View>
          )}

          {/* ─── 8. SIGNATURES ROW ─── */}
          <View style={styles.signaturesRow}>
            <Text style={styles.sigText}>
              المندوب / Representative: .....................................................
            </Text>
            <Text style={styles.sigText}>
              المستلم / Receiver: .....................................................
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
    padding: 14,
    fontSize: 8,
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
    padding: 8,
    flex: 1,
    justifyContent: "space-between",
  },

  // ─── Header Box ───
  headerBox: {
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLeft: {
    width: "35%",
    alignItems: "flex-start",
  },
  headerTitleEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
  },
  headerFieldRowEn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  headerFieldLblEn: {
    fontSize: 7.5,
    color: "#444444",
  },
  headerFieldColonEn: {
    fontSize: 7.5,
    color: "#444444",
  },
  headerFieldValEn: {
    fontSize: 7.5,
    color: "#111111",
    fontWeight: "bold",
  },

  headerCenter: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 65,
    height: 55,
    objectFit: "contain",
  },

  headerRight: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerTitleAr: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "right",
  },
  headerAddressAr: {
    fontSize: 7,
    color: "#444444",
    marginBottom: 2,
    textAlign: "right",
    lineHeight: 1.2,
  },
  headerRightFieldRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 1,
  },
  fieldLblAr: {
    fontSize: 7.5,
    color: "#444444",
  },
  fieldColon: {
    fontSize: 7.5,
    color: "#444444",
    marginHorizontal: 2,
  },
  fieldValAr: {
    fontSize: 7.5,
    color: "#111111",
    fontWeight: "bold",
  },

  // ─── Meta Row ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    backgroundColor: "#F9F9F9",
  },
  metaCol: {
    width: "32%",
  },
  metaCenter: {
    width: "34%",
    alignItems: "center",
  },
  metaTitleText: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#111111",
  },
  bidiRowReverse: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginVertical: 1,
  },
  metaLbl: {
    fontSize: 7.5,
    color: "#444444",
  },
  metaColon: {
    fontSize: 7.5,
    color: "#444444",
    marginHorizontal: 3,
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },

  // ─── Customer Card ───
  customerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  customerColRight: {
    width: "36%",
    alignItems: "flex-end",
  },
  customerColCenter: {
    width: "32%",
    alignItems: "flex-end",
  },
  customerColLeft: {
    width: "28%",
    alignItems: "flex-end",
  },
  custLbl: {
    fontSize: 7.5,
    color: "#555555",
  },
  custColon: {
    fontSize: 7.5,
    color: "#555555",
    marginHorizontal: 2,
  },
  custVal: {
    fontSize: 7.5,
    color: "#222222",
  },
  custValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },

  // ─── Table ───
  tableContainer: {
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#E8E8E8",
    borderBottomWidth: 1,
    borderBottomColor: "#555555",
    minHeight: 24,
    alignItems: "center",
  },
  thCell: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
    paddingVertical: 2,
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
    alignItems: "stretch",
  },
  tdCellWrap: {
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#777777",
    justifyContent: "center",
    alignItems: "center",
  },
  tdText: {
    fontSize: 7.5,
    color: "#222222",
    textAlign: "center",
  },
  tdTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  tdDescWrap: {
    alignItems: "flex-end",
    paddingRight: 6,
  },
  descTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "right",
  },
  discountNote: {
    fontSize: 6.5,
    color: "#C026D3",
    marginTop: 1,
    textAlign: "right",
  },

  // Column widths (100% total)
  colTotal: { width: "16%" },
  colVatAmount: { width: "13%" },
  colVatRate: { width: "10%" },
  colUnitPrice: { width: "13%" },
  colQty: { width: "9%" },
  colDesc: { width: "35%" },
  colIdx: { width: "4%" },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },

  // Left Totals Table
  totalsTable: {
    width: "33%",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    overflow: "hidden",
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#777777",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  totalsTableLbl: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  totalsTableVal: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "left",
  },
  netRow: {
    backgroundColor: "#EAEAEA",
    paddingVertical: 3.5,
  },
  netLblText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
  },
  netValText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },

  // Middle Column
  bankAndTafqeet: {
    width: "39%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  ibanColumn: {
    width: "39%",
  },
  bankCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  bankCardRow: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: "#777777",
  },
  bankLblText: {
    fontSize: 7,
    color: "#444444",
  },
  bankColon: {
    fontSize: 7,
    color: "#444444",
    marginHorizontal: 2,
  },
  bankValText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
  },
  tafqeetWrap: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    backgroundColor: "#F9F9F9",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tafqeetText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },

  // Right QR
  qrColumn: {
    width: "26%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImg: {
    width: 136,
    height: 136,
  },
  qrPlaceholder: {
    width: 136,
    height: 136,
  },

  // Notes & Terms
  notesTermsBox: {
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    padding: 5,
    marginBottom: 5,
    backgroundColor: "#FDFDFD",
  },
  noteItem: {
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  noteText: {
    fontSize: 6.5,
    color: "#555555",
    textAlign: "right",
  },

  // Footer Text
  footerTextBox: {
    paddingVertical: 2,
    alignItems: "center",
    marginBottom: 3,
  },
  footerTextContent: {
    fontSize: 7,
    color: "#555555",
    textAlign: "center",
  },

  // Signatures
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#888888",
  },
  sigText: {
    fontSize: 7,
    color: "#333333",
  },
});
