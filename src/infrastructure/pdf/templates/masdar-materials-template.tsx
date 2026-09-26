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

export interface MasdarBuildingMaterialsTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
  withTerms?: boolean;
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
 * Strict date formatting: DD/MM/YYYY only — NO hours, minutes, seconds, or timestamp.
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

// ─── Arabic Tafqeet (Spelled-out currency words) ───
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
  if (num === 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

export function MasdarBuildingMaterialsTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  withTerms,
}: MasdarBuildingMaterialsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const effectiveWithTerms = withTerms !== undefined ? withTerms : !template?.id?.includes("no_terms");

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);

  // Address lines for company
  const companyAddressParts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : "",
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressStr = companyAddressParts.join(" - ");

  // Address lines for customer
  const customerAddressParts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : "",
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict,
    customer.addressCity,
  ].filter(Boolean);
  const customerAddressStr = customerAddressParts.join(" - ");

  const customerUnified = customer.unifiedNumber || "";

  // Items & Calculations
  const items = invoice.items || [];
  const rawSubtotal = items.reduce((acc, it) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    return acc + q * p;
  }, 0);

  const totalLineDiscounts = items.reduce((acc, it) => {
    const d = Number(it.discountAmount || (it as any).discount || 0);
    return acc + d;
  }, 0);

  const invoiceDiscountTotal = Number((invoice as any).discountTotal || (invoice as any).discount || 0);
  const discountTotal = invoiceDiscountTotal > 0 ? invoiceDiscountTotal : totalLineDiscounts;

  const grossSubtotal = Number(invoice.subtotal || rawSubtotal);
  const taxableAmount = Math.max(0, grossSubtotal - (discountTotal > 0 ? discountTotal : 0));
  const vatTotal = Number(invoice.vatAmount || 0);
  const grandTotal = Number(invoice.total || (taxableAmount + vatTotal));

  const tafqeetText = tafqeet(grandTotal);

  // ─── Single-Page Guarantee: Dynamic Height Calculation ───
  // Standard A4 is 842 pt, Letter is 792 pt.
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * 26;
  if (invoice.notes && invoice.notes.length > 50) extraContentHeight += 20;
  if (company.footerText) extraContentHeight += 16;
  const page1Height = Math.max(basePageHeight, basePageHeight + extraContentHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      {/* ─── PAGE 1: INVOICE MAIN ─── */}
      <Page size={[pageWidth, page1Height]} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── TOP HEADER ─── */}
        <View style={styles.topHeaderWrap}>
          {/* Left: Logo & Company Identification */}
          <View style={styles.headerLeft}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.companyLogo} />
            ) : null}
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}

            {/* CR & VAT row */}
            {company.crNumber || company.vatNumber ? (
              <View style={styles.crVatBox}>
                <Text style={styles.crVatText}>
                  {company.crNumber ? `س.ت C.R. ${company.crNumber}` : ""}
                  {company.crNumber && company.vatNumber ? " | " : ""}
                  {company.vatNumber ? `الرقم الضريبي VAT ${company.vatNumber}` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Middle: Title & Address */}
          <View style={styles.headerCenter}>
            {companyAddressStr ? (
              <Text style={styles.branchAddressText}>{companyAddressStr}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.branchPhoneText}>الهاتف: {company.phone}</Text>
            ) : null}
            {company.email ? (
              <Text style={styles.branchPhoneText}>{company.email}</Text>
            ) : null}

            <View style={styles.titleBox}>
              <Text style={styles.titleAr}>فاتورة ضريبية</Text>
              <Text style={styles.titleEn}>TAX INVOICE</Text>
            </View>
          </View>

          {/* Right: Big ZATCA QR Code */}
          <View style={styles.headerRight}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrCodeImage} />
            ) : null}
          </View>
        </View>

        {/* ─── METADATA GRID BOX ─── */}
        <View style={styles.metaGrid}>
          {/* Row 1: Issue Date, Unified/CR No, Invoice Number */}
          <View style={styles.gridRow}>
            {/* Col 1: Issue Date (DD/MM/YYYY only) */}
            <View style={[styles.gridCell, { width: "32%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderAr}>تاريخ الفاتورة</Text>
                <Text style={styles.cellHeaderEn}>INVOICE DATE</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValBold}>{issueDateStr || "—"}</Text>
              </View>
            </View>

            {/* Col 2: Repurposed shop/branch cell: Unified No. / CR */}
            <View style={[styles.gridCell, { width: "32%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderAr}>الرقم الموحد / س.ت</Text>
                <Text style={styles.cellHeaderEn}>UNIFIED NO. / C.R.</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValBold}>
                  {company.crNumber || (company as any).unifiedNumber || "—"}
                </Text>
              </View>
            </View>

            {/* Col 3: Invoice Number */}
            <View style={[styles.gridCell, { width: "36%", borderRightWidth: 0 }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderAr}>رقم الفاتورة</Text>
                <Text style={styles.cellHeaderEn}>INVOICE NUMBER</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValBold}>{invoiceNum || "—"}</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Customer Box (Left) & Seller Registration / Supply Box (Right) */}
          <View style={styles.gridRow}>
            {/* Customer Box */}
            <View style={[styles.gridCell, { width: "50%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderAr}>بيانات العميل</Text>
                <Text style={styles.cellHeaderEn}>CUSTOMER DETAILS</Text>
              </View>
              <View style={styles.customerInnerBox}>
                {customer.nameAr ? (
                  <Text style={styles.customerNameText}>{customer.nameAr}</Text>
                ) : null}
                {customer.nameEn ? (
                  <Text style={styles.customerNameEn}>{customer.nameEn}</Text>
                ) : null}

                {/* Strict BiDi middle-colon rule */}
                {customer.vatNumber ? (
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.metaLabel}>الرقم الضريبي</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{customer.vatNumber}</Text>
                  </View>
                ) : null}

                {customerUnified ? (
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.metaLabel}>الرقم الموحد / س.ت</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{customerUnified}</Text>
                  </View>
                ) : null}

                {customerAddressStr ? (
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.metaLabel}>العنوان</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{customerAddressStr}</Text>
                  </View>
                ) : null}

                {customer.phone ? (
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.metaLabel}>الهاتف</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{customer.phone}</Text>
                  </View>
                ) : null}

                {customer.email ? (
                  <View style={styles.bidiRowReverse}>
                    <Text style={styles.metaLabel}>البريد</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{customer.email}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Repurposed Salesperson & Logistics cell: Seller Tax & Supply Place */}
            <View style={[styles.gridCell, { width: "50%", borderRightWidth: 0 }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderAr}>بيانات المنشأة الضريبية</Text>
                <Text style={styles.cellHeaderEn}>SELLER TAX & REGISTRATION</Text>
              </View>
              <View style={styles.customerInnerBox}>
                <View style={styles.bidiRowReverse}>
                  <Text style={styles.metaLabel}>الرقم الضريبي للمنشأة</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>{company.vatNumber || "—"}</Text>
                </View>
                <View style={styles.bidiRowReverse}>
                  <Text style={styles.metaLabel}>السجل التجاري / الرقم الموحد</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>
                    {company.crNumber || (company as any).unifiedNumber || "—"}
                  </Text>
                </View>
              </View>

              {/* Place of Supply & City */}
              <View
                style={[
                  styles.cellHeaderRow,
                  {
                    borderTopWidth: 0.5,
                    borderTopColor: "#000000",
                    marginTop: 4,
                    paddingTop: 2,
                  },
                ]}
              >
                <Text style={styles.cellHeaderAr}>مكان التوريد والمدينة</Text>
                <Text style={styles.cellHeaderEn}>PLACE OF SUPPLY & CITY</Text>
              </View>
              <View style={styles.customerInnerBox}>
                <View style={styles.bidiRowReverse}>
                  <Text style={styles.metaLabel}>المدينة / المركز</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>
                    {company.addressCity || "المملكة العربية السعودية"}
                  </Text>
                </View>
                <View style={styles.bidiRowReverse}>
                  <Text style={styles.metaLabel}>الدولة</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>
                    {"المملكة العربية السعودية" +
                      (company.addressPostalCode
                        ? ` (الرمز: ${company.addressPostalCode})`
                        : "")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── ITEMS TABLE ─── */}
        <View style={styles.tableWrap}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Description: 35% */}
            <View style={[styles.thCell, { width: "35%" }]}>
              <Text style={styles.thTextAr}>البيــــان</Text>
              <Text style={styles.thTextEn}>Description</Text>
            </View>
            {/* 2. Qty: 9% */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Qty</Text>
            </View>
            {/* 3. Unit Price: 11% */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thTextAr}>سعر الوحدة</Text>
              <Text style={styles.thTextEn}>Unit Price</Text>
            </View>
            {/* 4. Taxable Amt: 14% */}
            <View style={[styles.thCell, { width: "14%" }]}>
              <Text style={styles.thTextAr}>المبلغ الخاضع</Text>
              <Text style={styles.thTextEn}>Taxable Amt</Text>
            </View>
            {/* 5. Tax Rate: 9% */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextAr}>نسبة الضريبة</Text>
              <Text style={styles.thTextEn}>Tax Rate</Text>
            </View>
            {/* 6. Tax Amount: 10% */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>مبلغ الضريبة</Text>
              <Text style={styles.thTextEn}>Tax Amount</Text>
            </View>
            {/* 7. Total Inc VAT: 12% */}
            <View style={[styles.thCell, { width: "12%", borderRightWidth: 0 }]}>
              <Text style={styles.thTextAr}>المجموع شامل</Text>
              <Text style={styles.thTextEn}>Subtotal Inc VAT</Text>
            </View>
          </View>

          {/* Table Rows */}
          {items.map((item, idx) => {
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || 0);
            const grossLine = qty * unitPrice;
            const itemDiscount = Number(item.discountAmount || (item as any).discount || 0);
            const netTaxable = Math.max(0, grossLine - itemDiscount);
            const vatRate = item.vatRate !== undefined && item.vatRate !== null ? Number(item.vatRate) : 15;
            const ratePercent = Math.round(vatRate > 1 ? vatRate : vatRate * 100);
            const lineVat =
              item.lineVat !== undefined && item.lineVat !== null
                ? Number(item.lineVat)
                : (netTaxable * ratePercent) / 100;
            const lineTotal =
              item.lineTotal !== undefined && item.lineTotal !== null
                ? Number(item.lineTotal)
                : netTaxable + lineVat;

            return (
              <View key={item.position ?? idx} style={styles.tableRow}>
                {/* Description */}
                <View style={[styles.tdCell, { width: "35%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDescAr}>{item.description}</Text>
                </View>
                {/* Qty */}
                <View style={[styles.tdCell, { width: "9%", alignItems: "center" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(qty)}</Text>
                </View>
                {/* Unit Price */}
                <View style={[styles.tdCell, { width: "11%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatExactAmount(unitPrice)}</Text>
                </View>
                {/* Taxable Amount & Discount Breakdown */}
                <View style={[styles.tdCell, { width: "14%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatExactAmount(netTaxable)}</Text>
                  {itemDiscount > 0 ? (
                    <Text style={styles.tdDiscountHint}>
                      قبل: {formatExactAmount(grossLine)} | خصم: {formatExactAmount(itemDiscount)}
                    </Text>
                  ) : null}
                </View>
                {/* Tax Rate */}
                <View style={[styles.tdCell, { width: "9%", alignItems: "center" }]}>
                  <Text style={styles.tdCenter}>{ratePercent}%</Text>
                </View>
                {/* Tax Amount */}
                <View style={[styles.tdCell, { width: "10%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatExactAmount(lineVat)}</Text>
                </View>
                {/* Subtotal Inc VAT */}
                <View style={[styles.tdCell, { width: "12%", borderRightWidth: 0, alignItems: "flex-end" }]}>
                  <Text style={[styles.tdNum, { fontWeight: "bold" }]}>{formatExactAmount(lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── SUMMARY & SIGNATURES BLOCK ─── */}
        <View style={styles.summaryContainer}>
          {/* Left Block: Signatures (Clean text placeholders, NO images) */}
          <View style={styles.signaturesBlock}>
            <View style={styles.sigRow}>
              <Text style={styles.sigLabelAr}>أعدها</Text>
              <Text style={styles.sigLabelEn}>Prepared By</Text>
              <Text style={styles.sigVal}></Text>
            </View>
            <View style={styles.sigRow}>
              <Text style={styles.sigLabelAr}>اعتمدها</Text>
              <Text style={styles.sigLabelEn}>Approved By</Text>
              <Text style={styles.sigVal}></Text>
            </View>
            <View style={[styles.sigRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.sigLabelAr}>المستلم</Text>
              <Text style={styles.sigLabelEn}>Received By</Text>
              <Text style={styles.sigVal}></Text>
            </View>
          </View>

          {/* Middle: Remarks & Exact Tafqeet */}
          <View style={styles.remarksBlock}>
            <View style={styles.remarksHeader}>
              <Text style={styles.remarksHeaderAr}>ملاحظات الفاتورة</Text>
              <Text style={styles.remarksHeaderEn}>Remarks & Notes</Text>
            </View>
            <Text style={styles.remarksContent}>{invoice.notes || "لا توجد ملاحظات إضافية"}</Text>

            {/* Exact Tafqeet */}
            <View style={styles.tafqeetBox}>
              <Text style={styles.tafqeetTitle}>المبلغ المستحق كتابة / Amount in Words</Text>
              <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
            </View>
          </View>

          {/* Right: Totals Table */}
          <View style={styles.totalsBlock}>
            {/* 1. Gross Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>الإجمالي قبل الخصم / Gross Subtotal</Text>
              <Text style={styles.totalValue}>{formatExactAmount(grossSubtotal)}</Text>
            </View>
            {/* 2. Total Discount */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: discountTotal > 0 ? "#E11D48" : "#000000" }]}>
                إجمالي الخصم / Total Discount
              </Text>
              <Text style={[styles.totalValue, { color: discountTotal > 0 ? "#E11D48" : "#000000" }]}>
                {formatExactAmount(discountTotal)}
              </Text>
            </View>
            {/* 3. Taxable Amount */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>المبلغ الخاضع للضريبة / Taxable Amount</Text>
              <Text style={styles.totalValue}>{formatExactAmount(taxableAmount)}</Text>
            </View>
            {/* 4. VAT (15%) */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>ضريبة القيمة المضافة / VAT (15%)</Text>
              <Text style={styles.totalValue}>{formatExactAmount(vatTotal)}</Text>
            </View>
            {/* 5. Total Inc VAT */}
            <View style={[styles.totalRow, { backgroundColor: "#F1F5F9" }]}>
              <Text style={[styles.totalLabel, { fontWeight: "bold", color: "#1E3A8A" }]}>
                الإجمالي شامل الضريبة / Total Inc. VAT
              </Text>
              <Text style={[styles.totalValue, { fontWeight: "bold", color: "#1E3A8A" }]}>
                {formatExactAmount(grandTotal)}
              </Text>
            </View>
            {/* 6. Invoice Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>المبلغ المدفوع / Invoice Paid</Text>
              <Text style={styles.totalValue}>{formatExactAmount(grandTotal)}</Text>
            </View>
            {/* 7. Balance Due */}
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.totalLabel, { fontWeight: "bold" }]}>الرصيد المستحق / Balance Due</Text>
              <Text style={[styles.totalValue, { fontWeight: "bold" }]}>0.00</Text>
            </View>
          </View>
        </View>

        {/* Footer Notes & Page indicator */}
        <View style={styles.footerNoteRow}>
          <Text style={styles.footerItemCount}>عدد الأصناف / Total Items: {items.length}</Text>
          {company.footerText ? (
            <Text style={styles.footerCustomText}>{company.footerText}</Text>
          ) : null}
          <Text style={styles.footerEoE}>E & OE الخطأ والسهو مستثناه</Text>
        </View>
        <Text style={styles.pageEndMarker}>
          {effectiveWithTerms
            ? "---------------PAGE 1/2 END---------------"
            : "---------------PAGE 1/1 END---------------"}
        </Text>
      </Page>

      {/* ─── PAGE 2: TERMS & CONDITIONS (OPTIONAL) ─── */}
      {effectiveWithTerms ? (
        <Page size={paperSize as any} orientation="portrait" style={styles.page}>
          <View style={styles.termsHeader}>
            <Text style={styles.termsCompanyEn}>{company.nameEn || company.nameAr || ""}</Text>
            <Text style={styles.termsTitleEn}>Return and Exchange Policy - Terms & Conditions</Text>
          </View>

          <View style={styles.termsEnList}>
            <Text style={styles.termsItem}>1. Customer must present the original invoice.</Text>
            <Text style={styles.termsItem}>2. Merchandise must be in its original packing, and in a saleable condition.</Text>
            <Text style={styles.termsItem}>3. Customer may return merchandise for a full refund within 7 days of purchase date.</Text>
            <Text style={styles.termsItem}>4. Customer may return merchandise for exchange within a maximum period of 14 days of purchase date.</Text>
            <Text style={styles.termsItem}>5. Any materials fabricated, cut or sliced in special length, width, or using special specifications (non-standard) for special customer use will not be accepted.</Text>
            <Text style={styles.termsItem}>6. The customer shall bear the costs of transportation from their location to the company showroom / warehouse.</Text>
            <Text style={styles.termsItem}>7. Merchandise used or damaged after purchase will not be accepted.</Text>
            <Text style={styles.termsItem}>8. The company reserves all rights to accept or not accept any merchandise in other conditions or circumstances not mentioned above.</Text>
          </View>

          <View style={styles.termsHeaderArWrap}>
            <Text style={styles.termsCompanyAr}>{company.nameAr || ""}</Text>
            <Text style={styles.termsTitleAr}>سياسة الاسترجاع والاستبدال - الشروط والأحكام</Text>
          </View>

          <View style={styles.termsArList}>
            <Text style={styles.termsItemAr}>١. يجب على العميل تقديم أصل الفاتورة.</Text>
            <Text style={styles.termsItemAr}>٢. يجب أن تكون البضائع في عبوتها الأصلية وتغليفها السليم وفي حالة قابلة للبيع.</Text>
            <Text style={styles.termsItemAr}>٣. يجوز للعميل إرجاع البضاعة واسترداد قيمتها كاملة خلال ٧ أيام من تاريخ الشراء.</Text>
            <Text style={styles.termsItemAr}>٤. يجوز للعميل إرجاع البضاعة للاستبدال في مدة أقصاها ١٤ يوماً من تاريخ الشراء.</Text>
            <Text style={styles.termsItemAr}>٥. لن يتم قبول أي مواد تم تصنيعها أو قصها أو تقطيعها بمقاسات أو مواصفات خاصة بطلب العميل.</Text>
            <Text style={styles.termsItemAr}>٦. يتحمل العميل تكاليف الشحن والنقل من موقعه لمعرض أو مستودع الشركة.</Text>
            <Text style={styles.termsItemAr}>٧. لن يتم قبول البضائع المستخدمة أو التالفة بعد استلامها.</Text>
            <Text style={styles.termsItemAr}>٨. تحتفظ الشركة بكافة الحقوق في قبول أو عدم قبول أي بضاعة في حالات أو ظروف أخرى غير مذكورة أعلاه.</Text>
          </View>

          {invoice.terms ? (
            <View style={styles.customTermsBox}>
              <Text style={styles.customTermsTitle}>شروط إضافية خاصة بالفاتورة / Additional Terms</Text>
              <Text style={styles.customTermsText}>{invoice.terms}</Text>
            </View>
          ) : null}

          <Text style={styles.pageEndMarker}>---------------PAGE 2/2 END---------------</Text>
        </Page>
      ) : null}
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 7.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header ───
  topHeaderWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    width: "42%",
  },
  companyLogo: {
    width: 140,
    height: 48,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "left",
    marginBottom: 2,
  },
  crVatBox: {
    marginTop: 2,
  },
  crVatText: {
    fontSize: 6.5,
    color: "#334155",
  },
  headerCenter: {
    width: "30%",
    alignItems: "center",
    paddingTop: 4,
  },
  branchAddressText: {
    fontSize: 6.5,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 1,
  },
  branchPhoneText: {
    fontSize: 6.5,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 2,
  },
  titleBox: {
    alignItems: "center",
    marginTop: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#1E3A8A",
    borderRadius: 2,
    backgroundColor: "#F8FAFC",
  },
  titleAr: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  titleEn: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#E11D48",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  headerRight: {
    width: "25%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  qrCodeImage: {
    width: 130,
    height: 130,
    objectFit: "contain",
  },
  qrCodePlaceholder: {
    width: 130,
    height: 130,
    objectFit: "contain",
  },

  // ─── Metadata Grid ───
  metaGrid: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 3,
  },
  cellHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  cellHeaderEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  cellHeaderAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#0F172A",
  },
  cellValRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 12,
  },
  cellValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  customerInnerBox: {
    marginTop: 1,
  },
  customerNameText: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
    color: "#0F172A",
    marginBottom: 1,
  },
  customerNameEn: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "left",
    color: "#1E3A8A",
    marginBottom: 2,
  },

  // BiDi Middle-Colon Row
  bidiRowReverse: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 1.5,
  },
  metaLabel: {
    fontSize: 6.5,
    color: "#334155",
  },
  metaColon: {
    fontSize: 6.5,
    color: "#334155",
    marginHorizontal: 2,
  },
  metaValue: {
    fontSize: 6.5,
    color: "#0F172A",
    fontWeight: "bold",
  },

  // ─── Table ───
  tableWrap: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 6,
    fontWeight: "bold",
    textAlign: "center",
    color: "#0F172A",
  },
  thTextEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1E3A8A",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    minHeight: 18,
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 2.5,
    justifyContent: "center",
  },
  tdDescAr: {
    fontSize: 6.5,
    textAlign: "right",
    color: "#0F172A",
  },
  tdCenter: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#000000",
  },
  tdNum: {
    fontSize: 6.5,
    textAlign: "right",
    color: "#000000",
  },
  tdDiscountHint: {
    fontSize: 5,
    color: "#E11D48",
    textAlign: "right",
    marginTop: 1,
  },

  // ─── Summary Section ───
  summaryContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 6,
  },
  signaturesBlock: {
    width: "28%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  sigRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    padding: 3,
    minHeight: 20,
  },
  sigLabelAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#0F172A",
  },
  sigLabelEn: {
    fontSize: 5.5,
    color: "#64748B",
  },
  sigVal: {
    fontSize: 6,
  },
  remarksBlock: {
    width: "36%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 3,
  },
  remarksHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 2,
    marginBottom: 2,
  },
  remarksHeaderAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#0F172A",
  },
  remarksHeaderEn: {
    fontSize: 5.5,
    color: "#1E3A8A",
  },
  remarksContent: {
    fontSize: 6.5,
    color: "#1E293B",
    marginBottom: 4,
  },
  tafqeetBox: {
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
  },
  tafqeetTitle: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 1,
    textAlign: "right",
  },
  tafqeetValue: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
    lineHeight: 1.3,
  },
  totalsBlock: {
    width: "36%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontSize: 6,
    color: "#000000",
  },
  totalValue: {
    fontSize: 6.5,
    color: "#000000",
  },

  // ─── Footer Notes ───
  footerNoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: "#000000",
    padding: 3,
  },
  footerItemCount: {
    fontSize: 6.5,
    color: "#0F172A",
  },
  footerCustomText: {
    fontSize: 6.5,
    color: "#475569",
  },
  footerEoE: {
    fontSize: 6.5,
    color: "#0F172A",
  },
  pageEndMarker: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#64748B",
    marginTop: 2,
  },

  // ─── Terms & Conditions (Page 2) ───
  termsHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  termsCompanyEn: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1E3A8A",
    marginBottom: 3,
  },
  termsTitleEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#E11D48",
    textAlign: "center",
  },
  termsEnList: {
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  termsItem: {
    fontSize: 7.5,
    lineHeight: 1.4,
    marginBottom: 3,
    color: "#1E293B",
  },
  termsHeaderArWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  termsCompanyAr: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    color: "#0F172A",
    marginBottom: 3,
  },
  termsTitleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#E11D48",
    textAlign: "center",
  },
  termsArList: {
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  termsItemAr: {
    fontSize: 7.5,
    lineHeight: 1.5,
    marginBottom: 3,
    color: "#1E293B",
    textAlign: "right",
  },
  customTermsBox: {
    marginTop: 8,
    padding: 6,
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  customTermsTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 2,
    textAlign: "right",
  },
  customTermsText: {
    fontSize: 7,
    color: "#334155",
    textAlign: "right",
    lineHeight: 1.4,
  },
});
