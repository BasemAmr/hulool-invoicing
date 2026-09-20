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

export interface SaAlkoufiTemplateProps {
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

// ─── Optional extension fields (legacy ERP columns). All optional → "" when absent. ───

interface SaAlkoufiInvoiceExtensions {
  discountTotal?: string | number | null;
  invoiceTypeLabel?: string | null;
}

interface SaAlkoufiItemExtensions {
  unitName?: string | null;
  unit?: string | null;
}

function getInvoiceExt(invoice: InvoiceDto): SaAlkoufiInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<SaAlkoufiInvoiceExtensions>;
  return {
    discountTotal: rec.discountTotal ?? null,
    invoiceTypeLabel: rec.invoiceTypeLabel ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): SaAlkoufiItemExtensions {
  const rec = item as InvoiceItemDto & Partial<SaAlkoufiItemExtensions>;
  return {
    unitName: rec.unitName ?? rec.unit ?? null,
  };
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
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
 * Preserves raw exact decimal tails while adding thousands commas to integer part.
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

export function SaAlkoufiTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: SaAlkoufiTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);

  // ─── Dynamic Header Data ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyLogo = logoDataUrl || company.logoUrl;

  // Address per guidelines: (Additional No. - Postal Code - Street Name - Building No. - District - City - Country)
  const supplierAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : null,
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : null,
    company.addressStreet,
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const supplierAddress = supplierAddressParts.join(" - ");

  const supplierVat = company.vatNumber || "";
  const supplierPhone = company.phone || "";
  const supplierEmail = company.email || "";
  const supplierCrOrUnified = company.crNumber || (company as any).unifiedNumber || "";

  // ─── Customer Data ───
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerEmail = customer.email || "";

  // Address per guidelines: City - Postal Code - [Street / District]
  const customerAddressParts = [
    customer.addressCity,
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    (customer as any).addressDistrict || (customer as any).district,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  // ─── Metadata ───
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const currencyText = invoice.currency || "SAR";

  // ─── Line Items & Calculations ───
  const items = invoice.items ?? [];

  const rawSubtotalCalc = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );

  const discountVal =
    invExt.discountTotal ??
    items.reduce(
      (sum, item) => sum + Number(item.discountAmount || (item as any).discount || 0),
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
    items.reduce((sum, item) => sum + Number(item.lineVat || 0), 0);

  const totalVal = invoice.total ?? Number(taxableVal) + Number(vatVal);

  const firstItemVatRate = items.find(
    (it) => it.vatRate !== undefined && it.vatRate !== null
  )?.vatRate;
  const vatRatePercentage =
    firstItemVatRate !== undefined ? `%${Number(firstItemVatRate)}` : "%15";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(Number(totalVal)) : "صفر ريال سعودي";

  // ─── Policy Note & Custom Text ───
  const footerNote = toText(company.footerText ?? "");
  const invoiceNotes = toText(invoice.notes ?? "");
  const invoiceTerms = toText(invoice.terms ?? "");

  // ─── Dynamic Height Guarantee (One-Page Rule) ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * 22;

  if (invoiceNotes) extraContentHeight += 20 + Math.min(invoiceNotes.split("\n").length, 4) * 8;
  if (invoiceTerms) extraContentHeight += 20 + Math.min(invoiceTerms.split("\n").length, 4) * 8;
  if (footerNote) extraContentHeight += 24;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [pageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Header: Dynamic name, address, contacts & center logo ─── */}
        <View style={styles.headerRow}>
          {/* Left Column: English name & contacts */}
          <View style={styles.headerSideLeft}>
            {companyNameEn ? <Text style={styles.headerNameEn}>{companyNameEn}</Text> : null}
            {company.email ? (
              <View style={styles.headerContactRowEn}>
                <Text style={styles.headerContactLblEn}>Email: </Text>
                <Text style={styles.headerContactValEn}>{company.email}</Text>
              </View>
            ) : null}
            {company.phone ? (
              <View style={styles.headerContactRowEn}>
                <Text style={styles.headerContactLblEn}>Tel: </Text>
                <Text style={styles.headerContactValEn}>{company.phone}</Text>
              </View>
            ) : null}
            {supplierCrOrUnified ? (
              <View style={styles.headerContactRowEn}>
                <Text style={styles.headerContactLblEn}>C.R.: </Text>
                <Text style={styles.headerContactValEn}>{supplierCrOrUnified}</Text>
              </View>
            ) : null}
          </View>

          {/* Center Column: Logo */}
          <View style={styles.headerLogoWrap}>
            {companyLogo ? (
              <Image src={companyLogo} style={styles.logoImg} />
            ) : null}
          </View>

          {/* Right Column: Arabic name, address & tax details */}
          <View style={styles.headerSideRight}>
            {companyNameAr ? <Text style={styles.headerName}>{companyNameAr}</Text> : null}
            {supplierAddress ? (
              <Text style={styles.headerAddress}>{supplierAddress}</Text>
            ) : null}
            {supplierVat ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>الرقم الضريبي</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{supplierVat}</Text>
              </View>
            ) : null}
            {supplierCrOrUnified ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>السجل التجاري</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{supplierCrOrUnified}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Supplier / Customer box (Native 2-column cards) ─── */}
        <View style={styles.partiesBox}>
          <View style={styles.partiesHeaderRow}>
            <Text style={styles.partiesHeaderCell}>العميل / Customer</Text>
            <Text style={styles.partiesHeaderCell}>المورد / Supplier</Text>
          </View>

