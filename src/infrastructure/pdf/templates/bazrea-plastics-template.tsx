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

export interface BazreaPlasticsTemplateProps {
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

// ─── Arabic Tafqeet (Spelled-out currency amounts) ───
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
  return "فقط " + text + " لا غير";
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
 * Strict date formatting: DD/MM/YYYY only — NO hours, time, supply date, or due date.
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

export function BazreaPlasticsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: BazreaPlasticsTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);

  // Optional extensions (ERP legacy fields)
  const invExt = (invoice as any) || {};
  const refCodeText = invExt.refCode ?? invExt.refNo ?? "";
  const moreInfoText = invExt.moreInfo ?? invExt.notes2 ?? "";

  // Company details
  const companyNameAr = company.nameAr || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyUnified = (company as any).unifiedNumber || "";
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";

  // Standard Company Address: (Additional No. - Postal Code - Street - Building No. - District - City - Country)
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressFull = companyAddressParts.join(" - ");

  // Customer details
  const customerName = customer.nameAr || customer.nameEn || "عميل نقدي";
  const customerTax = customer.vatNumber || (customer as any).taxCode || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerAddress = [
    customer.addressCity,
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet,
    (customer as any).addressDistrict || (customer as any).district,
    "المملكة العربية السعودية",
  ].filter(Boolean).join(" - ");

  // Line items & calculations
  const items = invoice.items ?? [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
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

  // EXACT Tafqeet for invoice.total
  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";
  const currencyText = invoice.currency || "SAR";

  // Single-Page Dynamic Height Guarantee
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const itemRowHeight = 24;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 26 + Math.min(invoice.notes.split("\n").length, 5) * 12;
  if (invoice.terms)
    extraContentHeight += 26 + Math.min(invoice.terms.split("\n").length, 5) * 12;
  if (company.footerText) extraContentHeight += 24;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const dynamicPageSize = [pageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? <Image src={backgroundDataUrl} style={styles.backgroundImage} /> : null}

        {/* ─── Top strip: Page number left / Company Name & Full Address right ─── */}
        <View style={styles.topStrip}>
          <Text
            style={styles.topStripLeft}
            render={({ pageNumber, totalPages }) => `الصفحة ${pageNumber} من ${totalPages}`}
          />
          <View style={styles.topStripRight}>
            {companyNameAr ? <Text style={styles.topBranch}>{companyNameAr}</Text> : null}
            {companyAddressFull ? (
              <Text style={styles.topBranchSmall}>{companyAddressFull}</Text>
            ) : null}
            {companyPhone ? <Text style={styles.topBranchSmall}>هاتف: {companyPhone}</Text> : null}
          </View>
        </View>

        {/* ─── Header box: contacts left / title & logo center / vat-crn right (strict BiDi) ─── */}
        <View style={styles.headerBox}>
          {/* Left: English contacts */}
          <View style={styles.headerLeft}>
            {companyPhone ? (
              <View style={styles.headerEnRow}>
                <Text style={styles.hLabelEn}>Tel No.</Text>
                <Text style={styles.hColonEn}>:</Text>
                <Text style={styles.hValEn}>{companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={styles.headerEnRow}>
                <Text style={styles.hLabelEn}>Email</Text>
                <Text style={styles.hColonEn}>:</Text>
                <Text style={styles.hValEn}>{companyEmail}</Text>
              </View>
            ) : null}
            {companyVat ? (
              <View style={styles.headerEnRow}>
                <Text style={styles.hLabelEn}>Tax No. (TIN)</Text>
                <Text style={styles.hColonEn}>:</Text>
                <Text style={styles.hValEn}>{companyVat}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.headerEnRow}>
                <Text style={styles.hLabelEn}>CRN</Text>
                <Text style={styles.hColonEn}>:</Text>
                <Text style={styles.hValEn}>{companyCr}</Text>
              </View>
            ) : null}
          </View>

          {/* Center: Logo & Bilingual Tax Invoice Title */}
          <View style={styles.headerCenter}>
            {logoSource ? <Image src={logoSource} style={styles.logoImg} /> : null}
            <Text style={styles.titleAr}>فاتورة ضريبية</Text>
            <Text style={styles.titleEn}>Tax Invoice</Text>
          </View>

          {/* Right: Arabic Tax & CR Info with strict BiDi row-reverse middle colon */}
          <View style={styles.headerRight}>
            {companyVat ? (
              <View style={styles.headerBiDiRow}>
                <Text style={styles.hLabelAr}>الرقم الضريبي</Text>
                <Text style={styles.hColon}>:</Text>
                <Text style={styles.hVal}>{companyVat}</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.headerBiDiRow}>
                <Text style={styles.hLabelAr}>رقم السجل التجاري</Text>
                <Text style={styles.hColon}>:</Text>
                <Text style={styles.hVal}>{companyCr}</Text>
              </View>
            ) : null}
            {companyUnified ? (
              <View style={styles.headerBiDiRow}>
                <Text style={styles.hLabelAr}>الرقم الموحد</Text>
                <Text style={styles.hColon}>:</Text>
                <Text style={styles.hVal}>{companyUnified}</Text>
              </View>
            ) : null}
            <View style={styles.headerBiDiRow}>
              <Text style={styles.hLabelAr}>الصفحة</Text>
              <Text style={styles.hColon}>:</Text>
              <Text
                style={styles.hVal}
                render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
              />
            </View>
          </View>
        </View>

        {/* ─── Meta rows: number + date always; ref/more if present (strict BiDi middle-colon) ─── */}
        <View style={styles.metaBox}>
          {/* Invoice Number */}
          <View style={styles.metaRow}>
            <View style={styles.metaLabelRight}>
              <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
              <Text style={styles.metaLabelSlash}>/</Text>
              <Text style={styles.metaLabelEn}>Invoice No.</Text>
            </View>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValRed}>{invoiceNum}</Text>
          </View>

          {/* Issue Date (DD/MM/YYYY only) */}
          <View style={styles.metaRow}>
            <View style={styles.metaLabelRight}>
              <Text style={styles.metaLabelAr}>تاريخ الفاتورة</Text>
              <Text style={styles.metaLabelSlash}>/</Text>
              <Text style={styles.metaLabelEn}>Invoice Date</Text>
            </View>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
          </View>

          {/* Ref Code (optional ERP) */}
          {refCodeText ? (
            <View style={styles.metaRow}>
              <View style={styles.metaLabelRight}>
                <Text style={styles.metaLabelAr}>رقم المرجع</Text>
                <Text style={styles.metaLabelSlash}>/</Text>
                <Text style={styles.metaLabelEn}>Ref. Code</Text>
              </View>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaVal}>{refCodeText}</Text>
            </View>
          ) : null}

          {/* More Info (optional ERP) */}
          {moreInfoText ? (
            <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <View style={styles.metaLabelRight}>
                <Text style={styles.metaLabelAr}>معلومات إضافية</Text>
                <Text style={styles.metaLabelSlash}>/</Text>
                <Text style={styles.metaLabelEn}>More Info.</Text>
              </View>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaVal}>{moreInfoText}</Text>
            </View>
          ) : null}
        </View>

        {/* ─── Customer details strip + ZATCA QR Code ─── */}
        <View style={styles.customerBox}>
          {/* Customer Details Column (72% width) */}
          <View style={styles.customerCol}>
            {/* Customer Name */}
            <View style={styles.custRow}>
              <View style={styles.custLabelRight}>
                <Text style={styles.custLabelAr}>العميل</Text>
                <Text style={styles.custLabelSlash}>/</Text>
                <Text style={styles.custLabelEn}>Customer</Text>
              </View>
              <Text style={styles.custColon}>:</Text>
              <Text style={styles.custVal}>{customerName}</Text>
            </View>

            {/* Customer VAT */}
            <View style={styles.custRow}>
              <View style={styles.custLabelRight}>
                <Text style={styles.custLabelAr}>الرقم الضريبي للعميل</Text>
                <Text style={styles.custLabelSlash}>/</Text>
                <Text style={styles.custLabelEn}>Tax No.</Text>
              </View>
              <Text style={styles.custColon}>:</Text>
              <Text style={styles.custVal}>{customerTax || "-"}</Text>
            </View>

            {/* Customer Unified Number / CR */}
            <View style={styles.custRow}>
              <View style={styles.custLabelRight}>
                <Text style={styles.custLabelAr}>الرقم الموحد / س.ت</Text>
                <Text style={styles.custLabelSlash}>/</Text>
                <Text style={styles.custLabelEn}>Unified / CR</Text>
              </View>
              <Text style={styles.custColon}>:</Text>
              <Text style={styles.custVal}>{customerCrOrUnified || "-"}</Text>
            </View>

            {/* Customer Address */}
            <View style={styles.custRow}>
              <View style={styles.custLabelRight}>
                <Text style={styles.custLabelAr}>عنوان العميل</Text>
                <Text style={styles.custLabelSlash}>/</Text>
                <Text style={styles.custLabelEn}>Address</Text>
              </View>
              <Text style={styles.custColon}>:</Text>
              <Text style={styles.custVal}>{customerAddress || "-"}</Text>
            </View>

            {/* Customer Phone */}
            <View style={[styles.custRow, !customerEmail ? { borderBottomWidth: 0 } : {}]}>
              <View style={styles.custLabelRight}>
                <Text style={styles.custLabelAr}>هاتف العميل</Text>
                <Text style={styles.custLabelSlash}>/</Text>
                <Text style={styles.custLabelEn}>Phone</Text>
              </View>
              <Text style={styles.custColon}>:</Text>
              <Text style={styles.custVal}>{customerPhone || "-"}</Text>
            </View>

            {/* Customer Email (if present) */}
            {customerEmail ? (
              <View style={[styles.custRow, { borderBottomWidth: 0 }]}>
                <View style={styles.custLabelRight}>
                  <Text style={styles.custLabelAr}>البريد الإلكتروني</Text>
                  <Text style={styles.custLabelSlash}>/</Text>
                  <Text style={styles.custLabelEn}>Email</Text>
                </View>
                <Text style={styles.custColon}>:</Text>
                <Text style={styles.custVal}>{customerEmail}</Text>
              </View>
            ) : null}
          </View>

          {/* QR Code Column (28% width) - ONLY ZATCA QR Code */}
          <View style={styles.customerQrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR Code</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Items table (6 columns: Description, Qty, Unit Price, Tax Rate, Tax Amount, Subtotal Inc. VAT) ─── */}
        <View style={styles.table}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "36%" }]}>
              <Text style={styles.thAr}>البيان / الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>Tax Rate</Text>
            </View>
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thAr}>مبلغ الضريبة</Text>
              <Text style={styles.thEn}>Tax Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "16%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>الإجمالي شامل الضريبة</Text>
              <Text style={styles.thEn}>Total Inc. VAT</Text>
            </View>
          </View>

          {/* Table Body Rows */}
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

            const isLast = idx === items.length - 1;

            return (
              <View
                key={item.position ?? idx}
                style={[styles.tableRow, isLast ? { borderBottomWidth: 0 } : {}]}
              >
                {/* 1. Description */}
                <View style={[styles.tdCell, { width: "36%", alignItems: "flex-end", paddingRight: 6 }]}>
                  <Text style={styles.tdDesc}>{item.description || ""}</Text>
                  {lineDisc > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(lineDisc)} (قبل: {formatExactAmount(rawLineSubtotal)} | بعد: {formatExactAmount(discountedSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 2. Quantity */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMainBold}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* 4. Tax Rate */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>{vatPctStr}</Text>
                </View>

                {/* 5. Tax Amount */}
                <View style={[styles.tdCell, { width: "14%" }]}>
                  <Text style={styles.tdMain}>{formatExactAmount(lineVat)}</Text>
                </View>

                {/* 6. Subtotal Inc. VAT */}
                <View style={[styles.tdCell, { width: "16%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMainBold}>{formatExactAmount(lineTotalIncVat)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Totals: Quantity Box left / Totals Breakdown right ─── */}
        <View style={styles.bottomSection}>
          <View style={styles.qtyBox}>
            <Text style={styles.qtyLabelAr}>إجمالي الكمية</Text>
            <Text style={styles.qtyLabelEn}>Total Quantity</Text>
            <Text style={styles.qtyVal}>{formatExactAmount(totalQty)}</Text>
          </View>
          <View style={styles.totalsBox}>
            {/* 1. Gross Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalKey}>Total Excluding VAT / الإجمالي غير شامل قيمة الضريبة المضافة</Text>
            </View>

            {/* 2. Discount (if present) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>{formatExactAmount(discountVal)}</Text>
                <Text style={styles.totalKey}>Discount / إجمالي الخصم</Text>
              </View>
            ) : null}

            {/* 3. Taxable Amount (if discount present) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>{formatExactAmount(taxableVal)}</Text>
                <Text style={styles.totalKey}>Total Taxable Amount / الإجمالي الخاضع للضريبة</Text>
              </View>
            ) : null}

            {/* 4. VAT Amount */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(vatVal)}</Text>
              <Text style={styles.totalKey}>VAT ({vatRatePercentage}) / ضريبة القيمة المضافة</Text>
            </View>

            {/* 5. Total Inc VAT */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalVal, styles.grandVal]}>{formatExactAmount(totalVal)}</Text>
              <Text style={[styles.totalKey, styles.grandKey]}>Total Amt With Tax / الإجمالي شامل الضريبة</Text>
            </View>

            {/* 6. Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.totalKey}>Invoice Paid / المبلغ المدفوع</Text>
            </View>

            {/* 7. Balance Due */}
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalVal}>0.00</Text>
              <Text style={styles.totalKey}>Balance Due / الرصيد المستحق</Text>
            </View>
          </View>
        </View>

        {/* ─── Grand SAR + Spelled-out Tafqeet ─── */}
        <View style={styles.grandStrip}>
          <Text style={styles.grandSar}>
            {currencyText} {formatExactAmount(totalVal)}
          </Text>
          <Text style={styles.grandWords}>{tafqeetText}</Text>
        </View>

        {/* ─── Notes & Terms (if present) ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesBox}>
            {invoice.notes ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>الملاحظات / Notes :</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteItem}>
                <Text style={styles.noteTitle}>الشروط والأحكام / Terms & Conditions :</Text>
                <Text style={styles.notesText}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── Company Footer Text (if present) ─── */}
        {company.footerText ? (
          <View style={styles.footerBox}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}

        {/* ─── Seal / Sign (Preserving Classic Identity, no signature image) ─── */}
        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <Text style={styles.signLabel}>الختم / The Seal</Text>
            <View style={styles.signLine} />
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLabel}>التوقيع / Sign</Text>
            <View style={styles.signLine} />
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
  topStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#111827",
    borderBottomWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  topStripLeft: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
  },
  topStripRight: {
    alignItems: "flex-end",
  },
  topBranch: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  topBranchSmall: {
    fontSize: 6.8,
    color: "#374151",
    textAlign: "right",
    marginTop: 1,
  },
  headerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "32%",
    alignItems: "flex-start",
  },
  headerEnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  hLabelEn: {
    fontSize: 6.8,
    color: "#374151",
    fontWeight: "bold",
  },
  hColonEn: {
    fontSize: 6.8,
    color: "#374151",
    fontWeight: "bold",
    marginHorizontal: 2,
  },
  hValEn: {
    fontSize: 6.8,
    color: "#111827",
  },
  headerCenter: {
    width: "34%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 64,
    height: 42,
    objectFit: "contain",
    marginBottom: 2,
  },
  titleAr: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  titleEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  headerRight: {
    width: "32%",
    alignItems: "flex-end",
  },
  headerBiDiRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  hLabelAr: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111827",
  },
  hColon: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111827",
    marginHorizontal: 2,
  },
  hVal: {
    fontSize: 6.8,
    color: "#111827",
  },
  metaBox: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  metaLabelRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    width: "35%",
  },
  metaLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  metaLabelSlash: {
    fontSize: 7,
    color: "#6B7280",
    marginHorizontal: 3,
  },
  metaLabelEn: {
    fontSize: 6.8,
    color: "#4B5563",
  },
  metaColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    marginHorizontal: 4,
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    flex: 1,
  },
  metaValRed: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "right",
    flex: 1,
  },
  customerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  customerCol: {
    width: "72%",
  },
  custRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 17,
    paddingHorizontal: 6,
  },
  custLabelRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    width: "38%",
  },
  custLabelAr: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#374151",
  },
  custLabelSlash: {
    fontSize: 6,
    color: "#6B7280",
    marginHorizontal: 2,
  },
  custLabelEn: {
    fontSize: 6.2,
    color: "#4B5563",
  },
  custColon: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#374151",
    marginHorizontal: 3,
  },
  custVal: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    flex: 1,
  },
  customerQrCol: {
    width: "28%",
    borderLeftWidth: 1,
    borderLeftColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  qrImage: {
    width: 92,
    height: 92,
  },
  qrPlaceholder: {
    width: 92,
    height: 92,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  table: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6,
    color: "#374151",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 20,
    alignItems: "stretch",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdDesc: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
    width: "100%",
  },
  discountBadge: {
    marginTop: 2,
    paddingVertical: 1,
    paddingHorizontal: 3,
    backgroundColor: "#FEF2F2",
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#FECACA",
  },
  discountBadgeText: {
    fontSize: 5.8,
    color: "#B91C1C",
    textAlign: "right",
  },
  tdMain: {
    fontSize: 7,
    color: "#111827",
    textAlign: "center",
  },
  tdMainBold: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 6,
  },
  qtyBox: {
    width: "24%",
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
  },
  qtyLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  qtyLabelEn: {
    fontSize: 6.2,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 4,
  },
  qtyVal: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  totalsBox: {
    width: "74%",
    borderWidth: 1,
    borderColor: "#111827",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  totalKey: {
    fontSize: 6.8,
    color: "#111827",
    textAlign: "right",
    width: "70%",
  },
  totalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
    width: "30%",
  },
  grandKey: {
    fontWeight: "bold",
    color: "#B91C1C",
  },
  grandVal: {
    color: "#B91C1C",
    fontSize: 8,
  },
  grandStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#F9FAFB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  grandSar: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  grandWords: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },
  notesBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    padding: 5,
    marginBottom: 6,
  },
  noteItem: {
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "right",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 6.8,
    color: "#111827",
    textAlign: "right",
    lineHeight: 1.25,
  },
  footerBox: {
    paddingVertical: 2,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 6.8,
    color: "#4B5563",
    textAlign: "center",
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 14,
  },
  signBlock: {
    width: 160,
    alignItems: "center",
  },
  signLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },
  signLine: {
    width: 140,
    borderTopWidth: 0.75,
    borderTopColor: "#111827",
  },
});
