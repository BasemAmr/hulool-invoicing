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

export interface GenericDotmatrix22TemplateProps {
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

// ─── Safe conversion & formatting helpers ───

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
  if (num <= 0) return "صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

function companyAddressLineAr(company: CompanyRecord): string {
  const parts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet ?? "",
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(" - ");
}

function companyAddressLineEn(company: CompanyRecord): string {
  const parts = [
    company.addressCity ?? "",
    company.addressDistrict ?? "",
    company.addressStreet ?? "",
    company.addressBuildingNumber ? `Bldg ${company.addressBuildingNumber}` : "",
    company.addressPostalCode ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(", ");
}

function customerAddressLine(customer: CustomerRecord): string {
  const custAny = customer as unknown as {
    addressBuildingNumber?: string | null;
    addressDistrict?: string | null;
    addressAdditionalNumber?: string | null;
  };
  const parts = [
    customer.addressCity ?? "",
    custAny.addressDistrict ? `حي ${custAny.addressDistrict}` : "",
    customer.addressStreet ?? "",
    custAny.addressBuildingNumber ? `مبنى ${custAny.addressBuildingNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    custAny.addressAdditionalNumber ? `إضافي: ${custAny.addressAdditionalNumber}` : "",
  ].filter((p) => p.length > 0);
  return parts.join(" - ");
}

export function GenericDotmatrix22Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: GenericDotmatrix22TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values (all dynamic) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddressAr = companyAddressLineAr(company);
  const companyAddressEn = companyAddressLineEn(company);
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as unknown as { unifiedNumber?: string }).unifiedNumber || "";

  // ─── Meta values (all dynamic) ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const customerName = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerUnifiedOrCr =
    customer.unifiedNumber ||
    (customer as unknown as { crNumber?: string }).crNumber ||
    "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerAddress = customerAddressLine(customer);
  const customerVat = customer.vatNumber || "";
  const currencyText = invoice.currency || "SAR";

  // ─── Line Items & Calculations ───
  const items = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawLineAmount = qty * unitPrice;
    const lineDiscount = toNumber(
      item.discountAmount || (item as unknown as { discount?: string | number }).discount || 0
    );
    // Net line amount before VAT (never negative)
    const taxableSubtotal = Math.max(0, rawLineAmount - lineDiscount);

    const vatRateNum =
      item.vatRate !== undefined && item.vatRate !== null
        ? toNumber(item.vatRate)
        : (item as unknown as { taxRate?: string | number }).taxRate !== undefined &&
          (item as unknown as { taxRate?: string | number }).taxRate !== null
        ? toNumber((item as unknown as { taxRate?: string | number }).taxRate)
        : 15;

    const itemVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : (taxableSubtotal * vatRateNum) / 100;

    const itemTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + itemVat;

    return {
      key: item.position ?? idx,
      desc: item.description || "",
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
  const rawSubtotalCalc = rows.reduce((a, r) => a + r.rawLineAmount, 0);
  const discountVal =
    (invoice as unknown as { discountTotal?: string | number }).discountTotal !== undefined
      ? toNumber((invoice as unknown as { discountTotal?: string | number }).discountTotal)
      : rows.reduce((a, r) => a + r.lineDiscount, 0);

  const grossSubtotal =
    discountVal > 0
      ? rawSubtotalCalc > 0
        ? rawSubtotalCalc
        : toNumber(invoice.subtotal) + discountVal
      : toNumber(invoice.subtotal) > 0
      ? toNumber(invoice.subtotal)
      : rawSubtotalCalc;

  const taxableVal =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : Math.max(0, grossSubtotal - discountVal);

  const vatVal =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : rows.reduce((a, r) => a + r.itemVat, 0);

  const totalVal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableVal + vatVal;

  const firstVatRate = rows.find((r) => r.vatRateNum > 0)?.vatRateNum ?? 15;
  const vatRatePercentage = `${firstVatRate}%`;

  const tafqeetText = totalVal > 0 ? tafqeet(totalVal) : "صفر ريال سعودي لا غير";

  const invoiceNotes = toText(invoice.notes);
  const invoiceTerms = toText(invoice.terms);
  const footerNote = toText(company.footerText);

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;

  if (invoiceNotes) {
    extraContentHeight += 24 + Math.min(invoiceNotes.split("\n").length, 4) * 9;
  }
  if (invoiceTerms) {
    extraContentHeight += 24 + Math.min(invoiceTerms.split("\n").length, 4) * 9;
  }
  if (footerNote) extraContentHeight += 20;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize: [number, number] = [basePageWidth, dynamicHeight];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${docNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* ─── Background Watermark ─── */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Header: EN block (left) / logo (center) / AR block (right) ─── */}
        <View style={styles.headerRow}>
          {/* Left Column: English info */}
          <View style={styles.headerColLeft}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyAddressEn ? (
              <Text style={styles.headerLineEn}>{companyAddressEn}</Text>
            ) : null}
            {companyPhone ? (
              <View style={styles.bidiRowLeft}>
                <Text style={styles.headerLineEn}>Tel: {companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={styles.bidiRowLeft}>
                <Text style={styles.headerLineEn}>Email: {companyEmail}</Text>
              </View>
            ) : null}
            {companyVat ? (
              <View style={styles.bidiRowLeft}>
                <Text style={styles.headerLineEn}>VAT No: {companyVat}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.bidiRowLeft}>
                <Text style={styles.headerLineEn}>C.R.: {companyCr}</Text>
              </View>
            ) : null}
          </View>

          {/* Center Column: Logo (conditional, no dummy box if absent) */}
          <View style={styles.headerColCenter}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImg} />
            ) : null}
          </View>

          {/* Right Column: Arabic info (strict 3-element middle-colon BiDi pattern) */}
          <View style={styles.headerColRight}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            {companyAddressAr ? (
              <Text style={styles.headerLineAr}>{companyAddressAr}</Text>
            ) : null}
            {companyVat ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>الرقم الضريبي</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{companyVat}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>السجل التجاري</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{companyCr}</Text>
              </View>
            ) : null}
            {companyPhone ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>الهاتف</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={styles.bidiRowReverseRight}>
                <Text style={styles.headerTaxLbl}>البريد</Text>
                <Text style={styles.headerTaxColon}>:</Text>
                <Text style={styles.headerTaxVal}>{companyEmail}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Title band (solid NADA green) ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleMain}>فاتورة ضريبية / TAX INVOICE</Text>
          {docNo ? <Text style={styles.titleDoc}>{docNo}</Text> : null}
        </View>

        {/* ─── Meta grid (green-ruled dot-matrix boxes, bilingual labels) ─── */}
        <View style={styles.metaBox}>
          {/* Row 1: Invoice Number & Issue Date (Strictly DD/MM/YYYY) */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>رقم المستند / Document No.</Text>
              <Text style={styles.metaVal}>{docNo || "-"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>تاريخ الإصدار / Issue Date</Text>
              <Text style={styles.metaVal}>{issueDateStr || "-"}</Text>
            </View>
          </View>

          {/* Row 2: Customer Name & Unified Number / CR */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>اسم العميل / Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerName}
                {customerNameEn ? ` / ${customerNameEn}` : ""}
              </Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>الرقم الموحد / السجل التجاري / CR / Unified No.</Text>
              <Text style={styles.metaVal}>{customerUnifiedOrCr || "-"}</Text>
            </View>
          </View>

          {/* Row 3: Customer VAT & Currency */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>الرقم الضريبي للعميل / Customer VAT</Text>
              <Text style={styles.metaVal}>{customerVat || "-"}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>العملة / Currency</Text>
              <Text style={styles.metaVal}>{currencyText}</Text>
            </View>
          </View>

          {/* Row 4: Customer Address */}
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>عنوان العميل / Customer Address</Text>
              <Text style={styles.metaVal}>{customerAddress || "-"}</Text>
            </View>
          </View>

          {/* Row 5: Customer Phone & Email */}
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>بيانات التواصل للعميل / Contact Details</Text>
              <Text style={styles.metaVal}>
                {[
                  customerPhone ? `هاتف: ${customerPhone}` : "",
                  customerEmail ? `بريد: ${customerEmail}` : "",
                ]
                  .filter(Boolean)
                  .join("  |  ") || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Items table (green-ruled dot-matrix feel, 7 standard columns) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thAr}>اسم الصنف والبيان</Text>
              <Text style={styles.thEn}>Item Description</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>VAT %</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>المبلغ الخاضع</Text>
              <Text style={styles.thEn}>Taxable</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المبلغ شامل الضريبة</Text>
              <Text style={styles.thEn}>Total Incl. VAT</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderLeftWidth: 0 }]}>
                <Text style={styles.tdMain}>لا توجد أصناف / No items</Text>
              </View>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                {/* Description & Line Discount breakdown if present */}
                <View style={[styles.tdCell, { width: "30%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDesc}>{row.desc || "-"}</Text>
                  {row.lineDiscount > 0 ? (
                    <Text style={styles.discountBadge}>
                      قبل الخصم: {formatExactAmount(row.rawLineAmount)} | الخصم: {formatExactAmount(row.lineDiscount)} | بعد الخصم: {formatExactAmount(row.taxableSubtotal)}
                    </Text>
                  ) : null}
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatQty(row.qty)}</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.unitPrice)}</Text>
                </View>

                {/* VAT Rate */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>%{row.vatRateNum}</Text>
                </View>

                {/* Taxable Subtotal */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.itemVat)}</Text>
                </View>

                {/* Total Incl. VAT */}
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(row.itemTotal)}</Text>
                </View>
              </View>
            ))
          )}

          {/* ─── Table Summary Row ─── */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <View style={[styles.tdCell, { width: "30%" }]}>
              <Text style={styles.tdBold}>المجموع / TOTAL</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>{formatQty(sumQty)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>-</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>-</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(taxableVal)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "11%" }]}>
              <Text style={styles.tdBold}>{formatExactAmount(vatVal)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.tdBold}>{formatExactAmount(totalVal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Bottom Section: Totals Box & ZATCA QR Code ─── */}
        <View style={styles.bottomSection}>
          {/* Totals Breakdown (Left side in LTR flex container) */}
          <View style={styles.totalsBox}>
            {/* Gross Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalKey}>الإجمالي قبل الخصم / Gross Subtotal</Text>
            </View>

            {/* Total Discount (conditional if > 0) */}
            {discountVal > 0 ? (
              <View style={styles.totalRow}>
                <Text style={[styles.totalVal, { color: "#14532D" }]}>
                  -{formatExactAmount(discountVal)}
                </Text>
                <Text style={styles.totalKey}>إجمالي الخصم / Total Discount</Text>
              </View>
            ) : null}

            {/* Taxable Amount */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(taxableVal)}</Text>
              <Text style={styles.totalKey}>المبلغ الخاضع للضريبة / Taxable Amount</Text>
            </View>

            {/* VAT Amount with Rate % */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(vatVal)}</Text>
              <Text style={styles.totalKey}>
                ضريبة القيمة المضافة / VAT ({vatRatePercentage})
              </Text>
            </View>

            {/* Grand Total */}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={[styles.totalVal, styles.grandTotalVal]}>
                {formatExactAmount(totalVal)} {currencyText}
              </Text>
              <Text style={[styles.totalKey, styles.grandTotalKey]}>
                المجموع شامل الضريبة / Total Incl. VAT
              </Text>
            </View>

            {/* Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>
                {formatExactAmount(totalVal)} {currencyText}
              </Text>
              <Text style={styles.totalKey}>المبلغ المدفوع / Paid Amount</Text>
            </View>

            {/* Balance Due (Strictly 0.00) */}
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.totalVal, { fontWeight: "bold" }]}>
                0.00 {currencyText}
              </Text>
              <Text style={styles.totalKey}>المتبقي / Balance Due</Text>
            </View>
          </View>

          {/* QR Code Container (ZATCA 2D QR only, no linear 1D barcodes) */}
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

        {/* ─── Tafqeet Box (Exact Spelled-Out Arabic Amount for totalVal) ─── */}
        {tafqeetText ? (
          <View style={styles.tafqeetBox}>
            <View style={styles.bidiRowReverseCenter}>
              <Text style={styles.tafqeetLabel}>المبلغ كتابة</Text>
              <Text style={styles.tafqeetColon}>:</Text>
              <Text style={styles.tafqeetVal}>{tafqeetText}</Text>
            </View>
          </View>
        ) : null}

        {/* ─── Notes & Terms Section ─── */}
        {invoiceNotes || invoiceTerms ? (
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

        {/* ─── Company Footer Text ─── */}
        {footerNote ? (
          <Text style={styles.footerNote}>{footerNote}</Text>
        ) : null}
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
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 150,
    left: 120,
    width: 350,
    height: 350,
    opacity: 0.06,
    objectFit: "contain",
  },
  // ─── Header: 3-column scan layout (EN / logo / AR), NADA green theme ───
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1E6B3A",
    backgroundColor: "#F2F8F3",
    paddingVertical: 6,
    paddingHorizontal: 8,
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
    minHeight: 56,
  },
  headerColRight: {
    width: "40%",
    alignItems: "flex-end",
  },
  logoImg: {
    width: 56,
    height: 56,
    objectFit: "contain",
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "left",
    marginBottom: 2,
  },
  headerLineAr: {
    fontSize: 7.5,
    color: "#3A5A44",
    textAlign: "right",
    marginBottom: 1,
  },
  headerLineEn: {
    fontSize: 7.5,
    color: "#3A5A44",
    textAlign: "left",
    marginBottom: 1,
  },
  bidiRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  bidiRowReverseRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 1,
  },
  headerTaxLbl: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E6B3A",
  },
  headerTaxColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E6B3A",
    marginHorizontal: 3,
  },
  headerTaxVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  // ─── Title band (solid NADA green) ───
  titleBand: {
    backgroundColor: "#1E6B3A",
    borderWidth: 1,
    borderColor: "#14532D",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  titleMain: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleDoc: {
    fontSize: 8,
    color: "#D9EBDE",
    textAlign: "center",
    marginTop: 2,
  },
  // ─── Meta grid (green-ruled dot-matrix boxes) ───
  metaBox: {
    borderWidth: 1,
    borderColor: "#1E6B3A",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9DBEA9",
    minHeight: 20,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#9DBEA9",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  metaCellWide: {
    width: "100%",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "right",
    marginBottom: 1,
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // ─── Items table (green-ruled, tinted header) ───
  table: {
    borderWidth: 1,
    borderColor: "#1E6B3A",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EAF4EC",
    borderBottomWidth: 1,
    borderBottomColor: "#1E6B3A",
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#1E6B3A",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#14532D",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#3A6B4A",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#B9D2C0",
    minHeight: 20,
    alignItems: "stretch",
  },
  totalsRow: {
    backgroundColor: "#EAF4EC",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#1E6B3A",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#B9D2C0",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tdMain: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  tdDesc: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  discountBadge: {
    fontSize: 6,
    color: "#1E6B3A",
    backgroundColor: "#EDF7EE",
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginTop: 2,
    borderRadius: 2,
    textAlign: "right",
    width: "100%",
  },
  tdBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#14532D",
    textAlign: "center",
  },
  // ─── Bottom Section: Totals & QR Code ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  totalsBox: {
    width: "65%",
    borderWidth: 1,
    borderColor: "#1E6B3A",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9DBEA9",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  totalKey: {
    fontSize: 7.5,
    color: "#14532D",
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  grandTotalRow: {
    backgroundColor: "#EAF4EC",
    borderBottomWidth: 1,
    borderBottomColor: "#1E6B3A",
    borderTopWidth: 1,
    borderTopColor: "#1E6B3A",
  },
  grandTotalKey: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#14532D",
  },
  grandTotalVal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#14532D",
  },
  qrCol: {
    width: "32%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: "#9DBEA9",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 7,
    color: "#9DBEA9",
  },
  // ─── Tafqeet Box ───
  tafqeetBox: {
    borderWidth: 1,
    borderColor: "#1E6B3A",
    backgroundColor: "#F2F8F3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  bidiRowReverseCenter: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
  },
  tafqeetLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E6B3A",
  },
  tafqeetColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E6B3A",
    marginHorizontal: 3,
  },
  tafqeetVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#14532D",
  },
  // ─── Notes & Terms Section ───
  notesTermsBox: {
    borderWidth: 1,
    borderColor: "#9DBEA9",
    padding: 6,
    marginBottom: 8,
    backgroundColor: "#FCFDFC",
  },
  noteItem: {
    marginBottom: 4,
  },
  noteTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "right",
    marginBottom: 1,
  },
  noteText: {
    fontSize: 7,
    color: "#3A5A44",
    textAlign: "right",
    lineHeight: 1.3,
  },
  // ─── Footer ───
  footerNote: {
    fontSize: 7,
    color: "#3A5A44",
    textAlign: "center",
    marginTop: 4,
  },
});
