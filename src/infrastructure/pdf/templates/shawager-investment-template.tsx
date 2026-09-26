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

export interface ShawagerInvestmentTemplateProps {
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

// ─── Arabic Number Words (Tafqeet) ───
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

function tafqeetShawager(amount: number): string {
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " فقط لا غير";
}

/**
 * Full decimal precision formatter:
 * Preserves raw decimal values (e.g. 23.4646916641601264) without rounding, flooring, or ceiling.
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
 * Strict date formatting: DD/MM/YYYY only — NO time / hour / HHMMSS.
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

export function ShawagerInvestmentTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ShawagerInvestmentTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);

  // ─── Company Details ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as any).unifiedNumber || "";
  const companyWebsite = company.website || (company as any).webSite || "";
  const companyEmail = company.email || "";

  // Address per guidelines: (Additional No. - Postal Code - Street - Building No. - District - City - Country)
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : null,
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : null,
    company.addressStreet,
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  // ─── Customer Details ───
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerCrn = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerIdNumber = (customer as any).nationalId || (customer as any).idNumber || "";
  const customerEmail = customer.email || "";

  // Customer address per guidelines: (Additional No. - Postal Code - Street - Building No. - District - City - Country)
  const customerAddressParts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : null,
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
    customer.addressCity,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  // ─── Items & Calculations ───
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const rawSubtotalCalc = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );

  const discountVal =
    (invoice as any).discountTotal ??
    items.reduce((sum, item) => sum + Number(item.discountAmount || (item as any).discount || 0), 0);

  const grossSubtotal =
    Number(discountVal) > 0
      ? rawSubtotalCalc > 0
        ? rawSubtotalCalc
        : Number(invoice.subtotal || 0) + Number(discountVal)
      : Number(invoice.subtotal || 0);

  const taxableVal = invoice.subtotal ?? Math.max(0, grossSubtotal - Number(discountVal));
  const vatVal = invoice.vatAmount ?? items.reduce((sum, item) => sum + Number(item.lineVat || 0), 0);
  const totalVal = invoice.total ?? Number(taxableVal) + Number(vatVal);

  const tafqeetText = Number(totalVal) > 0 ? tafqeetShawager(Number(totalVal)) : "صفر ريال سعودي";

  // ─── Single-Page Height Calculation ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const extraItemsCount = Math.max(0, items.length - 2);
  let extraContentHeight = extraItemsCount * 22;

  if (invoice.notes) extraContentHeight += 24;
  if (invoice.terms) extraContentHeight += 24;
  if (company.footerText) extraContentHeight += 20;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="TAX INVOICE - فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={[pageWidth, dynamicHeight]} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: COMPANY DETAILS & LOGO ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column (English Details) */}
          <View style={styles.headerLeftCol}>
            {companyNameEn ? <Text style={styles.headerEnTitle}>{companyNameEn}</Text> : null}
            {companyWebsite ? <Text style={styles.headerEnText}>Website : {companyWebsite}</Text> : null}
            {companyEmail ? <Text style={styles.headerEnText}>E-mail : {companyEmail}</Text> : null}
            {companyCr ? <Text style={styles.headerEnText}>C.R. : {companyCr}</Text> : null}
            {companyAddress ? <Text style={styles.headerEnText}>Address : {companyAddress}</Text> : null}
          </View>

          {/* Center Column (Logo) */}
          <View style={styles.headerCenterLogo}>
            {logoDataUrl || company.logoUrl ? (
              <Image src={(logoDataUrl || company.logoUrl)!} style={styles.logoImage} />
            ) : null}
          </View>

          {/* Right Column (Arabic Details with proper middle colons) */}
          <View style={styles.headerRightCol}>
            <Text style={styles.headerArTitle}>{companyNameAr}</Text>
            {companyPhone ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyPhone}</Text>
                <Text style={styles.headerArColon}>:</Text>
                <Text style={styles.headerArKey}>هاتف</Text>
              </View>
            ) : null}
            {companyVat ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyVat}</Text>
                <Text style={styles.headerArColon}>:</Text>
                <Text style={styles.headerArKey}>الرقم الضريبي</Text>
              </View>
            ) : null}
            {companyCr ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyCr}</Text>
                <Text style={styles.headerArColon}>:</Text>
                <Text style={styles.headerArKey}>السجل التجاري / الموحد</Text>
              </View>
            ) : null}
            {companyAddress ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyAddress}</Text>
                <Text style={styles.headerArColon}>:</Text>
                <Text style={styles.headerArKey}>العنوان</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Dual Colored Divider: Blue on top of Lime Green ─── */}
        <View style={styles.dividerWrap}>
          <View style={styles.dividerBlue} />
          <View style={styles.dividerLime} />
        </View>

        {/* ─── 2. INVOICE TITLE: فاتورة ضريبية / Tax Invoice ─── */}
        <View style={styles.titleWrap}>
          <Text style={styles.titleText}>فاتورة ضريبية / Tax Invoice</Text>
          <View style={styles.titleUnderline} />
        </View>

        {/* ─── 3. METADATA GRID BOX (7 Rows, Maroon Borders & Blue Headers) ─── */}
        <View style={styles.metaGrid}>
          {/* Row 1 */}
          <View style={styles.gridRow}>
            {/* Left: Invoice Number */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valBold}>{invoiceNum}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>رقم الفاتورة</Text>
            </View>

            {/* Middle: Clean Total Display */}
            <View style={[styles.gridCell, { width: "40%", flexDirection: "row", justifyContent: "space-between" }]}>
              <Text style={styles.valBold}>{formatExactAmount(totalVal)} ريال</Text>
              <Text style={styles.valText}>
                {(invoice as any).quotationNumber || (invoice as any).quoteNo
                  ? `عرض أسعار: ${(invoice as any).quotationNumber || (invoice as any).quoteNo}`
                  : ""}
              </Text>
            </View>

            {/* Right: Repurposed Branch to Company CR */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{companyCr}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>السجل التجاري</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
            {/* Left: Issue Date (DD/MM/YYYY only, no time) */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{issueDateStr}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>تاريخ الفاتورة</Text>
            </View>

            {/* Middle: PO Reference or Clean */}
            <View style={[styles.gridCell, { width: "40%" }]}>
              <Text style={styles.valText}>
                {(invoice as any).purchaseOrderNumber || (invoice as any).poNumber
                  ? `أمر الشراء: ${(invoice as any).purchaseOrderNumber || (invoice as any).poNumber}`
                  : ""}
              </Text>
            </View>

            {/* Right: Repurposed Warehouse to Company City / District */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{company.addressCity || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>المدينة</Text>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.gridRow}>
            {/* Left: Repurposed Due Date to Standard Tax Invoice indicator */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>فاتورة ضريبية</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>نوع الفاتورة</Text>
            </View>

            {/* Middle: Empty space for clean structure */}
            <View style={[styles.gridCell, { width: "40%" }]}>
              <Text style={styles.valText}></Text>
            </View>

            {/* Right: Quote Number / Reference */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{(invoice as any).quotationNumber || (invoice as any).quoteNo || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>رقم العرض</Text>
            </View>
          </View>

          {/* Row 4 */}
          <View style={styles.gridRow}>
            {/* Left: Customer VAT Number */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{customerVat}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabel}>الرقم الضريبي</Text>
            </View>

            {/* Middle & Right: Customer Name (NO time) */}
            <View style={[styles.gridCell, { width: "65%", alignItems: "flex-end" }]}>
              <Text style={styles.valBold}>
                {[customerName, (customer as any).customerNumber || (customer as any).code].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>العميل</Text>
            </View>
          </View>

          {/* Row 5 */}
          <View style={styles.gridRow}>
            {/* Left: Customer Unified / CR Number */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{customerCrn}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabel}>الرقم الموحد / س.ت</Text>
            </View>

            {/* Middle & Right: Customer Address */}
            <View style={[styles.gridCell, { width: "65%", alignItems: "flex-end" }]}>
              <Text style={styles.valText}>{customerAddress || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>العنوان</Text>
            </View>
          </View>

          {/* Row 6 */}
          <View style={styles.gridRow}>
            {/* Left: Phone */}
            <View style={[styles.gridCell, { width: "27%", alignItems: "center" }]}>
              <Text style={styles.blueLabel}>{customerPhone ? `هاتف: ${customerPhone}` : "هاتف: -"}</Text>
            </View>

            {/* Middle: National ID / Email */}
            <View style={[styles.gridCell, { width: "65%", alignItems: "center" }]}>
              <Text style={styles.blueLabel}>
                {customerIdNumber
                  ? `رقم الهوية: ${customerIdNumber}`
                  : customerEmail
                  ? `البريد: ${customerEmail}`
                  : ""}
              </Text>
            </View>

            {/* Right: Receiver Label */}
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>بيانات التواصل</Text>
            </View>
          </View>

          {/* Row 7 (Last) */}
          <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.gridCell, { width: "92%" }]}>
              <Text style={styles.valText}>
                {(customer as any).accountNumber ? `رقم الحساب: ${(customer as any).accountNumber}` : invoice.notes || ""}
              </Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>الحساب / بيان</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (10 Columns, 100% Width, Full Precision, Clean Discount) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Subtotal Inc VAT */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>الإجمالي شامل الضريبة</Text>
            </View>

            {/* 2. VAT Amount */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>ضريبة القيمة</Text>
            </View>

            {/* 3. VAT Rate */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>نسبة الضريبة</Text>
            </View>

            {/* 4. Taxable Amount */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>المبلغ الخاضع للضريبة</Text>
            </View>

            {/* 5. Discount Amount */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>مبلغ الخصم</Text>
            </View>

            {/* 6. Discount % */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>نسبة الخصم</Text>
            </View>

            {/* 7. Unit Price */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>

            {/* 8. Quantity */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 9. Description */}
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thText}>اســــــم الـصــنـــف والبيان</Text>
            </View>

            {/* 10. Sequence */}
            <View style={[styles.thCell, { width: "4%", borderRightWidth: 0 }]}>
              <Text style={styles.thText}>م</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item, index) => {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const rawLineTotal = qty * unitPrice;
            const lineDiscount = Number(item.discountAmount || (item as any).discount || 0);
            const lineTaxable = Math.max(0, rawLineTotal - lineDiscount);
            const vatRate = item.vatRate !== undefined ? Number(item.vatRate) : 15;
            const lineVat = Number(item.lineVat ?? (lineTaxable * (vatRate / 100)));
            const lineTotal = Number(item.lineTotal ?? (lineTaxable + lineVat));

            return (
              <View key={item.position ?? index} style={styles.tableBodyRow}>
                {/* 1. Subtotal Inc VAT */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(lineTotal)}</Text>
                </View>

                {/* 2. VAT Amount */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(lineVat)}</Text>
                </View>

                {/* 3. VAT Rate */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{vatRate}%</Text>
                </View>

                {/* 4. Taxable Amount */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(lineTaxable)}</Text>
                </View>

                {/* 5. Discount Amount */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>
                    {lineDiscount > 0 ? formatExactAmount(lineDiscount) : "0"}
                  </Text>
                </View>

                {/* 6. Discount % */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>
                    {(item as any).discountPercent
                      ? `${formatExactAmount((item as any).discountPercent)}%`
                      : lineDiscount > 0 && rawLineTotal > 0
                      ? `${formatExactAmount((lineDiscount / rawLineTotal) * 100)}%`
                      : "0%"}
                  </Text>
                </View>

                {/* 7. Unit Price */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* 8. Quantity */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 9. Description */}
                <View style={[styles.tdCell, { width: "30%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDesc}>{item.description || ""}</Text>
                </View>

                {/* 10. Sequence */}
                <View style={[styles.tdCell, { width: "4%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION: TOTALS TABLE (LEFT) | QUANTITY (CENTER) | QR (RIGHT) ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Totals Table */}
          <View style={styles.totalsBox}>
            {/* Row 1: Subtotal Excl. VAT (before discount) */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsValBold}>{formatExactAmount(grossSubtotal)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>الإجمالي غير شامل الضريبة</Text>
              </View>
            </View>

            {/* Row 2: Discount */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsVal}>{formatExactAmount(discountVal)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>مجموع الخصومات</Text>
              </View>
            </View>

            {/* Row 3: Taxable Amount (after discount) */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsValBold}>{formatExactAmount(taxableVal)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>المبلغ الخاضع للضريبة</Text>
              </View>
            </View>

            {/* Row 4: VAT Amount */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%", flexDirection: "row", justifyContent: "space-between" }]}>
                <Text style={styles.totalsValBold}>{formatExactAmount(vatVal)}</Text>
                <Text style={styles.totalsValBold}>15%</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>ضريبة القيمة المضافة</Text>
              </View>
            </View>

            {/* Row 5: Net Total with VAT */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsValBold}>{formatExactAmount(totalVal)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>الإجمالي شامل الضريبة</Text>
              </View>
            </View>

            {/* Row 6: Invoice Paid */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsValBold}>{formatExactAmount(totalVal)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>المبلغ المدفوع</Text>
              </View>
            </View>

            {/* Row 7: Balance Due */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.totalsValCell, { width: "55%" }]}>
                <Text style={styles.totalsValBold}>0.00 ﷼</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "45%" }]}>
                <Text style={styles.totalsKey}>المبلغ المتبقي المستحق</Text>
              </View>
            </View>
          </View>

          {/* Center: Total Quantity Counter */}
          <View style={styles.qtyCounterBox}>
            <View style={styles.qtyCounterInner}>
              <Text style={styles.qtyCounterLabel}>إجمالي الكميات</Text>
              <Text style={styles.qtyCounterVal}>{formatExactAmount(totalQty)}</Text>
            </View>
          </View>

          {/* Right: ZATCA QR Code */}
          <View style={styles.qrBox}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 6. ARABIC TAFQEET SPELLED WORDS ─── */}
        <View style={styles.tafqeetRow}>
          <Text style={styles.tafqeetText}>المبلغ كتابة: {tafqeetText}</Text>
        </View>

        {/* ─── 7. OPTIONAL NOTES & TERMS ─── */}
        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>ملاحظات الفاتورة</Text>
            <Text style={styles.notesContent}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.terms ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>الشروط والأحكام</Text>
            <Text style={styles.notesContent}>{invoice.terms}</Text>
          </View>
        ) : null}

        {/* ─── 8. DOTTED SIGNATURE LINES ─── */}
        <View style={styles.signaturesRow}>
          {/* Seller Sig (Left) */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>البائع / المحاسب</Text>
            <Text style={styles.sigDottedLine}>................................................................</Text>
          </View>

          {/* Receiver Sig (Right) */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المستلم / المشتري</Text>
            <Text style={styles.sigDottedLine}>................................................................</Text>
          </View>
        </View>

        {/* ─── 9. FOOTER TEXT ─── */}
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
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header ───
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "35%",
    alignItems: "flex-start",
  },
  headerEnTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
  },
  headerEnText: {
    fontSize: 7,
    color: "#000000",
    lineHeight: 1.25,
  },

  headerCenterLogo: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 85,
    height: 45,
    objectFit: "contain",
  },
  logoDiamond: {
    width: 44,
    height: 30,
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },

  headerRightCol: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerArTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  headerArRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 1,
  },
  headerArKey: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  headerArColon: {
    fontSize: 7,
    color: "#000000",
    marginHorizontal: 2,
  },
  headerArVal: {
    fontSize: 7,
    color: "#000000",
  },

  // ─── Dual Divider ───
  dividerWrap: {
    width: "100%",
    marginBottom: 8,
  },
  dividerBlue: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1D4ED8",
  },
  dividerLime: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#84CC16",
    marginTop: 1,
  },

  // ─── Title ───
  titleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  titleUnderline: {
    width: 140,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    marginTop: 2,
  },

  // ─── Metadata Grid (Maroon borders #800000) ───
  metaGrid: {
    borderWidth: 1,
    borderColor: "#800000",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#800000",
    minHeight: 18,
    alignItems: "center",
  },
  gridCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center",
  },
  gridCellHeader: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  blueLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },
  blueLabelUnderline: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    textDecoration: "underline",
  },
  valText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  valBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Items Table (Maroon borders #800000) ───
  table: {
    borderWidth: 1,
    borderColor: "#800000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#800000",
    minHeight: 20,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#800000",
    minHeight: 18,
    alignItems: "center",
  },
  tdCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  tdDesc: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  totalsBox: {
    width: "42%",
    borderWidth: 1,
    borderColor: "#800000",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#800000",
    minHeight: 17,
    alignItems: "center",
  },
  totalsValCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  totalsKeyCell: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  totalsKey: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsVal: {
    fontSize: 7,
    color: "#000000",
    textAlign: "left",
  },
  totalsValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },

  qtyCounterBox: {
    width: "26%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  qtyCounterInner: {
    borderWidth: 1,
    borderColor: "#800000",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyCounterLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 2,
    textAlign: "center",
  },
  qtyCounterVal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  qrBox: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 128,
    height: 128,
  },

  // ─── Tafqeet ───
  tafqeetRow: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  tafqeetText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Notes & Terms ───
  notesBox: {
    borderWidth: 0.75,
    borderColor: "#800000",
    padding: 4,
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    marginBottom: 2,
  },
  notesContent: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 6,
  },
  sigBlock: {
    width: 150,
    alignItems: "center",
  },
  sigTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 4,
    textAlign: "center",
  },
  sigDottedLine: {
    fontSize: 7.5,
    color: "#94A3B8",
    textAlign: "center",
  },

  // ─── Footer ───
  footerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  footerText: {
    fontSize: 6.5,
    color: "#475569",
    textAlign: "center",
  },
});
