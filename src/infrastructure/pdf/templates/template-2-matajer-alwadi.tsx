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

export interface Template2MatajerAlwadiProps {
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

// ─── Optional extension interfaces (typesafe, non-breaking fallbacks) ───

interface ExtendedInvoice {
  discountTotal?: string | number | null;
  discount?: string | number | null;
  discountAmount?: string | number | null;
  totalQty?: string | number | null;
}

interface ExtendedCustomer {
  customerNumber?: string | number | null;
  code?: string | number | null;
  custCode?: string | number | null;
  clientNo?: string | number | null;
  crNumber?: string | null;
  addressDistrict?: string | null;
  addressBuildingNumber?: string | null;
  addressAdditionalNumber?: string | null;
}

interface ExtendedItem {
  discount?: string | number | null;
  taxRate?: string | number | null;
  descriptionEn?: string | null;
  nameEn?: string | null;
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

function formatQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const parts = str.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
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

function getCompanyAddress(company: CompanyRecord): string {
  const parts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : null,
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : null,
    company.addressStreet,
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressDistrict,
    company.addressCity,
  ].filter(Boolean);
  return parts.join(" - ");
}

function getCustomerAddress(customer: CustomerRecord): string {
  const ext = customer as CustomerRecord & ExtendedCustomer;
  const parts = [
    ext.addressAdditionalNumber ? `الرقم الإضافي: ${ext.addressAdditionalNumber}` : null,
    ext.addressPostalCode || customer.addressPostalCode ? `الرمز البريدي: ${ext.addressPostalCode || customer.addressPostalCode}` : null,
    customer.addressStreet,
    ext.addressBuildingNumber ? `مبنى ${ext.addressBuildingNumber}` : null,
    ext.addressDistrict,
    customer.addressCity,
  ].filter(Boolean);
  return parts.join(" - ");
}

// ─── Arabic Tafqeet (Spelled-out Amount) ───

const ARABIC_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const ARABIC_TEENS = [
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
const ARABIC_TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const ARABIC_HUNDREDS = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertThreeDigits(n: number): string {
  if (n <= 0) return "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0 && ARABIC_HUNDREDS[h]) {
    parts.push(ARABIC_HUNDREDS[h]);
  }
  if (rem > 0) {
    if (rem < 10) {
      if (ARABIC_ONES[rem]) parts.push(ARABIC_ONES[rem]);
    } else if (rem < 20) {
      const teen = ARABIC_TEENS[rem - 10];
      if (teen) parts.push(teen);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const tensLabel = ARABIC_TENS[t];
      if (u > 0 && ARABIC_ONES[u]) {
        parts.push(`${ARABIC_ONES[u]} و${tensLabel}`);
      } else if (tensLabel) {
        parts.push(tensLabel);
      }
    }
  }
  return parts.join(" و");
}

function numberToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(`${convertThreeDigits(millions)} ملايين`);
    else parts.push(`${convertThreeDigits(millions)} مليون`);
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertThreeDigits(thousands)} آلاف`);
    else parts.push(`${convertThreeDigits(thousands)} ألف`);
  }
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }
  return parts.join(" و ");
}

function tafqeet(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (num <= 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و" + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Main Template Component ───

export function Template2MatajerAlwadi({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template2MatajerAlwadiProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const extInv = invoice as InvoiceDto & ExtendedInvoice;
  const extCust = customer as CustomerRecord & ExtendedCustomer;

  // Invoice metadata
  const invoiceNum = toText(invoice.invoiceNumber);
  const issueDateFormatted = formatDate(invoice.issueDate);

  // Customer metadata
  const customerName = toText(customer.nameAr || customer.nameEn);
  const customerVat = toText(customer.vatNumber);
  const customerUnifiedOrCr = toText(
    customer.unifiedNumber ?? extCust.crNumber ?? extCust.custCode ?? extCust.customerNumber ?? extCust.code ?? extCust.clientNo ?? ""
  );
  const customerAddress = getCustomerAddress(customer);
  const customerPhone = toText(customer.phone);
  const customerEmail = toText(customer.email);

  // Company metadata
  const companyNameAr = toText(company.nameAr);
  const companyNameEn = toText(company.nameEn);
  const companyVat = toText(company.vatNumber);
  const companyCr = toText(company.crNumber);
  const companyWebsite = toText(company.website);
  const companyAddress = getCompanyAddress(company);

  // Items processing with exact math
  const items = invoice.items || [];
  let computedSubtotal = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;
  let totalQtyCount = 0;

  const rows = items.map((item, idx) => {
    const extItem = item as InvoiceItemDto & ExtendedItem;
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const lineDiscount = toNumber(item.discountAmount ?? extItem.discount ?? 0);
    const rawSubtotal = qty * unitPrice;
    const taxableSubtotal = Math.max(0, rawSubtotal - lineDiscount);

    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null
        ? toNumber(item.vatRate)
        : extItem.taxRate !== undefined && extItem.taxRate !== null
        ? toNumber(extItem.taxRate)
        : 15;

    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : (taxableSubtotal * vatRate) / 100;

    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedSubtotal += rawSubtotal;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;
    totalQtyCount += qty;

    const descAr = toText(item.description);
    const descEn = toText(extItem.descriptionEn ?? extItem.nameEn ?? "");

    return {
      key: item.position ?? idx,
      index: idx + 1,
      descAr,
      descEn,
      qty,
      unitPrice,
      lineDiscount,
      rawSubtotal,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const displayTotalQty = extInv.totalQty ? toNumber(extInv.totalQty) : totalQtyCount;

  // Master totals calculation
  const subtotalVal = invoice.subtotal !== undefined && invoice.subtotal !== null ? toNumber(invoice.subtotal) : computedSubtotal;
  const headerDiscount = toNumber(extInv.discountTotal ?? extInv.discount ?? extInv.discountAmount ?? 0);
  const totalDiscountVal = headerDiscount > 0 ? headerDiscount : computedDiscount;
  const taxableSubtotalVal = Math.max(0, subtotalVal - totalDiscountVal);
  const vatVal = invoice.vatAmount !== undefined && invoice.vatAmount !== null ? toNumber(invoice.vatAmount) : computedVat;
  const totalVal = invoice.total !== undefined && invoice.total !== null ? toNumber(invoice.total) : taxableSubtotalVal + vatVal;

  const firstItemVatRate = rows.find((r) => r.vatRate !== undefined)?.vatRate ?? 15;
  const vatRatePercentage = `${firstItemVatRate}%`;

  const tafqeetText = tafqeet(totalVal);

  // ─── Strict Single-Page Dynamic Height Guarantee ───
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const itemRowHeight = 24;
  const extraItemsCount = Math.max(0, rows.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes) {
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  }
  if (invoice.terms) {
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  }
  if (company.footerText) {
    extraContentHeight += 18;
  }
  if (customerPhone || customerEmail) {
    extraContentHeight += 20;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr || "متاجر الوادي"}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ENCLOSURE ─── */}
        <View style={styles.headerContainer}>
          {/* Header Top Row: Logo (Left), QR Code (Center), Company Names & Details (Right) */}
          <View style={styles.headerTopRow}>
            {/* Left: Brand Logo & Website (Strictly no placeholder if absent) */}
            <View style={styles.headerLeftLogoCol}>
              {logoSource ? (
                <Image src={logoSource} style={styles.logoImage} />
              ) : null}
              {companyWebsite ? (
                <Text style={styles.headerWebsiteText}>{companyWebsite}</Text>
              ) : null}
            </View>

            {/* Center: Official ZATCA QR Code */}
            <View style={styles.headerCenterQrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.headerQrImage} />
              ) : null}
            </View>

            {/* Right: Company Names (Arabic on top, English underneath) & Address/Contact */}
            <View style={styles.headerRightInfoCol}>
              <Text style={styles.companyNameArText}>
                {companyNameAr}
              </Text>
              {companyNameEn ? (
                <Text style={styles.companyNameEnText}>
                  {companyNameEn}
                </Text>
              ) : null}
              {companyAddress ? (
                <Text style={styles.companyMetaText}>
                  {companyAddress}
                </Text>
              ) : null}
              {company.phone || company.email ? (
                <Text style={styles.companyMetaText}>
                  {[company.phone, company.email].filter(Boolean).join(" | ")}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Double Decorative Bar: Dark Green and Light Green Lines */}
          <View style={styles.decorativeBarWrap}>
            <View style={styles.decorativeLineDark} />
            <View style={styles.decorativeLineGreen} />
          </View>

          {/* Metadata Row: Company CR and VAT Number with 3-element middle-colon pattern */}
          <View style={styles.headerVatRow}>
            {companyCr ? (
              <View style={styles.metaBadgeGroup}>
                <Text style={styles.metaLabel}>السجل التجاري</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaValue}>{companyCr}</Text>
              </View>
            ) : null}
            <View style={styles.metaBadgeGroup}>
              <Text style={styles.metaLabel}>الرقم الضريبي</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.vatNumberValue}>{companyVat}</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. INFO PANEL (Bilingual Labels, Split Columns) ─── */}
        <View style={styles.infoPanelContainer}>
          {/* Row 1: Left (INV. No) | Center (Clear Title Badge: فاتورة ضريبية) | Right (Issue Date DD/MM/YYYY) */}
          <View style={styles.infoPanelRow}>
            {/* Left Cell: Invoice Number */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{invoiceNum}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>INV. No</Text>
                <Text style={styles.infoLabelAr}>رقم الفاتورة</Text>
              </View>
            </View>

            {/* Center Cell: "فاتورة ضريبية" badge (payment method removed completely) */}
            <View style={styles.infoCellCenter}>
              <Text style={styles.invoiceTitleBadge}>فاتورة ضريبية</Text>
            </View>

            {/* Right Cell: Date (Issue Date ONLY DD/MM/YYYY) */}
            <View style={styles.infoCellRight}>
              <Text style={styles.infoValueText}>{issueDateFormatted}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Date</Text>
                <Text style={styles.infoLabelAr}>تاريخ الفاتورة</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Left (Cust. Unified / CR) | Right (Cust. Name) */}
          <View style={styles.infoPanelRow}>
            {/* Left Cell: Customer Unified / CR */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{customerUnifiedOrCr || "-"}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Cust. ID / CR</Text>
                <Text style={styles.infoLabelAr}>الرقم الموحد / السجل</Text>
              </View>
            </View>

            {/* Right Cell: Customer Name */}
            <View style={styles.infoCellCustomerSpan}>
              <Text style={[styles.infoValueText, styles.customerNameVal]}>
                {customerName || "-"}
              </Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Cust. Name</Text>
                <Text style={styles.infoLabelAr}>اسم العميل</Text>
              </View>
            </View>
          </View>

          {/* Row 3: Left (Customer VAT No) | Right (Customer Address) */}
          <View style={[styles.infoPanelRow, !customerPhone && !customerEmail ? styles.infoPanelLastRow : {}]}>
            {/* Left Cell: Customer VAT No */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{customerVat || "-"}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>VAT No</Text>
                <Text style={styles.infoLabelAr}>الرقم الضريبي للعميل</Text>
              </View>
            </View>

            {/* Right Cell: Customer Address */}
            <View style={styles.infoCellCustomerSpan}>
              <Text style={styles.infoValueText}>{customerAddress || "-"}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Address</Text>
                <Text style={styles.infoLabelAr}>العنوان</Text>
              </View>
            </View>
          </View>

          {/* Row 4 (Optional): Left (Customer Phone) | Right (Customer Email) */}
          {customerPhone || customerEmail ? (
            <View style={[styles.infoPanelRow, styles.infoPanelLastRow]}>
              <View style={styles.infoCellLeft}>
                <Text style={styles.infoValueText}>{customerPhone || "-"}</Text>
                <View style={styles.infoLabelGroup}>
                  <Text style={styles.infoLabelEn}>Phone</Text>
                  <Text style={styles.infoLabelAr}>الهاتف</Text>
                </View>
              </View>
              <View style={styles.infoCellCustomerSpan}>
                <Text style={styles.infoValueText}>{customerEmail || "-"}</Text>
                <View style={styles.infoLabelGroup}>
                  <Text style={styles.infoLabelEn}>Email</Text>
                  <Text style={styles.infoLabelAr}>البريد الإلكتروني</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* ─── 3. ITEMS DATA TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header (RTL Order: Right to Left) */}
          <View style={styles.tableHeaderRow}>
            {/* Leftmost (7): Total Inc VAT */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thText}>المجموع شامل الضريبة</Text>
            </View>
            {/* (6): VAT Amount */}
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thText}>مبلغ الضريبة</Text>
            </View>
            {/* (5): VAT Rate */}
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thText}>نسبة الضريبة</Text>
            </View>
            {/* (4): Unit Price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>
            {/* (3): Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            {/* (2): Description / البيان */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thText}>البيـــــــــان</Text>
            </View>
            {/* Rightmost (1): Sequence # (tinted light green header) */}
            <View style={[styles.thCell, styles.colIndex, styles.thIndex]}>
              <Text style={styles.thText}>م</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          <View style={styles.tableBody}>
            {rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                {/* Total Inc VAT */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={styles.tdNumberBold}>
                    {formatExactAmount(row.lineTotal)}
                  </Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, styles.colVat]}>
                  <Text style={styles.tdNumber}>
                    {formatExactAmount(row.lineVat)}
                  </Text>
                </View>

                {/* VAT Rate */}
                <View style={[styles.tdCell, styles.colVatRate]}>
                  <Text style={styles.tdCenterText}>{row.vatRate}%</Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdNumber}>
                    {formatExactAmount(row.unitPrice)}
                  </Text>
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdNumberBold}>
                    {formatQty(row.qty)}
                  </Text>
                </View>

                {/* Description: Arabic on top, English underneath, discount badge if present */}
                <View style={[styles.tdCell, styles.colDesc, styles.tdDescCell]}>
                  <Text style={styles.itemDescAr}>{row.descAr}</Text>
                  {row.descEn ? (
                    <Text style={styles.itemDescEn}>{row.descEn}</Text>
                  ) : null}
                  {row.lineDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.rawSubtotal)} | بعد: {formatExactAmount(row.taxableSubtotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Sequence #: Distinct light green shaded tint */}
                <View style={[styles.tdCell, styles.colIndex, styles.tdIndexTint]}>
                  <Text style={styles.indexText}>{row.index}</Text>
                </View>
              </View>
            ))}

            {/* Empty fallback row if no items present */}
            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, styles.colTotal]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colVat]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colVatRate]}><Text style={styles.tdCenterText}>15%</Text></View>
                <View style={[styles.tdCell, styles.colPrice]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colQty]}><Text style={styles.tdCenterText}>0</Text></View>
                <View style={[styles.tdCell, styles.colDesc]}><Text style={styles.tdCenterText}>لا توجد عناصر</Text></View>
                <View style={[styles.tdCell, styles.colIndex, styles.tdIndexTint]}><Text style={styles.tdCenterText}>-</Text></View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 4. TOTALS & SUMMARY SECTION ─── */}
        <View style={styles.bottomSectionContainer}>
          {/* Boxed Totals Container */}
          <View style={styles.totalsBoxContainer}>
            {/* Totals Row 1: Subtotal Excl. VAT (Left) & Total Qty (Right) */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValueBold}>
                  {formatExactAmount(subtotalVal)}
                </Text>
                <Text style={styles.totalsLabel}>المجموع غير شامل الضريبة</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsValueBold}>
                  {formatQty(displayTotalQty)}
                </Text>
                <Text style={styles.totalsLabel}>إجمالي الكمية</Text>
              </View>
            </View>

            {/* Totals Row 2: Discount (Left) & Taxable Amount (Right) */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>
                  {formatExactAmount(totalDiscountVal)}
                </Text>
                <Text style={styles.totalsLabel}>إجمالي الخصم</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsValue}>
                  {formatExactAmount(taxableSubtotalVal)}
                </Text>
                <Text style={styles.totalsLabel}>المبلغ الخاضع للضريبة</Text>
              </View>
            </View>

            {/* Totals Row 3: VAT Tax Amount (Left) & Invoice Paid (Right) */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>
                  {formatExactAmount(vatVal)}
                </Text>
                <Text style={styles.totalsLabel}>ضريبة القيمة المضافة ({vatRatePercentage})</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsValueBold}>
                  {formatExactAmount(totalVal)}
                </Text>
                <Text style={styles.totalsLabel}>المبلغ المدفوع</Text>
              </View>
            </View>

            {/* Totals Row 4: Balance Due (Left) & Payment Status (Right) */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>0.00 SAR</Text>
                <Text style={styles.totalsLabel}>المبلغ المستحق</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsStatusText}>تم الدفع بالكامل . المحصلة</Text>
              </View>
            </View>

            {/* Totals Row 5: Net Invoice Total & Spelled-out Arabic Words */}
            <View style={[styles.totalsRow, styles.totalsFinalRow]}>
              {/* Left: Net Invoice Total */}
              <View style={styles.totalsCellLeft}>
                <Text style={styles.netTotalValueBold}>
                  {formatExactAmount(totalVal)}
                </Text>
                <Text style={styles.netTotalLabelBold}>صافي الفاتورة شامل الضريبة</Text>
              </View>

              {/* Right: Amount in Words */}
              <View style={styles.totalsCellRightWords}>
                <Text style={styles.amountWordsText}>{tafqeetText}</Text>
                <Text style={styles.currencyBadge}>SAR</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 5. NOTES, TERMS & FOOTER ─── */}
        {invoice.notes ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesHeading}>ملاحظات</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.terms ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesHeading}>الشروط والأحكام</Text>
            <Text style={styles.notesText}>{invoice.terms}</Text>
          </View>
        ) : null}

        {company.footerText ? (
          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ─── Stylesheet ───

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontSize: 7.5,
    color: "#000000",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header Enclosure ───
  headerContainer: {
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  // Header Left (Logo & brand)
  headerLeftLogoCol: {
    width: "28%",
    alignItems: "flex-start",
  },
  logoImage: {
    width: 90,
    height: 48,
    objectFit: "contain",
  },
  headerWebsiteText: {
    fontSize: 6.5,
    color: "#4B5563",
    marginTop: 2,
  },
  // Header Center (QR Code)
  headerCenterQrCol: {
    width: "22%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerQrImage: {
    width: 52,
    height: 52,
  },
  // Header Right (Company names & metadata)
  headerRightInfoCol: {
    width: "50%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  companyNameArText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEnText: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companyMetaText: {
    fontSize: 6.5,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.2,
  },
  // Decorative lines
  decorativeBarWrap: {
    width: "100%",
    marginBottom: 4,
  },
  decorativeLineDark: {
    height: 2,
    backgroundColor: "#164E2E",
    width: "100%",
    marginBottom: 1,
  },
  decorativeLineGreen: {
    height: 1.5,
    backgroundColor: "#22C55E",
    width: "100%",
  },
  // Metadata Row under decorative lines (RTL 3-element pattern)
  headerVatRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  metaBadgeGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  metaColon: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    marginHorizontal: 2,
  },
  metaValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#164E2E",
  },
  vatNumberValue: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    letterSpacing: 0.5,
  },

  // ─── Info Panel ───
  infoPanelContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    borderRadius: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  infoPanelRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  infoPanelLastRow: {
    borderBottomWidth: 0,
  },
  infoCellLeft: {
    width: "36%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoCellCenter: {
    width: "18%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: "#F9FAFB",
  },
  infoCellRight: {
    width: "46%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoCellCustomerSpan: {
    width: "64%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabelEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#4B5563",
    marginRight: 3,
  },
  infoLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  infoValueText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    flex: 1,
    textAlign: "right",
    paddingRight: 4,
  },
  customerNameVal: {
    fontSize: 8,
  },
  invoiceTitleBadge: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#164E2E",
    textAlign: "center",
  },

  // ─── Data Table ───
  tableContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 19,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 1,
  },
  thText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thIndex: {
    backgroundColor: "#E6F4EA",
    borderRightWidth: 0,
  },
  tableBody: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#D1D5DB",
    minHeight: 22,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  tdDescCell: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 4,
  },
  tdIndexTint: {
    backgroundColor: "#E6F4EA",
    borderRightWidth: 0,
  },
  indexText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  itemDescAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  itemDescEn: {
    fontSize: 5.5,
    color: "#374151",
    textAlign: "right",
    marginTop: 1,
  },
  discountBadge: {
    marginTop: 1,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  discountBadgeText: {
    fontSize: 5.5,
    color: "#991B1B",
    textAlign: "right",
  },
  tdNumber: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdNumberBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (Sum = 100%)
  colTotal: { width: "14%" },
  colVat: { width: "12%" },
  colVatRate: { width: "10%" },
  colPrice: { width: "11%" },
  colQty: { width: "9%" },
  colDesc: { width: "38%" },
  colIndex: { width: "6%" },

  // ─── Totals Section ───
  bottomSectionContainer: {
    width: "100%",
    marginTop: 2,
  },
  totalsBoxContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    borderRadius: 4,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  totalsFinalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#FAFAFA",
    minHeight: 22,
  },
  totalsCellLeft: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsCellRight: {
    width: "52%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsCellRightWords: {
    width: "52%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsValue: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  totalsValueBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  totalsStatusText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#164E2E",
    textAlign: "center",
    width: "100%",
  },
  netTotalLabelBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  netTotalValueBold: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  amountWordsText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    flex: 1,
    paddingRight: 6,
  },
  currencyBadge: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Notes & Terms & Footer ───
  notesContainer: {
    marginTop: 4,
    padding: 4,
    borderWidth: 0.75,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
  },
  notesHeading: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#164E2E",
    textAlign: "right",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 6.5,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.3,
  },
  footerWrap: {
    marginTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: "#E5E7EB",
    paddingTop: 3,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#6B7280",
    textAlign: "center",
  },
});

