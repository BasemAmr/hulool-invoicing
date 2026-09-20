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

export interface Template7AlsahahProps {
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
const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
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
 * Preserves the exact raw decimal tail and formats integer part with thousands separators.
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

export function Template7Alsahah({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template7AlsahahProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // Dynamic Company Info
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as any).unifiedNumber || "";
  const companySub = company.footerText || "";
  const companyAddressParts = [
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressStreet || "",
    company.addressCity || "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
  ].filter(Boolean);
  const companyAddressAr = companyAddressParts.join(" - ");

  // Dynamic Customer Info
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCr = customer.unifiedNumber || (customer as any).crNumber || (customer as any).customerCode || (customer as any).code || "";
  const customerAddressParts = [
    (customer as any).addressDistrict ? `حي ${(customer as any).addressDistrict}` : "",
    customer.addressStreet || "",
    customer.addressCity || "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
  ].filter(Boolean);
  const customerAddress = customerAddressParts.length > 0 ? customerAddressParts.join(" - ") : "المملكة العربية السعودية";
  const customerContact = [customer.phone, customer.email].filter(Boolean).join(" | ");

  // Dynamic Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const invoiceIssueDate = formatDate(invoice.issueDate);
  const invoiceNotes = invoice.notes || "";
  const invoiceTerms = invoice.terms || "";
  const invAny = invoice as any;

  // Items processing with exact discount logic
  const items: InvoiceItemDto[] = invoice.items ?? [];
  const processedRows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawDiscount = toNumber((item as any).discount ?? (item as any).discountAmount ?? 0);
    const grossTotal = qty * unitPrice;
    const taxableSubtotal = Math.max(0, grossTotal - rawDiscount);
    const vatRate = toNumber(item.vatRate) || 15;
    const vatAmount = toNumber(item.lineVat) || (taxableSubtotal * vatRate) / 100;
    const lineTotalWithVat = toNumber(item.lineTotal) || taxableSubtotal + vatAmount;

    return {
      sNo: idx + 1,
      description: item.description || "",
      productSubtitle: (item as any).descriptionAr || (item as any).notes || "",
      qty,
      unitPrice,
      rawDiscount,
      taxableSubtotal,
      vatRate,
      vatAmount,
      lineTotalWithVat,
      grossTotal,
    };
  });

  const totalQuantitySum = processedRows.reduce((sum, r) => sum + r.qty, 0);

  // Totals calculations
  const calculatedGrossSubtotal = processedRows.reduce((sum, r) => sum + r.grossTotal, 0);
  const calculatedLineDiscounts = processedRows.reduce((sum, r) => sum + r.rawDiscount, 0);
  const invoiceDiscount = toNumber(invAny.discountTotal ?? 0);
  const totalDiscounts = calculatedLineDiscounts + invoiceDiscount;
  const calculatedTaxable = processedRows.reduce((sum, r) => sum + r.taxableSubtotal, 0);
  const calculatedVat = processedRows.reduce((sum, r) => sum + r.vatAmount, 0);
  const calculatedGrandTotal = calculatedTaxable + calculatedVat;

  const grossSubtotal = toNumber(invoice.subtotal) || calculatedGrossSubtotal;
  const taxableAmount = toNumber(invAny.taxableAmount) || Math.max(0, grossSubtotal - totalDiscounts);
  const vatTotal = toNumber(invAny.vatTotal ?? invoice.vatAmount) || calculatedVat;
  const grandTotal = toNumber(invAny.grandTotal ?? invoice.total) || calculatedGrandTotal;
  const tafqeetText = tafqeet(grandTotal);

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoiceNotes)
    extraContentHeight += 24 + Math.min(invoiceNotes.split("\n").length, 4) * 10;
  if (invoiceTerms)
    extraContentHeight += 24 + Math.min(invoiceTerms.split("\n").length, 4) * 10;
  if (company.footerText) extraContentHeight += 18;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;
  const watermarkSource = backgroundDataUrl || logoSource;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={companyNameAr || "شركة الصحاح العالمية"}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Centered subtle watermark (never stretched across full page) */}
        {watermarkSource ? (
          <Image src={watermarkSource} style={styles.watermarkImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION ─── */}
        <View style={styles.headerContainer}>
          {/* Company Branding (RTL right-to-left layout) */}
          <View style={styles.headerCompanyInfo}>
            <Text style={styles.companyNameArText}>{companyNameAr || "شركة الصحاح العالمية للتجارة المحدودة"}</Text>
            {companyNameEn ? <Text style={styles.companyNameEnText}>{companyNameEn}</Text> : null}
            {companyAddressAr ? <Text style={styles.companySubText}>{companyAddressAr}</Text> : null}
            {companySub ? <Text style={styles.companySubText}>{companySub}</Text> : null}
          </View>

          {/* Logo Unit (Left side): ONLY render if real logo is provided, NEVER render fake dummy graphics */}
          <View style={styles.logoUnit}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 2. HORIZONTAL BANNER STRIP (VAT / TAX INVOICE / CR) ─── */}
        <View style={styles.bannerRow}>
          {/* Left: VAT NO Box */}
          <View style={styles.vatBox}>
            <Text style={styles.vatText}>
              VAT NO.  {companyVat || "—"}  الرقم الضريبي
            </Text>
          </View>

          {/* Center: Clear Tax Invoice Box */}
          <View style={styles.invoiceTitleBox}>
            <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
            <Text style={styles.invoiceTitleEn}>TAX INVOICE</Text>
          </View>

          {/* Right: Commercial Registration / Unified Number */}
          <View style={styles.crBox}>
            <Text style={styles.crValue}>{companyCr || "—"}</Text>
            <Text style={styles.crLabel}>س.ت / الرقم الموحد</Text>
          </View>
        </View>

        {/* ─── 3. CUSTOMER & METADATA SECTION ─── */}
        <View style={styles.custMetaContainer}>
          {/* Left Block: Official ZATCA 2D QR Code + Customer Information Table */}
          <View style={styles.customerBlock}>
            {qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image src={qrDataUrl} style={styles.qrImage} />
              </View>
            ) : (
              <View style={styles.qrPlaceholder} />
            )}

            <View style={styles.customerTable}>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>Customer</Text>
                <Text style={styles.custValue}>{customerName || "عميل نقدي"}</Text>
                <Text style={styles.custLabelAr}>اسم العميل</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>VAT Number</Text>
                <Text style={styles.custValue}>{customerVat || "—"}</Text>
                <Text style={styles.custLabelAr}>الرقم الضريبي</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>Address</Text>
                <Text style={styles.custValue}>{customerAddress}</Text>
                <Text style={styles.custLabelAr}>العنوان الوطني</Text>
              </View>
              <View style={[styles.custRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.custLabelEn}>Contact</Text>
                <Text style={styles.custValue}>{customerContact || "—"}</Text>
                <Text style={styles.custLabelAr}>الهاتف / البريد</Text>
              </View>
            </View>
          </View>

          {/* Right Block: 6-Cell Metadata Grid */}
          <View style={styles.metaGridBlock}>
            {/* Top Row: Customer CR / Unified No. - City - Customer Mobile */}
            <View style={styles.metaGridRow}>
              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>الرقم الموحد / س.ت</Text>
                  <Text style={styles.metaHeaderEn}>Customer CR / Unified</Text>
                </View>
                <Text style={styles.metaValueText}>{customerCr || "—"}</Text>
              </View>

              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>المدينة</Text>
                  <Text style={styles.metaHeaderEn}>Customer City</Text>
                </View>
                <Text style={styles.metaValueText}>{customer.addressCity || "—"}</Text>
              </View>

              <View style={[styles.metaCell, { borderRightWidth: 0 }]}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>جوال العميل</Text>
                  <Text style={styles.metaHeaderEn}>Customer Mobile</Text>
                </View>
                <Text style={styles.metaValueText}>{customer.phone || "—"}</Text>
              </View>
            </View>

            {/* Bottom Row: Document Status - Issue Date (DD/MM/YYYY ONLY) - Invoice No */}
            <View style={[styles.metaGridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>حالة الفاتورة</Text>
                  <Text style={styles.metaHeaderEn}>Invoice Status</Text>
                </View>
                <Text style={styles.metaValueTextBold}>معتمدة / Valid</Text>
              </View>

              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>تاريخ الإصدار</Text>
                  <Text style={styles.metaHeaderEn}>Issue Date</Text>
                </View>
                <Text style={styles.metaValueText}>{invoiceIssueDate}</Text>
              </View>

              <View style={[styles.metaCell, { borderRightWidth: 0 }]}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>رقم الفاتورة</Text>
                  <Text style={styles.metaHeaderEn}>Invoice No.</Text>
                </View>
                <Text style={styles.metaValueTextBold}>{invoiceNumber}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 4. PRODUCTS DATA TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row: Aligned with no item code/unit columns */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "4%" }]}>
              <Text style={styles.thAr}>م</Text>
              <Text style={styles.thEn}>S.N.</Text>
            </View>
            <View style={[styles.thCell, { width: "31%" }]}>
              <Text style={styles.thAr}>البيان والخدمة</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Discount</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>المبلغ الخاضع</Text>
              <Text style={styles.thEn}>Taxable Amt</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT %</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>مبلغ الضريبة</Text>
              <Text style={styles.thEn}>VAT Amt</Text>
            </View>
            <View style={[styles.thCell, { width: "10%", borderRightWidth: 0 }]}>
              <Text style={styles.thAr}>الإجمالي شامل</Text>
              <Text style={styles.thEn}>Total (Inc. VAT)</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {processedRows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0, justifyContent: "center" }]}>
                <Text style={[styles.tdText, { textAlign: "center", color: "#666666" }]}>
                  لا توجد عناصر مسجلة بالفاتورة
                </Text>
              </View>
            </View>
          ) : (
            processedRows.map((r, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "4%" }]}>
                  <Text style={styles.tdTextCenter}>{r.sNo}</Text>
                </View>
                <View style={[styles.tdCell, { width: "31%", alignItems: "flex-end", paddingRight: 4 }]}>
                  <Text style={styles.tdTextRightBold}>{r.description}</Text>
                  {r.productSubtitle ? (
                    <Text style={styles.tdProductSub}>{r.productSubtitle}</Text>
                  ) : null}
                  {r.rawDiscount > 0 ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        خصم: {formatExactAmount(r.rawDiscount)} ر.س (الأصل: {formatExactAmount(r.grossTotal)})
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{formatQty(r.qty)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(r.unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdTextCenter}>
                    {r.rawDiscount > 0 ? formatExactAmount(r.rawDiscount) : "0.00"}
                  </Text>
                </View>
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(r.taxableSubtotal)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{r.vatRate}%</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(r.vatAmount)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextCenterBold}>{formatExactAmount(r.lineTotalWithVat)}</Text>
                </View>
              </View>
            ))
          )}

          {/* Table Summary Line for Total Qty */}
          <View style={styles.tableSummaryRow}>
            <View style={[styles.tdCell, { width: "35%", borderRightWidth: 0, justifyContent: "center" }]}>
              <Text style={styles.tableSummaryLabel}>مجموع الكميات / Total Quantity</Text>
            </View>
            <View style={[styles.tdCell, { width: "8%", justifyContent: "center" }]}>
              <Text style={styles.tdTextCenterBold}>{formatQty(totalQuantitySum)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "57%", borderRightWidth: 0 }]} />
          </View>
        </View>

        {/* ─── 5. TAFQEET SPELLED-OUT WORDS BANNER ─── */}
        <View style={styles.tafqeetBanner}>
          <View style={styles.tafqeetDiamond}>
            <Text style={styles.tafqeetDiamondChar}>❖</Text>
          </View>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة:</Text>
          <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
        </View>

        {/* ─── 6. SUMMARY & TOTALS SECTION ─── */}
        <View style={styles.bottomSection}>
          {/* Left Block: Notes, Terms, and Company Footer Note */}
          <View style={styles.leftInfoBlock}>
            {invoiceNotes ? (
              <View style={styles.noteSection}>
                <View style={styles.noteHeaderWrap}>
                  <Text style={styles.noteDiamond}>◆</Text>
                  <Text style={styles.noteHeaderTitle}>الملاحظات / Notes</Text>
                </View>
                <Text style={styles.noteContentText}>{invoiceNotes}</Text>
              </View>
            ) : null}

            {invoiceTerms ? (
              <View style={styles.noteSection}>
                <View style={styles.noteHeaderWrap}>
                  <Text style={styles.noteDiamond}>◆</Text>
                  <Text style={styles.noteHeaderTitle}>الشروط والأحكام / Terms & Conditions</Text>
                </View>
                <Text style={styles.noteContentText}>{invoiceTerms}</Text>
              </View>
            ) : null}

            {company.footerText ? (
              <View style={styles.noteSection}>
                <Text style={styles.footerNoteText}>{company.footerText}</Text>
              </View>
            ) : null}

            <View style={styles.guaranteeNoteWrap}>
              <Text style={styles.guaranteeNoteText}>
                الشركة غير مسؤولة عن النقص وتبديل المكسور خلال يومين من استلام البضاعة
              </Text>
            </View>
          </View>

          {/* Right Block: Comprehensive Stacked Totals Box */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalLbl}>الإجمالي غير شامل الضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(totalDiscounts)}</Text>
              <Text style={styles.totalLbl}>مجموع الخصومات</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(taxableAmount)}</Text>
              <Text style={styles.totalLbl}>الإجمالي الخاضع للضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatExactAmount(vatTotal)}</Text>
              <Text style={styles.totalLbl}>ضريبة القيمة المضافة 15%</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalVal}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.grandTotalLbl}>المجموع الكلي شامل الضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.paidVal}>{formatExactAmount(grandTotal)}</Text>
              <Text style={styles.totalLbl}>المبلغ المدفوع</Text>
            </View>
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.balanceDueVal}>0.00</Text>
              <Text style={styles.totalLbl}>المبلغ المتبقي</Text>
            </View>
          </View>
        </View>

        {/* ─── 7. FOOTER ─── */}
        <View style={styles.footerContainer}>
          <Text style={styles.pageNumberText}>صفحة 1 من 1</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLESHEET (Preserves authentic Al-Sahah Navy & Cyan Identity) ───
