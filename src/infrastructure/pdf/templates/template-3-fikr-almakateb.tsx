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

export interface Template3FikrAlmakatebProps {
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

// ─── Optional ERP extension interfaces ───
interface FikrInvoiceExtensions {
  discountTotal?: string | number | null;
  discount?: string | number | null;
  discountAmount?: string | number | null;
  bankName?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  bankIban?: string | null;
  returnPolicyNote?: string | null;
}

interface FikrCustomerExtensions {
  clientNo?: string | number | null;
  customerCode?: string | number | null;
  code?: string | number | null;
  crNumber?: string | null;
  commercialReg?: string | null;
  addressDistrict?: string | null;
  district?: string | null;
  addressBuildingNumber?: string | null;
  buildingNo?: string | null;
  buildingNumber?: string | null;
  addressAdditionalNumber?: string | null;
  additionalNo?: string | null;
  secondaryNumber?: string | null;
  country?: string | null;
  mobile?: string | null;
}

interface FikrCompanyExtensions {
  secondaryNumber?: string | null;
  mobile?: string | null;
  country?: string | null;
  bankName?: string | null;
  bankNameEn?: string | null;
  iban?: string | null;
}

interface FikrItemExtensions {
  discount?: string | number | null;
  taxRate?: string | number | null;
  descriptionEn?: string | null;
  nameEn?: string | null;
}

function getInvoiceExt(invoice: InvoiceDto): FikrInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<FikrInvoiceExtensions>;
  return {
    discountTotal: rec.discountTotal ?? rec.discount ?? rec.discountAmount ?? null,
    bankName: rec.bankName ?? null,
    bankAccount: rec.bankAccount ?? null,
    iban: rec.iban ?? rec.bankIban ?? null,
    returnPolicyNote: rec.returnPolicyNote ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): FikrCustomerExtensions {
  const rec = customer as CustomerRecord & Partial<FikrCustomerExtensions>;
  return {
    clientNo: rec.clientNo ?? rec.customerCode ?? rec.code ?? null,
    crNumber: customer.unifiedNumber ?? rec.crNumber ?? rec.commercialReg ?? null,
    addressDistrict: rec.addressDistrict ?? rec.district ?? null,
    addressBuildingNumber: rec.addressBuildingNumber ?? rec.buildingNo ?? rec.buildingNumber ?? null,
    addressAdditionalNumber: rec.addressAdditionalNumber ?? rec.additionalNo ?? rec.secondaryNumber ?? null,
    country: rec.country ?? null,
    mobile: rec.mobile ?? customer.phone ?? null,
  };
}

function getCompanyExt(company: CompanyRecord): FikrCompanyExtensions {
  const rec = company as CompanyRecord & Partial<FikrCompanyExtensions>;
  return {
    secondaryNumber: rec.secondaryNumber ?? company.addressAdditionalNumber ?? null,
    mobile: rec.mobile ?? company.phone ?? null,
    country: rec.country ?? null,
    bankName: rec.bankName ?? null,
    bankNameEn: rec.bankNameEn ?? null,
    iban: rec.iban ?? null,
  };
}

// ─── Helpers ───
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
function formatDateFormatted(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

// ─── Arabic Tafqeet (Number to Words) ───
const ONES_AR = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS_AR = [
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
const TENS_AR = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS_AR = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertThreeDigits(n: number): string {
  if (n <= 0) return "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0) {
    const label = HUNDREDS_AR[h];
    if (label) parts.push(label);
  }
  if (rem > 0) {
    if (rem < 10) {
      const label = ONES_AR[rem];
      if (label) parts.push(label);
    } else if (rem < 20) {
      const label = TEENS_AR[rem - 10];
      if (label) parts.push(label);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const tensLabel = TENS_AR[t];
      if (u > 0) {
        const onesLabel = ONES_AR[u];
        if (onesLabel && tensLabel) parts.push(`${onesLabel} و${tensLabel}`);
        else if (onesLabel) parts.push(onesLabel);
      } else if (tensLabel) {
        parts.push(tensLabel);
      }
    }
  }
  return parts.join(" و");
}

function tafqeetArabic(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  const groups: string[] = [];
  const millions = Math.floor(riyals / 1000000);
  const remMillions = riyals % 1000000;
  const thousands = Math.floor(remMillions / 1000);
  const rest = remMillions % 1000;

  if (millions > 0) {
    if (millions === 1) groups.push("مليون");
    else if (millions === 2) groups.push("مليونان");
    else if (millions >= 3 && millions <= 10) groups.push(`${convertThreeDigits(millions)} ملايين`);
    else groups.push(`${convertThreeDigits(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) groups.push("ألف");
    else if (thousands === 2) groups.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) groups.push(`${convertThreeDigits(thousands)} آلاف`);
    else groups.push(`${convertThreeDigits(thousands)} ألف`);
  }

  if (rest > 0) {
    groups.push(convertThreeDigits(rest));
  }

  let text = groups.length > 0 ? groups.join(" و") : "صفر";
  text = `فقط ${text} ريال سعودي`;
  if (halalas > 0) {
    text += ` و${convertThreeDigits(halalas)} هللة`;
  }
  text += " لا غير";
  return text;
}

export function Template3FikrAlmakateb({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template3FikrAlmakatebProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const custExt = getCustomerExt(customer);
  const compExt = getCompanyExt(company);

  // Invoice & Company metadata
  const invoiceNum = toText(invoice.invoiceNumber);
  const issueDateStr = formatDateFormatted(invoice.issueDate);
  const companyNameAr = toText(company.nameAr);
  const companyNameEn = toText(company.nameEn);
  const companyVat = toText(company.vatNumber);
  const companyCr = toText(company.crNumber);
  const companyPhone = toText(compExt.mobile || company.phone);
  const companyEmail = toText(company.email);
  const companyWebsite = toText(company.website);
  const companyCountry = toText(compExt.country || "المملكة العربية السعودية");
  const companyCity = toText(company.addressCity || "الرياض");
  const companyDistrict = toText(company.addressDistrict);
  const companyStreet = toText(company.addressStreet);
  const companyBuildingNo = toText(company.addressBuildingNumber);
  const companySecondaryNo = toText(compExt.secondaryNumber || company.addressAdditionalNumber);
  const companyPostalCode = toText(company.addressPostalCode);

  const logoSource = logoDataUrl || company.logoUrl;

  // Customer metadata
  const customerName = toText(customer.nameAr || customer.nameEn);
  const customerVat = toText(customer.vatNumber);
  const customerCr = toText(customer.unifiedNumber ?? custExt.crNumber);
  const customerPhone = toText(custExt.mobile || customer.phone);
  const customerEmail = toText(customer.email);
  const customerCountry = toText(custExt.country || "المملكة العربية السعودية");
  const customerCity = toText(customer.addressCity);
  const customerDistrict = toText(custExt.addressDistrict);
  const customerStreet = toText(customer.addressStreet);
  const customerBuildingNo = toText(custExt.addressBuildingNumber);
  const customerSecondaryNo = toText(custExt.addressAdditionalNumber);
  const customerPostalCode = toText(customer.addressPostalCode);

  // Line items processing
  const items = invoice.items ?? [];
  let sumGross = 0;
  let sumLineDiscounts = 0;
  let sumLineTaxable = 0;
  let sumLineVat = 0;
  let sumLineTotal = 0;

  const rows = items.map((item, index) => {
    const itemExt = item as InvoiceItemDto & Partial<FikrItemExtensions>;
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount ?? itemExt.discount ?? 0);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null
        ? toNumber(item.vatRate)
        : itemExt.taxRate !== undefined && itemExt.taxRate !== null
        ? toNumber(itemExt.taxRate)
        : 15;

    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : (taxableSubtotal * vatRate) / 100;

    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    sumGross += gross;
    sumLineDiscounts += lineDiscount;
    sumLineTaxable += taxableSubtotal;
    sumLineVat += lineVat;
    sumLineTotal += lineTotal;

    return {
      key: item.position ?? index,
      index: index + 1,
      description: toText(item.description),
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

  // Master Totals Calculations
  const grossTotalVal = sumGross > 0 ? sumGross : toNumber(invoice.subtotal);
  const headerDiscount = toNumber(invExt.discountTotal);
  const totalDiscountVal = headerDiscount > 0 ? headerDiscount : sumLineDiscounts;
  const taxableAmountVal =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : Math.max(0, grossTotalVal - totalDiscountVal);

  const vatVal =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : sumLineVat;

  const grandTotalVal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableAmountVal + vatVal;

  const invoicePaidVal = grandTotalVal;
  const balanceDueVal = 0;

  // Arabic Tafqeet for the exact grand total
  const tafqeetText = tafqeetArabic(grandTotalVal);

  // Bank Info
  const bankNameEn = toText(compExt.bankNameEn);
  const bankNameAr = toText(compExt.bankName || invExt.bankName);
  const bankIban = toText(compExt.iban || invExt.iban);
  const hasBankInfo = Boolean(bankNameEn || bankNameAr || bankIban);

  // Footnote policy
  const defaultPolicy =
    "*الإرجاع والاستبدال خلال (48)ساعة من تاريخ الفاتورة على ان تكون البضاعة بالحالة الأصلية وبالغلاف الأصلي";
  const returnPolicy = toText(invExt.returnPolicyNote || company.footerText || defaultPolicy);

  // ─── Strict Single-Page Dynamic Height Guarantee ───
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;

  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 26;

  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 14;

  if (invoice.notes) {
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 5) * 11;
  }
  if (invoice.terms) {
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 5) * 11;
  }
  if (company.footerText) {
    extraContentHeight += 20;
  }
  if (hasBankInfo) {
    extraContentHeight += 24;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const primaryVatRate = rows.find((r) => r.vatRate > 0)?.vatRate ?? 15;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark (Centered 50% width, 0.04 opacity, never full-page stretch) */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP TITLE BAR ─── */}
        <View style={styles.topTitleBar}>
          <Text style={styles.topTitleEn}>TAX INVOICE</Text>
          <Text style={styles.topTitleAr}>فاتورة ضريبية</Text>
        </View>

        {/* ─── 2. SUBTITLE & HEADER SECTION ─── */}
        <View style={styles.headerSection}>
          {/* Left Column: Subtitle + Official ZATCA QR Code */}
          <View style={styles.headerLeftCol}>
            <Text style={styles.invoiceSubtitleAr}>فاتورة ضريبية</Text>
            <View style={styles.qrContainer}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : null}
            </View>
          </View>

          {/* Center Column: Company Logo (Conditionally rendered; null if absent) */}
          <View style={styles.headerCenterCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
          </View>

          {/* Right Column: Company Info Rows (RTL Key-Values with independent colons) */}
          <View style={styles.headerRightCol}>
            <Text style={styles.companyNameHeader}>{companyNameAr}</Text>
            {companyNameEn ? (
              <Text style={styles.companyNameEnHeader}>{companyNameEn}</Text>
            ) : null}

            {companyVat ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الرقم الضريبي</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyVat}</Text>
              </View>
            ) : null}

            {companyCr ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>السجل التجاري</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyCr}</Text>
              </View>
            ) : null}

            {companyPhone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>رقم الاتصال</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyPhone}</Text>
              </View>
            ) : null}

            {companyCountry ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>البلد</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyCountry}</Text>
              </View>
            ) : null}

            {companyCity ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>المدينة</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyCity}</Text>
              </View>
            ) : null}

            {companyDistrict ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الحي</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyDistrict}</Text>
              </View>
            ) : null}

            {companyStreet ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الشارع</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyStreet}</Text>
              </View>
            ) : null}

            {companyBuildingNo ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>رقم المبنى</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyBuildingNo}</Text>
              </View>
            ) : null}

            {companySecondaryNo ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الرقم الإضافي</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companySecondaryNo}</Text>
              </View>
            ) : null}

            {companyPostalCode ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الرمز البريدي</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyPostalCode}</Text>
              </View>
            ) : null}

            {companyEmail ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>البريد الإلكتروني</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyEmail}</Text>
              </View>
            ) : null}

            {companyWebsite ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>الموقع الإلكتروني</Text>
                <Text style={styles.infoColon}>:</Text>
                <Text style={styles.infoVal}>{companyWebsite}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. CUSTOMER DATA SECTION (بيانات العميل) ─── */}
        <View style={styles.customerSection}>
          <View style={styles.sectionHeaderBar}>
            <Text style={styles.sectionHeaderText}>بيانات العميل</Text>
          </View>

          {/* Grid Row 1 Headers (RTL: رقم الفاتورة | تاريخ الفاتورة | اسم العميل | السجل التجاري / الرقم الموحد | رقم ضريبة العميل) */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellHeader, { width: "18%" }]}>
              <Text style={styles.gridHeaderLabel}>رقم ضريبة العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "16%" }]}>
              <Text style={styles.gridHeaderLabel}>السجل / الرقم الموحد</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "34%" }]}>
              <Text style={styles.gridHeaderLabel}>اسم العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "16%" }]}>
              <Text style={styles.gridHeaderLabel}>تاريخ الفاتورة</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={styles.gridHeaderLabel}>رقم الفاتورة</Text>
            </View>
          </View>

          {/* Grid Row 1 Values */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellVal, { width: "18%" }]}>
              <Text style={styles.gridValBold}>{customerVat || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "16%" }]}>
              <Text style={styles.gridValBold}>{customerCr || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "34%" }]}>
              <Text style={styles.gridValBold}>{customerName || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "16%" }]}>
              <Text style={styles.gridValBold}>{issueDateStr || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={styles.gridValBold}>{invoiceNum || "-"}</Text>
            </View>
          </View>

          {/* Grid Row 2 Headers (National Address & Contact Details) */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellHeader, { width: "18%" }]}>
              <Text style={styles.gridHeaderLabel}>البريد الإلكتروني</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "14%" }]}>
              <Text style={styles.gridHeaderLabel}>رقم الجوال</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "10%" }]}>
              <Text style={styles.gridHeaderLabel}>الرمز البريدي</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "10%" }]}>
              <Text style={styles.gridHeaderLabel}>الرقم الإضافي</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "10%" }]}>
              <Text style={styles.gridHeaderLabel}>رقم المبنى</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "13%" }]}>
              <Text style={styles.gridHeaderLabel}>الحي</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "15%" }]}>
              <Text style={styles.gridHeaderLabel}>الشارع</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "10%", borderRightWidth: 0 }]}>
              <Text style={styles.gridHeaderLabel}>المدينة</Text>
            </View>
          </View>

          {/* Grid Row 2 Values */}
          <View style={[styles.custGridRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.custCellVal, { width: "18%" }]}>
              <Text style={styles.gridValText}>{customerEmail || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "14%" }]}>
              <Text style={styles.gridValText}>{customerPhone || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "10%" }]}>
              <Text style={styles.gridValText}>{customerPostalCode || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "10%" }]}>
              <Text style={styles.gridValText}>{customerSecondaryNo || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "10%" }]}>
              <Text style={styles.gridValText}>{customerBuildingNo || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "13%" }]}>
              <Text style={styles.gridValText}>{customerDistrict || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "15%" }]}>
              <Text style={styles.gridValText}>{customerStreet || "-"}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "10%", borderRightWidth: 0 }]}>
              <Text style={styles.gridValText}>{customerCity || "-"}</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE ─── */}
        {/* RTL Columns: مسلسل | اسم الصنف والبيان | الكمية | سعر الوحدة | الخاضع للضريبة | نسبة الضريبة | مبلغ الضريبة | المجموع شامل الضريبة */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "15%" }]}>
              <Text style={styles.thText}>المجموع شامل الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thText}>مبلغ الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>نسبة الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع للضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            <View style={[styles.thCell, { width: "27%" }]}>
              <Text style={styles.thText}>اسم الصنف والبيان</Text>
            </View>
            <View style={[styles.thCell, { width: "5%", borderRightWidth: 0 }]}>
              <Text style={styles.thText}>مسلسل</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0, paddingVertical: 8 }]}>
                <Text style={styles.tdTextCenter}>لا توجد أصناف / No items</Text>
              </View>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                {/* Total Inc. VAT */}
                <View style={[styles.tdCell, { width: "15%" }]}>
                  <Text style={styles.tdTextBold}>{formatExactAmount(row.lineTotal)}</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdTextNum}>{formatExactAmount(row.lineVat)}</Text>
                </View>

                {/* VAT Rate */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>%{row.vatRate}</Text>
                </View>

                {/* Taxable Subtotal */}
                <View style={[styles.tdCell, { width: "14%" }]}>
                  <Text style={styles.tdTextNum}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdTextNum}>{formatExactAmount(row.unitPrice)}</Text>
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{formatQty(row.qty)}</Text>
                </View>

                {/* Description & Discount Badge */}
                <View style={[styles.tdCell, { width: "27%", alignItems: "flex-end", paddingRight: 4 }]}>
                  <Text style={styles.tdTextAr}>{row.description}</Text>
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(row.lineDiscount)} (قبل الخصم: {formatExactAmount(row.gross)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Sequence */}
                <View style={[styles.tdCell, { width: "5%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{row.index}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ─── 5. SUMMARY & TOTALS SECTION ─── */}
        <View style={styles.summarySection}>
          {/* Left Block: Thank you note + Amount in Words + Bank Info + Notes & Terms */}
          <View style={styles.summaryLeftCol}>
            <View style={styles.thankYouBox}>
              <Text style={styles.thankYouText}>*** نشكركم لتعاملكم معنا ونتطلع لخدمتكم دائماً</Text>
            </View>

            {/* Tafqeet Amount in Words (BiDi row-reverse, colon separated) */}
            <View style={styles.amountInWordsBox}>
              <Text style={styles.amountWordsLabel}>المبلغ كتابة</Text>
              <Text style={styles.amountWordsColon}>:</Text>
              <Text style={styles.amountWordsVal}>{tafqeetText}</Text>
            </View>

            {/* Bank Info Box (only rendered when bank info is provided) */}
            {hasBankInfo ? (
              <View style={styles.bankBox}>
                {bankNameEn ? <Text style={styles.bankEn}>{bankNameEn}</Text> : null}
                {bankIban ? <Text style={styles.bankIban}>{bankIban}</Text> : null}
                {bankNameAr ? <Text style={styles.bankAr}>{bankNameAr}</Text> : null}
              </View>
            ) : null}

            {/* Optional Invoice Notes */}
            {invoice.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>ملاحظات</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Optional Invoice Terms */}
            {invoice.terms ? (
              <View style={styles.termsBox}>
                <Text style={styles.termsTitle}>الشروط والأحكام</Text>
                <Text style={styles.termsText}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>

          {/* Right Block: Boxed Totals Table */}
          <View style={styles.summaryRightCol}>
            <View style={styles.totalsTable}>
              {/* Row 1: Gross Total before tax */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(grossTotalVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>الإجمالي قبل الضريبة</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Total before tax</Text>
                </View>
              </View>

              {/* Row 2: Discount */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(totalDiscountVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>إجمالي الخصم</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Discount</Text>
                </View>
              </View>

              {/* Row 3: Taxable Subtotal */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(taxableAmountVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>المبلغ الخاضع للضريبة</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Taxable Amount</Text>
                </View>
              </View>

              {/* Row 4: Total VAT */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(vatVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>
                    ضريبة القيمة المضافة (%{primaryVatRate})
                  </Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Total VAT ({primaryVatRate}%)</Text>
                </View>
              </View>

              {/* Row 5: Total after VAT / Grand Total */}
              <View style={[styles.totalsRow, styles.totalsRowGrand]}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValGrand}>{formatExactAmount(grandTotalVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelArGrand}>صافي المبلغ شامل الضريبة</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEnGrand}>Grand Total</Text>
                </View>
              </View>

              {/* Row 6: Invoice Paid */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(invoicePaidVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>المبلغ المدفوع</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Invoice Paid</Text>
                </View>
              </View>

              {/* Row 7: Balance Due */}
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(balanceDueVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>المبلغ المتبقي</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Balance Due</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 6. POLICY & FOOTER NOTE ─── */}
        {returnPolicy ? (
          <View style={styles.policyFootnote}>
            <Text style={styles.policyText}>{returnPolicy}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ─── STYLESHEET ───
const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontSize: 7.5,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Top Title Bar ───
  topTitleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 3,
    borderBottomWidth: 1.2,
    borderBottomColor: "#1E293B",
    marginBottom: 6,
  },
  topTitleEn: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
    letterSpacing: 0.8,
  },
  topTitleAr: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },

  // ─── Header Section ───
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "22%",
    alignItems: "flex-start",
  },
  invoiceSubtitleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#B45309",
    marginBottom: 4,
    textAlign: "left",
  },
  qrContainer: {
    alignItems: "flex-start",
  },
  qrImage: {
    width: 80,
    height: 80,
  },

  headerCenterCol: {
    width: "36%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  logoImage: {
    maxWidth: 160,
    maxHeight: 80,
    objectFit: "contain",
  },

  headerRightCol: {
    width: "42%",
    alignItems: "flex-end",
    paddingRight: 2,
  },
  companyNameHeader: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
    marginBottom: 1,
  },
  companyNameEnHeader: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right",
    marginBottom: 3,
  },
  infoRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 1.5,
  },
  infoKey: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "right",
  },
  infoColon: {
    fontSize: 6.8,
    color: "#334155",
    marginHorizontal: 2,
  },
  infoVal: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Customer Data Section ───
  customerSection: {
    borderWidth: 0.8,
    borderColor: "#1E293B",
    marginBottom: 6,
    backgroundColor: "#FAFAFA",
  },
  sectionHeaderBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    backgroundColor: "#1E293B",
  },
  sectionHeaderText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  custGridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#1E293B",
    minHeight: 14,
    alignItems: "stretch",
  },
  custCellHeader: {
    borderRightWidth: 0.6,
    borderRightColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingVertical: 1.5,
    backgroundColor: "#F1F5F9",
  },
  gridHeaderLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
  },
  custCellVal: {
    borderRightWidth: 0.6,
    borderRightColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  gridValBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  gridValText: {
    fontSize: 6.5,
    color: "#334155",
    textAlign: "center",
  },

  // ─── Items Table ───
  table: {
    borderWidth: 0.8,
    borderColor: "#1E293B",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    minHeight: 17,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.6,
    borderRightColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  thText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    minHeight: 16,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.6,
    borderRightColor: "#E2E8F0",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2.5,
  },
  tdTextBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  tdTextNum: {
    fontSize: 6.8,
    color: "#0F172A",
    textAlign: "center",
  },
  tdTextCenter: {
    fontSize: 6.8,
    color: "#0F172A",
    textAlign: "center",
  },
  tdTextAr: {
    fontSize: 6.8,
    color: "#0F172A",
    textAlign: "right",
  },
  discountBadge: {
    marginTop: 2,
    paddingVertical: 1,
    paddingHorizontal: 3,
    backgroundColor: "#FEF3C7",
    borderRadius: 2,
    alignSelf: "flex-end",
  },
  discountBadgeText: {
    fontSize: 5.8,
    color: "#92400E",
    fontWeight: "bold",
    textAlign: "right",
  },

  // ─── Summary Section ───
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  summaryLeftCol: {
    width: "48%",
    paddingTop: 2,
  },
  thankYouBox: {
    marginBottom: 6,
  },
  thankYouText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#B45309",
    textAlign: "right",
  },
  amountInWordsBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.6,
    borderColor: "#E2E8F0",
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  amountWordsLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E293B",
  },
  amountWordsColon: {
    fontSize: 7,
    color: "#1E293B",
    marginHorizontal: 2,
  },
  amountWordsVal: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  bankBox: {
    borderWidth: 0.8,
    borderColor: "#1E293B",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 5,
    backgroundColor: "#FAFAFA",
  },
  bankEn: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#1E293B",
  },
  bankIban: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  bankAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E293B",
  },
  notesBox: {
    borderWidth: 0.6,
    borderColor: "#CBD5E1",
    padding: 4,
    marginBottom: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 2,
  },
  notesTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 6.2,
    color: "#334155",
    textAlign: "right",
  },
  termsBox: {
    borderWidth: 0.6,
    borderColor: "#CBD5E1",
    padding: 4,
    marginBottom: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 2,
  },
  termsTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
    marginBottom: 1,
  },
  termsText: {
    fontSize: 6.2,
    color: "#334155",
    textAlign: "right",
  },

  // ─── Totals Table ───
  summaryRightCol: {
    width: "50%",
  },
  totalsTable: {
    borderWidth: 0.8,
    borderColor: "#1E293B",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#1E293B",
    minHeight: 15,
    alignItems: "stretch",
  },
  totalsRowGrand: {
    backgroundColor: "#F1F5F9",
    borderTopWidth: 0.8,
    borderTopColor: "#1E293B",
  },
  totalsLabelEnCell: {
    width: "36%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  totalsLabelEn: {
    fontSize: 6.8,
    color: "#334155",
  },
  totalsLabelEnGrand: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0F172A",
  },
  totalsLabelArCell: {
    width: "38%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "flex-end",
    borderRightWidth: 0.6,
    borderRightColor: "#1E293B",
  },
  totalsLabelAr: {
    fontSize: 6.8,
    color: "#334155",
    textAlign: "right",
  },
  totalsLabelArGrand: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  totalsValCell: {
    width: "26%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 0.6,
    borderRightColor: "#1E293B",
  },
  totalsValText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  totalsValGrand: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#B45309",
    textAlign: "center",
  },

  // ─── Policy Footnote ───
  policyFootnote: {
    borderTopWidth: 0.8,
    borderTopColor: "#1E293B",
    paddingTop: 3,
    alignItems: "center",
    marginTop: 2,
  },
  policyText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "center",
  },
});
