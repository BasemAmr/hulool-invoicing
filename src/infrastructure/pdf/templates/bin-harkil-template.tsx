import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface BinHarkilTemplateProps {
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

// ─── Official Saudi Riyal Currency Emblem (Vector SVG) ────────────────────────

function SaudiRiyalSymbol({
  size = 7.5,
  color = "#000000",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 24 26"
      style={{ marginRight: 3 }}
    >
      {/* Left vertical stem */}
      <Path d="M8.5 2V20.5L5.5 22.5V3.5L8.5 2Z" fill={color} />
      {/* Right vertical stem */}
      <Path d="M14.5 1V19.5L11.5 21.5V2.5L14.5 1Z" fill={color} />
      {/* Upper diagonal cross-bar */}
      <Path d="M2 12.2L21.5 8.2L22 10.7L2.5 14.7L2 12.2Z" fill={color} />
      {/* Lower diagonal cross-bar */}
      <Path d="M2 16.8L21.5 12.8L22 15.3L2.5 19.3L2 16.8Z" fill={color} />
      {/* Bottom-right tail */}
      <Path d="M15.5 21.2L22 19.8L22.4 22.2L15.9 23.6L15.5 21.2Z" fill={color} />
    </Svg>
  );
}

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

// Exact representation: never pad, round or truncate (e.g. 23.4646916641601264
// must print with its full tail). Only the integer part gets thousands commas.
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

function formatQty(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

// Issue date only, DD/MM/YYYY — no time component (guideline).
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

// ─── Arabic Tafqeet: spell out the final total due (guideline) ────────────────
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = [
  "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
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
    else if (millions <= 10) out += convertGroup(millions) + " ملايين";
    else out += convertGroup(millions) + " مليون";
  }
  if (thousands > 0) {
    if (out) out += " و ";
    if (thousands === 1) out += "ألف";
    else if (thousands === 2) out += "ألفان";
    else if (thousands <= 10) out += convertGroup(thousands) + " آلاف";
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
  if (halalas > 0) text += " و " + numberToArabicWords(halalas) + " هللة";
  return text + " لا غير";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BinHarkilTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: BinHarkilTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Dynamic Company / Seller fields
  const companyNameEn = company.nameEn || "";
  const companyNameAr = company.nameAr || "";
  const companyCr = company.crNumber || "";
  const companyVat = company.vatNumber || "";
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";
  const companyCity = company.addressCity || "";
  const companyDistrict = company.addressDistrict || "";
  const companyStreet = company.addressStreet || "";
  const companyBuilding = company.addressBuildingNumber || "";
  const companyAddNo = company.addressAdditionalNumber || "";
  const companyPostal = company.addressPostalCode || "";

  // Dynamic Customer fields
  const customerNameEn = customer.nameEn || "";
  const customerNameAr = customer.nameAr || "";
  const customerCr =
    customer.unifiedNumber ||
    (customer as { crNumber?: string }).crNumber ||
    "";
  const customerVat = customer.vatNumber || "";
  const customerCity = customer.addressCity || "";
  const customerDistrict = customer.addressDistrict || "";
  const customerStreet = customer.addressStreet || "";
  const customerBuilding = customer.addressBuildingNumber || "";
  const customerPostal = customer.addressPostalCode || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";

  // Dynamic Invoice Metadata (Requested empty fields strictly left empty)
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);
  const currencyCode = invoice.currency || "SAR";
  const invoiceTypeLabel =
    invoice.invoiceType === "simplified"
      ? "Simplified / مبسطة"
      : "Standard / ضريبية";
  const footerText = company.footerText || "";

  // Line Items & Financial Calculations
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal =
      item.lineSubtotal !== undefined &&
      item.lineSubtotal !== null &&
      item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Math.max(0, gross - lineDiscount);

    const vatPct =
      item.vatRate !== undefined && item.vatRate !== null
        ? normalizeVatRatePercent(toNumber(item.vatRate))
        : 15;

    const lineVat =
      item.lineVat !== undefined &&
      item.lineVat !== null &&
      item.lineVat !== ""
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatPct / 100);

    const lineTotal =
      item.lineTotal !== undefined &&
      item.lineTotal !== null &&
      item.lineTotal !== ""
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;

    const discountPct = gross > 0 ? (lineDiscount / gross) * 100 : 0;
    const subDescription =
      (item as { productDescription?: string }).productDescription || "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      subDesc: subDescription,
      unitPrice,
      qty,
      discountPct,
      taxableSubtotal,
      vatPct,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null &&
    invoice.subtotal !== undefined &&
    invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null &&
    invoice.vatAmount !== undefined &&
    invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);
  const netTotalExclVat = Math.max(0, taxableAmount - invoiceDiscount);
  const grossTotalBeforeDiscount =
    computedGross > 0 ? computedGross : taxableAmount;

  const grandTotal =
    invoice.total !== null &&
    invoice.total !== undefined &&
    invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, netTotalExclVat + totalVat);

  // Prefer the raw string values for display so long decimal tails are never
  // round-tripped through a JS float (guideline: exact raw representation).
  const grossTotalDisplay =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? invoice.subtotal
      : grossTotalBeforeDiscount;
  const netTotalDisplay =
    invoice.subtotal !== null &&
    invoice.subtotal !== undefined &&
    invoice.subtotal !== "" &&
    invoiceDiscount === 0
      ? invoice.subtotal
      : netTotalExclVat;
  const totalVatDisplay = invoice.vatAmount ?? totalVat;
  const grandTotalDisplay = invoice.total ?? grandTotal;

  const tafqeetText = grandTotal > 0 ? tafqeet(invoice.total ?? grandTotal) : "";

  // Dynamic single-page height guarantee
  const extraItemsCount = Math.max(0, rows.length - 6);
  let extraHeight = extraItemsCount * 28;
  if (invoice.notes) extraHeight += 22;
  if (invoice.terms) extraHeight += 22;
  if (tafqeetText) extraHeight += 16;
  if (footerText) extraHeight += 14;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoiceNumber}`}
      author={companyNameAr || companyNameEn || "Hulool Invoicing"}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO & COMPANY INFO (LEFT) + SELLER TABLE (RIGHT) ─── */}
        <View style={styles.topSectionRow}>
          {/* Left Column: Logo, Company Names, Reg Info & TAX INVOICE Title */}
          <View style={styles.topLeftCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}

            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}

            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}

            <View style={styles.companyContactList}>
              {companyCr ? (
                <Text style={styles.companyContactText}>CR: {companyCr}</Text>
              ) : null}
              {companyVat ? (
                <Text style={styles.companyContactText}>VAT: {companyVat}</Text>
              ) : null}
              {companyPhone ? (
                <Text style={styles.companyContactText}>Phone: {companyPhone}</Text>
              ) : null}
              {companyEmail ? (
                <Text style={styles.companyContactText}>Email: {companyEmail}</Text>
              ) : null}
              {companyWebsite ? (
                <Text style={styles.companyContactText}>{companyWebsite}</Text>
              ) : null}
            </View>

            <View style={styles.mainTitleRow}>
              <Text style={styles.mainTitleEn}>TAX INVOICE</Text>
              <Text style={styles.mainTitleSep}> - </Text>
              <Text style={styles.mainTitleAr}>فاتورة ضريبية</Text>
            </View>
          </View>

          {/* Right Column: Seller / البائع Table */}
          <View style={styles.sellerTable}>
            {/* Header Row */}
            <View style={styles.sellerHeaderRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.sellerHeaderEn}>Seller</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}></Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.sellerHeaderAr}>البائع</Text>
              </View>
            </View>

            {/* Row 1: VAT No. */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>VAT No.</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyVat}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرقم الضريبي</Text>
              </View>
            </View>

            {/* Row 2: CR No. */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>CR No.</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyCr}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم السجل التجاري</Text>
              </View>
            </View>

            {/* Row 3: Country */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>Country</Text>
              </View>
              <View style={styles.sellerColVal}>
                <View style={styles.bilingualInlineCenter}>
                  <Text style={styles.cellCenterText}>المملكة العربية السعودية</Text>
                  <Text style={styles.cellCenterText}> </Text>
                  <Text style={styles.cellCenterText}>Saudi Arabia</Text>
                </View>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الدولة</Text>
              </View>
            </View>

            {/* Row 4: City */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>City</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyCity}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>المدينة</Text>
              </View>
            </View>

            {/* Row 5: District */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>District</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyDistrict}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الحي</Text>
              </View>
            </View>

            {/* Row 6: Street Name */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>Street Name</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyStreet}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>اسم الشارع</Text>
              </View>
            </View>

            {/* Row 7: Building No. */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>Building No.</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyBuilding}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم المبنى</Text>
              </View>
            </View>

            {/* Row 8: Additional No. */}
            <View style={styles.gridRow}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>Additional No.</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyAddNo}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرقم الإضافي</Text>
              </View>
            </View>

            {/* Row 9: Postal Code */}
            <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.sellerColEn}>
                <Text style={styles.cellBoldLeft}>Postal Code</Text>
              </View>
              <View style={styles.sellerColVal}>
                <Text style={styles.cellCenterText}>{companyPostal}</Text>
              </View>
              <View style={[styles.sellerColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرمز البريدي</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 2. MIDDLE SECTION: CUSTOMER INFORMATION (LEFT) & SELLING INFORMATION (RIGHT) ─── */}
        <View style={styles.middleTablesRow}>
          {/* Left Table: Customer Information / بيانات العميل */}
          <View style={styles.customerTable}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>Customer Information</Text>
              <Text style={styles.sectionHeaderText}> / </Text>
              <Text style={styles.sectionHeaderText}>بيانات العميل</Text>
            </View>

            {/* Row 1: Name (Split English & Arabic rows in center column) */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>Name</Text>
              </View>
              <View style={styles.custColValSplit}>
                <View style={styles.custNameTopSubCell}>
                  <Text style={styles.cellCenterText}>
                    {customerNameEn || customerNameAr}
                  </Text>
                </View>
                <View style={styles.custNameBottomSubCell}>
                  <Text style={styles.cellCenterText}>
                    {customerNameAr || customerNameEn}
                  </Text>
                </View>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>اسم العميل</Text>
              </View>
            </View>

            {/* Row 2: CR No. */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>CR No.</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerCr}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم السجل</Text>
              </View>
            </View>

            {/* Row 3: VAT No. */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>VAT No.</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerVat}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرقم الضريبي</Text>
              </View>
            </View>

            {/* Row 4: City */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>City</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerCity}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>المدينة</Text>
              </View>
            </View>

            {/* Row 6: District */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>District</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerDistrict}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الحي</Text>
              </View>
            </View>

            {/* Row 7: Street Name */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>Street Name</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerStreet}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>اسم الشارع</Text>
              </View>
            </View>

            {/* Row 8: Building No. */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>Building No.</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerBuilding}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم المبنى</Text>
              </View>
            </View>

            {/* Row 9: Postal Code */}
            <View style={styles.gridRow}>
              <View style={styles.custColEn}>
                <Text style={styles.cellBoldLeft}>Postal Code</Text>
              </View>
              <View style={styles.custColVal}>
                <Text style={styles.cellCenterText}>{customerPostal}</Text>
              </View>
              <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>الرمز البريدي</Text>
              </View>
            </View>

            {customerPhone ? (
              <View style={styles.gridRow}>
                <View style={styles.custColEn}>
                  <Text style={styles.cellBoldLeft}>Phone</Text>
                </View>
                <View style={styles.custColVal}>
                  <Text style={styles.cellCenterText}>{customerPhone}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>الهاتف</Text>
                </View>
              </View>
            ) : null}

            {customerEmail ? (
              <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
                <View style={styles.custColEn}>
                  <Text style={styles.cellBoldLeft}>Email</Text>
                </View>
                <View style={styles.custColVal}>
                  <Text style={styles.cellCenterText}>{customerEmail}</Text>
                </View>
                <View style={[styles.custColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>الإيميل</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Right Table: Selling Information / معلومات البيع */}
          <View style={styles.sellingTable}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>Selling Information</Text>
              <Text style={styles.sectionHeaderText}> / </Text>
              <Text style={styles.sectionHeaderText}>معلومات البيع</Text>
            </View>

            {/* Row 1: Invoice # */}
            <View style={styles.sellingRow}>
              <View style={styles.sellColEn}>
                <Text style={styles.cellBoldLeft}>Invoice #</Text>
              </View>
              <View style={styles.sellColVal}>
                <Text style={styles.cellCenterText}>{invoiceNumber}</Text>
              </View>
              <View style={[styles.sellColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>رقم الفاتورة</Text>
              </View>
            </View>

            {/* Row 2: Invoice Type */}
            <View style={styles.sellingRow}>
              <View style={styles.sellColEn}>
                <Text style={styles.cellBoldLeft}>Invoice Type</Text>
              </View>
              <View style={styles.sellColVal}>
                <Text style={styles.cellCenterText}>{invoiceTypeLabel}</Text>
              </View>
              <View style={[styles.sellColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>نوع الفاتورة</Text>
              </View>
            </View>

            {/* Row 3: Invoice Date */}
            <View style={styles.sellingRow}>
              <View style={styles.sellColEn}>
                <Text style={styles.cellBoldLeft}>Invoice Date</Text>
              </View>
              <View style={styles.sellColVal}>
                <Text style={styles.cellCenterText}>{issueDateStr}</Text>
              </View>
              <View style={[styles.sellColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>تاريخ الفاتورة</Text>
              </View>
            </View>

            {/* Row 6: Currency (last row fills remaining height) */}
            <View style={[styles.sellingRow, { borderBottomWidth: 0, flex: 1 }]}>
              <View style={styles.sellColEn}>
                <Text style={styles.cellBoldLeft}>Currency</Text>
              </View>
              <View style={styles.sellColVal}>
                <Text style={styles.cellCenterText}>{currencyCode}</Text>
              </View>
              <View style={[styles.sellColAr, { borderRightWidth: 0 }]}>
                <Text style={styles.cellBoldRight}>العملة</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. LINE ITEMS TABLE (8 COLUMNS, LEFT-TO-RIGHT) ─── */}
        <View style={styles.itemsTable}>
          {/* Header Row */}
          <View style={styles.itemsHeaderRow}>
            {/* 1. L.N / م */}
            <View style={[styles.thCell, styles.colLn, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>L.N</Text>
              <Text style={styles.thTextLeft}>م</Text>
            </View>

            {/* 2. Item Description / وصف الصنف */}
            <View style={[styles.thCell, styles.colDesc, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Item Description</Text>
              <Text style={styles.thTextLeft}>وصف الصنف</Text>
            </View>

            {/* 3. Price / السعر */}
            <View style={[styles.thCell, styles.colPrice, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Price</Text>
              <Text style={styles.thTextLeft}>السعر</Text>
            </View>

            {/* 4. QTY / الكمية */}
            <View style={[styles.thCell, styles.colQty, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>QTY</Text>
              <Text style={styles.thTextLeft}>الكمية</Text>
            </View>

            {/* 5. Dis % / الخصم % */}
            <View style={[styles.thCell, styles.colDis, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Dis %</Text>
              <Text style={styles.thTextLeft}>الخصم</Text>
              <Text style={styles.thTextLeft}>%</Text>
            </View>

            {/* 6. Taxable Amount / المبلغ الخاضع للضريبة */}
            <View style={[styles.thCell, styles.colTaxable, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Taxable</Text>
              <Text style={styles.thTextLeft}>Amount</Text>
              <Text style={styles.thTextLeft}>المبلغ الخاضع</Text>
              <Text style={styles.thTextLeft}>للضريبة</Text>
            </View>

            {/* 7. Tax % / الضريبة % */}
            <View style={[styles.thCell, styles.colTaxPct, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Tax %</Text>
              <Text style={styles.thTextLeft}>الضريبة</Text>
              <Text style={styles.thTextLeft}>%</Text>
            </View>

            {/* 8. Tax Amount / قيمة الضريبة */}
            <View style={[styles.thCell, styles.colTaxAmt, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>Tax</Text>
              <Text style={styles.thTextLeft}>Amount</Text>
              <Text style={styles.thTextLeft}>قيمة الضريبة</Text>
            </View>

            {/* 9. Total incl. VAT / الإجمالي */}
            <View
              style={[
                styles.thCell,
                styles.colTotal,
                { alignItems: "flex-start", borderRightWidth: 0 },
              ]}
            >
              <Text style={styles.thTextLeft}>Total</Text>
              <Text style={styles.thTextLeft}>الإجمالي</Text>
            </View>
          </View>

          {/* Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.itemsDataRow} wrap={false}>
              {/* 1. L.N */}
              <View style={[styles.tdCell, styles.colLn, { alignItems: "center" }]}>
                <Text style={styles.tdCenterText}>{row.index}</Text>
              </View>

              {/* 2. Item Description */}
              <View style={[styles.tdCell, styles.colDesc, { alignItems: "flex-start" }]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
                {row.subDesc ? (
                  <Text style={styles.tdSubDescText}>{row.subDesc}</Text>
                ) : null}
              </View>

              {/* 3. Price */}
              <View style={[styles.tdCell, styles.colPrice, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>
                  {formatExactAmount(row.unitPrice)}
                </Text>
              </View>

              {/* 4. QTY */}
              <View style={[styles.tdCell, styles.colQty, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>{formatQty(row.qty)}</Text>
              </View>

              {/* 5. Dis % */}
              <View style={[styles.tdCell, styles.colDis, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>
                  {row.discountPct.toFixed(2)}%
                </Text>
              </View>

              {/* 6. Taxable Amount */}
              <View style={[styles.tdCell, styles.colTaxable, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>
                  {formatExactAmount(row.taxableSubtotal)}
                </Text>
              </View>

              {/* 7. Tax % */}
              <View style={[styles.tdCell, styles.colTaxPct, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>{row.vatPct.toFixed(2)}%</Text>
              </View>

              {/* 8. Tax Amount */}
              <View style={[styles.tdCell, styles.colTaxAmt, { alignItems: "flex-end" }]}>
                <Text style={styles.tdRightText}>
                  {formatExactAmount(row.lineVat)}
                </Text>
              </View>

              {/* 9. Total incl. VAT */}
              <View
                style={[
                  styles.tdCell,
                  styles.colTotal,
                  { alignItems: "flex-end", borderRightWidth: 0 },
                ]}
              >
                <Text style={styles.tdRightText}>
                  {formatExactAmount(row.lineTotal)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 4. BOTTOM SECTION: QR CODE BOX (LEFT) + TOTALS TABLE (RIGHT) ─── */}
        <View style={styles.bottomSectionRow} wrap={false}>
          {/* Left: QR Code Box */}
          <View style={styles.qrBoxCard}>
            <View style={styles.qrBoxHeader}>
              <Text style={styles.sectionHeaderText}>QR Code</Text>
              <Text style={styles.sectionHeaderText}> / </Text>
              <Text style={styles.sectionHeaderText}>رمز الاستجابة السريعة</Text>
            </View>
            <View style={styles.qrBoxBody}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrDraftBox}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Totals Data / البيان Table + Authorized Signature */}
          <View style={styles.totalsAndSignCol}>
            <View style={styles.totalsTable}>
              {/* Header Row */}
              <View style={styles.totalsHeaderRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.totHeaderCenter}>Data</Text>
                </View>
                <View style={styles.totColVal}>
                  <Text style={styles.cellCenterText}></Text>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>البيان</Text>
                </View>
              </View>

              {/* Row 1: Total */}
              <View style={styles.gridRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Total</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>
                      {formatExactAmount(grossTotalDisplay)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>الإجمالي</Text>
                </View>
              </View>

              {/* Optional Invoice Discount Row */}
              {invoiceDiscount > 0 ? (
                <View style={styles.gridRow}>
                  <View style={styles.totColEn}>
                    <Text style={styles.cellBoldLeft}>Discount</Text>
                  </View>
                  <View style={styles.totColVal}>
                    <View style={styles.sarAmountRow}>
                      <SaudiRiyalSymbol size={7.5} color="#000000" />
                      <Text style={styles.totAmountBold}>
                        -{formatExactAmount(invoiceDiscount)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                    <Text style={styles.cellBoldRight}>الخصم</Text>
                  </View>
                </View>
              ) : null}

              {/* Row 2: Net Total (Excluding VAT) */}
              <View style={styles.gridRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Net Total</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>
                      {formatExactAmount(netTotalDisplay)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>
                    الإجمالي غير شامل الضريبة
                  </Text>
                </View>
              </View>

              {/* Row 3: Total VAT */}
              <View style={styles.gridRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Total VAT</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>
                      {formatExactAmount(totalVatDisplay)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>إجمالي الضريبة</Text>
                </View>
              </View>

              {/* Row 4: Grand Total (Shaded Gray Row) */}
              <View style={styles.grandTotalRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Grand Total</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>
                      {formatExactAmount(grandTotalDisplay)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>الإجمالي النهائي</Text>
                </View>
              </View>

              {/* Invoice Paid (this app issues fully-paid at issue time) */}
              <View style={styles.gridRow}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Invoice Paid</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>
                      {formatExactAmount(grandTotalDisplay)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>المدفوع</Text>
                </View>
              </View>

              {/* Balance Due */}
              <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totColEn}>
                  <Text style={styles.cellBoldLeft}>Balance Due</Text>
                </View>
                <View style={styles.totColVal}>
                  <View style={styles.sarAmountRow}>
                    <SaudiRiyalSymbol size={7.5} color="#000000" />
                    <Text style={styles.totAmountBold}>0.00</Text>
                  </View>
                </View>
                <View style={[styles.totColAr, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellBoldRight}>الرصيد المتبقي</Text>
                </View>
              </View>
            </View>

            {/* Authorized Signature Line (no signature image per guideline) */}
            <View style={styles.authSignBlock}>
              <View style={styles.authSignLine} />
              <Text style={styles.authSignText}>Authorized Signature</Text>
            </View>
          </View>
        </View>

        {/* Spelled-out total due (Tafqeet) */}
        {tafqeetText ? (
          <View style={styles.tafqeetRow} wrap={false}>
            <Text style={styles.tafqeetText}>{tafqeetText}</Text>
          </View>
        ) : null}

        {/* Optional Notes & Terms */}
        {(invoice.notes || invoice.terms) ? (
          <View style={styles.notesSection} wrap={false}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>ملاحظات</Text>
                <Text style={styles.noteLineText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>الشروط والأحكام</Text>
                <Text style={styles.noteLineText}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Company custom footer text */}
        {footerText ? (
          <Text style={styles.footerText}>{footerText}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

// ─── STYLES (PIXEL-PERFECT TAJAWAL TYPOGRAPHY) ────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 24,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // 1. Top Header Row
  topSectionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  topLeftCol: {
    width: "43%",
    flexDirection: "column",
    alignItems: "flex-start",
    paddingTop: 4,
  },
  logoImage: {
    width: 142,
    height: 48,
    objectFit: "contain",
    marginBottom: 6,
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
    textAlign: "left",
    marginBottom: 1.5,
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#000000",
    textAlign: "left",
    marginBottom: 3,
  },
  companyContactList: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  companyContactText: {
    fontFamily: "Tajawal",
    fontSize: 6.8,
    color: "#374151",
    textAlign: "left",
    marginBottom: 1.2,
  },
  mainTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  mainTitleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 12.5,
    color: "#000000",
  },
  mainTitleSep: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 12.5,
    color: "#000000",
  },
  mainTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 12.5,
    color: "#000000",
  },

  // Seller Table (Top Right)
  sellerTable: {
    width: "54%",
    borderWidth: 0.9,
    borderColor: "#111827",
  },
  sellerHeaderRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#E2E5E9",
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 17,
    alignItems: "center",
  },
  sellerColEn: {
    width: "26.5%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sellerColVal: {
    width: "47.5%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sellerColAr: {
    width: "26%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sellerHeaderEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  sellerHeaderAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  bilingualInlineCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. Middle Side-by-Side Tables
  middleTablesRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 8,
  },
  customerTable: {
    width: "64%",
    borderWidth: 0.9,
    borderColor: "#111827",
  },
  sellingTable: {
    width: "34.5%",
    borderWidth: 0.9,
    borderColor: "#111827",
    flexDirection: "column",
  },
  sectionHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E5E9",
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 16.5,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  gridRow: {
    width: "100%",
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    minHeight: 16.5,
    alignItems: "center",
  },
  custColEn: {
    width: "33.5%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  custColVal: {
    width: "34%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  custColValSplit: {
    width: "34%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    flexDirection: "column",
  },
  custNameTopSubCell: {
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    minHeight: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  custNameBottomSubCell: {
    minHeight: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  custColAr: {
    width: "32.5%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  sellingRow: {
    width: "100%",
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    minHeight: 18,
    alignItems: "center",
  },
  sellColEn: {
    width: "35%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sellColVal: {
    width: "31%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  sellColAr: {
    width: "34%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  cellBoldLeft: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "left",
  },
  cellBoldRight: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  cellCenterText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },

  // 3. Line Items Table (10 Columns)
  itemsTable: {
    width: "100%",
    borderWidth: 0.9,
    borderColor: "#111827",
    marginBottom: 8,
  },
  itemsHeaderRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#E2E5E9",
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 38,
    alignItems: "center",
  },
  itemsDataRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    minHeight: 24,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tdCell: {
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  thTextLeft: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "left",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },
  tdRightText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "left",
  },
  tdSubDescText: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#1F2937",
    textAlign: "left",
    marginTop: 1,
  },

  // Column Widths (Sum = 100%)
  colLn: { width: "4.5%" },
  colDesc: { width: "33%" },
  colPrice: { width: "10%" },
  colQty: { width: "8%" },
  colDis: { width: "8%" },
  colTaxable: { width: "11%" },
  colTaxPct: { width: "7%" },
  colTaxAmt: { width: "9%" },
  colTotal: { width: "9.5%" },

  // 4. Bottom Section: QR Box & Totals Table
  bottomSectionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  qrBoxCard: {
    width: "31%",
    borderWidth: 0.9,
    borderColor: "#111827",
  },
  qrBoxHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E5E9",
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 16.5,
    paddingHorizontal: 4,
  },
  qrBoxBody: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  qrImage: {
    width: 112,
    height: 112,
  },
  qrDraftBox: {
    width: 112,
    height: 112,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#9CA3AF",
  },

  totalsAndSignCol: {
    width: "66.5%",
    flexDirection: "column",
  },
  totalsTable: {
    width: "100%",
    borderWidth: 0.9,
    borderColor: "#111827",
  },
  totalsHeaderRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#E2E5E9",
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 16.5,
    alignItems: "center",
  },
  grandTotalRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#E2E5E9",
    minHeight: 18,
    alignItems: "center",
  },
  totColEn: {
    width: "34%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  totColVal: {
    width: "33%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 6,
  },
  totColAr: {
    width: "33%",
    borderRightWidth: 0.8,
    borderColor: "#111827",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  totHeaderCenter: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  sarAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  totAmountBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
  },

  // Authorized Signature Block
  authSignBlock: {
    alignSelf: "flex-end",
    width: "31%",
    marginTop: 18,
    alignItems: "center",
  },
  authSignLine: {
    width: "100%",
    height: 0.9,
    backgroundColor: "#111827",
    marginBottom: 3,
  },
  authSignText: {
    fontFamily: "Tajawal",
    fontSize: 7.2,
    color: "#111827",
    textAlign: "center",
  },

  // Tafqeet (spelled-out total)
  tafqeetRow: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  tafqeetText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#111827",
    textAlign: "right",
  },

  // Optional Notes
  notesSection: {
    marginTop: 10,
    paddingTop: 4,
    alignItems: "flex-end",
  },
  noteBlock: {
    alignItems: "flex-end",
    marginBottom: 3,
  },
  noteLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#111827",
    textAlign: "right",
  },
  noteLineText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#374151",
    textAlign: "right",
    marginBottom: 2,
  },
  footerText: {
    marginTop: 8,
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#374151",
    textAlign: "center",
  },
});
