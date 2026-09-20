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

export interface Template4JuffaliFoodProps {
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

// ─── Number to Arabic Words Tafqeet Helpers ───
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
  const remainder = num % 1000;
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
  text += " لا غير";
  return text;
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Exact numeric amount formatter: preserves complete decimal representation
 * without rounding or truncating raw decimals, and formats the integer part with commas.
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

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

/**
 * Strict DD/MM/YYYY date formatter for Issue Date only.
 */
function formatDateFormatted(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // fallback
  }
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  const text = value.trim();
  if (UUID_RE.test(text)) return true;
  if (
    text.length >= 20 &&
    (text.match(/-/g) || []).length >= 2 &&
    /^[0-9a-f-]+$/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function Template4JuffaliFood({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template4JuffaliFoodProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  // Invoice identifiers & dates (DD/MM/YYYY only)
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateFormatted = formatDateFormatted(invoice.issueDate);

  // Seller Details
  const companyNameEn = company.nameEn || "";
  const companyNameAr = company.nameAr || "";
  const companyCr = company.crNumber || "";
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyPoBox = (company as any).poBox || (company as any).addressPostalCode || "";
  const companyCity = company.addressCity || "";
  const companyCountry = (company as any).country || "المملكة العربية السعودية";
  const companyBuildingNo = company.addressBuildingNumber || "";
  const companyAdditionalNo = (company as any).addressAdditionalNumber || (company as any).addressAdditionalNo || "";
  const companyDistrict = company.addressDistrict || "";
  const companyStreet = company.addressStreet || "";
  const companyVatNo = company.vatNumber || "";
  const logoSource = logoDataUrl || company.logoUrl;

  // Buyer Details
  const customerNameEn = (customer as any).nameEn || customer.nameAr || "";
  const customerNameAr = customer.nameAr || (customer as any).nameEn || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = (customer as any).addressDistrict || "";
  const customerBuilding = (customer as any).addressBuildingNumber || "";
  const customerCity = customer.addressCity || "";
  const customerPostalCode = customer.addressPostalCode || "";
  const customerCountry = (customer as any).country || "المملكة العربية السعودية";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerPo = (invoice as any).customerPo || (invoice as any).poNumber || "";
  const customerVatNo = customer.vatNumber || "";
  const customerUnifiedNo = customer.unifiedNumber || (customer as any).crNumber || "";

  // Secondary bar values
  const customerIdRaw = (customer as any).customerId || (customer as any).code || (customer as any).id || "";
  const customerIdDisplay = isUuidLike(String(customerIdRaw)) ? "" : String(customerIdRaw);

  // Line items & calculations
  const items = invoice.items || [];
  const rows = items.map((item, idx) => {
    const extItem = item as InvoiceItemDto & {
      taxRate?: number | null;
      taxAmount?: number | null;
      discount?: number | string | null;
      subtotal?: number | string | null;
      itemRef?: string | null;
      packSize?: string | null;
      packaging?: string | null;
      uom?: string | null;
    };
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount ?? extItem.discount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);
    const vatRate = item.vatRate !== undefined && item.vatRate !== null
      ? toNumber(item.vatRate)
      : (extItem.taxRate !== undefined && extItem.taxRate !== null ? toNumber(extItem.taxRate) : 15);
    const lineVat = item.lineVat !== undefined && item.lineVat !== null
      ? toNumber(item.lineVat)
      : (extItem.taxAmount !== undefined && extItem.taxAmount !== null ? toNumber(extItem.taxAmount) : (taxableSubtotal * vatRate) / 100);
    const lineTotal = item.lineTotal !== undefined && item.lineTotal !== null
      ? toNumber(item.lineTotal)
      : (taxableSubtotal + lineVat);
    const packSize = extItem.packSize || extItem.packaging || extItem.uom || "";

    return {
      key: item.position ?? idx,
      si: String(idx + 1),
      desc: item.description || "",
      packSize,
      qty,
      unitPrice,
      gross,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const sumGross = rows.reduce((sum, r) => sum + r.gross, 0);
  const sumDiscounts = rows.reduce((sum, r) => sum + r.lineDiscount, 0);
  const sumTaxable = rows.reduce((sum, r) => sum + r.taxableSubtotal, 0);
  const sumVat = rows.reduce((sum, r) => sum + r.lineVat, 0);

  // Financial totals
  const grossTotal = sumGross;
  const discountTotal = sumDiscounts;
  const taxableAmount = invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
    ? toNumber(invoice.subtotal)
    : sumTaxable;
  const totalVat = invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
    ? toNumber(invoice.vatAmount)
    : sumVat;
  const grandTotal = invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
    ? toNumber(invoice.total)
    : (taxableAmount + totalVat);

  const amountPaid = grandTotal;
  const balanceDue = 0;
  const tafqeetArabic = tafqeet(grandTotal);

  // Effective primary VAT rate for summary row
  const primaryVatRate = rows.length > 0 && rows[0] ? rows[0].vatRate : 15;

  // Single-Page Height Guarantee calculation
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 28;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 12;

  if (invoice.notes) {
    extraContentHeight += 22 + Math.min(invoice.notes.split("\n").length, 5) * 10;
  }
  if (invoice.terms) {
    extraContentHeight += 22 + Math.min(invoice.terms.split("\n").length, 5) * 10;
  }
  if (company.footerText) {
    extraContentHeight += 18;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr || companyNameEn || "Hulool Invoicing"}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered Watermark with opacity 0.04 */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (Left English Box | Center Logo Column | Right Arabic Box) ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column: English Details */}
          <View style={styles.headerLeftCol}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            <View style={styles.infoLine}>
              {companyCr ? <Text style={styles.infoText}>C.R. No. {companyCr}</Text> : null}
              {companyPhone ? <Text style={styles.infoText}> - Tel: {companyPhone}</Text> : null}
              {companyEmail ? <Text style={styles.infoText}> - Email: {companyEmail}</Text> : null}
            </View>
            <View style={styles.infoLine}>
              {companyCity ? <Text style={styles.infoText}>{companyCity} </Text> : null}
              {companyDistrict ? <Text style={styles.infoText}>- Dist. {companyDistrict} </Text> : null}
              {companyStreet ? <Text style={styles.infoText}>- St. {companyStreet} </Text> : null}
              {companyPoBox ? <Text style={styles.infoText}>- P.O. Box: {companyPoBox} </Text> : null}
              {companyCountry ? <Text style={styles.infoText}>- {companyCountry}</Text> : null}
            </View>
            <View style={styles.infoLine}>
              {companyBuildingNo ? <Text style={styles.infoText}>Bldg No. {companyBuildingNo} </Text> : null}
              {companyAdditionalNo ? <Text style={styles.infoText}>- Add. No. {companyAdditionalNo}</Text> : null}
            </View>
            {companyVatNo ? (
              <Text style={styles.companyVatEn}>VAT Reg. No: {companyVatNo}</Text>
            ) : null}
          </View>

          {/* Center Column: Logo (conditionally rendered, clean empty if absent) */}
          <View style={styles.headerCenterCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.centerLogoImage} />
            ) : null}
          </View>

          {/* Right Column: Arabic Company Details */}
          <View style={styles.headerRightCol}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            <View style={styles.arabicInfoRow}>
              {companyCr ? (
                <View style={styles.bidiInlinePair}>
                  <Text style={styles.companySubAr}>ست</Text>
                  <Text style={styles.bidiColon}>:</Text>
                  <Text style={styles.companySubArVal}>{companyCr}</Text>
                </View>
              ) : null}
              {companyPhone ? (
                <View style={styles.bidiInlinePair}>
                  <Text style={styles.companySubAr}>هاتف</Text>
                  <Text style={styles.bidiColon}>:</Text>
                  <Text style={styles.companySubArVal}>{companyPhone}</Text>
                </View>
              ) : null}
              {companyEmail ? (
                <View style={styles.bidiInlinePair}>
                  <Text style={styles.companySubAr}>بريد</Text>
                  <Text style={styles.bidiColon}>:</Text>
                  <Text style={styles.companySubArVal}>{companyEmail}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.arabicInfoRow}>
              {companyCity ? <Text style={styles.companySubAr}>{companyCity} </Text> : null}
              {companyDistrict ? <Text style={styles.companySubAr}>- حي {companyDistrict} </Text> : null}
              {companyStreet ? <Text style={styles.companySubAr}>- شارع {companyStreet} </Text> : null}
              {companyPoBox ? <Text style={styles.companySubAr}>- ص.ب: {companyPoBox} </Text> : null}
              {companyCountry ? <Text style={styles.companySubAr}>- {companyCountry}</Text> : null}
            </View>
            <View style={styles.arabicInfoRow}>
              {companyBuildingNo ? <Text style={styles.companySubAr}>مبنى {companyBuildingNo} </Text> : null}
              {companyAdditionalNo ? <Text style={styles.companySubAr}>- الرقم الإضافي {companyAdditionalNo}</Text> : null}
            </View>
            {companyVatNo ? (
              <View style={styles.arabicVatRow}>
                <Text style={styles.companyVatAr}>الرقم الضريبي</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.companyVatArVal}>{companyVatNo}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. TITLE STRIP (Tax Invoice No. | Tax Invoice فاتورة ضريبية | رقم الفاتورة الضريبية) ─── */}
        <View style={styles.titleStrip}>
          <View style={styles.titleLeftCol}>
            <Text style={styles.titleLabelEn}>Tax Invoice No.</Text>
          </View>
          <View style={styles.titleCenterCol}>
            <View style={styles.titleCenterHeading}>
              <Text style={styles.titleCenterText}>فاتورة ضريبية</Text>
              <Text style={styles.titleCenterSep}>/</Text>
              <Text style={styles.titleCenterText}>Tax Invoice</Text>
            </View>
            <View style={styles.invoiceNumberBox}>
              <Text style={styles.invoiceNumberText}>{invoiceNum}</Text>
            </View>
          </View>
          <View style={styles.titleRightCol}>
            <Text style={styles.titleLabelAr}>رقم الفاتورة الضريبية</Text>
          </View>
        </View>

        {/* ─── 3. CUSTOMER / BUYER INFO GRID ─── */}
        <View style={styles.customerGrid}>
          {/* Row 1: Sold To / اسم العميل */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Sold To</Text></View>
            <View style={styles.cellValueEn}><Text style={styles.valueText}>{customerNameEn}</Text></View>
            <View style={styles.cellValueAr}><Text style={styles.valueTextAr}>{customerNameAr}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>السادة / العميل</Text></View>
          </View>

          {/* Row 2: National Address / العنوان الوطني */}
          <View style={[styles.gridRow, { minHeight: 28 }]}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Address</Text></View>
            <View style={styles.cellValueEn}>
              <Text style={styles.valueText}>
                {[customerBuilding ? `Bldg ${customerBuilding}` : "", customerStreet, customerDistrict, customerPostalCode].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <View style={styles.cellValueAr}>
              <Text style={styles.valueTextAr}>
                {[customerBuilding ? `مبنى ${customerBuilding}` : "", customerStreet, customerDistrict ? `حي ${customerDistrict}` : "", customerPostalCode].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>العنوان الوطني</Text></View>
          </View>

          {/* Row 3: City & Country / المدينة والدولة */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>City / Country</Text></View>
            <View style={styles.cellCityHalf}><Text style={styles.valueText}>{customerCity || "-"}</Text></View>
            <View style={styles.cellCountryHalf}><Text style={styles.valueText}>{customerCountry || "-"}</Text></View>
            <View style={styles.cellCityHalfAr}><Text style={styles.valueTextAr}>{customerCountry || "-"}</Text></View>
            <View style={styles.cellCountryHalfAr}><Text style={styles.valueTextAr}>{customerCity || "-"}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>المدينة / الدولة</Text></View>
          </View>

          {/* Row 4: Phone & Email / الهاتف والبريد */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Contact Info</Text></View>
            <View style={styles.cellCityHalf}><Text style={styles.valueText}>{customerPhone ? `Tel: ${customerPhone}` : "-"}</Text></View>
            <View style={styles.cellCountryHalf}><Text style={styles.valueText}>{customerEmail || "-"}</Text></View>
            <View style={styles.cellCombinedAr}>
              <Text style={styles.valueTextAr}>
                {[customerPhone ? `هاتف: ${customerPhone}` : "", customerEmail].filter(Boolean).join(" | ")}
              </Text>
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>بيانات الاتصال</Text></View>
          </View>

          {/* Row 5: Unified Number / CR (الرقم الموحد / السجل التجاري) */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>CR / Unified No.</Text></View>
            <View style={styles.cellValueWideEn}>
              <Text style={styles.valueText}>{customerUnifiedNo || "-"}</Text>
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>السجل / الموحد</Text></View>
          </View>

          {/* Row 6: VAT Registration Number */}
          <View style={[styles.gridRow, { borderBottomWidth: 1 }]}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>VAT Number</Text></View>
            <View style={styles.cellValueWideVat}>
              <Text style={styles.vatValueText}>
                {customerVatNo || "-"}
              </Text>
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>الرقم الضريبي</Text></View>
          </View>
        </View>

        {/* ─── 4. SECONDARY METADATA BAR (Customer ID | Customer Unified/CR | Issue City | Invoice Type | PO Ref | Company CR | Issue Date) ─── */}
        <View style={styles.metaBar}>
          {/* Customer ID */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>رقم العميل</Text>
            <Text style={styles.metaCellLabelEn}>Customer ID</Text>
            <Text style={styles.metaCellValue}>{customerIdDisplay || "-"}</Text>
          </View>

          {/* Customer CR / Unified */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>السجل / الموحد</Text>
            <Text style={styles.metaCellLabelEn}>CR / Unified</Text>
            <Text style={styles.metaCellValue}>{customerUnifiedNo || "-"}</Text>
          </View>

          {/* Issue City */}
          <View style={styles.metaCellNarrow}>
            <Text style={styles.metaCellLabelAr}>مدينة الإصدار</Text>
            <Text style={styles.metaCellLabelEn}>Issue City</Text>
            <Text style={styles.metaCellValue}>{companyCity || customerCity || "-"}</Text>
          </View>

          {/* Invoice Type */}
          <View style={styles.metaCellNarrow}>
            <Text style={styles.metaCellLabelAr}>نوع الفاتورة</Text>
            <Text style={styles.metaCellLabelEn}>Invoice Type</Text>
            <Text style={styles.metaCellValue}>ضريبية / Tax</Text>
          </View>

          {/* Customer PO */}
          <View style={styles.metaCellWide}>
            <Text style={styles.metaCellLabelAr}>رقم أمر الشراء</Text>
            <Text style={styles.metaCellLabelEn}>PO Reference</Text>
            <Text style={styles.metaCellValue}>{customerPo || "-"}</Text>
          </View>

          {/* Seller CR */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>سجل المنشأة</Text>
            <Text style={styles.metaCellLabelEn}>Seller CR</Text>
            <Text style={styles.metaCellValue}>{companyCr || "-"}</Text>
          </View>

          {/* Invoice Date */}
          <View style={styles.metaCellDate}>
            <Text style={styles.metaCellLabelAr}>تاريخ الفاتورة</Text>
            <Text style={styles.metaCellLabelEn}>Issue Date</Text>
            <Text style={styles.metaCellValue}>{issueDateFormatted}</Text>
          </View>
        </View>

        {/* ─── 5. MAIN PRODUCTS TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.colSn, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>م</Text>
              <Text style={styles.headerTextEn}>#</Text>
            </View>
            <View style={[styles.colDesc, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>البيـــــــــان</Text>
              <Text style={styles.headerTextEn}>Description</Text>
            </View>
            <View style={[styles.colQty, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الكمية</Text>
              <Text style={styles.headerTextEn}>Qty</Text>
            </View>
            <View style={[styles.colUnitPrice, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>سعر الوحدة</Text>
              <Text style={styles.headerTextEn}>Unit Price</Text>
            </View>
            <View style={[styles.colGrossAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الإجمالي</Text>
              <Text style={styles.headerTextEn}>Gross Amt</Text>
            </View>
            <View style={[styles.colDiscAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الخصم</Text>
              <Text style={styles.headerTextEn}>Disc Amt</Text>
            </View>
            <View style={[styles.colNetAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الخاضع للضريبة</Text>
              <Text style={styles.headerTextEn}>Taxable Amt</Text>
            </View>
            <View style={[styles.colVatPercent, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>% الضريبة</Text>
              <Text style={styles.headerTextEn}>VAT%</Text>
            </View>
            <View style={[styles.colVatAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>مبلغ الضريبة</Text>
              <Text style={styles.headerTextEn}>VAT Amt</Text>
            </View>
            <View style={[styles.colLineTotal, styles.tableHeaderCell, { borderRightWidth: 0 }]}>
              <Text style={styles.headerTextAr}>شامل الضريبة</Text>
              <Text style={styles.headerTextEn}>Total Inc VAT</Text>
            </View>
          </View>

          {/* Body Rows */}
          {rows.map((row) => {
            return (
              <View key={row.key} style={styles.tableRow} wrap={false}>
                {/* Serial */}
                <View style={[styles.colSn, styles.tableCell]}>
                  <Text style={styles.cellCodeText}>{row.si}</Text>
                </View>

                {/* Description & Discount Breakdown */}
                <View style={[styles.colDesc, styles.tableCellDesc]}>
                  <Text style={styles.cellDescAr}>{row.desc}</Text>
                  {row.packSize ? (
                    <Text style={styles.cellPackSize}>{row.packSize}</Text>
                  ) : null}
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        قبل: {formatExactAmount(row.gross)} | خصم: {formatExactAmount(row.lineDiscount)} | خاضع: {formatExactAmount(row.taxableSubtotal)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quantity */}
                <View style={[styles.colQty, styles.tableCellQty]}>
                  <Text style={styles.checkMark}>✓</Text>
                  <Text style={styles.cellQtyText}>{formatQty(row.qty)}</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.colUnitPrice, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatExactAmount(row.unitPrice)}</Text>
                </View>

                {/* Gross Amount */}
                <View style={[styles.colGrossAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatExactAmount(row.gross)}</Text>
                </View>

                {/* Discount */}
                <View style={[styles.colDiscAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{row.lineDiscount > 0 ? formatExactAmount(row.lineDiscount) : "-"}</Text>
                </View>

                {/* Taxable Subtotal */}
                <View style={[styles.colNetAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>

                {/* VAT Rate % */}
                <View style={[styles.colVatPercent, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>%{formatQty(row.vatRate)}</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.colVatAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatExactAmount(row.lineVat)}</Text>
                </View>

                {/* Line Total Inc VAT */}
                <View style={[styles.colLineTotal, styles.tableCellNum, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellNumText}>{formatExactAmount(row.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 6. TOTALS BREAKDOWN SUMMARY (Corporate Food Distribution Grid) ─── */}
        <View style={styles.summaryContainer}>
          {/* Gross Total Excl. VAT */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Gross Total (Excl. VAT)</Text>
            <Text style={styles.summaryLabelAr}>المجموع قبل الخصم</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(grossTotal)}</Text>
          </View>

          {/* Total Discounts */}
          {discountTotal > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelEn}>Total Discounts</Text>
              <Text style={styles.summaryLabelAr}>مجموع الخصومات</Text>
              <Text style={styles.summaryVal}>-{formatExactAmount(discountTotal)}</Text>
            </View>
          ) : null}

          {/* Taxable Subtotal */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Taxable Amount (Net Subtotal)</Text>
            <Text style={styles.summaryLabelAr}>الإجمالي الخاضع للضريبة</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(taxableAmount)}</Text>
          </View>

          {/* VAT Amount */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Total VAT Amount ({primaryVatRate}%)</Text>
            <Text style={styles.summaryLabelAr}>ضريبة القيمة المضافة ({primaryVatRate}%)</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(totalVat)}</Text>
          </View>

          {/* Grand Total Incl. VAT */}
          <View style={[styles.summaryRow, styles.summaryRowHighlight]}>
            <Text style={styles.summaryLabelEnBold}>Grand Total (Incl. VAT)</Text>
            <Text style={styles.summaryLabelArBold}>المجموع الكلي شامل الضريبة</Text>
            <Text style={styles.summaryValBold}>{formatExactAmount(grandTotal)}</Text>
          </View>

          {/* Amount Paid & Balance Due */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Invoice Paid</Text>
            <Text style={styles.summaryLabelAr}>المبلغ المدفوع</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(amountPaid)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>Balance Due</Text>
            <Text style={styles.summaryLabelAr}>المبلغ المتبقي</Text>
            <Text style={styles.summaryVal}>{formatExactAmount(balanceDue)}</Text>
          </View>
        </View>

        {/* ─── 7. AMOUNT IN WORDS & GRAND TOTAL BOX ─── */}
        <View style={styles.grandTotalBar}>
          <View style={styles.wordsCell}>
            <Text style={styles.wordsText}>{tafqeetArabic}</Text>
          </View>
          <View style={styles.grandTotalLabelCell}>
            <Text style={styles.grandTotalLabel}>المجموع الكلي بالريال</Text>
            <Text style={styles.grandTotalSubLabel}>الكمية الإجمالية: {formatQty(totalQty)}</Text>
          </View>
          <View style={styles.grandTotalValueCell}>
            <Text style={styles.grandTotalValue}>{formatExactAmount(grandTotal)}</Text>
          </View>
        </View>

        {/* ─── 8. ZATCA QR CODE SECTION ─── */}
        <View style={styles.qrSection}>
          {qrDataUrl ? (
            <Image src={qrDataUrl} style={styles.qrImage} />
          ) : (
            <View style={styles.qrPlaceholder} />
          )}
        </View>

        {/* ─── 9. EXTRAS: NOTES, TERMS & SYSTEM NOTICE ─── */}
        <View style={styles.footerNoteBox}>
          {/* Invoice Notes if present */}
          {invoice.notes ? (
            <View style={styles.extraSection}>
              <View style={styles.extraHeaderRow}>
                <Text style={styles.footerNoteHeader}>NOTES</Text>
                <Text style={styles.footerNoteHeaderAr}>ملاحظات</Text>
              </View>
              <Text style={styles.extraBodyText}>{invoice.notes}</Text>
            </View>
          ) : null}

          {/* Invoice Terms if present */}
          {invoice.terms ? (
            <View style={styles.extraSection}>
              <View style={styles.extraHeaderRow}>
                <Text style={styles.footerNoteHeader}>TERMS & CONDITIONS</Text>
                <Text style={styles.footerNoteHeaderAr}>الشروط والأحكام</Text>
              </View>
              <Text style={styles.extraBodyText}>{invoice.terms}</Text>
            </View>
          ) : null}

          {/* Company Footer Text if present */}
          {company.footerText ? (
            <View style={styles.extraSection}>
              <Text style={styles.footerCustomText}>{company.footerText}</Text>
            </View>
          ) : null}

          {/* System Computer Generated Notice */}
          <View style={styles.footerNoteRow}>
            <Text style={styles.footerNoteEn}>This is a computer generated invoice and does not require any signature.</Text>
            <Text style={styles.footerNoteAr}>هذه الفاتورة صادرة آلياً من نظام الحاسب الآلي ولا تتطلب توقيعاً.</Text>
          </View>
        </View>

        {/* Page Numbering */}
        <View style={styles.pageNumberWrap}>
          <Text
            style={styles.pageNumberText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 7,
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header ───
  headerContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    borderWidth: 0.75,
    borderColor: "#1A1A1A",
    marginBottom: 5,
    minHeight: 66,
  },
  headerLeftCol: {
    width: "43%",
    padding: 5,
    justifyContent: "center",
    borderRightWidth: 0.75,
    borderRightColor: "#1A1A1A",
  },
  companyNameEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    lineHeight: 1.15,
  },
  infoLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    lineHeight: 1.15,
  },
  infoText: {
    fontSize: 5.8,
    color: "#000000",
  },
  companyVatEn: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 1,
  },

  headerCenterCol: {
    width: "14%",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    borderRightWidth: 0.75,
    borderRightColor: "#1A1A1A",
  },
  centerLogoImage: {
    width: 46,
    height: 46,
    objectFit: "contain",
  },

  headerRightCol: {
    width: "43%",
    padding: 5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  companyNameAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    lineHeight: 1.15,
    marginBottom: 2,
  },
  arabicInfoRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "center",
    lineHeight: 1.15,
  },
  bidiInlinePair: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginLeft: 4,
  },
  bidiColon: {
    fontSize: 5.8,
    color: "#000000",
    marginHorizontal: 1.5,
  },
  companySubAr: {
    fontSize: 5.8,
    color: "#000000",
    textAlign: "right",
  },
  companySubArVal: {
    fontSize: 5.8,
    color: "#000000",
    textAlign: "right",
  },
  arabicVatRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 1,
  },
  companyVatAr: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  companyVatArVal: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Title Strip ───
  titleStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    marginBottom: 4,
  },
  titleLeftCol: {
    width: "28%",
  },
  titleLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  titleCenterCol: {
    width: "44%",
    alignItems: "center",
  },
  titleCenterHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  titleCenterText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#C51A1B",
  },
  titleCenterSep: {
    fontSize: 8,
    color: "#374151",
  },
  invoiceNumberBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 0.5,
    marginTop: 1,
    backgroundColor: "#FAFAFA",
  },
  invoiceNumberText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  titleRightCol: {
    width: "28%",
    alignItems: "flex-end",
  },
  titleLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Customer Grid ───
  customerGrid: {
    borderWidth: 0.75,
    borderColor: "#000000",
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderColor: "#000000",
    minHeight: 14,
  },
  cellLabelLeft: {
    width: 65,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  labelEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },
  cellValueEn: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  valueText: {
    fontSize: 6.5,
    color: "#000000",
  },
  cellValueAr: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  valueTextAr: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },
  cellLabelRight: {
    width: 65,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  labelAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  cellCityHalf: {
    width: "22%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellCountryHalf: {
    width: "20%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellCityHalfAr: {
    width: "24%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCountryHalfAr: {
    width: "16%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCombinedAr: {
    width: "40%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellValueWideEn: {
    flex: 2,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellValueWideVat: {
    flex: 2,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vatValueText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 0.5,
  },

  // ─── Secondary Metadata Bar ───
  metaBar: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 5,
    backgroundColor: "#FDFDFD",
  },
  metaCell: {
    flex: 1.1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellNarrow: {
    flex: 0.9,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellWide: {
    flex: 1.4,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellDate: {
    flex: 1.3,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellLabelAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
  },
  metaCellLabelEn: {
    fontSize: 5.5,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 1,
    marginBottom: 1,
  },
  metaCellValue: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },

  // ─── Main Products Table ───
  tableContainer: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 0.75,
    borderColor: "#000000",
  },
  tableHeaderCell: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextAr: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
  },
  headerTextEn: {
    fontSize: 5.2,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
    lineHeight: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#000000",
    minHeight: 14,
  },
  tableCell: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tableCellDesc: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tableCellQty: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tableCellNum: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCodeText: {
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
  },
  cellDescAr: {
    fontSize: 6.2,
    color: "#000000",
    textAlign: "right",
  },
  cellPackSize: {
    fontSize: 5.2,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 0.5,
  },
  discountBadge: {
    marginTop: 1,
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    backgroundColor: "#FEF2F2",
    borderRadius: 1,
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  discountBadgeText: {
    fontSize: 4.8,
    color: "#991B1B",
    textAlign: "right",
  },
  checkMark: {
    fontSize: 6,
    color: "#DC2626",
    fontWeight: "bold",
  },
  cellQtyText: {
    fontSize: 6,
    color: "#000000",
    fontWeight: "bold",
  },
  cellNumText: {
    fontSize: 6,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths (Sum = 100%)
  colSn: { width: "4%" },
  colDesc: { width: "27%" },
  colQty: { width: "6%" },
  colUnitPrice: { width: "9%" },
  colGrossAmt: { width: "9%" },
  colDiscAmt: { width: "7%" },
  colNetAmt: { width: "10%" },
  colVatPercent: { width: "6%" },
  colVatAmt: { width: "10%" },
  colLineTotal: { width: "12%" },

  // ─── Summary Section ───
  summaryContainer: {
    marginTop: 3,
    marginBottom: 4,
    paddingRight: 6,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 1.5,
  },
  summaryRowHighlight: {
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: "#C51A1B",
    paddingVertical: 1.5,
    backgroundColor: "#FFF5F5",
  },
  summaryLabelEn: {
    fontSize: 6,
    color: "#4B5563",
  },
  summaryLabelAr: {
    fontSize: 6.2,
    fontWeight: "bold",
    color: "#000000",
  },
  summaryVal: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#000000",
    width: 75,
    textAlign: "right",
  },
  summaryLabelEnBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#C51A1B",
  },
  summaryLabelArBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#C51A1B",
  },
  summaryValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#C51A1B",
    width: 75,
    textAlign: "right",
  },

  // ─── Grand Total & Words Bar ───
  grandTotalBar: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 6,
    minHeight: 18,
    backgroundColor: "#FFFDFD",
  },
  wordsCell: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  wordsText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
    fontWeight: "bold",
  },
  grandTotalLabelCell: {
    width: 95,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  grandTotalLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#C51A1B",
    textAlign: "center",
  },
  grandTotalSubLabel: {
    fontSize: 5.2,
    color: "#4B5563",
    textAlign: "center",
  },
  grandTotalValueCell: {
    width: 85,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5F5",
  },
  grandTotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#C51A1B",
    textAlign: "center",
  },

  // ─── QR Section ───
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  qrImage: {
    width: 70,
    height: 70,
  },
  qrPlaceholder: {
    width: 70,
    height: 70,
    borderWidth: 0.75,
    borderColor: "#D1D5DB",
  },

  // ─── Footer Notice & Extras ───
  footerNoteBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  extraSection: {
    borderBottomWidth: 0.5,
    borderColor: "#E5E7EB",
    paddingBottom: 2,
    marginBottom: 2,
  },
  extraHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 1,
  },
  footerNoteHeader: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#374151",
  },
  footerNoteHeaderAr: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "right",
  },
  extraBodyText: {
    fontSize: 5.5,
    color: "#1F2937",
    textAlign: "right",
    lineHeight: 1.2,
  },
  footerCustomText: {
    fontSize: 5.5,
    color: "#374151",
    textAlign: "center",
    fontWeight: "bold",
  },
  footerNoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 1,
  },
  footerNoteEn: {
    fontSize: 5,
    color: "#6B7280",
    width: "48%",
  },
  footerNoteAr: {
    fontSize: 5,
    color: "#6B7280",
    textAlign: "right",
    width: "48%",
  },

  // ─── Page Numbering ───
  pageNumberWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  pageNumberText: {
    fontSize: 6,
    color: "#6B7280",
    textAlign: "center",
  },
});
