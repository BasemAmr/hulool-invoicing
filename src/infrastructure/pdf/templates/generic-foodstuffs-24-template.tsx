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

export interface GenericFoodstuffs24TemplateProps {
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

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
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

/**
 * Monetary formatting without rounding or truncation:
 * Preserves raw exact decimal tails while adding thousands commas to the integer part.
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

// ─── Arabic Tafqeet (Amount in Words) ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

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

export function GenericFoodstuffs24Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: GenericFoodstuffs24TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Company & Supplier Values ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyLogo = logoDataUrl || company.logoUrl;

  const companyAddressParts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressStreet,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyUnified = (company as any).unifiedNumber || "";

  // ─── Document Values ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const currencyText = invoice.currency || "SAR";

  // ─── Customer Values ───
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerNameEn = customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCrOrUnified =
    customer.unifiedNumber || (customer as any).crNumber || "";

  const customerAddressParts = [
    customer.addressAdditionalNumber
      ? `الرقم الإضافي ${customer.addressAdditionalNumber}`
      : null,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
    customer.addressCity,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  const customerContacts = [
    customer.phone ? `هاتف: ${customer.phone}` : null,
    customer.email ? `بريد: ${customer.email}` : null,
  ].filter(Boolean).join(" | ");

  // ─── Items & Calculations ───
  const items = invoice.items ?? [];
  let sumQty = 0;
  let grossTotalCalc = 0;
  let discountTotalCalc = 0;
  let taxableTotalCalc = 0;
  let vatTotalCalc = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawLineGross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, rawLineGross - lineDiscount);
    const vatRate = toNumber(item.vatRate ?? 15);
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    sumQty += qty;
    grossTotalCalc += rawLineGross;
    discountTotalCalc += lineDiscount;
    taxableTotalCalc += taxableSubtotal;
    vatTotalCalc += lineVat;

    return {
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      rawLineGross,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const invoiceSubtotal = toNumber(invoice.subtotal);
  const invoiceVat = toNumber(invoice.vatAmount);
  const invoiceTotal = toNumber(invoice.total);

  const finalGross = grossTotalCalc > 0 ? grossTotalCalc : invoiceSubtotal;
  const finalDiscount = discountTotalCalc;
  const finalTaxable = taxableTotalCalc > 0 ? taxableTotalCalc : invoiceSubtotal;
  const finalVat = vatTotalCalc > 0 ? vatTotalCalc : invoiceVat;
  const finalTotal =
    invoiceTotal > 0 ? invoiceTotal : finalTaxable + finalVat;

  const tafqeetText = tafqeet(finalTotal);

  // ─── Extra Notes & Terms ───
  const footerNote = toText(company.footerText ?? "");
  const invoiceNotes = toText(invoice.notes ?? "");
  const invoiceTerms = toText(invoice.terms ?? "");

  // ─── Dynamic Height Guarantee (Strict Single-Page Rule) ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const extraItemsCount = Math.max(0, items.length - 3);
  let extraContentHeight = extraItemsCount * 28;

  if (invoiceNotes) {
    extraContentHeight += 24 + Math.min(invoiceNotes.split("\n").length, 4) * 10;
  }
  if (invoiceTerms) {
    extraContentHeight += 24 + Math.min(invoiceTerms.split("\n").length, 4) * 10;
  }
  if (footerNote) {
    extraContentHeight += 20;
  }
  if (finalDiscount > 0) {
    extraContentHeight += 16;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [pageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${docNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Boxed Header: EN (Left) / Logo (Center) / AR (Right) ─── */}
        <View style={styles.headerBox}>
          {/* Left Column: English Details */}
          <View style={styles.headerColLeft}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLineEn}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <Text style={styles.headerLineEn}>Tel: {companyPhone}</Text>
            ) : null}
            {companyEmail ? (
              <Text style={styles.headerLineEn}>Email: {companyEmail}</Text>
            ) : null}
            {companyWebsite ? (
              <Text style={styles.headerLineEn}>Web: {companyWebsite}</Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.headerLineEn}>C.R.: {companyCr}</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.headerLineEn}>VAT No: {companyVat}</Text>
            ) : null}
          </View>

          {/* Center Column: Logo ONLY (no dummy placeholder if absent) */}
          <View style={styles.headerColCenter}>
            {companyLogo ? (
              <Image src={companyLogo} style={styles.logoImg} />
            ) : null}
          </View>

          {/* Right Column: Arabic Details with BiDi Middle-Colon Pattern */}
          <View style={styles.headerColRight}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLineAr}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <View style={styles.headerBidiRow}>
                <Text style={styles.headerBidiLabel}>جوال</Text>
                <Text style={styles.headerBidiColon}>:</Text>
                <Text style={styles.headerBidiVal}>{companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={styles.headerBidiRow}>
                <Text style={styles.headerBidiLabel}>البريد</Text>
                <Text style={styles.headerBidiColon}>:</Text>
                <Text style={styles.headerBidiVal}>{companyEmail}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.headerBidiRow}>
                <Text style={styles.headerBidiLabel}>سجل تجاري</Text>
                <Text style={styles.headerBidiColon}>:</Text>
                <Text style={styles.headerBidiVal}>{companyCr}</Text>
              </View>
            ) : null}
            {companyUnified ? (
              <View style={styles.headerBidiRow}>
                <Text style={styles.headerBidiLabel}>الرقم الموحد</Text>
                <Text style={styles.headerBidiColon}>:</Text>
                <Text style={styles.headerBidiVal}>{companyUnified}</Text>
              </View>
            ) : null}
            {companyVat ? (
              <View style={styles.headerBidiRow}>
                <Text style={styles.headerBidiLabel}>الرقم الضريبي</Text>
                <Text style={styles.headerBidiColon}>:</Text>
                <Text style={styles.headerBidiVal}>{companyVat}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Title Band: Clear Tax Invoice Title & Metadata ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleMain}>فاتورة ضريبية / TAX INVOICE</Text>
          <View style={styles.titleSubRow}>
            {docNo ? (
              <View style={styles.titleMetaItem}>
                <Text style={styles.titleMetaLabel}>رقم الفاتورة</Text>
                <Text style={styles.titleMetaColon}>:</Text>
                <Text style={styles.titleMetaVal}>{docNo}</Text>
              </View>
            ) : null}
            {issueDateStr ? (
              <View style={styles.titleMetaItem}>
                <Text style={styles.titleMetaLabel}>تاريخ الإصدار</Text>
                <Text style={styles.titleMetaColon}>:</Text>
                <Text style={styles.titleMetaVal}>{issueDateStr}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Customer Details Box ─── */}
        <View style={styles.metaBox}>
          {/* Row 1: Customer Name */}
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>اسم العميل Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerName}
                {customerNameEn && customerNameEn !== customerName
                  ? ` / ${customerNameEn}`
                  : ""}
              </Text>
            </View>
          </View>

          {/* Row 2: Customer VAT & Unified/CR */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>الرقم الضريبي للعميل VAT Number</Text>
              <Text style={styles.metaVal}>{customerVat || "—"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>
                الرقم الموحد / السجل التجاري Unified No. / CR
              </Text>
              <Text style={styles.metaVal}>{customerCrOrUnified || "—"}</Text>
            </View>
          </View>

          {/* Row 3: Customer National Address & Contacts */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>العنوان الوطني للعميل Address</Text>
              <Text style={styles.metaVal}>{customerAddress || "—"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>بيانات التواصل Phone & Email</Text>
              <Text style={styles.metaVal}>{customerContacts || "—"}</Text>
            </View>
          </View>

          {/* Row 4: Currency & Invoice Type */}
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>العملة Currency</Text>
              <Text style={styles.metaVal}>{currencyText}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>نوع الفاتورة Invoice Type</Text>
              <Text style={styles.metaVal}>
                {invoice.invoiceType === "simplified"
                  ? "فاتورة ضريبية مبسطة / Simplified"
                  : "فاتورة ضريبية / Tax Invoice"}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Line Items Table ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "5%" }]}>
              <Text style={styles.thAr}>م</Text>
              <Text style={styles.thEn}>#</Text>
            </View>
            <View style={[styles.thCell, { width: "31%" }]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Disc</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>الخاضع للضريبة</Text>
              <Text style={styles.thEn}>Taxable</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "12%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المجموع شامل الضريبة</Text>
              <Text style={styles.thEn}>Total Incl. VAT</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderLeftWidth: 0 }]}>
                <Text style={styles.tdMain}>لا توجد أصناف No items</Text>
              </View>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.index} style={styles.tableRow}>
                {/* Index */}
                <View style={[styles.tdCell, { width: "5%" }]}>
                  <Text style={styles.tdMain}>{row.index}</Text>
                </View>

                {/* Description */}
                <View
                  style={[
                    styles.tdCell,
                    { width: "31%", alignItems: "flex-end", paddingHorizontal: 4 },
                  ]}
                >
                  <Text style={[styles.tdMain, { textAlign: "right" }]}>
                    {row.desc}
                  </Text>
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discBadgeDesc}>
                      <Text style={styles.discBadgeDescText}>
                        خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.rawLineGross)} | بعد: {formatExactAmount(row.taxableSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdMain}>{formatQty(row.qty)}</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>
                    {formatExactAmount(row.unitPrice)}
                  </Text>
                </View>

                {/* Discount */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  {row.lineDiscount > 0 ? (
                    <View style={styles.cellCenter}>
                      <Text style={styles.tdMain}>
                        {formatExactAmount(row.lineDiscount)}
                      </Text>
                      <View style={styles.discBadge}>
                        <Text style={styles.discBadgeText}>خصم</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.tdMain}>0.00</Text>
                  )}
                </View>

                {/* Taxable Subtotal */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>
                    {formatExactAmount(row.taxableSubtotal)}
                  </Text>
                </View>

                {/* VAT Amount & Rate */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>
                    {formatExactAmount(row.lineVat)}
                  </Text>
                  <Text style={styles.tdSubRate}>({row.vatRate}%)</Text>
                </View>

                {/* Line Total */}
                <View style={[styles.tdCell, { width: "12%", borderLeftWidth: 0 }]}>
                  <Text style={[styles.tdMain, { fontWeight: "bold" }]}>
                    {formatExactAmount(row.lineTotal)}
                  </Text>
                </View>
              </View>
            ))
          )}

          {/* Table Totals Bar */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <View style={[styles.tdCell, { width: "5%" }]}>
              <Text style={styles.tdBold}>#</Text>
            </View>
            <View style={[styles.tdCell, { width: "31%" }]}>
              <Text style={styles.tdBold}>الإجمالي / TOTAL</Text>
            </View>
            <View style={[styles.tdCell, { width: "9%" }]}>
              <Text style={styles.tdBold}>{formatQty(sumQty)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "11%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(finalGross)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(finalDiscount)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "11%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(finalTaxable)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "11%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(finalVat)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%", borderLeftWidth: 0 }]}>
              <Text style={styles.tdBold}>{formatExactAmount(finalTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Summary & Totals Container: Left Totals, Right Tafqeet & QR ─── */}
        <View style={styles.summaryContainer}>
          {/* Right Box: Tafqeet & Official ZATCA QR */}
          <View style={styles.summaryRightCol}>
            {/* Tafqeet Card */}
            <View style={styles.tafqeetBox}>
              <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة :</Text>
              <Text style={styles.tafqeetText}>{tafqeetText}</Text>
            </View>

            {/* ZATCA QR Code (Official 2D QR ONLY, no linear barcodes) */}
            {qrDataUrl ? (
              <View style={styles.qrBox}>
                <Image src={qrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrLabel}>رمز الاستجابة السريعة (ZATCA QR)</Text>
              </View>
            ) : null}
          </View>

          {/* Left Box: Formal Totals Card */}
          <View style={styles.summaryLeftCol}>
            <View style={styles.totalsCard}>
              {/* Gross Total (Excl. VAT) */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabelAr}>إجمالي المبلغ قبل الخصم</Text>
                  <Text style={styles.totalLabelEn}>Gross Total (Excl. VAT)</Text>
                </View>
                <Text style={styles.totalColon}>:</Text>
                <Text style={styles.totalVal}>
                  {formatExactAmount(finalGross)} {currencyText}
                </Text>
              </View>

              {/* Total Discount (Conditional) */}
              {finalDiscount > 0 ? (
                <View style={styles.totalRow}>
                  <View style={styles.totalLabelBox}>
                    <Text style={styles.totalLabelAr}>مجموع الخصومات</Text>
                    <Text style={styles.totalLabelEn}>Total Discount</Text>
                  </View>
                  <Text style={styles.totalColon}>:</Text>
                  <Text style={[styles.totalVal, { color: "#A21CAF" }]}>
                    -{formatExactAmount(finalDiscount)} {currencyText}
                  </Text>
                </View>
              ) : null}

              {/* Taxable Subtotal */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabelAr}>الإجمالي الخاضع للضريبة</Text>
                  <Text style={styles.totalLabelEn}>Taxable Amount</Text>
                </View>
                <Text style={styles.totalColon}>:</Text>
                <Text style={styles.totalVal}>
                  {formatExactAmount(finalTaxable)} {currencyText}
                </Text>
              </View>

              {/* Total VAT */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabelAr}>ضريبة القيمة المضافة (15%)</Text>
                  <Text style={styles.totalLabelEn}>VAT Amount</Text>
                </View>
                <Text style={styles.totalColon}>:</Text>
                <Text style={styles.totalVal}>
                  {formatExactAmount(finalVat)} {currencyText}
                </Text>
              </View>

              {/* Grand Total */}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.grandTotalLabelAr}>
                    المجموع الكلي شامل الضريبة
                  </Text>
                  <Text style={styles.grandTotalLabelEn}>Total Incl. VAT</Text>
                </View>
                <Text style={styles.grandTotalColon}>:</Text>
                <Text style={styles.grandTotalVal}>
                  {formatExactAmount(finalTotal)} {currencyText}
                </Text>
              </View>

              {/* Paid Amount */}
              <View style={styles.totalRow}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabelAr}>المبلغ المدفوع</Text>
                  <Text style={styles.totalLabelEn}>Paid Amount</Text>
                </View>
                <Text style={styles.totalColon}>:</Text>
                <Text style={styles.totalVal}>
                  {formatExactAmount(finalTotal)} {currencyText}
                </Text>
              </View>

              {/* Balance Due */}
              <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabelAr}>المتبقي</Text>
                  <Text style={styles.totalLabelEn}>Balance Due</Text>
                </View>
                <Text style={styles.totalColon}>:</Text>
                <Text style={styles.totalVal}>0.00 {currencyText}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Notes & Terms Blocks ─── */}
        {invoiceNotes ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>ملاحظات / Notes</Text>
            <Text style={styles.noteContent}>{invoiceNotes}</Text>
          </View>
        ) : null}

        {invoiceTerms ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>الشروط والأحكام / Terms & Conditions</Text>
            <Text style={styles.noteContent}>{invoiceTerms}</Text>
          </View>
        ) : null}

        {/* ─── Footer: Custom text & print note ─── */}
        <View style={styles.footerContainer}>
          {footerNote ? (
            <Text style={styles.footerCustomText}>{footerNote}</Text>
          ) : null}
          <Text style={styles.footerNote}>
            المبالغ بالريال السعودي (SAR) • طبعت الفاتورة إلكترونياً وهي معتمدة من هيئة الزكاة والضريبة والجمارك
          </Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFEF7",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#2E2300",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    objectFit: "cover",
  },
  // ─── Boxed Header Frame (Classic Gold/Amber) ───
  headerBox: {
    flexDirection: "row",
    backgroundColor: "#FDF6DC",
    borderWidth: 1.5,
    borderColor: "#B8860B",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  headerColLeft: {
    width: "40%",
    alignItems: "flex-start",
  },
  headerColCenter: {
    width: "20%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  headerColRight: {
    width: "40%",
    alignItems: "flex-end",
  },
  logoImg: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  companyNameAr: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "left",
    marginBottom: 2,
  },
  headerLineAr: {
    fontSize: 7.5,
    color: "#5C4A1A",
    textAlign: "right",
    marginBottom: 1,
  },
  headerLineEn: {
    fontSize: 7.5,
    color: "#5C4A1A",
    textAlign: "left",
    marginBottom: 1,
  },
  headerBidiRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 1,
  },
  headerBidiLabel: {
    fontSize: 7.5,
    color: "#5C4A1A",
    textAlign: "right",
  },
  headerBidiColon: {
    fontSize: 7.5,
    color: "#5C4A1A",
    marginHorizontal: 3,
  },
  headerBidiVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#2E2300",
  },
  // ─── Title Band ───
  titleBand: {
    backgroundColor: "#A67C00",
    borderWidth: 1,
    borderColor: "#7A5C00",
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  titleMain: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleSubRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 3,
  },
  titleMetaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  titleMetaLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#FDF6DC",
  },
  titleMetaColon: {
    fontSize: 8,
    color: "#FDF6DC",
    marginHorizontal: 2,
  },
  titleMetaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  // ─── Customer Details Box ───
  metaBox: {
    backgroundColor: "#FFFDF0",
    borderWidth: 1,
    borderColor: "#B8860B",
    borderRadius: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9C47A",
    minHeight: 20,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#D9C47A",
    paddingVertical: 3,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  metaCellWide: {
    width: "100%",
    paddingVertical: 3,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#7A5C00",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#2E2300",
    textAlign: "right",
    marginTop: 1,
  },
  // ─── Line Items Table ───
  table: {
    borderWidth: 1.25,
    borderColor: "#B8860B",
    borderRadius: 3,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F0DFA8",
    borderBottomWidth: 1,
    borderBottomColor: "#B8860B",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#B8860B",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#7A5C00",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9C47A",
    minHeight: 20,
    alignItems: "stretch",
  },
  totalsRow: {
    backgroundColor: "#E8D48B",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#B8860B",
    minHeight: 22,
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#D9C47A",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7.5,
    color: "#2E2300",
    textAlign: "center",
  },
  tdSubRate: {
    fontSize: 6.5,
    color: "#7A5C00",
    marginTop: 1,
  },
  tdBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "center",
  },
  cellCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  discBadge: {
    backgroundColor: "#FDF2F8",
    borderWidth: 0.5,
    borderColor: "#F472B6",
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    marginTop: 1,
  },
  discBadgeText: {
    fontSize: 5.5,
    color: "#BE185D",
    fontWeight: "bold",
  },
  discBadgeDesc: {
    backgroundColor: "#FDF4FF",
    borderWidth: 0.5,
    borderColor: "#E879F9",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
    alignSelf: "flex-end",
  },
  discBadgeDescText: {
    fontSize: 6,
    color: "#86198F",
    textAlign: "right",
  },
  // ─── Summary & Totals Container ───
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  summaryRightCol: {
    width: "48%",
    alignItems: "stretch",
  },
  summaryLeftCol: {
    width: "50%",
    alignItems: "stretch",
  },
  tafqeetBox: {
    backgroundColor: "#FDF6DC",
    borderWidth: 1,
    borderColor: "#B8860B",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  tafqeetLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#7A5C00",
    textAlign: "right",
    marginBottom: 2,
  },
  tafqeetText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "right",
    lineHeight: 1.3,
  },
  qrBox: {
    backgroundColor: "#FFFDF0",
    borderWidth: 1,
    borderColor: "#B8860B",
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 125,
    height: 125,
  },
  qrPlaceholder: {
    width: 125,
    height: 125,
  },
  qrLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#7A5C00",
    marginTop: 3,
    textAlign: "center",
  },
  totalsCard: {
    backgroundColor: "#FFFDF0",
    borderWidth: 1,
    borderColor: "#B8860B",
    borderRadius: 4,
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9C47A",
    paddingVertical: 3,
    paddingHorizontal: 6,
    minHeight: 18,
  },
  totalLabelBox: {
    alignItems: "flex-end",
    flex: 1,
  },
  totalLabelAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "right",
  },
  totalLabelEn: {
    fontSize: 6,
    color: "#7A5C00",
    textAlign: "right",
  },
  totalColon: {
    fontSize: 7,
    color: "#7A5C00",
    marginHorizontal: 3,
  },
  totalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#2E2300",
    textAlign: "left",
    minWidth: 70,
  },
  grandTotalRow: {
    backgroundColor: "#E8D48B",
    borderTopWidth: 1,
    borderTopColor: "#B8860B",
    borderBottomWidth: 1,
    borderBottomColor: "#B8860B",
    paddingVertical: 4,
  },
  grandTotalLabelAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "right",
  },
  grandTotalLabelEn: {
    fontSize: 6.5,
    color: "#6B4E00",
    textAlign: "right",
  },
  grandTotalColon: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4A3600",
    marginHorizontal: 3,
  },
  grandTotalVal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "left",
    minWidth: 70,
  },
  // ─── Notes & Terms Blocks ───
  noteBox: {
    backgroundColor: "#FDF6DC",
    borderWidth: 0.75,
    borderColor: "#B8860B",
    borderRadius: 3,
    padding: 5,
    marginBottom: 5,
  },
  noteTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "right",
    marginBottom: 2,
  },
  noteContent: {
    fontSize: 7,
    color: "#4A3600",
    textAlign: "right",
    lineHeight: 1.25,
  },
  // ─── Footer ───
  footerContainer: {
    marginTop: 4,
    alignItems: "center",
  },
  footerCustomText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "center",
    marginBottom: 2,
  },
  footerNote: {
    fontSize: 6.5,
    color: "#7A5C00",
    textAlign: "center",
  },
});
