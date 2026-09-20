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

export interface HasaniahFoamTemplateProps {
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

// ─── Arabic Words (Tafqeet) ───
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
 * Strict date formatting: DD/MM/YYYY only — NO hours, minutes, or seconds.
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

export function HasaniahFoamTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: HasaniahFoamTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);

  // ─── Company Address Formatting ───
  const companyAddressParts = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressAr = companyAddressParts.join(" - ");

  const companyAddressEnParts = [
    company.addressBuildingNumber ? `Bldg ${company.addressBuildingNumber}` : "",
    company.addressStreet || "",
    company.addressDistrict ? `${company.addressDistrict} Dist.` : "",
    company.addressCity || "",
    company.addressPostalCode ? `Postal Code ${company.addressPostalCode}` : "",
    company.addressAdditionalNumber ? `Add. No ${company.addressAdditionalNumber}` : "",
    "Saudi Arabia",
  ].filter(Boolean);
  const companyAddressEn = companyAddressEnParts.join(", ");

  const companyCrOrUnified = company.crNumber || (company as any).unifiedNumber || "";
  const companyUnifiedNo = (company as any).unifiedNumber || "";
  const companyWebsite = (company as any).website || "";

  // ─── Customer Address & Data ───
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerTaxId = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerNo = (customer as any).customerNumber || (customer as any).code || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerAddress = [
    customer.addressCity,
    customer.addressPostalCode,
    customer.addressStreet,
    (customer as any).addressDistrict || (customer as any).district,
  ].filter(Boolean).join(" - ");

  const referenceNo =
    (invoice as any).referenceNumber || (invoice as any).checkingNo || "";

  // ─── Items & Totals Calculations ───
  const items = invoice.items || [];
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

  // Calculate total size quantity
  const totalSizeQty = items.reduce((acc, it) => {
    const s = parseFloat(String((it as any).sizeQty || (it as any).size || 0));
    return acc + (isNaN(s) ? 0 : s);
  }, 0);
  const totalSizeDisplay = totalSizeQty > 0 ? formatExactAmount(totalSizeQty) : "";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Single-Page Dynamic Height Guarantee (Portrait) ───
  const basePageHeight = paperSize === "Letter" ? 792 : 842;
  const itemRowHeight = 24;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  if (invoice.terms)
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  if (company.footerText) extraContentHeight += 18;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [
    paperSize === "Letter" ? 612 : 595.28,
    dynamicHeight,
  ] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP DUAL HEADER WITH LOGO IN CENTER ─── */}
        <View style={styles.headerRow}>
          {/* Left Column (English) */}
          <View style={styles.headerLeft}>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            {companyAddressEn ? (
              <Text style={styles.headerSubEn}>{companyAddressEn}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerContactEn}>Telfax: {company.phone}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerVatEn}>
                Supplier VAT No.: {company.vatNumber}
              </Text>
            ) : null}
            {companyCrOrUnified ? (
              <Text style={styles.headerCrEn}>
                C.R. No.: {companyCrOrUnified}
              </Text>
            ) : null}
            {company.email ? (
              <Text style={styles.headerContactEn}>{company.email}</Text>
            ) : null}
            {companyWebsite ? (
              <Text style={styles.headerContactEn}>{companyWebsite}</Text>
            ) : null}
          </View>

          {/* Center Column: Logo & Badge */}
          <View style={styles.headerCenter}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImg} />
            ) : null}

            {/* "فاتورة ضريبية / Tax Invoice" Rounded Badge */}
            <View style={styles.invoiceTitleBadge}>
              <Text style={styles.invoiceTitleText}>فاتورة ضريبية</Text>
              <Text style={styles.invoiceTitleSub}>Tax Invoice</Text>
            </View>
          </View>

          {/* Right Column (Arabic) */}
          <View style={styles.headerRight}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {companyAddressAr ? (
              <Text style={styles.headerSubAr}>{companyAddressAr}</Text>
            ) : null}

            {/* Strict React-PDF BiDi Middle-Colon metadata lines */}
            {company.vatNumber ? (
              <View style={styles.bidiRowRight}>
                <Text style={styles.bidiLabelAr}>الرقم الضريبي</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValArBold}>{company.vatNumber}</Text>
              </View>
            ) : null}

            {companyCrOrUnified ? (
              <View style={styles.bidiRowRight}>
                <Text style={styles.bidiLabelAr}>السجل التجاري</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValAr}>{companyCrOrUnified}</Text>
              </View>
            ) : null}

            {companyUnifiedNo ? (
              <View style={styles.bidiRowRight}>
                <Text style={styles.bidiLabelAr}>الرقم الموحد</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValAr}>{companyUnifiedNo}</Text>
              </View>
            ) : null}

            {company.phone ? (
              <View style={styles.bidiRowRight}>
                <Text style={styles.bidiLabelAr}>تليفاكس / هاتف</Text>
                <Text style={styles.bidiColon}>:</Text>
                <Text style={styles.bidiValAr}>{company.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. METADATA PILLS SECTION (Two Columns: Left Company/Dates, Right Customer) ─── */}
        <View style={styles.metaSection}>
          {/* Left Metadata Column */}
          <View style={styles.metaColLeft}>
            {/* Row 1: Issue Date */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Issue Date</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValTextBold}>{issueDateStr}</Text>
              </View>
              <Text style={styles.pillLblAr}>تاريخ الإصدار</Text>
            </View>

            {/* Row 2: Company C.R. (Repurposed from Supply Date to preserve capsule grid) */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>C.R. No.</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{companyCrOrUnified}</Text>
              </View>
              <Text style={styles.pillLblAr}>السجل التجاري</Text>
            </View>

            {/* Row 3: Customer Address */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Address</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{customerAddress}</Text>
              </View>
              <Text style={styles.pillLblAr}>العنوان</Text>
            </View>

            {/* Row 4: Reference No. */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Ref. No.</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{referenceNo}</Text>
              </View>
              <Text style={styles.pillLblAr}>رقم المرجع</Text>
            </View>
          </View>

          {/* Right Metadata Column */}
          <View style={styles.metaColRight}>
            {/* Row 1: Invoice No. */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Invoice No.</Text>
              <View style={[styles.pillBox, { flex: 1 }]}>
                <Text style={styles.pillValTextBold}>{invoiceNum}</Text>
              </View>
              <Text style={styles.pillLblAr}>رقم الفاتورة</Text>
            </View>

            {/* Row 2: Customer Unified No. & Customer Name (Repurposed Payment Method to preserve capsule grid) */}
            <View style={styles.dualPillRow}>
              <View style={styles.subPillLeft}>
                <View style={[styles.pillBox, { width: 50 }]}>
                  <Text style={styles.pillValText}>{customerCrOrUnified}</Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>الرقم الموحد</Text>
                  <Text style={styles.subPillLblEn}>Unified No.</Text>
                </View>
              </View>

              <View style={styles.subPillRight}>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValTextBold}>{customerNameAr}</Text>
                </View>
                <Text style={styles.pillLblAr}>اسم العميل</Text>
              </View>
            </View>

            {/* Row 3: Customer No. & Customer VAT */}
            <View style={styles.dualPillRow}>
              <View style={styles.subPillLeft}>
                <View style={[styles.pillBox, { width: 50 }]}>
                  <Text style={styles.pillValText}>{customerNo}</Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>رقم العميل</Text>
                  <Text style={styles.subPillLblEn}>Customer No.</Text>
                </View>
              </View>

              <View style={styles.subPillRight}>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValText}>{customerTaxId}</Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>الرقم الضريبي</Text>
                  <Text style={styles.subPillSubAr}>(للعميل إن وجد)</Text>
                </View>
              </View>
            </View>

            {/* Row 4: Serial Red Box & Telephone */}
            <View style={styles.dualPillRow}>
              <View style={styles.redSerialWrap}>
                <Text style={styles.redSerialText}>{invoiceNum}</Text>
              </View>

              <View style={styles.subPillRight}>
                <Text style={styles.pillLblEn}>Tel.</Text>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValText}>{customerPhone}</Text>
                </View>
                <Text style={styles.pillLblAr}>هاتف</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE WITH BLUE BORDERS & PEACH ACCENT ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row (Peach Background, RTL: Total on Left, Size on Right) */}
          <View style={styles.tableHeaderRow}>
            {/* Col 1: Total Value (Inc. VAT) */}
            <View style={[styles.thCellWrap, styles.colTotal]}>
              <Text style={styles.thArText}>إجمالي القيمة</Text>
              <Text style={styles.thEnText}>Total Inc. VAT</Text>
            </View>

            {/* Col 2: Tax Amount */}
            <View style={[styles.thCellWrap, styles.colVatAmount]}>
              <Text style={styles.thArText}>مبلغ الضريبة</Text>
              <Text style={styles.thEnText}>VAT Amount</Text>
            </View>

            {/* Col 3: Tax Rate */}
            <View style={[styles.thCellWrap, styles.colVatRate]}>
              <Text style={styles.thArText}>نسبة الضريبة</Text>
              <Text style={styles.thEnText}>Tax Rate</Text>
            </View>

            {/* Col 4: Unit Price */}
            <View style={[styles.thCellWrap, styles.colPrice]}>
              <Text style={styles.thArText}>سعر الوحدة</Text>
              <Text style={styles.thEnText}>Unit Price</Text>
            </View>

            {/* Col 5: Quantity */}
            <View style={[styles.thCellWrap, styles.colQty]}>
              <Text style={styles.thArText}>الكمية</Text>
              <Text style={styles.thEnText}>Quantity</Text>
            </View>

            {/* Col 6: Item Name & Description */}
            <View style={[styles.thCellWrap, styles.colName]}>
              <Text style={styles.thArText}>اسم الصنف والبيان</Text>
              <Text style={styles.thEnText}>Item Description</Text>
            </View>

            {/* Col 7: Size Qty / 3m */}
            <View style={[styles.thCellWrap, styles.colSize, { borderRightWidth: 0 }]}>
              <Text style={styles.thArText}>حجم الكمية /م٣</Text>
              <Text style={styles.thEnText}>Size Qty./3m</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          <View style={styles.tableBody}>
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const unitPrice = Number(item.unitPrice || 0);
              const lineDisc = Number(
                item.discountAmount || (item as any).discount || 0
              );
              const rawLineSubtotal = unitPrice * qty;
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

              const size = (item as any).sizeQty || (item as any).size || "";

              return (
                <View key={idx} style={styles.tableDataRow}>
                  {/* Col 1: Total Value (Tinted Peach column) */}
                  <View style={[styles.tdCellWrap, styles.colTotal, styles.peachColumn]}>
                    <Text style={styles.tdValBold}>{formatExactAmount(lineTotalIncVat)}</Text>
                  </View>

                  {/* Col 2: Tax Amount */}
                  <View style={[styles.tdCellWrap, styles.colVatAmount]}>
                    <Text style={styles.tdValText}>{formatExactAmount(lineVat)}</Text>
                  </View>

                  {/* Col 3: Tax Rate */}
                  <View style={[styles.tdCellWrap, styles.colVatRate]}>
                    <Text style={styles.tdValText}>{vatPctStr}</Text>
                  </View>

                  {/* Col 4: Unit Price */}
                  <View style={[styles.tdCellWrap, styles.colPrice]}>
                    <Text style={styles.tdValText}>{formatExactAmount(unitPrice)}</Text>
                  </View>

                  {/* Col 5: Quantity */}
                  <View style={[styles.tdCellWrap, styles.colQty]}>
                    <Text style={styles.tdValText}>{formatExactAmount(qty)}</Text>
                  </View>

                  {/* Col 6: Item Name & Description */}
                  <View style={[styles.tdCellWrap, styles.colName, styles.textRightAlign]}>
                    <Text style={styles.tdValTextBold}>{item.description || ""}</Text>
                    {lineDisc > 0 ? (
                      <View style={styles.discountSubBox}>
                        <Text style={styles.discountSubText}>
                          خصم: {formatExactAmount(lineDisc)} (قبل: {formatExactAmount(rawLineSubtotal)} | بعد: {formatExactAmount(discountedSubtotal)})
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Col 7: Size Qty */}
                  <View style={[styles.tdCellWrap, styles.colSize, { borderRightWidth: 0 }]}>
                    <Text style={styles.tdValText}>{size ? formatExactAmount(size) : ""}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── 4. SUMMARY & QR CODE BAR (Size Box Left, QR Center, Totals Right) ─── */}
        <View style={styles.summaryContainer}>
          {/* Far Left: Total Size Qty Peach Box */}
          <View style={styles.sizeTotalBox}>
            <Text style={styles.sizeTotalLabel}>إجمالي الحجم</Text>
            <Text style={styles.sizeTotalText}>{totalSizeDisplay || "-"}</Text>
            <Text style={styles.sizeTotalUnit}>م³</Text>
          </View>

          {/* Center-Left: Pure ZATCA QR Code Box */}
          <View style={styles.qrBox}>
            {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrImg} /> : null}
          </View>

          {/* Right: Multi-Row Totals Breakdown Table */}
          <View style={styles.totalsTable}>
            {/* Row 1: Subtotal Before VAT */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, styles.peachBox]}>
                <Text style={styles.totalsValText}>{formatExactAmount(grossSubtotal)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  Total Before VAT الإجمالي قبل الضريبة
                </Text>
              </View>
            </View>

            {/* Row 2: Discount (if any) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(discountVal)}</Text>
                </View>
                <View style={styles.totalsLblCell}>
                  <Text style={styles.totalsLblText}>Discount الخصم</Text>
                </View>
              </View>
            ) : null}

            {/* Row 3: Taxable Amount (if discount) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatExactAmount(taxableVal)}</Text>
                </View>
                <View style={styles.totalsLblCell}>
                  <Text style={styles.totalsLblText}>
                    Taxable Amount المبلغ الخاضع للضريبة
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Row 4: VAT */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsValCell}>
                <Text style={styles.totalsValText}>{formatExactAmount(vatVal)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  VAT ({vatRatePercentage}) ضريبة القيمة المضافة
                </Text>
              </View>
            </View>

            {/* Row 5: Total After VAT (Peach Highlight) */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, styles.peachBox]}>
                <Text style={styles.totalsValTextBold}>{formatExactAmount(totalVal)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblTextBold}>
                  Total After VAT الإجمالي بعد ضريبة القيمة المضافة
                </Text>
              </View>
            </View>

            {/* Row 6: Invoice Paid */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsValCell}>
                <Text style={styles.totalsValText}>{formatExactAmount(totalVal)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  Paid Amount المبلغ المدفوع
                </Text>
              </View>
            </View>

            {/* Row 7: Balance Due */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <View style={styles.totalsValCell}>
                <Text style={styles.totalsValText}>0.00</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  Balance Due المبلغ المتبقي
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 5. TAFQEET & RECEIPT CLAUSE ─── */}
        {tafqeetText ? (
          <View style={styles.tafqeetRow}>
            <Text style={styles.tafqeetLabel}>المبلغ كتابة</Text>
            <Text style={styles.tafqeetColon}>:</Text>
            <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
          </View>
        ) : null}

        <View style={styles.conditionRow}>
          <Text style={styles.conditionText}>
            إستلمت البضاعة أعلاه كاملة وسليمة
          </Text>
        </View>

        {/* ─── 6. NOTES & TERMS (if present) ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesTermsContainer}>
            {invoice.notes ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteTitle}>ملاحظات</Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 7. FOUR SIGNATURE BLOCKS (Official Tax Invoice Signing) ─── */}
        <View style={styles.signaturesRow}>
          {/* Signature 1: Receiver */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المستلم / Receiver</Text>
            <Text style={styles.sigLine}>الاسم: ........................</Text>
            <Text style={styles.sigLine}>التوقيع: ........................</Text>
          </View>

          {/* Signature 2: Accountant */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المحاسب / Accountant</Text>
            <Text style={styles.sigLine}>الاسم: ........................</Text>
            <Text style={styles.sigLine}>التوقيع: ........................</Text>
          </View>

          {/* Signature 3: Sales */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المبيعات / Sales</Text>
            <Text style={styles.sigLine}>الاسم: ........................</Text>
            <Text style={styles.sigLine}>التوقيع: ........................</Text>
          </View>

          {/* Signature 4: Approval */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>الاعتماد / Approved</Text>
            <Text style={styles.sigLine}>الاسم: ........................</Text>
            <Text style={styles.sigLine}>التوقيع: ........................</Text>
          </View>
        </View>

        {/* ─── 8. FOOTER TEXT (if present) ─── */}
        {company.footerText ? (
          <View style={styles.footerRow}>
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
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#154273", // Primary deep blue
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    width: "36%",
    alignItems: "flex-start",
  },
  companyNameEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
  },
  headerSubEn: {
    fontSize: 7,
    color: "#154273",
    lineHeight: 1.25,
    marginBottom: 2,
  },
  headerContactEn: {
    fontSize: 7,
    color: "#154273",
    marginTop: 1,
  },
  headerVatEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginTop: 1,
  },
  headerCrEn: {
    fontSize: 7,
    color: "#154273",
    marginTop: 1,
  },

  headerCenter: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 55,
    height: 55,
    objectFit: "contain",
  },

  invoiceTitleBadge: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#154273",
    borderRadius: 8,
    backgroundColor: "#EBF5FF",
    paddingHorizontal: 12,
    paddingVertical: 2,
    alignItems: "center",
  },
  invoiceTitleText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#154273",
  },
  invoiceTitleSub: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#154273",
    marginTop: 1,
  },

  headerRight: {
    width: "36%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
    textAlign: "right",
  },
  headerSubAr: {
    fontSize: 7.5,
    color: "#154273",
    lineHeight: 1.25,
    textAlign: "right",
    marginBottom: 2,
  },
  bidiRowRight: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 1.5,
  },
  bidiLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
  },
  bidiColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginHorizontal: 2,
  },
  bidiValAr: {
    fontSize: 7.5,
    color: "#154273",
  },
  bidiValArBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
  },

  // ─── Meta Section (Pills) ───
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  metaColLeft: {
    width: "42%",
  },
  metaColRight: {
    width: "56%",
  },

  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3.5,
  },
  pillLblEn: {
    fontSize: 7.5,
    color: "#154273",
    width: 60,
    textAlign: "left",
  },
  pillBox: {
    borderWidth: 1.25,
    borderColor: "#154273",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 16,
    flex: 1,
    marginHorizontal: 3,
    backgroundColor: "#FFFFFF",
  },
  pillValText: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
  },
  pillValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  pillLblAr: {
    fontSize: 7.5,
    color: "#154273",
    width: 62,
    textAlign: "right",
  },

  dualPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3.5,
  },
  subPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    width: "42%",
  },
  subPillLabelBlock: {
    marginLeft: 3,
    alignItems: "flex-start",
  },
  subPillLblAr: {
    fontSize: 7,
    color: "#154273",
  },
  subPillLblEn: {
    fontSize: 6.5,
    color: "#154273",
  },
  subPillRight: {
    flexDirection: "row",
    alignItems: "center",
    width: "56%",
    justifyContent: "flex-end",
  },
  subPillSubAr: {
    fontSize: 6,
    color: "#154273",
  },

  redSerialWrap: {
    width: "35%",
    alignItems: "center",
    justifyContent: "center",
  },
  redSerialText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#D9381E", // Prominent Red
    letterSpacing: 0.5,
  },

  // ─── Table ───
  tableContainer: {
    borderWidth: 1.25,
    borderColor: "#154273",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    position: "relative",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FCEADE", // Soft Peach / Apricot
    borderBottomWidth: 1.25,
    borderBottomColor: "#154273",
    minHeight: 24,
  },
  thCellWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  thArText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },
  thEnText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },

  tableBody: {
    minHeight: 140,
  },
  tableDataRow: {
    flexDirection: "row",
    minHeight: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  tdCellWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  peachColumn: {
    backgroundColor: "#FFF4ED", // Subtle Peach tint
  },
  tdValText: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
  },
  tdValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  tdValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },
  textRightAlign: {
    alignItems: "flex-end",
    paddingRight: 4,
  },
  discountSubBox: {
    marginTop: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: "#FFF1F2",
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#FECDD3",
  },
  discountSubText: {
    fontSize: 6.5,
    color: "#E11D48",
    textAlign: "right",
  },

  // Column Widths (Right-to-Left order in table: Leftmost is Total, Rightmost is Size)
  colTotal: { width: "18%" },
  colVatAmount: { width: "12%" },
  colVatRate: { width: "10%" },
  colPrice: { width: "12%" },
  colQty: { width: "10%" },
  colName: { width: "28%" },
  colSize: { width: "10%" },

  // ─── Summary & QR Section ───
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    borderWidth: 1.25,
    borderTopWidth: 0,
    borderColor: "#154273",
  },
  sizeTotalBox: {
    width: "10%",
    backgroundColor: "#FCEADE", // Peach
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
    paddingVertical: 6,
  },
  sizeTotalLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
  },
  sizeTotalText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#154273",
  },
  sizeTotalUnit: {
    fontSize: 6.5,
    color: "#154273",
    marginTop: 1,
  },
  qrBox: {
    width: "22%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  qrImg: {
    width: 65,
    height: 65,
  },

  totalsTable: {
    width: "68%",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#154273",
    minHeight: 16,
  },
  totalsValCell: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
    paddingVertical: 2,
  },
  peachBox: {
    backgroundColor: "#FCEADE",
  },
  totalsValText: {
    fontSize: 7.5,
    color: "#111111",
  },
  totalsValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
  },
  totalsLblCell: {
    width: "72%",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 6,
    paddingVertical: 2,
  },
  totalsLblText: {
    fontSize: 7,
    color: "#154273",
    textAlign: "right",
  },
  totalsLblTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "right",
  },

  // ─── Tafqeet & Condition ───
  tafqeetRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tafqeetLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
  },
  tafqeetColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginHorizontal: 3,
  },
  tafqeetValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
  },
  conditionRow: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "left",
  },

  // ─── Notes & Terms ───
  notesTermsContainer: {
    marginTop: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#154273",
    borderRadius: 4,
    padding: 6,
    backgroundColor: "#F8FAFC",
  },
  noteBox: {
    marginBottom: 3,
  },
  noteTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 1,
    textAlign: "right",
  },
  noteBody: {
    fontSize: 7,
    color: "#334155",
    lineHeight: 1.3,
    textAlign: "right",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#A0A0A0",
  },
  sigBlock: {
    width: "24%",
    alignItems: "center",
  },
  sigTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 3,
    textAlign: "center",
  },
  sigLine: {
    fontSize: 7,
    color: "#475569",
    marginBottom: 2,
    textAlign: "center",
  },

  // ─── Footer ───
  footerRow: {
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 3,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#64748B",
    textAlign: "center",
  },
});
