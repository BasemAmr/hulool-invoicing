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

// ─── Tafqeet (Arabic Number to Words) ───
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

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text;
}

/**
 * Format monetary amount with exact decimal representation — NEVER floor, ceiling, or round.
 * Preserves the exact raw decimal tail (e.g. 23.4646916641601264) and formats integer part with commas.
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
 * Strict date formatting: DD/MM/YYYY only — NO hours, minutes, or seconds.
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
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);

  // ─── Company Address Formatting (Additional No. - Postal Code - Street - Building No. - District - City - Country) ───
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressLine = companyAddressParts.join(" - ");

  const companyAddressEnParts = [
    company.addressBuildingNumber ? `Bldg ${company.addressBuildingNumber}` : "",
    company.addressStreet || "",
    company.addressDistrict ? `${company.addressDistrict} Dist.` : "",
    company.addressCity || "",
    company.addressPostalCode ? `Postal Code ${company.addressPostalCode}` : "",
    company.addressAdditionalNumber ? `Add. No ${company.addressAdditionalNumber}` : "",
    "Saudi Arabia",
  ].filter(Boolean);
  const companyAddressEnLine = companyAddressEnParts.join(", ");

  const companyUnifiedNo = (company as any).unifiedNumber || "";

  // ─── Customer Address & Data ───
  const customerAddress = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet || "",
    customer.addressBuildingNumber ? `مبنى: ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : "",
    customer.addressCity || "",
  ].filter(Boolean).join(" - ");

  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";

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

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageHeight = paperSize === "Letter" ? 792 : 842;
  const itemRowHeight = 24;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 30 + Math.min(invoice.notes.split("\n").length, 5) * 12;
  if (invoice.terms)
    extraContentHeight += 30 + Math.min(invoice.terms.split("\n").length, 5) * 12;
  if (company.footerText) extraContentHeight += 24;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [
    paperSize === "Letter" ? 612 : 595.28,
    dynamicHeight,
  ] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER (3 Columns: English Left, Logo Center, Arabic Right) ─── */}
        <View style={styles.headerRow}>
          {/* Left: English / Company Info */}
          <View style={styles.headerLeft}>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            {companyAddressEnLine ? (
              <Text style={styles.headerLeftText}>{companyAddressEnLine}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerLeftText}>VAT No: {company.vatNumber}</Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.headerLeftText}>C.R. No: {company.crNumber}</Text>
            ) : null}
            {companyUnifiedNo ? (
              <Text style={styles.headerLeftText}>Unified No: {companyUnifiedNo}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerLeftText}>Mobile: {company.phone}</Text>
            ) : null}
            {company.email ? (
              <Text style={styles.headerLeftText}>Email: {company.email}</Text>
            ) : null}
            {company.website ? (
              <Text style={styles.headerLeftText}>Website: {company.website}</Text>
            ) : null}
          </View>

          {/* Center: Logo */}
          <View style={styles.headerCenter}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImg} />
            ) : null}
          </View>

          {/* Right: Arabic Company Info (Strict BiDi 3-element rows) */}
          <View style={styles.headerRight}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {companyAddressLine ? (
              <Text style={styles.headerAddressText}>{companyAddressLine}</Text>
            ) : null}
            {company.vatNumber ? (
              <View style={styles.bidiHeaderRow}>
                <Text style={styles.bidiHeaderLabel}>الرقم الضريبي</Text>
                <Text style={styles.bidiHeaderColon}>:</Text>
                <Text style={styles.bidiHeaderVal}>{company.vatNumber}</Text>
              </View>
            ) : null}
            {company.crNumber ? (
              <View style={styles.bidiHeaderRow}>
                <Text style={styles.bidiHeaderLabel}>س.ت</Text>
                <Text style={styles.bidiHeaderColon}>:</Text>
                <Text style={styles.bidiHeaderVal}>{company.crNumber}</Text>
              </View>
            ) : null}
            {companyUnifiedNo ? (
              <View style={styles.bidiHeaderRow}>
                <Text style={styles.bidiHeaderLabel}>الرقم الموحد</Text>
                <Text style={styles.bidiHeaderColon}>:</Text>
                <Text style={styles.bidiHeaderVal}>{companyUnifiedNo}</Text>
              </View>
            ) : null}
            {company.phone ? (
              <View style={styles.bidiHeaderRow}>
                <Text style={styles.bidiHeaderLabel}>جوال</Text>
                <Text style={styles.bidiHeaderColon}>:</Text>
                <Text style={styles.bidiHeaderVal}>{company.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. INVOICE META ROW (Invoice Number Left, Tax Invoice Title Center, Issue Date Right) ─── */}
        <View style={styles.metaRow}>
          {/* Left: Invoice Number */}
          <View style={styles.metaLeft}>
            <View style={styles.metaBiDiRow}>
              <Text style={styles.metaLabel}>رقم الفاتورة</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaVal}>{invoiceNum}</Text>
            </View>
          </View>

          {/* Center: Title (Clear فاتورة ضريبية / Tax Invoice) */}
          <View style={styles.metaCenter}>
            <Text style={styles.invoiceTitle}>فاتورة ضريبية</Text>
            <Text style={styles.invoiceSubTitle}>TAX INVOICE</Text>
          </View>

          {/* Right: Issue Date (DD/MM/YYYY only) */}
          <View style={styles.metaRight}>
            <View style={styles.metaBiDiRow}>
              <Text style={styles.metaLabel}>تاريخ الإصدار</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. CUSTOMER DETAILS BOX (3 Columns: English Left, Value Center, Arabic Right) ─── */}
        <View style={styles.customerBox}>
          {/* Row 1: Name */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Customer Name</Text>
            <Text style={styles.custColValue}>
              {customer.nameAr || customer.nameEn || "عميل نقدي"}
            </Text>
            <Text style={styles.custColAr}>اسم العميل</Text>
          </View>

          {/* Row 2: VAT Number */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Tax Identification Number</Text>
            <Text style={styles.custColValue}>{customer.vatNumber || "-"}</Text>
            <Text style={styles.custColAr}>الرقم الضريبي</Text>
          </View>

          {/* Row 3: Unified Number / CR */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Unified No. / C.R.</Text>
            <Text style={styles.custColValue}>{customerCrOrUnified || "-"}</Text>
            <Text style={styles.custColAr}>الرقم الموحد / س.ت</Text>
          </View>

          {/* Row 4: Address */}
          <View style={styles.customerRow}>
            <Text style={styles.custColEn}>Address</Text>
            <Text style={styles.custColValue}>{customerAddress || "-"}</Text>
            <Text style={styles.custColAr}>العنوان</Text>
          </View>

          {/* Row 5: Contact Info */}
          <View style={[styles.customerRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.custColEn}>Mobile / Email</Text>
            <Text style={styles.custColValue}>
              {[customer.phone, customer.email].filter(Boolean).join(" - ") || "-"}
            </Text>
            <Text style={styles.custColAr}>الجوال / البريد</Text>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (7 Columns: م, الوصف, الكمية, سعر الوحدة, نسبة الضريبة, مبلغ الضريبة, المجموع شامل الضريبة) ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header (RTL: left to right renders Total to Index) */}
          <View style={styles.tableHeader}>
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thTextAr}>المجموع شامل الضريبة</Text>
              <Text style={styles.thTextEn}>Total Inc. VAT</Text>
            </View>
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thTextAr}>مبلغ الضريبة</Text>
              <Text style={styles.thTextEn}>VAT Amount</Text>
            </View>
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thTextAr}>نسبة الضريبة</Text>
              <Text style={styles.thTextEn}>VAT Rate</Text>
            </View>
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thTextAr}>سعر الوحدة</Text>
              <Text style={styles.thTextEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Quantity</Text>
            </View>
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thTextAr}>الوصف</Text>
              <Text style={styles.thTextEn}>Description</Text>
            </View>
            <View style={[styles.thCell, styles.colIndex]}>
              <Text style={styles.thTextAr}>م</Text>
              <Text style={styles.thTextEn}>No.</Text>
            </View>
          </View>

          {/* Table Rows */}
          {items.map((item, idx) => {
            const itemQty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || 0);
            const lineDisc = Number(
              item.discountAmount || (item as any).discount || 0
            );
            const rawLineSubtotal = unitPrice * itemQty;
            const discountedSubtotal =
              lineDisc > 0
                ? Math.max(0, rawLineSubtotal - lineDisc)
                : Number(item.lineSubtotal ?? rawLineSubtotal);

            const vatRate =
              item.vatRate !== undefined && item.vatRate !== null
                ? Number(item.vatRate)
                : (item as any).taxRate !== undefined
                ? Number((item as any).taxRate)
                : 15;
            const vatPctStr = `${vatRate}%`;

            const lineVat =
              item.lineVat !== undefined && item.lineVat !== null
                ? Number(item.lineVat)
                : (discountedSubtotal * vatRate) / 100;

            const lineTotalIncVat =
              item.lineTotal !== undefined && item.lineTotal !== null
                ? Number(item.lineTotal)
                : discountedSubtotal + lineVat;

            return (
              <View key={idx} style={styles.tableRow}>
                {/* 1. Total Inc. VAT */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={styles.tdTextBold}>
                    {formatExactAmount(lineTotalIncVat)}
                  </Text>
                </View>
                {/* 2. VAT Amount */}
                <View style={[styles.tdCell, styles.colVatAmount]}>
                  <Text style={styles.tdText}>{formatExactAmount(lineVat)}</Text>
                </View>
                {/* 3. VAT Rate */}
                <View style={[styles.tdCell, styles.colVatRate]}>
                  <Text style={styles.tdText}>{vatPctStr}</Text>
                </View>
                {/* 4. Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdText}>{formatExactAmount(unitPrice)}</Text>
                </View>
                {/* 5. Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdTextBold}>{formatExactAmount(itemQty)}</Text>
                </View>
                {/* 6. Description */}
                <View style={[styles.tdCell, styles.colDesc, styles.textRight]}>
                  <Text style={styles.descText}>{item.description || ""}</Text>
                  {lineDisc > 0 ? (
                    <View style={styles.discountSubBox}>
                      <Text style={styles.discountSubText}>
                        خصم: {formatExactAmount(lineDisc)} (قبل: {formatExactAmount(rawLineSubtotal)} | بعد: {formatExactAmount(discountedSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>
                {/* 7. Index */}
                <View style={[styles.tdCell, styles.colIndex]}>
                  <Text style={styles.tdText}>{idx + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TAFQEET ROW ─── */}
        {tafqeetText ? (
          <View style={styles.tafqeetBox}>
            <View style={styles.tafqeetRow}>
              <Text style={styles.tafqeetLabel}>المبلغ كتابة</Text>
              <Text style={styles.tafqeetColon}>:</Text>
              <Text style={styles.tafqeetValue}>فقط {tafqeetText} لا غير</Text>
            </View>
          </View>
        ) : null}

        {/* ─── 6. SUMMARY & QR CODE (Totals Left, QR Center/Right) ─── */}
        <View style={styles.summarySection}>
          {/* Left: Totals Breakdown */}
          <View style={styles.totalsContainer}>
            {/* Gross Total */}
            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>
                {formatExactAmount(grossSubtotal)} ريال
              </Text>
              <Text style={styles.totalLabel}>المجموع غير شامل الضريبة</Text>
            </View>

            {/* Discount (if any) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalLine}>
                <Text style={styles.totalValue}>
                  {formatExactAmount(discountVal)} ريال
                </Text>
                <Text style={styles.totalLabel}>إجمالي الخصم</Text>
              </View>
            ) : null}

            {/* Taxable Amount after discount */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalLine}>
                <Text style={styles.totalValue}>
                  {formatExactAmount(taxableVal)} ريال
                </Text>
                <Text style={styles.totalLabel}>المجموع الخاضع للضريبة</Text>
              </View>
            ) : null}

            {/* VAT Amount */}
            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>
                {formatExactAmount(vatVal)} ريال
              </Text>
              <Text style={styles.totalLabel}>
                ضريبة القيمة المضافة ({vatRatePercentage})
              </Text>
            </View>

            {/* Net Total with VAT */}
            <View style={[styles.totalLine, styles.netLine]}>
              <Text style={[styles.totalValue, styles.netBold]}>
                {formatExactAmount(totalVal)} ريال
              </Text>
              <Text style={[styles.totalLabel, styles.netBold]}>
                المجموع شامل الضريبة
              </Text>
            </View>

            {/* Invoice Paid */}
            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>
                {formatExactAmount(totalVal)} ريال
              </Text>
              <Text style={styles.totalLabel}>المبلغ المدفوع</Text>
            </View>

            {/* Balance Due / Remaining */}
            <View style={styles.totalLine}>
              <Text style={styles.totalValue}>0.00 ريال</Text>
              <Text style={styles.totalLabel}>المبلغ المتبقي</Text>
            </View>
          </View>

          {/* Right: Large Clean ZATCA QR Code */}
          <View style={styles.qrContainer}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 7. NOTES & TERMS (if present) ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesTermsContainer}>
            {invoice.notes ? (
              <View style={styles.notesBlock}>
                <Text style={styles.notesTitle}>ملاحظات</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.notesBlock}>
                <Text style={styles.notesTitle}>الشروط والأحكام</Text>
                <Text style={styles.notesText}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 8. CUSTOM FOOTER TEXT (if present) ─── */}
        {company.footerText ? (
          <View style={styles.customFooterWrap}>
            <Text style={styles.customFooterText}>{company.footerText}</Text>
          </View>
        ) : null}

        {/* ─── 9. RETURN POLICY NOTICE (Preserved Visual Identity) ─── */}
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
    marginBottom: 14,
  },
  headerLeft: {
    width: "35%",
    alignItems: "flex-start",
  },
  companyNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 2,
    textAlign: "left",
  },
  headerLeftText: {
    fontSize: 7.5,
    color: "#333333",
    lineHeight: 1.35,
    textAlign: "left",
  },
  headerCenter: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 65,
    height: 65,
    objectFit: "contain",
  },
  headerRight: {
    width: "37%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "right",
  },
  headerAddressText: {
    fontSize: 7.5,
    color: "#333333",
    lineHeight: 1.35,
    textAlign: "right",
    marginBottom: 2,
  },
  bidiHeaderRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 1,
  },
  bidiHeaderLabel: {
    fontSize: 7.5,
    color: "#444444",
  },
  bidiHeaderColon: {
    fontSize: 7.5,
    color: "#444444",
    marginHorizontal: 2,
  },
  bidiHeaderVal: {
    fontSize: 7.5,
    color: "#222222",
    fontWeight: "bold",
  },

  // ─── Meta Row ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#C0C0C0",
    paddingBottom: 6,
  },
  metaLeft: {
    width: "32%",
    alignItems: "flex-start",
  },
  metaCenter: {
    width: "36%",
    alignItems: "center",
  },
  metaRight: {
    width: "32%",
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  invoiceSubTitle: {
    fontSize: 8,
    color: "#555555",
    letterSpacing: 1,
    marginTop: 1,
    textAlign: "center",
  },
  metaBiDiRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8.5,
    color: "#444444",
  },
  metaColon: {
    fontSize: 8.5,
    color: "#444444",
    marginHorizontal: 3,
  },
  metaVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#222222",
  },

  // ─── Customer Box ───
  customerBox: {
    borderWidth: 1,
    borderColor: "#A0A0A0",
    borderRadius: 2,
    marginBottom: 10,
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
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#D9D9D9",
    borderBottomWidth: 1,
    borderBottomColor: "#A0A0A0",
    minHeight: 22,
    alignItems: "center",
  },
  thCell: {
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#A0A0A0",
    height: "100%",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6.5,
    color: "#444444",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#C0C0C0",
    minHeight: 20,
    alignItems: "center",
  },
  tdCell: {
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#C0C0C0",
    height: "100%",
    justifyContent: "center",
  },
  tdText: {
    fontSize: 8,
    color: "#222222",
    textAlign: "center",
  },
  tdTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
  },
  descText: {
    fontSize: 8,
    color: "#222222",
    textAlign: "right",
  },
  discountSubBox: {
    marginTop: 1,
  },
  discountSubText: {
    fontSize: 6.5,
    color: "#666666",
    textAlign: "right",
  },
  textRight: {
    textAlign: "right",
    paddingRight: 6,
  },

  // 7 Column Widths (Total exactly 100%)
  colTotal: { width: "17%" },
  colVatAmount: { width: "13%" },
  colVatRate: { width: "10%" },
  colPrice: { width: "13%" },
  colQty: { width: "9%" },
  colDesc: { width: "33%" },
  colIndex: { width: "5%", borderRightWidth: 0 },

  // ─── Tafqeet Box ───
  tafqeetBox: {
    backgroundColor: "#F9F9F9",
    borderWidth: 0.75,
    borderColor: "#C0C0C0",
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  tafqeetRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  tafqeetLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333333",
  },
  tafqeetColon: {
    fontSize: 8,
    color: "#333333",
    marginHorizontal: 3,
  },
  tafqeetValue: {
    fontSize: 8,
    color: "#222222",
  },

  // ─── Summary & QR Section ───
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
  },
  totalsContainer: {
    width: "52%",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EAEAEA",
  },
  totalLabel: {
    fontSize: 8,
    color: "#333333",
    textAlign: "right",
  },
  totalValue: {
    fontSize: 8,
    color: "#222222",
    textAlign: "left",
  },
  netLine: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#A0A0A0",
    borderBottomWidth: 1,
    borderBottomColor: "#A0A0A0",
    paddingVertical: 3,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 4,
  },
  netBold: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
  },

  qrContainer: {
    width: "44%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  qrImage: {
    width: 160,
    height: 160,
  },

  // ─── Notes & Terms ───
  notesTermsContainer: {
    marginTop: 8,
    padding: 6,
    borderWidth: 0.75,
    borderColor: "#C0C0C0",
    borderRadius: 2,
    backgroundColor: "#FAFAFA",
  },
  notesBlock: {
    marginBottom: 4,
  },
  notesTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 7.5,
    color: "#444444",
    textAlign: "right",
    lineHeight: 1.3,
  },

  // ─── Custom Footer ───
  customFooterWrap: {
    marginTop: 6,
    alignItems: "center",
  },
  customFooterText: {
    fontSize: 7.5,
    color: "#555555",
    textAlign: "center",
  },

  // ─── Return Policy Footer ───
  footerWrap: {
    marginTop: "auto",
    paddingTop: 10,
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