const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    fontSize: 7.5,
    color: "#000000",
    position: "relative",
  },
  watermarkImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // 1. Header
  headerContainer: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  headerCompanyInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 10,
  },
  companyNameArText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEnText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0284C7",
    textAlign: "right",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  companySubText: {
    fontSize: 7,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.2,
  },
  logoUnit: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 90,
    height: 50,
    objectFit: "contain",
  },

  // 2. Banner Row
  bannerRow: {
    flexDirection: "row",
    height: 24,
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  vatBox: {
    width: "42%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 4,
  },
  vatText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  invoiceTitleBox: {
    width: "26%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    backgroundColor: "#1E3A8A",
  },
  invoiceTitleAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  invoiceTitleEn: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#E0F2FE",
    letterSpacing: 0.5,
  },
  crBox: {
    width: "32%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 6,
    backgroundColor: "#F9FAFB",
  },
  crValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  crLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E3A8A",
  },

  // 3. Customer & Metadata Container
  custMetaContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
    minHeight: 70,
  },
  customerBlock: {
    width: "55%",
    flexDirection: "row",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  qrWrapper: {
    width: 68,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
    backgroundColor: "#FFFFFF",
  },
  qrImage: {
    width: 62,
    height: 62,
  },
  qrPlaceholder: {
    width: 68,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    backgroundColor: "#F9FAFB",
  },
  customerTable: {
    flex: 1,
  },
  custRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    alignItems: "center",
    height: 17.5,
    paddingHorizontal: 4,
  },
  custLabelEn: {
    width: "28%",
    fontSize: 6,
    fontWeight: "bold",
    color: "#4B5563",
    textAlign: "left",
  },
  custValue: {
    width: "48%",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  custLabelAr: {
    width: "24%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },

  // Metadata Grid Block
  metaGridBlock: {
    width: "45%",
  },
  metaGridRow: {
    flexDirection: "row",
    height: 35,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
  },
  metaCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    backgroundColor: "#FFFFFF",
  },
  metaHeaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  metaHeaderAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  metaHeaderEn: {
    fontSize: 5,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 1,
  },
  metaValueText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  metaValueTextBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0F2942",
    textAlign: "center",
  },

  // 4. Main Table
  tableContainer: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#1E3A8A",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 22,
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5,
    color: "#E0F2FE",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    minHeight: 16,
    alignItems: "center",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#CBD5E1",
    justifyContent: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    height: "100%",
  },
  tdText: {
    fontSize: 6.5,
    color: "#000000",
  },
  tdTextCenter: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  tdTextCenterBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tdTextRightBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },
  tdProductSub: {
    fontSize: 5.5,
    color: "#6B7280",
    textAlign: "right",
  },
  discountBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 0.5,
    borderColor: "#93C5FD",
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: 1,
  },
  discountBadgeText: {
    fontSize: 5,
    color: "#1D4ED8",
    textAlign: "right",
  },
  tableSummaryRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 16,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
  },
  tableSummaryLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },

  // 5. Tafqeet Banner
  tafqeetBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#0284C7",
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
    gap: 4,
  },
  tafqeetDiamond: {
    justifyContent: "center",
    alignItems: "center",
  },
  tafqeetDiamondChar: {
    color: "#0284C7",
    fontSize: 8,
    fontWeight: "bold",
  },
  tafqeetLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  tafqeetValue: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#0F172A",
    flex: 1,
    textAlign: "right",
  },

  // 6. Summary & Totals Section
  bottomSection: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
    minHeight: 95,
  },
  leftInfoBlock: {
    width: "60%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 6,
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
  },
  noteSection: {
    marginBottom: 3,
  },
  noteHeaderWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginBottom: 1,
  },
  noteDiamond: {
    fontSize: 5,
    color: "#0284C7",
  },
  noteHeaderTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  noteContentText: {
    fontSize: 6,
    color: "#374151",
    textAlign: "right",
    lineHeight: 1.2,
  },
  footerNoteText: {
    fontSize: 6,
    color: "#1E3A8A",
    textAlign: "right",
  },
  guaranteeNoteWrap: {
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 2,
    marginTop: 2,
  },
  guaranteeNoteText: {
    fontSize: 5.5,
    color: "#6B7280",
    textAlign: "center",
  },

  // Stacked Totals Block
  totalsBlock: {
    width: "40%",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    height: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
  },
  totalLbl: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  totalVal: {
    fontSize: 6.5,
    color: "#000000",
  },
  grandTotalRow: {
    backgroundColor: "#1E3A8A",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    height: 17,
  },
  grandTotalLbl: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  grandTotalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  paidVal: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#15803D",
  },
  balanceDueVal: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // 7. Footer
  footerContainer: {
    alignItems: "center",
    marginTop: 2,
  },
  pageNumberText: {
    fontSize: 6.5,
    color: "#64748B",
    fontWeight: "bold",
  },
});
