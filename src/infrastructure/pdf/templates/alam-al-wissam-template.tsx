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

export interface AlamAlWissamTemplateProps {
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

// ─── Arabic Tafqeet (Number to Words) ─────────────────────────────────────────

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
  if (num <= 0) return "صفر ريال سعودي";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text;
}

// ─── Number & Date Helpers ────────────────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  let str: string;
  if (typeof val === "number") {
    str = Number.isFinite(val) ? String(Number(val.toFixed(10))) : "0.00";
  } else {
    str = String(val).trim();
  }
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1];
  if (decPart === undefined) {
    decPart = "00";
  } else if (decPart.length === 1) {
    decPart = `${decPart}0`;
  }
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = `${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

function formatQty(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0";
  return num.toString();
}

function formatDateFormatted(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatDateTimeFormatted(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return "";
  const d = dateStr.slice(0, 10).split("-");
  const formattedDate = d && d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : dateStr;

  let timeFormatted = "";
  if (timeStr && timeStr.trim().length > 0) {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const mins = parts[1] || "00";
    const secs = parts[2] || "00";
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    timeFormatted = ` ${String(h12).padStart(2, "0")}:${mins}:${secs} ${ampm}`;
  }

  return `${formattedDate}${timeFormatted}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlamAlWissamTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: AlamAlWissamTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const pageSize = isLetter ? ("LETTER" as const) : ("A4" as const);

  const logoSource = logoDataUrl || company.logoUrl;

  // Invoice & Company Header details
  const companyNameAr = company.nameAr || "";
  const companyAddressHeader = [company.addressCity, company.addressDistrict, company.addressStreet]
    .filter(Boolean)
    .join(" - ");

  // Dates: explicitly as requested: Due Date = Invoice Date
  const issueDateFormatted = formatDateFormatted(invoice.issueDate);
  const issueDateTimeFormatted = formatDateTimeFormatted(invoice.issueDate, invoice.issueTime);
  const dueDateFormatted = issueDateFormatted; // due date = invoice date per instruction

  // Calculations
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;
  let totalQty = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate = item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;
    totalQty += qty;

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);
  const totalDiscountVal = computedDiscount + invoiceDiscount;

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const tafqeetText = tafqeet(grandTotal);

  // Common Header Renderer
  const renderHeader = (pageNumber: number) => (
    <View style={styles.headerContainer} wrap={false}>
      {/* 1. Left: Large ZATCA QR Code */}
      <View style={styles.qrCol}>
        {qrDataUrl ? (
          <Image src={qrDataUrl} style={styles.qrImage} />
        ) : (
          <View style={styles.qrPlaceholder}>
            <Text style={styles.draftText}>DRAFT</Text>
          </View>
        )}
      </View>

      {/* 2. Center: Logo, Page Indicator, Simple Tax Invoice Title */}
      <View style={styles.centerCol}>
        {logoSource ? (
          <Image src={logoSource} style={styles.logo} />
        ) : (
          <View style={styles.logoSpacer} />
        )}
        <View style={styles.pageNumberWrap}>
          <Text style={styles.pageText}>Page</Text>
          <Text style={styles.pageText}>{pageNumber} of 2</Text>
        </View>
        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerAr}>فاتورة ضريبية مبسطة</Text>
          <Text style={styles.titleBannerEn}>Simple Tax Invoice</Text>
        </View>
      </View>

      {/* 3. Right: Company Name & Bilingual Metadata Rows */}
      <View style={styles.rightCol}>
        {companyNameAr ? (
          <Text style={styles.companyNameAr}>{companyNameAr}</Text>
        ) : null}
        {companyAddressHeader ? (
          <Text style={styles.companyAddressText}>{companyAddressHeader}</Text>
        ) : null}

        <View style={styles.metaTable}>
          {/* Invoice Number */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaValueRed}>{invoice.invoiceNumber ?? ""}</Text>
            <Text style={styles.metaLabelGroup}>Invoice Number / رقم الفاتورة</Text>
          </View>
          {/* Invoice Date */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaValueText}>{issueDateTimeFormatted}</Text>
            <Text style={styles.metaLabelGroup}>Invoice Date / تاريخ الفاتورة</Text>
          </View>
          {/* Due Date = Invoice Date */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaValueText}>{dueDateFormatted}</Text>
            <Text style={styles.metaLabelGroup}>Due Date / تاريخ الإستحقاق</Text>
          </View>
          {/* Payment Method - Label only per prompt instruction */}
          <View style={styles.metaTableRow}>
            <Text style={styles.metaValueText}></Text>
            <Text style={styles.metaLabelGroup}>Payment Method / طريقة الدفع</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Common Seller & Buyer Dual Box Renderer
  const renderPartyBoxes = () => (
    <View style={styles.partyBoxesContainer} wrap={false}>
      {/* Seller Box (Left) */}
      <View style={styles.partyCard}>
        <View style={styles.partyCardHeader}>
          <Text style={styles.partyCardHeaderEn}>Seller :</Text>
          <Text style={styles.partyCardHeaderAr}>المورد :</Text>
        </View>
        <View style={styles.partyCardBody}>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Name :</Text>
            <Text style={[styles.partyCellVal, styles.bold]}>{company.nameAr || ""}</Text>
            <Text style={styles.partyCellAr}>الاسم :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Bulding :</Text>
            <Text style={styles.partyCellVal}>{company.addressBuildingNumber || ""}</Text>
            <Text style={styles.partyCellAr}>المبنى :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Street :</Text>
            <Text style={styles.partyCellVal}>{company.addressStreet || ""}</Text>
            <Text style={styles.partyCellAr}>الشارع :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>District :</Text>
            <Text style={styles.partyCellVal}>{company.addressDistrict || ""}</Text>
            <Text style={styles.partyCellAr}>الحي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>City :</Text>
            <Text style={styles.partyCellVal}>{company.addressCity || ""}</Text>
            <Text style={styles.partyCellAr}>المدينة :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Country :</Text>
            <Text style={styles.partyCellVal}>المملكة العربية السعودية</Text>
            <Text style={styles.partyCellAr}>الدولة :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Postal Code :</Text>
            <Text style={styles.partyCellVal}>{company.addressPostalCode || ""}</Text>
            <Text style={styles.partyCellAr}>الرمز البريدي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Additional No :</Text>
            <Text style={styles.partyCellVal}>{company.addressAdditionalNumber || ""}</Text>
            <Text style={styles.partyCellAr}>الرقم الإضافي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Vat No :</Text>
            <Text style={[styles.partyCellVal, styles.bold]}>{company.vatNumber || ""}</Text>
            <Text style={styles.partyCellAr}>الرقم الضريبي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>CRN :</Text>
            <Text style={styles.partyCellVal}>{company.crNumber || ""}</Text>
            <Text style={styles.partyCellAr}>السجل التجاري :</Text>
          </View>
          <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.partyCellEn}>Other ID :</Text>
            <Text style={styles.partyCellVal}></Text>
            <Text style={styles.partyCellAr}>معرف آخر :</Text>
          </View>
        </View>
      </View>

      {/* Buyer Box (Right) */}
      <View style={styles.partyCard}>
        <View style={styles.partyCardHeader}>
          <Text style={styles.partyCardHeaderEn}>Buyer :</Text>
          <Text style={styles.partyCardHeaderAr}>العميل :</Text>
        </View>
        <View style={styles.partyCardBody}>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Name :</Text>
            <Text style={[styles.partyCellVal, styles.bold]}>{customer.nameAr || customer.nameEn || ""}</Text>
            <Text style={styles.partyCellAr}>الاسم :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Bulding :</Text>
            <Text style={styles.partyCellVal}>{customer.addressBuildingNumber || ""}</Text>
            <Text style={styles.partyCellAr}>المبنى :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Street :</Text>
            <Text style={styles.partyCellVal}>{customer.addressStreet || "-"}</Text>
            <Text style={styles.partyCellAr}>الشارع :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>District :</Text>
            <Text style={styles.partyCellVal}>{customer.addressDistrict || ""}</Text>
            <Text style={styles.partyCellAr}>الحي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>City :</Text>
            <Text style={styles.partyCellVal}>{customer.addressCity || ""}</Text>
            <Text style={styles.partyCellAr}>المدينة :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Country :</Text>
            <Text style={styles.partyCellVal}>المملكة العربية السعودية</Text>
            <Text style={styles.partyCellAr}>الدولة :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Postal Code :</Text>
            <Text style={styles.partyCellVal}>{customer.addressPostalCode || ""}</Text>
            <Text style={styles.partyCellAr}>الرمز البريدي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Additional No :</Text>
            <Text style={styles.partyCellVal}>{customer.addressAdditionalNumber || ""}</Text>
            <Text style={styles.partyCellAr}>الرقم الإضافي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>Vat No :</Text>
            <Text style={[styles.partyCellVal, styles.bold]}>{customer.vatNumber || ""}</Text>
            <Text style={styles.partyCellAr}>الرقم الضريبي :</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyCellEn}>CRN :</Text>
            <Text style={styles.partyCellVal}>{customer.unifiedNumber || ""}</Text>
            <Text style={styles.partyCellAr}>السجل التجاري :</Text>
          </View>
          <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.partyCellEn}>Other ID :</Text>
            <Text style={styles.partyCellVal}></Text>
            <Text style={styles.partyCellAr}>معرف آخر :</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Common Description Strip
  const renderDescriptionStrip = () => (
    <View style={styles.descStrip} wrap={false}>
      <Text style={styles.descStripText}>Description / البيان</Text>
    </View>
  );

  // Common Signatures Renderer
  const renderSignatures = () => (
    <View style={styles.signaturesContainer} wrap={false}>
      <View style={styles.sealCol}>
        <View style={styles.signSpace} />
        <Text style={styles.signLabelUnderline}>The Seal / الختم</Text>
      </View>
      <View style={styles.signCol}>
        <View style={styles.signSpace}>
          {signatureDataUrl ? (
            <Image src={signatureDataUrl} style={styles.signatureImage} />
          ) : null}
        </View>
        <Text style={styles.signLabelUnderline}>Sign / التوقيع</Text>
      </View>
    </View>
  );

  return (
    <Document
      title={`Simple Tax Invoice ${invoice.invoiceNumber ?? "DRAFT"}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="SIMPLE TAX INVOICE"
      creator="Hulool Invoicing"
    >
      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1: HEADER, PARTIES, DESCRIPTION STRIP, ITEMS TABLE, SIGNATURES
         ══════════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {renderHeader(1)}
        {renderPartyBoxes()}
        {renderDescriptionStrip()}

        {/* ─── ITEMS TABLE (PAGE 1) ─── */}
        <View style={styles.table}>
          {/* Header Row (Left to Right) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Item ID / الكود - empty per instruction */}
            <View style={[styles.thCell, styles.colItemId]}>
              <Text style={styles.thText}>الكود</Text>
              <Text style={styles.thText}>Item ID</Text>
            </View>
            {/* 2. Item Name & Description */}
            <View style={[styles.thCell, styles.colItemName]}>
              <Text style={styles.thText}>اسم الصنف / البيان</Text>
              <Text style={styles.thText}>Item Name / Descreption</Text>
            </View>
            {/* 3. Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thText}>الكمية</Text>
              <Text style={styles.thText}>Quantity</Text>
            </View>
            {/* 4. Amount / Unit Price */}
            <View style={[styles.thCell, styles.colAmount]}>
              <Text style={styles.thText}>القيمة</Text>
              <Text style={styles.thText}>Amount</Text>
            </View>
            {/* 5. Discount */}
            <View style={[styles.thCell, styles.colDiscount]}>
              <Text style={styles.thText}>الخصم</Text>
              <Text style={styles.thText}>Discount</Text>
            </View>
            {/* 6. Tax / VAT Amount */}
            <View style={[styles.thCell, styles.colTax]}>
              <Text style={styles.thText}>الضريبة</Text>
              <Text style={styles.thText}>Tax</Text>
            </View>
            {/* 7. Total Due */}
            <View style={[styles.thCell, styles.colTotal, { borderRightWidth: 0 }]}>
              <Text style={styles.thText}>الإجمالي</Text>
              <Text style={styles.thText}>Total Due</Text>
            </View>
          </View>

          {/* Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* Item ID: cell empty per user instruction */}
              <View style={[styles.tdCell, styles.colItemId]}>
                <Text style={styles.tdCenterText}></Text>
              </View>
              {/* Description (Right-aligned, bold) */}
              <View style={[styles.tdCell, styles.colItemName]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>
              {/* Quantity: unit + qty */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdQtyUnit}>حبة</Text>
                <Text style={styles.tdQtyNum}>{formatQty(row.qty)}</Text>
              </View>
              {/* Amount (Unit Price) */}
              <View style={[styles.tdCell, styles.colAmount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>
              {/* Discount */}
              <View style={[styles.tdCell, styles.colDiscount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineDiscount)}</Text>
              </View>
              {/* Tax */}
              <View style={[styles.tdCell, styles.colTax]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineVat)}</Text>
              </View>
              {/* Total Due */}
              <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}>
                <Text style={styles.tdTotalText}>{formatExactAmount(row.lineTotal)}</Text>
              </View>
            </View>
          ))}
        </View>

        {renderSignatures()}
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2: HEADER, PARTIES, DESCRIPTION STRIP, TOTALS SUMMARY, SIGNATURES
         ══════════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {renderHeader(2)}
        {renderPartyBoxes()}
        {renderDescriptionStrip()}

        {/* ─── TOTALS CARD (PAGE 2) ─── */}
        <View style={styles.totalsContainer} wrap={false}>
          {/* Top Tafqeet & Amount Box Row */}
          <View style={styles.totalsTopRow}>
            {/* Arabic Words (Tafqeet) */}
            <Text style={styles.tafqeetText}>{tafqeetText}</Text>

            {/* Currency Pill + Red Amount Box */}
            <View style={styles.totalsAmountPillGroup}>
              <View style={styles.currencyBox}>
                <Text style={styles.currencyText}>SR</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.amountBoxText}>{formatExactAmount(grandTotal)}</Text>
              </View>
            </View>
          </View>

          {/* Breakdown Body: Left (Total Qty) + Right (Financial Tiers) */}
          <View style={styles.totalsBody}>
            {/* Left: Total Qty Card */}
            <View style={styles.totalQtyCol}>
              <Text style={styles.totalQtyLabel}>إجمالي الكمية / Total QTY</Text>
              <Text style={styles.totalQtyVal}>{formatQty(totalQty)}</Text>
            </View>

            {/* Right: Detailed Breakdown Tiers */}
            <View style={styles.totalsTiersCol}>
              {/* 1. Total Excluding VAT */}
              <View style={styles.tierRow}>
                <Text style={styles.tierValue}>{formatExactAmount(taxableAmount)}</Text>
                <Text style={styles.tierLabel}>Total Excluding VAT / الإجمالي غير شامل ضريبة القيمة المضافة</Text>
              </View>

              {/* 2. Discount */}
              <View style={styles.tierRow}>
                <Text style={styles.tierValue}>{formatExactAmount(totalDiscountVal)}</Text>
                <Text style={styles.tierLabel}>Discount / الخصم</Text>
              </View>

              {/* 3. Charges */}
              <View style={styles.tierRow}>
                <Text style={styles.tierValue}>0.00</Text>
                <Text style={styles.tierLabel}>Charges / الأعباء</Text>
              </View>

              {/* 4. Total Taxable Amount */}
              <View style={styles.tierRow}>
                <Text style={styles.tierValue}>{formatExactAmount(taxableAmount)}</Text>
                <Text style={styles.tierLabel}>Total Taxable Amount / الإجمالي الخاضع للضريبة</Text>
              </View>

              {/* 5. Tax (15%) */}
              <View style={styles.tierRow}>
                <Text style={styles.tierValue}>{formatExactAmount(totalVat)}</Text>
                <View style={styles.taxLabelGroup}>
                  <Text style={styles.tierLabel}>Tax / </Text>
                  <Text style={styles.taxRateRed}>%15 </Text>
                  <Text style={styles.tierLabel}>الضريبة</Text>
                </View>
              </View>

              {/* 6. Grand Total (Shaded Strip) */}
              <View style={[styles.tierRow, styles.tierRowGrand]}>
                <Text style={[styles.tierValue, styles.tierValueGrand]}>{formatExactAmount(grandTotal)}</Text>
                <Text style={[styles.tierLabel, styles.tierLabelGrand]}>Total Amt With Tax / الإجمالي النهائي شامل الضريبة</Text>
              </View>
            </View>
          </View>
        </View>

        {renderSignatures()}
      </Page>
    </Document>
  );
}

// ─── STYLES (PURE TAJAWAL TYPOGRAPHY) ─────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  bold: {
    fontWeight: "bold",
  },

  // 1. Header Section
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  qrCol: {
    width: 82,
    alignItems: "flex-start",
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: "#999999",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 7.5,
    color: "#999999",
  },

  centerCol: {
    width: 140,
    alignItems: "center",
    textAlign: "center",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
  },
  logoSpacer: {
    height: 12,
  },
  pageNumberWrap: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 3,
  },
  pageText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#1D4ED8",
    textAlign: "center",
  },
  titleBanner: {
    backgroundColor: "#E0F7FA",
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 8,
    width: "100%",
    alignItems: "center",
  },
  titleBannerAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
  },
  titleBannerEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },

  rightCol: {
    flex: 1,
    alignItems: "flex-end",
    textAlign: "right",
    paddingLeft: 12,
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#000000",
    marginBottom: 1,
    textAlign: "right",
  },
  companyAddressText: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#000000",
    marginBottom: 4,
    textAlign: "right",
  },
  metaTable: {
    flexDirection: "column",
    width: "100%",
  },
  metaTableRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 2,
  },
  metaLabelGroup: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginLeft: 6,
    textAlign: "right",
  },
  metaValueRed: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#B91C1C",
  },
  metaValueText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },

  // 2. Seller & Buyer Cards
  partyBoxesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  partyCard: {
    width: "49.2%",
    borderWidth: 1,
    borderColor: "#6B7280",
  },
  partyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderColor: "#6B7280",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  partyCardHeaderEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  partyCardHeaderAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
  },
  partyCardBody: {
    flexDirection: "column",
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: "#D1D5DB",
    minHeight: 12.5,
  },
  partyCellEn: {
    width: "27%",
    backgroundColor: "#F3F4F6",
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "left",
  },
  partyCellVal: {
    width: "46%",
    fontFamily: "Tajawal",
    fontSize: 6.5,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "center",
  },
  partyCellAr: {
    width: "27%",
    backgroundColor: "#F3F4F6",
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    paddingHorizontal: 2,
    textAlign: "right",
  },

  // 3. Description Strip
  descStrip: {
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#6B7280",
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  descStripText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },

  // 4. Line Items Table (Page 1)
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#6B7280",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderColor: "#6B7280",
    minHeight: 22,
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    backgroundColor: "#EBF8FA",
    borderBottomWidth: 0.5,
    borderColor: "#A5D8E8",
    minHeight: 18,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.8,
    borderColor: "#6B7280",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderColor: "#A5D8E8",
    height: "100%",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },
  tdQtyUnit: {
    fontFamily: "Tajawal",
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
  },
  tdQtyNum: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdTotalText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (Sum = 100%)
  colItemId: { width: "12%" },
  colItemName: { width: "42%" },
  colQty: { width: "9%" },
  colAmount: { width: "10%" },
  colDiscount: { width: "9%" },
  colTax: { width: "9%" },
  colTotal: { width: "9%" },

  // 5. Totals Card (Page 2)
  totalsContainer: {
    borderWidth: 1,
    borderColor: "#6B7280",
    marginTop: 4,
    marginBottom: 8,
  },
  totalsTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderColor: "#6B7280",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tafqeetText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "left",
  },
  totalsAmountPillGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencyBox: {
    borderWidth: 1,
    borderColor: "#6B7280",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  currencyText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
  },
  amountBox: {
    borderWidth: 1,
    borderColor: "#6B7280",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 70,
    alignItems: "center",
  },
  amountBoxText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#B91C1C",
  },

  totalsBody: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  totalQtyCol: {
    width: "32%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  totalQtyLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginBottom: 4,
    textAlign: "center",
  },
  totalQtyVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 12,
    color: "#1D4ED8",
    textAlign: "center",
  },
  totalsTiersCol: {
    width: "68%",
    flexDirection: "column",
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
  },
  tierRowGrand: {
    backgroundColor: "#E5E7EB",
    marginTop: 2,
    paddingVertical: 2.5,
  },
  tierLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  tierLabelGrand: {
    fontSize: 7.5,
  },
  taxLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  taxRateRed: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#B91C1C",
  },
  tierValue: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#B91C1C",
    minWidth: 60,
    textAlign: "right",
    marginRight: 10,
  },
  tierValueGrand: {
    fontSize: 8,
  },

  // 6. Signatures
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
    marginBottom: 20,
    paddingHorizontal: 50,
  },
  sealCol: {
    alignItems: "center",
    width: 120,
  },
  signCol: {
    alignItems: "center",
    width: 120,
  },
  signSpace: {
    height: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  signatureImage: {
    maxHeight: 30,
    maxWidth: 70,
    objectFit: "contain",
  },
  signLabelUnderline: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
    textDecoration: "underline",
    textAlign: "center",
  },
});