          {/* Name */}
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الاسم / Name</Text>
              <Text style={styles.partyValBold}>{customerName || "—"}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الاسم / Name</Text>
              <Text style={styles.partyValBold}>{companyNameAr || "—"}</Text>
            </View>
          </View>

          {/* VAT Number */}
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الرقم الضريبي / VAT No.</Text>
              <Text style={styles.partyVal}>{customerVat || "—"}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الرقم الضريبي / VAT No.</Text>
              <Text style={styles.partyVal}>{supplierVat || "—"}</Text>
            </View>
          </View>

          {/* Address */}
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>العنوان / Address</Text>
              <Text style={styles.partyVal}>{customerAddress || "—"}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>العنوان / Address</Text>
              <Text style={styles.partyVal}>{supplierAddress || "—"}</Text>
            </View>
          </View>

          {/* Phone */}
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الهاتف / Phone</Text>
              <Text style={styles.partyVal}>{customerPhone || "—"}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الهاتف / Phone</Text>
              <Text style={styles.partyVal}>{supplierPhone || "—"}</Text>
            </View>
          </View>

          {/* CR / Unified No */}
          <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.partyCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.partyLabel}>الرقم الموحد / CR No.</Text>
              <Text style={styles.partyVal}>{customerCrOrUnified || "—"}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>السجل التجاري / CR No.</Text>
              <Text style={styles.partyVal}>{supplierCrOrUnified || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ─── Invoice Title & Metadata (BiDi middle-colon rule) ─── */}
        <Text style={styles.invoiceTitle}>فاتورة ضريبية / Tax Invoice</Text>

        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>رقم الفاتورة / Invoice No.</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaVal}>{invoiceNum}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>تاريخ الإصدار / Issue Date</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
          </View>
        </View>

        {/* ─── Items Table (7 Columns, Deep Purple Theme) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "26%" }]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>Tax Rate</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>المبلغ الخاضع</Text>
              <Text style={styles.thEn}>Taxable Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>السعر الإجمالي</Text>
              <Text style={styles.thEn}>Total Price</Text>
            </View>
          </View>

          {items.map((item, idx) => {
            const ext = getItemExt(item);
            const unitText = toText(ext.unitName);

            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const rawLineAmount = qty * unitPrice;
            const lineDiscount = Number(item.discountAmount || (item as any).discount || 0);
            const taxableSubtotal = Math.max(0, rawLineAmount - lineDiscount);

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
              <View key={item.position ?? idx} style={styles.tableRow}>
                {/* Description & Line Discount */}
                <View style={[styles.tdCell, { width: "26%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDescMain}>{item.description || ""}</Text>
                  {lineDiscount > 0 ? (
                    <Text style={styles.discountNote}>
                      قبل الخصم: {formatExactAmount(rawLineAmount)} | خصم: {formatExactAmount(lineDiscount)} | بعد الخصم: {formatExactAmount(taxableSubtotal)}
                    </Text>
                  ) : null}
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>{formatQty(qty)}</Text>
                  {unitText ? <Text style={styles.tdSub}>{unitText}</Text> : null}
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(unitPrice)}</Text>
                </View>

                {/* Tax Rate */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>%{vatRateNum}</Text>
                </View>

                {/* Taxable Amount */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(taxableSubtotal)}</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(itemVat)}</Text>
                </View>

                {/* Total Inc. VAT */}
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMainBold}>{formatExactAmount(itemTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Bottom Section: Totals & ZATCA QR Code ─── */}
        <View style={styles.bottomSection}>
          {/* Totals Breakdown */}
          <View style={styles.totalsBox}>
            {/* Gross Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalKey}>الإجمالي غير شامل الضريبة / Subtotal</Text>
            </View>

            {/* Discount if present */}
            {Number(discountVal) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={[styles.totalVal, { color: "#6D28D9" }]}>
                  -{formatExactAmount(discountVal)}
                </Text>
                <Text style={styles.totalKey}>إجمالي التخفيض / Discount</Text>
              </View>
            ) : null}

            {/* Taxable Amount */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(taxableVal)}</Text>
              <Text style={styles.totalKey}>المبلغ الخاضع للضريبة / Taxable Amount</Text>
            </View>

            {/* VAT */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(vatVal)}</Text>
              <Text style={styles.totalKey}>ضريبة القيمة المضافة / VAT ({vatRatePercentage})</Text>
            </View>

            {/* Grand Total */}
            <View style={[styles.totalRow, styles.totalRowGrand]}>
              <Text style={[styles.totalVal, styles.grandVal]}>
                {formatExactAmount(totalVal)} {currencyText}
              </Text>
              <Text style={[styles.totalKey, styles.grandKey]}>
                المجموع شامل الضريبة / Total Inc. VAT
              </Text>
            </View>

            {/* Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>
                {formatExactAmount(totalVal)} {currencyText}
              </Text>
              <Text style={styles.totalKey}>المبلغ المدفوع / Paid Amount</Text>
            </View>

            {/* Balance Due */}
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.totalVal, { fontWeight: "bold" }]}>
                0.00 {currencyText}
              </Text>
              <Text style={styles.totalKey}>المتبقي / Balance Due</Text>
            </View>
          </View>

          {/* QR Code Column (ZATCA QR only, NO linear barcodes) */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR Code</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Tafqeet Box (Exact Spelled-Out Arabic Amount) ─── */}
        {tafqeetText ? (
          <View style={styles.tafqeetBox}>
            <View style={styles.bidiRowReverseCenter}>
              <Text style={styles.tafqeetLabel}>المبلغ كتابة</Text>
              <Text style={styles.tafqeetColon}>:</Text>
              <Text style={styles.tafqeetText}>{tafqeetText}</Text>
            </View>
          </View>
        ) : null}

        {/* ─── Notes & Terms Section ─── */}
        {(invoiceNotes || invoiceTerms) ? (
          <View style={styles.notesTermsBox}>
            {invoiceNotes ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>ملاحظات / Notes</Text>
                <Text style={styles.noteText}>{invoiceNotes}</Text>
              </View>
            ) : null}
            {invoiceTerms ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>الشروط والأحكام / Terms & Conditions</Text>
                <Text style={styles.noteText}>{invoiceTerms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── Company Footer Policy Note ─── */}
        {footerNote ? (
          <View style={styles.footerNoteBox}>
            <Text style={styles.footerNoteText}>{footerNote}</Text>
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
    fontSize: 7.5,
    color: "#111827",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerSideLeft: {
    width: "36%",
    alignItems: "flex-start",
  },
  headerNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4C1D95",
    marginBottom: 2,
  },
  headerContactRowEn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  headerContactLblEn: {
    fontSize: 6.5,
    color: "#6B7280",
  },
  headerContactValEn: {
    fontSize: 6.5,
    color: "#111827",
    fontWeight: "bold",
  },

  headerLogoWrap: {
    width: "26%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 64,
    height: 64,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: {
    fontSize: 9,
    color: "#9CA3AF",
  },

  headerSideRight: {
    width: "36%",
    alignItems: "flex-end",
  },
  headerName: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "right",
    marginBottom: 2,
  },
  headerAddress: {
    fontSize: 6.5,
    color: "#4B5563",
    textAlign: "right",
    marginBottom: 2,
    lineHeight: 1.2,
  },
  bidiRowReverseRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1,
  },
  headerTaxLbl: {
    fontSize: 6.5,
    color: "#4B5563",
  },
  headerTaxColon: {
    fontSize: 6.5,
    color: "#4B5563",
    marginHorizontal: 2,
  },
  headerTaxVal: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111827",
  },

  // ─── Parties Box (Native Cards) ───
  partiesBox: {
    borderWidth: 1,
    borderColor: "#4C1D95",
    marginBottom: 8,
  },
  partiesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#4C1D95",
  },
  partiesHeaderCell: {
    width: "50%",
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
    paddingVertical: 3,
  },
  partyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 17,
    alignItems: "stretch",
  },
  partyCell: {
    width: "50%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 0.5,
    borderLeftColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  partyLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "right",
  },
  partyVal: {
    fontSize: 7,
    color: "#111827",
    textAlign: "left",
  },
  partyValBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
  },

  // ─── Title + Meta ───
  invoiceTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
    marginBottom: 4,
  },
  metaBox: {
    alignItems: "flex-end",
    marginBottom: 8,
    paddingRight: 4,
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingVertical: 1,
  },
  metaLabel: {
    fontSize: 7.5,
    color: "#374151",
    textAlign: "right",
  },
  metaColon: {
    fontSize: 7.5,
    color: "#374151",
    marginHorizontal: 3,
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
  },

  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#4C1D95",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#4C1D95",
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#4C1D95",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5.5,
    color: "#6D28D9",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 19,
    alignItems: "stretch",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tdMain: {
    fontSize: 7,
    color: "#111827",
    textAlign: "center",
  },
  tdMainBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  tdDescMain: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
    width: "100%",
  },
  tdSub: {
    fontSize: 5.5,
    color: "#6B7280",
    textAlign: "center",
  },
  discountNote: {
    fontSize: 5.5,
    color: "#6D28D9",
    textAlign: "right",
    marginTop: 1,
    width: "100%",
  },

  // ─── Totals + QR ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  totalsBox: {
    width: "60%",
    borderWidth: 1,
    borderColor: "#4C1D95",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
  },
  totalRowGrand: {
    backgroundColor: "#EDE9FE",
  },
  totalKey: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
  },
  grandKey: {
    fontSize: 7.5,
    color: "#4C1D95",
  },
  grandVal: {
    fontSize: 8,
    color: "#4C1D95",
  },
  qrCol: {
    width: "36%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 9,
    color: "#9CA3AF",
  },

  // ─── Tafqeet Box ───
  tafqeetBox: {
    borderWidth: 1,
    borderColor: "#6D28D9",
    backgroundColor: "#F5F3FF",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  bidiRowReverseCenter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
  },
  tafqeetLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
  },
  tafqeetColon: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    marginHorizontal: 3,
  },
  tafqeetText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#4C1D95",
  },

  // ─── Notes & Terms ───
  notesTermsBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FAFAFA",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  noteItem: {
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "right",
    marginBottom: 1,
  },
  noteText: {
    fontSize: 6.5,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.3,
  },

  // ─── Footer note ───
  footerNoteBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  footerNoteText: {
    fontSize: 6.5,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 1.3,
  },
});
