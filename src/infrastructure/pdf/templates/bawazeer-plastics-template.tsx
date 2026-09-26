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

export interface BawazeerPlasticsTemplateProps {
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
 * Strict date formatting: DD/MM/YYYY only — NO hours/time.
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

export function BawazeerPlasticsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: BawazeerPlasticsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);
  const dueDateStr = invoice.dueDate ? formatDate(invoice.dueDate) : "";

  // ─── Company / Seller Details ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = (company as any).nameEn || "";
  const companyBuilding = company.addressBuildingNumber || "";
  const companyStreet = company.addressStreet || "";
  const companyDistrict = company.addressDistrict || "";
  const companyCity = company.addressCity || "";
  const companyCountry = "المملكة العربية السعودية";
  const companyPostalCode = company.addressPostalCode || "";
  const companyAdditionalNo = company.addressAdditionalNumber || "";
  const companyVatNo = company.vatNumber || "";
  const companyCrn = company.crNumber || (company as any).unifiedNumber || "";
  const companyPhone1 = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = (company as any).website || "";

  // Clean company address line for top-right subheader
  const companyAddressParts = [
    companyStreet,
    companyDistrict,
    companyCity,
  ].filter(Boolean);
  const companyAddressHeader = companyAddressParts.join(" - ");

  // ─── Customer / Buyer Details ───
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerNameEn = customer.nameEn && customer.nameEn !== customer.nameAr ? customer.nameEn : "";
  const customerBuilding = customer.addressBuildingNumber || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = customer.addressDistrict || "";
  const customerCity = customer.addressCity || "";
  const customerCountry = "المملكة العربية السعودية";
  const customerPostalCode = customer.addressPostalCode || "";
  const customerAdditionalNo = customer.addressAdditionalNumber || "";
  const customerVatNo = customer.vatNumber || "";
  const customerCrn = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerOtherId = customer.unifiedNumber || (customer as any).otherId || (customerCrn ? "CRN" : "");

  // ─── Line Items & Calculations ───
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const hasAnyDiscount = items.some((item) => Number(item.discountAmount || (item as any).discount || 0) > 0);

  const discountVal = (invoice as any).discountTotal ?? items.reduce((s, it) => s + Number(it.discountAmount || (it as any).discount || 0), 0);
  // invoice.subtotal in our domain model is already the net taxable subtotal after line item discounts.
  // The gross subtotal before discount is items.reduce(qty * unitPrice) or (invoice.subtotal + discountVal).
  const rawSubtotalCalc = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  const grossSubtotal = Number(discountVal) > 0
    ? (rawSubtotalCalc > 0 ? rawSubtotalCalc : Number(invoice.subtotal || 0) + Number(discountVal))
    : Number(invoice.subtotal || 0);

  const taxableVal = invoice.subtotal ?? Math.max(0, grossSubtotal - Number(discountVal));
  const vatVal = invoice.vatAmount ?? items.reduce((s, it) => s + Number(it.lineVat || 0), 0);
  const totalVal = invoice.total ?? (Number(taxableVal) + Number(vatVal));

  // Determine VAT rate label (default 15%)
  const firstItemVatRate = items.find((it) => it.vatRate !== undefined && it.vatRate !== null)?.vatRate;
  const vatRatePercentage = firstItemVatRate !== undefined ? `${Number(firstItemVatRate)}%` : "15%";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Single-Page Guarantee: Dynamic Height Calculation ───
  // A4 standard height is 841.89 pt (~842 pt), Letter is 792 pt.
  // We expand the page height dynamically so the entire invoice fits in ONE continuous page without spilling to page 2.
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const itemRowHeight = 25;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes) extraContentHeight += 36 + Math.min(invoice.notes.split("\n").length, 6) * 12;
  if (invoice.terms) extraContentHeight += 36 + Math.min(invoice.terms.split("\n").length, 6) * 12;
  if (company.footerText) extraContentHeight += 26;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="TAX INVOICE - فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={[pageWidth, dynamicHeight]} orientation="portrait" style={styles.page}>
        {/* Background Watermark if provided */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (QR | TITLE & LOGO | METADATA) ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column: ZATCA QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder} />
            )}
          </View>

          {/* Center Column: Logo, Page Info & Invoice Title */}
          <View style={styles.centerCol}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.headerLogoImage} />
            ) : null}

            <Text
              style={styles.pageNumberText}
              render={({ pageNumber, totalPages }) => `Page\n${pageNumber} of ${totalPages}`}
            />

            <View style={styles.invoiceTitleWrap}>
              <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
              <Text style={styles.invoiceTitleEn}>Tax Invoice</Text>
            </View>
          </View>

          {/* Right Column: Company Header & BiDi Metadata Rows */}
          <View style={styles.rightCol}>
            <View style={styles.companyInfoWrap}>
              <Text style={styles.companyNameText}>{companyNameAr}</Text>
              {companyNameEn ? (
                <Text style={styles.companyNameEnText}>{companyNameEn}</Text>
              ) : null}
              <View style={styles.companySubRow}>
                {companyPhone1 ? (
                  <View style={styles.branchPhoneRight}>
                    <Text style={styles.branchLabel}>هاتف / جوال</Text>
                    <Text style={styles.branchNumber}>{companyPhone1}</Text>
                  </View>
                ) : null}
                {companyAddressHeader ? (
                  <Text style={styles.companyStreetText}>{companyAddressHeader}</Text>
                ) : null}
              </View>
            </View>

            {/* Strict React-PDF BiDi & middle-colon metadata rows:
                row-reverse with 3 separate elements:
                [Arabic label without trailing colon on RIGHT] + [independent middle colon ':' with marginHorizontal: 2] + [value on LEFT] */}
            <View style={styles.metaRowsContainer}>
              {/* Invoice Number */}
              <View style={styles.metaRow}>
                <View style={styles.metaLabelGroup}>
                  <Text style={styles.metaLabelAr}>رقم الفاتورة</Text>
                  <Text style={styles.metaLabelSlash}>/</Text>
                  <Text style={styles.metaLabelEn}>Invoice No</Text>
                </View>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaInvoiceNum}>{invoiceNum}</Text>
              </View>

              {/* Issue Date (DD/MM/YYYY only) */}
              <View style={styles.metaRow}>
                <View style={styles.metaLabelGroup}>
                  <Text style={styles.metaLabelAr}>تاريخ الفاتورة</Text>
                  <Text style={styles.metaLabelSlash}>/</Text>
                  <Text style={styles.metaLabelEn}>Invoice Date</Text>
                </View>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaValText}>{issueDateStr}</Text>
              </View>


            </View>
          </View>
        </View>

        {/* ─── 2. SELLER & BUYER DUAL CARDS ─── */}
        <View style={styles.cardsContainer}>
          {/* Seller Card (Left) */}
          <View style={styles.partyCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderLabelEn}>Seller</Text>
              <Text style={styles.cardHeaderLabelAr}>المورد</Text>
            </View>

            <View style={styles.cardBody}>
              {/* Name */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Name</Text>
                <Text style={styles.rowValueCenterBold}>{companyNameAr}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الاسم</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Building */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Building</Text>
                <Text style={styles.rowValueCenter}>{companyBuilding}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>المبنى</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Street */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Street</Text>
                <Text style={styles.rowValueCenter}>{companyStreet}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الشارع</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* District */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>District</Text>
                <Text style={styles.rowValueCenter}>{companyDistrict}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الحي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* City */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>City</Text>
                <Text style={styles.rowValueCenter}>{companyCity}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>المدينة</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Country */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Country</Text>
                <Text style={styles.rowValueCenter}>{companyCountry}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الدولة</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Postal Code */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Postal Code</Text>
                <Text style={styles.rowValueCenter}>{companyPostalCode}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرمز البريدي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Additional No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Additional No</Text>
                <Text style={styles.rowValueCenter}>{companyAdditionalNo}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرقم الإضافي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* VAT No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>VAT No</Text>
                <Text style={styles.rowValueCenterBold}>{companyVatNo}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرقم الضريبي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* CRN / Unified No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>CRN / Unified</Text>
                <Text style={styles.rowValueCenter}>{companyCrn}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>السجل / الموحد</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Phone / Email / Website (conditional or Other ID) */}
              {companyPhone1 || companyEmail ? (
                <View style={styles.cardDataRowLast}>
                  <Text style={styles.rowLabelEn}>Contact</Text>
                  <Text style={styles.rowValueCenter}>
                    {[companyPhone1, companyEmail].filter(Boolean).join(" - ")}
                  </Text>
                  <View style={styles.rowLabelArGroup}>
                    <Text style={styles.rowLabelAr}>التواصل</Text>
                    <Text style={styles.rowColon}>:</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cardDataRowLast}>
                  <Text style={styles.rowLabelEn}>Other ID</Text>
                  <Text style={styles.rowValueCenter}>{companyCrn ? "CRN" : ""}</Text>
                  <View style={styles.rowLabelArGroup}>
                    <Text style={styles.rowLabelAr}>معرف آخر</Text>
                    <Text style={styles.rowColon}>:</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Buyer Card (Right) */}
          <View style={styles.partyCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderLabelEn}>Buyer</Text>
              <Text style={styles.cardHeaderLabelAr}>العميل</Text>
            </View>

            <View style={styles.cardBody}>
              {/* Name */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Name</Text>
                <Text style={styles.rowValueCenterBold}>{customerNameAr}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الاسم</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Building */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Building</Text>
                <Text style={styles.rowValueCenter}>{customerBuilding}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>المبنى</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Street */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Street</Text>
                <Text style={styles.rowValueCenter}>{customerStreet}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الشارع</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* District */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>District</Text>
                <Text style={styles.rowValueCenter}>{customerDistrict}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الحي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* City */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>City</Text>
                <Text style={styles.rowValueCenter}>{customerCity}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>المدينة</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Country */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Country</Text>
                <Text style={styles.rowValueCenter}>{customerCountry}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الدولة</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Postal Code */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Postal Code</Text>
                <Text style={styles.rowValueCenter}>{customerPostalCode}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرمز البريدي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Additional No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Additional No</Text>
                <Text style={styles.rowValueCenter}>{customerAdditionalNo}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرقم الإضافي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* VAT No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>VAT No</Text>
                <Text style={styles.rowValueCenterBold}>{customerVatNo}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>الرقم الضريبي</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* CRN / Unified No */}
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>CRN / Unified</Text>
                <Text style={styles.rowValueCenter}>{customerCrn}</Text>
                <View style={styles.rowLabelArGroup}>
                  <Text style={styles.rowLabelAr}>السجل / الموحد</Text>
                  <Text style={styles.rowColon}>:</Text>
                </View>
              </View>

              {/* Phone / Email / Other ID */}
              {customerPhone || customerEmail ? (
                <View style={styles.cardDataRowLast}>
                  <Text style={styles.rowLabelEn}>Contact</Text>
                  <Text style={styles.rowValueCenter}>
                    {[customerPhone, customerEmail].filter(Boolean).join(" - ")}
                  </Text>
                  <View style={styles.rowLabelArGroup}>
                    <Text style={styles.rowLabelAr}>التواصل</Text>
                    <Text style={styles.rowColon}>:</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cardDataRowLast}>
                  <Text style={styles.rowLabelEn}>Other ID</Text>
                  <Text style={styles.rowValueCenter}>{customerOtherId}</Text>
                  <View style={styles.rowLabelArGroup}>
                    <Text style={styles.rowLabelAr}>معرف آخر</Text>
                    <Text style={styles.rowColon}>:</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── 3. SUB-HEADER: NOTES / DESCRIPTION (NO TRAILING COLONS) ─── */}
        {invoice.notes ? (
          <View style={styles.descriptionRow}>
            <Text style={styles.descriptionLabel}>البيان / Description</Text>
            <Text style={styles.descriptionValue}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ─── 4. ITEMS TABLE (7 COLUMNS WITH FULL DECIMAL PRECISION) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* Col 1: Item Name / Description */}
            <View style={[styles.thCell, { width: "39%" }]}>
              <Text style={styles.thTextAr}>اسم الصنف / البيان</Text>
              <Text style={styles.thTextEn}>Item Name / Description</Text>
            </View>

            {/* Col 2: Quantity */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Quantity</Text>
            </View>

            {/* Col 3: Unit Price */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thTextAr}>سعر الوحدة</Text>
              <Text style={styles.thTextEn}>Unit Price</Text>
            </View>

            {/* Col 4: Discount */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextAr}>الخصم</Text>
              <Text style={styles.thTextEn}>Discount</Text>
            </View>

            {/* Col 5: VAT (Rate & Amount) */}
            <View style={[styles.thCell, { width: "15%" }]}>
              <Text style={styles.thTextAr}>ضريبة القيمة المضافة</Text>
              <Text style={styles.thTextEn}>VAT ({vatRatePercentage})</Text>
            </View>

            {/* Col 6: Total Due with VAT */}
            <View style={[styles.thCell, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={styles.thTextAr}>الإجمالي شامل الضريبة</Text>
              <Text style={styles.thTextEn}>Total Due</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item: InvoiceItemDto, index: number) => {
            const unitName = (item as any).unit || (item as any).unitName || "";
            const itemQty = item.quantity;
            const unitPrice = item.unitPrice;
            const lineDisc = item.discountAmount || (item as any).discount || 0;
            const rawLineAmount = Number(unitPrice || 0) * Number(itemQty || 0);
            const discountedSubtotal = Number(lineDisc) > 0
              ? Math.max(0, rawLineAmount - Number(lineDisc))
              : (item.lineSubtotal ?? rawLineAmount);
            const lineVat = item.lineVat || 0;
            const lineTotal = item.lineTotal || 0;
            const itemVatRate = item.vatRate !== undefined && item.vatRate !== null ? `${Number(item.vatRate)}%` : vatRatePercentage;

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index % 2 === 1 ? styles.tableRowEven : {},
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* Col 1: Item Name / Description */}
                <View style={[styles.tdCell, { width: "39%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdRightText}>{item.description}</Text>
                </View>

                {/* Col 2: Quantity (Stacked Unit & Exact Value) */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  {unitName ? <Text style={styles.tdUnitText}>{unitName}</Text> : null}
                  <Text style={styles.tdCenterBoldText}>{formatExactAmount(itemQty)}</Text>
                </View>

                {/* Col 3: Unit Price (and before/after discount subtotal if discounted) */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdCenterText}>{formatExactAmount(unitPrice)}</Text>
                  {Number(lineDisc) > 0 ? (
                    <View style={styles.subCalcBlock}>
                      <Text style={styles.tdSubCalcText}>قبل: {formatExactAmount(rawLineAmount)}</Text>
                      <Text style={styles.tdSubCalcText}>بعد: {formatExactAmount(discountedSubtotal)}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Col 4: Discount */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenterText}>
                    {Number(lineDisc) > 0 ? formatExactAmount(lineDisc) : "0"}
                  </Text>
                </View>

                {/* Col 5: VAT Amount & Rate */}
                <View style={[styles.tdCell, { width: "15%" }]}>
                  <Text style={styles.tdCenterText}>{formatExactAmount(lineVat)}</Text>
                  <Text style={styles.tdVatRateText}>({itemVatRate})</Text>
                </View>

                {/* Col 6: Total with VAT */}
                <View style={[styles.tdCell, { width: "16%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdRightBoldText}>{formatExactAmount(lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TAFQEET SPELLED OUT STRIP ─── */}
        <View style={styles.tafqeetRow}>
          <View style={styles.tafqeetTextWrap}>
            <Text style={styles.tafqeetText}>{tafqeetText}</Text>
          </View>
          <View style={styles.tafqeetCurrencyBox}>
            <Text style={styles.tafqeetCurrencyText}>SAR</Text>
          </View>
          <View style={styles.tafqeetAmountBox}>
            <Text style={styles.tafqeetAmountText}>{formatExactAmount(totalVal)}</Text>
          </View>
        </View>

        {/* ─── 6. SUMMARY & TOTALS SECTION ─── */}
        <View style={styles.summaryContainer}>
          {/* Left Block: Total Quantity Highlighted */}
          <View style={styles.totalQtyBlock}>
            <Text style={styles.totalQtyLabel}>إجمالي الكمية / Total QTY</Text>
            <Text style={styles.totalQtyValue}>{formatExactAmount(totalQty)}</Text>
          </View>

          {/* Right Block: Comprehensive Totals Breakdown */}
          <View style={styles.totalsTableBlock}>
            {/* Row 1: Total Excluding VAT */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalsLabel}>الإجمالي غير شامل ضريبة القيمة المضافة / Total Excluding VAT</Text>
            </View>

            {/* Row 2: Discount (shown if any discount) */}
            {(hasAnyDiscount || Number(discountVal) > 0) ? (
              <View style={styles.totalsTableRow}>
                <Text style={styles.totalsVal}>{formatExactAmount(discountVal)}</Text>
                <Text style={styles.totalsLabel}>الخصم / Discount</Text>
              </View>
            ) : null}

            {/* Row 3: Charges */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>0</Text>
              <Text style={styles.totalsLabel}>الأعباء / Charges</Text>
            </View>

            {/* Row 4: Total Taxable Amount */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(taxableVal)}</Text>
              <Text style={styles.totalsLabel}>الإجمالي الخاضع للضريبة / Total Taxable Amount</Text>
            </View>

            {/* Row 5: VAT with Rate Highlight */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(vatVal)}</Text>
              <View style={styles.taxLabelRow}>
                <Text style={styles.totalsLabel}>الضريبة / </Text>
                <Text style={styles.taxRedText}>{vatRatePercentage} </Text>
                <Text style={styles.totalsLabel}>Tax</Text>
              </View>
            </View>

            {/* Row 6: Final Total with Tax */}
            <View style={[styles.totalsTableRow, styles.totalsFinalRow]}>
              <Text style={styles.totalsFinalVal}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.totalsFinalLabel}>الإجمالي النهائي شامل الضريبة / Total Amt With Tax</Text>
            </View>

            {/* Row 7: Invoice Paid */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.totalsLabel}>المبلغ المدفوع / Invoice Paid</Text>
            </View>

            {/* Row 8: Balance Due (0) */}
            <View style={[styles.totalsTableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalsVal}>0</Text>
              <Text style={styles.totalsLabel}>المبلغ المتبقي / Balance Due</Text>
            </View>
          </View>
        </View>

        {/* ─── 7. TERMS & CONDITIONS (IF PRESENT) ─── */}
        {invoice.terms ? (
          <View style={styles.termsRow}>
            <Text style={styles.termsLabel}>الشروط والأحكام / Terms & Conditions</Text>
            <Text style={styles.termsValue}>{invoice.terms}</Text>
          </View>
        ) : null}

        {/* ─── 8. COMPANY CUSTOM FOOTER TEXT (IF PRESENT) ─── */}
        {company.footerText ? (
          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 20,
    paddingRight: 20,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Top Header Section ───
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingBottom: 4,
  },
  qrCol: {
    width: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 128,
    height: 128,
  },
  qrPlaceholder: {
    width: 128,
    height: 128,
    borderWidth: 1,
    borderColor: "#9CA3AF",
  },

  centerCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
  },
  headerLogoImage: {
    maxHeight: 45,
    maxWidth: 120,
    objectFit: "contain",
    marginBottom: 4,
  },
  pageNumberText: {
    fontSize: 7,
    color: "#2563EB",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 1.2,
  },
  invoiceTitleWrap: {
    alignItems: "center",
    marginTop: 2,
  },
  invoiceTitleAr: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  invoiceTitleEn: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },

  rightCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  companyInfoWrap: {
    alignItems: "flex-end",
    marginBottom: 5,
  },
  companyNameText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    marginBottom: 1,
  },
  companyNameEnText: {
    fontSize: 8.5,
    color: "#4B5563",
    textAlign: "right",
    marginBottom: 2,
  },
  companySubRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  companyStreetText: {
    fontSize: 7.5,
    color: "#374151",
    textAlign: "right",
  },
  branchPhoneRight: {
    alignItems: "center",
  },
  branchLabel: {
    fontSize: 7,
    color: "#4B5563",
    textAlign: "right",
  },
  branchNumber: {
    fontSize: 7.5,
    color: "#111827",
    fontWeight: "bold",
  },

  // ─── BiDi Metadata Rows (Header Right) ───
  metaRowsContainer: {
    alignItems: "flex-end",
    width: "100%",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 2,
  },
  metaLabelGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
  },
  metaLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  metaLabelSlash: {
    fontSize: 7,
    color: "#6B7280",
  },
  metaLabelEn: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
  },
  metaColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    marginHorizontal: 2,
  },
  metaInvoiceNum: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    marginRight: 2,
    textAlign: "right",
  },
  metaValText: {
    fontSize: 7.5,
    color: "#111827",
    marginRight: 2,
    textAlign: "right",
  },

  // ─── Dual Party Cards ───
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 6,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#FFFFFF",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
  },
  cardHeaderLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  cardHeaderLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  cardBody: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cardDataRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 1.5,
    minHeight: 14,
  },
  cardDataRowLast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    minHeight: 14,
  },
  rowLabelEn: {
    width: "28%",
    fontSize: 6.8,
    color: "#4B5563",
    textAlign: "left",
  },
  rowValueCenter: {
    flex: 1,
    fontSize: 6.8,
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  rowValueCenterBold: {
    flex: 1,
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  rowLabelArGroup: {
    width: "28%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  rowLabelAr: {
    fontSize: 6.8,
    color: "#4B5563",
    textAlign: "right",
  },
  rowColon: {
    fontSize: 6.8,
    color: "#4B5563",
    marginHorizontal: 1.5,
  },

  // ─── Sub-header: Notes / Description ───
  descriptionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    marginBottom: 5,
    gap: 6,
  },
  descriptionLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  descriptionValue: {
    fontSize: 7.5,
    color: "#374151",
  },

  // ─── Items Table ───
  table: {
    borderWidth: 1,
    borderColor: "#4B5563",
    marginBottom: 5,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#4B5563",
    minHeight: 24,
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6.2,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 20,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#FAFAFA",
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenterText: {
    fontSize: 6.8,
    color: "#111827",
    textAlign: "center",
  },
  tdCenterBoldText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  tdUnitText: {
    fontSize: 5.8,
    color: "#4B5563",
    textAlign: "center",
  },
  tdRightText: {
    fontSize: 6.8,
    color: "#111827",
    textAlign: "right",
  },
  tdRightBoldText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  tdVatRateText: {
    fontSize: 5.8,
    color: "#6B7280",
    textAlign: "center",
  },
  subCalcBlock: {
    marginTop: 1,
  },
  tdSubCalcText: {
    fontSize: 5.5,
    color: "#4B5563",
    textAlign: "center",
  },

  // ─── Tafqeet Strip ───
  tafqeetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#9CA3AF",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    marginBottom: 5,
    gap: 6,
  },
  tafqeetTextWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  tafqeetText: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "right",
  },
  tafqeetCurrencyBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  tafqeetCurrencyText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
  },
  tafqeetAmountBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    minWidth: 60,
    alignItems: "center",
  },
  tafqeetAmountText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "center",
  },

  // ─── Summary & Totals ───
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#4B5563",
    marginBottom: 5,
  },
  totalQtyBlock: {
    width: "28%",
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    backgroundColor: "#FAFAFA",
  },
  totalQtyLabel: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 3,
  },
  totalQtyValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2563EB",
    textAlign: "center",
  },

  totalsTableBlock: {
    width: "72%",
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  totalsFinalRow: {
    backgroundColor: "#F9FAFB",
    paddingVertical: 2.5,
  },
  totalsLabel: {
    fontSize: 6.8,
    color: "#111827",
    textAlign: "right",
  },
  totalsFinalLabel: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  taxLabelRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  taxRedText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  totalsVal: {
    fontSize: 7.2,
    color: "#111827",
    textAlign: "left",
  },
  totalsFinalVal: {
    fontSize: 8.2,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "left",
  },

  // ─── Terms & Conditions ───
  termsRow: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FAFAFA",
    padding: 4,
    marginBottom: 4,
  },
  termsLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    marginBottom: 2,
  },
  termsValue: {
    fontSize: 6.8,
    color: "#374151",
    textAlign: "right",
  },

  // ─── Footer ───
  footerWrap: {
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 3,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.8,
    color: "#6B7280",
    textAlign: "center",
  },
});
