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

export interface GenericDeliveryNoteTemplateProps {
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

// ─── Arabic Tafqeet (Number to Words) ───
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

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
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

function companyAddressLine(company: CompanyRecord): string {
  const parts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressStreet ?? "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity ?? "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    "المملكة العربية السعودية",
  ].filter((p) => p.length > 0);
  return parts.join(" - ");
}

function customerAddressLine(customer: CustomerRecord): string {
  const parts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet ?? "",
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : "",
    customer.addressCity ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(" - ");
}

export function GenericDeliveryNoteTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: GenericDeliveryNoteTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddress = companyAddressLine(company);
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = (company as any).website || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as any).unifiedNumber || "";

  // ─── Document Meta ───
  const invoiceNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const currencyText = invoice.currency || "SAR";

  // ─── Customer Details ───
  const customerNameAr = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerAddress = customerAddressLine(customer);
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";

  // ─── Line Items & Calculations ───
  const items: InvoiceItemDto[] = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawLineAmount = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount || (item as any).discount);
    // Ensure taxableSubtotal never becomes negative
    const taxableSubtotal = Math.max(0, rawLineAmount - lineDiscount);
    const vatRateNum = item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const itemVat = item.lineVat !== undefined && item.lineVat !== null
      ? toNumber(item.lineVat)
      : (taxableSubtotal * vatRateNum) / 100;
    const itemTotal = item.lineTotal !== undefined && item.lineTotal !== null
      ? toNumber(item.lineTotal)
      : taxableSubtotal + itemVat;

    return {
      key: item.position ?? idx,
      index: idx + 1,
      description: item.description || "",
      qty,
      unitPrice,
      rawLineAmount,
      lineDiscount,
      taxableSubtotal,
      vatRateNum,
      itemVat,
      itemTotal,
    };
  });

  const sumQty = rows.reduce((a, r) => a + r.qty, 0);
  const grossSubtotal = rows.reduce((a, r) => a + r.rawLineAmount, 0);
  const discountVal = (invoice as any).discountTotal ?? rows.reduce((a, r) => a + r.lineDiscount, 0);
  const taxableVal = invoice.subtotal !== undefined && invoice.subtotal !== null
    ? toNumber(invoice.subtotal)
    : Math.max(0, grossSubtotal - toNumber(discountVal));
  const vatVal = invoice.vatAmount !== undefined && invoice.vatAmount !== null
    ? toNumber(invoice.vatAmount)
    : rows.reduce((a, r) => a + r.itemVat, 0);
  const totalVal = invoice.total !== undefined && invoice.total !== null
    ? toNumber(invoice.total)
    : taxableVal + vatVal;

  const firstItemVatRate = rows.find((r) => r.vatRateNum !== undefined)?.vatRateNum;
  const vatRatePercentage = firstItemVatRate !== undefined ? `${firstItemVatRate}%` : "15%";

  // Spelled-out Arabic words (Tafqeet) - ALWAYS spells out final total due
  const tafqeetText = totalVal > 0 ? tafqeet(totalVal) : "صفر ريال سعودي لا غير";

  // Printed on date
  const printedOn = formatDate(new Date().toISOString());

  // Logo source: strictly conditional without placeholder
  const logoSource = logoDataUrl || company.logoUrl;

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 20 + Math.min(invoice.notes.split("\n").length, 4) * 9;
  if (invoice.terms)
    extraContentHeight += 20 + Math.min(invoice.terms.split("\n").length, 4) * 9;
  if (company.footerText) extraContentHeight += 16;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Optional Watermark Background */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Centered header: logo + bilingual name + address + contacts + VAT/CR ─── */}
        <View style={styles.header}>
          {logoSource ? <Image src={logoSource} style={styles.logoImg} /> : null}
          {companyNameAr ? <Text style={styles.companyNameAr}>{companyNameAr}</Text> : null}
          {companyNameEn ? <Text style={styles.companyNameEn}>{companyNameEn}</Text> : null}
          {companyAddress ? <Text style={styles.headerLine}>{companyAddress}</Text> : null}

          <View style={styles.headerContactsRow}>
            {companyPhone ? (
              <View style={styles.bidiInlineItem}>
                <Text style={styles.bidiLabel}>هاتف Tel</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValue}>{companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={styles.bidiInlineItem}>
                <Text style={styles.bidiLabel}>البريد Email</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValue}>{companyEmail}</Text>
              </View>
            ) : null}
            {companyWebsite ? (
              <View style={styles.bidiInlineItem}>
                <Text style={styles.bidiLabel}>الموقع Web</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValue}>{companyWebsite}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headerTaxRow}>
            {companyVat ? (
              <View style={styles.bidiInlineItem}>
                <Text style={styles.bidiLabel}>الرقم الضريبي VAT No</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValue}>{companyVat}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.bidiInlineItem}>
                <Text style={styles.bidiLabel}>سجل تجاري / الرقم الموحد C.R.</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValue}>{companyCr}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Title band ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleOriginal}>أصلي ORIGINAL</Text>
          <Text style={styles.titleMain}>فاتورة ضريبية TAX INVOICE</Text>
          <Text style={styles.titleDoc}>{invoiceNo ? `# ${invoiceNo}` : " "}</Text>
        </View>

        {/* ─── Meta grid (2-column dot-matrix box) ─── */}
        <View style={styles.metaBox}>
          {/* Row 1: Date & Invoice Number */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>التاريخ Date</Text>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>رقم الفاتورة Invoice No</Text>
              <Text style={styles.metaVal}>{invoiceNo}</Text>
            </View>
          </View>

          {/* Row 2: Customer Name */}
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>اسم العميل Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerNameAr || "عميل نقدي"}
                {customerNameEn ? ` / ${customerNameEn}` : ""}
              </Text>
            </View>
          </View>

          {/* Row 3: Customer VAT & CR / Unified No */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>الرقم الضريبي للعميل Customer VAT</Text>
              <Text style={styles.metaVal}>{customerVat || "—"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>الرقم الموحد / السجل التجاري Unified No / C.R.</Text>
              <Text style={styles.metaVal}>{customerCrOrUnified || "—"}</Text>
            </View>
          </View>

          {/* Row 4: Customer Address */}
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>عنوان العميل Customer Address</Text>
              <Text style={styles.metaVal}>{customerAddress || "—"}</Text>
            </View>
          </View>

          {/* Row 5: Phone & Email */}
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>رقم الجوال Phone</Text>
              <Text style={styles.metaVal}>{customerPhone || "—"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>البريد الإلكتروني Email</Text>
              <Text style={styles.metaVal}>{customerEmail || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ─── Items table (monochrome, thin dot-matrix borders) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thAr}>م</Text>
              <Text style={styles.thEn}>#</Text>
            </View>
            <View style={[styles.thCell, { width: "32%" }]}>
              <Text style={styles.thAr}>وصف الصنف / البيان</Text>
              <Text style={styles.thEn}>Item Description</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>المبلغ الخاضع</Text>
              <Text style={styles.thEn}>Taxable Amt</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المجموع شامل</Text>
              <Text style={styles.thEn}>Total Incl VAT</Text>
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
              <View key={row.key} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdMain}>{row.index}</Text>
                </View>
                <View style={[styles.tdCell, { width: "32%", alignItems: "flex-end", paddingHorizontal: 4 }]}>
                  <Text style={styles.tdDesc}>{row.description}</Text>
                  {row.lineDiscount > 0 ? (
                    <Text style={styles.discountBadge}>
                      قبل الخصم: {formatExactAmount(row.rawLineAmount)} | خصم: {formatExactAmount(row.lineDiscount)} | بعد الخصم: {formatExactAmount(row.taxableSubtotal)}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdMain}>{formatQty(row.qty)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.itemVat)}</Text>
                  <Text style={styles.tdSub}>%{row.vatRateNum}</Text>
                </View>
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdBold}>{formatExactAmount(row.itemTotal)}</Text>
                </View>
              </View>
            ))
          )}

          {/* ─── Totals summary row ─── */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <View style={[styles.tdCell, { width: "6%" }]}>
              <Text style={styles.tdBold}>#</Text>
            </View>
            <View style={[styles.tdCell, { width: "32%" }]}>
              <Text style={styles.tdBold}>الإجمالي Total</Text>
            </View>
            <View style={[styles.tdCell, { width: "9%" }]}>
              <Text style={styles.tdBold}>{formatQty(sumQty)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "13%" }]}>
              <Text style={styles.tdBold}>—</Text>
            </View>
            <View style={[styles.tdCell, { width: "13%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(taxableVal)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(vatVal)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.tdBold}>{formatExactAmount(totalVal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Bottom Section: Totals Table & ZATCA QR + Tafqeet ─── */}
        <View style={styles.bottomSection}>
          {/* Left Column: Formal Dot-Matrix Totals Box */}
          <View style={styles.totalsTable}>
            {/* Gross Total */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalValue}>{formatExactAmount(grossSubtotal)} {currencyText}</Text>
              <Text style={styles.totalLabel}>الإجمالي غير شامل الضريبة / Gross Total</Text>
            </View>

            {/* Total Discount if present */}
            {Number(discountVal) > 0 ? (
              <View style={styles.totalsTableRow}>
                <Text style={[styles.totalValue, { color: "#444444" }]}>
                  -{formatExactAmount(discountVal)} {currencyText}
                </Text>
                <Text style={styles.totalLabel}>إجمالي الخصم / Total Discount</Text>
              </View>
            ) : null}

            {/* Taxable Amount */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalValue}>{formatExactAmount(taxableVal)} {currencyText}</Text>
              <Text style={styles.totalLabel}>المبلغ الخاضع للضريبة / Taxable Amount</Text>
            </View>

            {/* VAT Amount */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalValue}>{formatExactAmount(vatVal)} {currencyText}</Text>
              <Text style={styles.totalLabel}>ضريبة القيمة المضافة / VAT ({vatRatePercentage})</Text>
            </View>

            {/* Grand Total */}
            <View style={[styles.totalsTableRow, styles.totalsGrandRow]}>
              <Text style={[styles.totalValue, styles.grandValue]}>
                {formatExactAmount(totalVal)} {currencyText}
              </Text>
              <Text style={[styles.totalLabel, styles.grandLabel]}>
                المجموع شامل الضريبة / Total Incl. VAT
              </Text>
            </View>

            {/* Invoice Paid */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalValue}>{formatExactAmount(totalVal)} {currencyText}</Text>
              <Text style={styles.totalLabel}>المبلغ المدفوع / Paid Amount</Text>
            </View>

            {/* Balance Due */}
            <View style={[styles.totalsTableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalValue}>0.00 {currencyText}</Text>
              <Text style={styles.totalLabel}>المبلغ المتبقي / Balance Due</Text>
            </View>
          </View>

          {/* Right Column: Official ZATCA QR Code & Arabic Tafqeet */}
          <View style={styles.sideInfoBox}>
            {qrDataUrl ? (
              <View style={styles.qrContainer}>
                <Image src={qrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrLabel}>رمز الاستجابة السريعة (ZATCA QR)</Text>
              </View>
            ) : null}

            <View style={styles.tafqeetBox}>
              <Text style={styles.tafqeetTitle}>المبلغ كتابة / Amount in Words:</Text>
              <Text style={styles.tafqeetContent}>{tafqeetText}</Text>
            </View>

            {invoice.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>ملاحظات / Notes:</Text>
                <Text style={styles.notesContent}>{invoice.notes}</Text>
              </View>
            ) : null}

            {invoice.terms ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>الشروط والأحكام / Terms &amp; Conditions:</Text>
                <Text style={styles.notesContent}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Footer Notes ─── */}
        <View style={styles.footerSection}>
          <Text style={styles.footerNote}>
            المبالغ بالريال السعودي • All amounts are in {currencyText}
          </Text>
          <Text style={styles.footerNote}>
            طبع بتاريخ Printed On: {printedOn}
          </Text>
          {company.footerText ? (
            <Text style={styles.companyFooterText}>{company.footerText}</Text>
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "20%",
    left: "20%",
    width: "60%",
    height: "50%",
    opacity: 0.06,
    objectFit: "contain",
  },
  // ─── Header (centered, dot-matrix feel) ───
  header: {
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
    marginBottom: 6,
  },
  logoImg: {
    width: 54,
    height: 54,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameAr: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  companyNameEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
  },
  headerLine: {
    fontSize: 7,
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
  },
  headerContactsRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 1,
  },
  headerTaxRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 2,
  },
  bidiInlineItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  bidiLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#333333",
  },
  bidiColon: {
    fontSize: 7,
    marginHorizontal: 2,
    color: "#333333",
  },
  bidiValue: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  // ─── Title band ───
  titleBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  titleMain: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  titleOriginal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 1,
    paddingHorizontal: 5,
  },
  titleDoc: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    minWidth: 50,
    textAlign: "left",
  },
  // ─── Meta grid ───
  metaBox: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#666666",
    minHeight: 18,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#666666",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  metaCellWide: {
    width: "100%",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#444444",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // ─── Items table ───
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 25,
    alignItems: "stretch",
    backgroundColor: "#F8F8F8",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6,
    color: "#444444",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#888888",
    minHeight: 18,
    alignItems: "stretch",
  },
  totalsRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    backgroundColor: "#FAFAFA",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#888888",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdDesc: {
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  discountBadge: {
    fontSize: 5.5,
    color: "#555555",
    textAlign: "right",
    marginTop: 1,
    width: "100%",
  },
  tdSub: {
    fontSize: 5.5,
    color: "#555555",
    textAlign: "center",
  },
  tdBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  // ─── Bottom Section: Totals & Side Info ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  totalsTable: {
    width: "53%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#888888",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    minHeight: 16,
  },
  totalsGrandRow: {
    backgroundColor: "#F3F4F6",
    borderTopWidth: 0.75,
    borderTopColor: "#000000",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
  },
  totalLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  totalValue: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  grandLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  grandValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  sideInfoBox: {
    width: "44%",
    flexDirection: "column",
    gap: 4,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#FAFAFA",
  },
  qrImage: {
    width: 102,
    height: 102,
  },
  qrLabel: {
    fontSize: 5.5,
    color: "#555555",
    marginTop: 2,
    textAlign: "center",
  },
  tafqeetBox: {
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  tafqeetTitle: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#444444",
    textAlign: "right",
  },
  tafqeetContent: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginTop: 1,
  },
  notesBox: {
    borderWidth: 0.5,
    borderColor: "#888888",
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "#FAFAFA",
  },
  notesTitle: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  notesContent: {
    fontSize: 6,
    color: "#000000",
    textAlign: "right",
    marginTop: 1,
  },
  // ─── Footer Section ───
  footerSection: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 3,
    alignItems: "center",
  },
  footerNote: {
    fontSize: 6.5,
    color: "#444444",
    textAlign: "center",
    marginBottom: 1,
  },
  companyFooterText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },
});

