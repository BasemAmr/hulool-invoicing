import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Polygon,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

// ─── Number to Arabic Words (Tafqeet) ───
const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
];
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
const TENS = [
  "",
  "عشرة",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];
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
  if (num <= 0) return "فقط صفر ريال سعودي لا غير";
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Helper Functions ───
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

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

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function formatCompanyFullAddress(company: CompanyRecord): string {
  const parts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressAdditionalNumber ? `إضافي ${company.addressAdditionalNumber}` : "",
  ].filter((p): p is string => Boolean(p && p.trim().length > 0));
  return parts.join(" - ");
}

export interface Template12MassSteelProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl: string | null;
  signatureDataUrl?: string | null;
}

export function Template12MassSteel({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template12MassSteelProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const invoiceNum = invoice.invoiceNumber ?? "DRAFT";
  const issueDateStr = formatDateOnly(invoice.issueDate);
  const logoSource = logoDataUrl || company.logoUrl;

  const customerAddress = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" - ");

  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
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

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
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

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableAmount + totalVat;

  const totalDiscount = computedDiscount;
  const tafqeetText = tafqeet(grandTotal);

  // Dynamic height calculation so the whole document always fits on one continuous page
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 22;
  const discountItemsCount = rows.filter((r) => r.lineDiscount > 0).length;
  extraContentHeight += discountItemsCount * 12;

  if (invoice.notes) {
    extraContentHeight += 20 + Math.min(invoice.notes.split("\n").length, 5) * 8;
  }
  if (invoice.terms) {
    extraContentHeight += 20 + Math.min(invoice.terms.split("\n").length, 5) * 8;
  }
  if (company.footerText) {
    extraContentHeight += 16;
  }

  // Add a safety buffer of 80pt so react-pdf never overflows by 1-2px onto a second blank page
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight) + 80;
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr}
      subject="فاتورة ضريبية / Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ─── */}
        <View style={styles.topHeader} wrap={false}>
          {/* Left: Company Logo (conditional) */}
          <View style={styles.headerLeft}>
            {logoSource ? (
              <Image src={logoSource} style={styles.companyLogo} />
            ) : null}
          </View>

          {/* Right: Company Branding & Legal Identifiers */}
          <View style={styles.headerRight}>
            <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            <View style={styles.crVatRow}>
              <View style={styles.bidiInlinePair}>
                <Text style={styles.metaLabel}>الرقم الضريبي</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaValue}>{company.vatNumber || ""}</Text>
              </View>
              {company.crNumber ? (
                <>
                  <Text style={styles.metaSeparator}>-</Text>
                  <View style={styles.bidiInlinePair}>
                    <Text style={styles.metaLabel}>سجل تجاري</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{company.crNumber}</Text>
                  </View>
                </>
              ) : null}
            </View>
            <Text style={styles.metaSubText}>
              {company.crNumber ? `C.R. ${company.crNumber}` : ""}
              {company.crNumber && company.vatNumber ? " - " : ""}
              {company.vatNumber ? `VAT Reg. No. ${company.vatNumber}` : ""}
            </Text>
          </View>
        </View>

        {/* ─── 2. DOCUMENT TITLE ─── */}
        <View style={styles.titleContainer} wrap={false}>
          <Text style={styles.titleText}>فاتورة ضريبية   Sales Invoice / Tax Invoice</Text>
        </View>

        {/* ─── 3. METADATA & CLIENT GRID TABLE ─── */}
        <View style={styles.metaGrid} wrap={false}>
          {/* Row 1: Issue Date & Invoice No */}
          <View style={styles.gridRow}>
            {/* Date Box */}
            <View style={[styles.gridCell, styles.cellWidth50]}>
              <Text style={styles.cellLabelEn}>Issue Date</Text>
              <Text style={styles.cellValueCenter}>{issueDateStr}</Text>
              <Text style={styles.cellLabelAr}>تاريخ الفاتورة</Text>
            </View>
            {/* Invoice No Box */}
            <View style={[styles.gridCell, styles.cellWidth50, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>Invoice No</Text>
              <Text style={styles.cellValueCenterBold}>{invoiceNum}</Text>
              <Text style={styles.cellLabelAr}>رقم الفاتورة</Text>
            </View>
          </View>

          {/* Row 2: Salesman / Store / Branch (Left empty as requested) */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.cellWidth33]}>
              <Text style={styles.cellLabelEn}>Salesman</Text>
              <Text style={styles.cellValueCenter}></Text>
              <Text style={styles.cellLabelAr}>مندوب المبيعات</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth33, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>Store</Text>
              <Text style={styles.cellValueCenter}></Text>
              <Text style={styles.cellLabelAr}>المستودع</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth34, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>Branch</Text>
              <Text style={styles.cellValueCenter}></Text>
              <Text style={styles.cellLabelAr}>الفرع</Text>
            </View>
          </View>

          {/* Row 3: Client No & Client Name */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.cellWidth33]}>
              <Text style={styles.cellLabelEn}>Client No</Text>
              <Text style={styles.cellValueCenter}>{customer.unifiedNumber || (customer.vatNumber ? customer.vatNumber.slice(-6) : "")}</Text>
              <Text style={styles.cellLabelAr}>رقم العميل</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth67, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>Client Name</Text>
              <Text style={styles.cellValueCenterBold}>{customer.nameAr || customer.nameEn || ""}</Text>
              <Text style={styles.cellLabelAr}>اسم العميل</Text>
            </View>
          </View>

          {/* Row 4: Customer VAT Reg No & Address */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.cellWidth50]}>
              <Text style={styles.cellLabelEn}>VAT Reg No</Text>
              <Text style={styles.cellValueCenterBold}>{customer.vatNumber || ""}</Text>
              <Text style={styles.cellLabelAr}>الرقم الضريبي</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth50, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>Address</Text>
              <Text style={styles.cellValueCenter}>{customerAddress}</Text>
              <Text style={styles.cellLabelAr}>العنوان</Text>
            </View>
          </View>

          {/* Row 5: Serial & Order Ribbon */}
          <View style={[styles.gridRow, styles.subHeaderRow]}>
            <View style={[styles.gridCell, styles.cellWidth30]}>
              <Text style={styles.subHeaderTitle}>Ser M12-</Text>
              <Text style={styles.subHeaderAr}>م</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth35, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>S.O No</Text>
              <Text style={styles.cellValueCenter}></Text>
              <Text style={styles.cellLabelAr}>رقم أمر البيع</Text>
            </View>
            <View style={[styles.gridCell, styles.cellWidth35, styles.cellBorderLeft]}>
              <Text style={styles.cellLabelEn}>P.O No</Text>
              <Text style={styles.cellValueCenter}></Text>
              <Text style={styles.cellLabelAr}>رقم أمر الشراء</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE ─── */}
        <View style={styles.itemsTable} wrap={false}>
          {/* Blue Table Header */}
          <View style={styles.tableHeaderRow}>
            {/* Value / القيمة */}
            <View style={[styles.thCell, styles.colVal]}>
              <Text style={styles.thAr}>القيمة</Text>
              <Text style={styles.thEn}>Value</Text>
            </View>
            {/* VAT Amount / قيمة الضريبة */}
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT 15%</Text>
            </View>
            {/* Unit Price / سعر الوحدة */}
            <View style={[styles.thCell, styles.colUPrice]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>U.Price</Text>
            </View>
            {/* Unit / الوحدة */}
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thAr}>الوحدة</Text>
              <Text style={styles.thEn}>Unit</Text>
            </View>
            {/* Qty / الكمية */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            {/* Item Description / اسم ووصف السلعة أو الخدمة */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thAr}>اسم و وصف السلعة أو الخدمة</Text>
              <Text style={styles.thEn}>Item/Service Name & Description</Text>
            </View>
            {/* Item Code / رقم الصنف */}
            <View style={[styles.thCell, styles.colCode]}>
              <Text style={styles.thAr}>رقم الصنف</Text>
              <Text style={styles.thEn}>Item Code</Text>
            </View>
            {/* No / م */}
            <View style={[styles.thCell, styles.colNo]}>
              <Text style={styles.thAr}>م</Text>
              <Text style={styles.thEn}>No</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row, idx) => {
            const hasRowDiscount = row.lineDiscount > 0;
            return (
              <View key={row.key} style={[styles.tableDataRow, idx % 2 === 1 ? styles.altRowBg : {}]}>
                {/* Total Value */}
                <View style={[styles.tdCell, styles.colVal]}>
                  <Text style={styles.cellNumberBold}>{formatExactAmount(row.lineTotal)}</Text>
                </View>
                {/* VAT Amount */}
                <View style={[styles.tdCell, styles.colVat]}>
                  <Text style={styles.cellNumber}>{formatExactAmount(row.lineVat)}</Text>
                </View>
                {/* Unit Price */}
                <View style={[styles.tdCell, styles.colUPrice]}>
                  <Text style={styles.cellNumber}>{formatExactAmount(row.unitPrice)}</Text>
                </View>
                {/* Unit */}
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.cellCenterText}>-</Text>
                </View>
                {/* Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.cellNumber}>{formatQty(row.qty)}</Text>
                </View>
                {/* Description */}
                <View style={[styles.tdCell, styles.colDesc, { alignItems: "flex-end" }]}>
                  <Text style={styles.descText}>{row.desc}</Text>
                  {hasRowDiscount ? (
                    <Text style={styles.discountHint}>
                      خصم: {formatExactAmount(row.lineDiscount)} (قبل: {formatExactAmount(row.gross)})
                    </Text>
                  ) : null}
                </View>
                {/* Item Code */}
                <View style={[styles.tdCell, styles.colCode]}>
                  <Text style={styles.cellCenterText}>{row.index}</Text>
                </View>
                {/* Row Index */}
                <View style={[styles.tdCell, styles.colNo]}>
                  <Text style={styles.cellCenterText}>{row.index}</Text>
                </View>
              </View>
            );
          })}

          {/* Minimum table rows height with vertical grid lines */}
          {rows.length < 5 ? (
            <View style={[styles.emptyFillerRow, { height: (5 - rows.length) * 20 }]}>
              <View style={[styles.tdCell, styles.colVal]} />
              <View style={[styles.tdCell, styles.colVat]} />
              <View style={[styles.tdCell, styles.colUPrice]} />
              <View style={[styles.tdCell, styles.colUnit]} />
              <View style={[styles.tdCell, styles.colQty]} />
              <View style={[styles.tdCell, styles.colDesc]} />
              <View style={[styles.tdCell, styles.colCode]} />
              <View style={[styles.tdCell, styles.colNo]} />
            </View>
          ) : null}
        </View>

        {/* ─── 5. TOTALS & ADDITIONAL INFO SECTION ─── */}
        <View style={styles.summarySection} wrap={false}>
          {/* Left Block: Numerical Totals Table */}
          <View style={styles.totalsTable}>
            {/* Discount Row */}
            <View style={styles.totalRow}>
              <View style={styles.totalValCell}>
                <Text style={styles.totalValText}>{formatExactAmount(totalDiscount)}</Text>
              </View>
              <View style={styles.totalLabelCell}>
                <Text style={styles.totalLabelAr}>الخصم</Text>
                <Text style={styles.totalLabelDash}>-</Text>
                <Text style={styles.totalLabelEn}>Discount</Text>
              </View>
            </View>

            {/* Additional Amount */}
            <View style={styles.totalRow}>
              <View style={styles.totalValCell}>
                <Text style={styles.totalValText}>0.00</Text>
              </View>
              <View style={styles.totalLabelCell}>
                <Text style={styles.totalLabelAr}>رسوم إضافية</Text>
                <Text style={styles.totalLabelDash}>-</Text>
                <Text style={styles.totalLabelEn}>Additional Amount</Text>
              </View>
            </View>

            {/* Total Taxable Value */}
            <View style={styles.totalRow}>
              <View style={styles.totalValCell}>
                <Text style={styles.totalValText}>{formatExactAmount(taxableAmount)}</Text>
              </View>
              <View style={styles.totalLabelCell}>
                <Text style={styles.totalLabelAr}>اجمالي القيمة</Text>
                <Text style={styles.totalLabelDash}>-</Text>
                <Text style={styles.totalLabelEn}>Total Value</Text>
              </View>
            </View>

            {/* VAT Amount */}
            <View style={styles.totalRow}>
              <View style={styles.totalValCell}>
                <Text style={styles.totalValText}>{formatExactAmount(totalVat)}</Text>
              </View>
              <View style={styles.totalLabelCell}>
                <Text style={styles.totalLabelAr}>ضريبة القيمة المضافة</Text>
                <Text style={styles.totalLabelDash}>-</Text>
                <Text style={styles.totalLabelEn}>VAT Amount</Text>
              </View>
            </View>

            {/* Net Amount / Grand Total */}
            <View style={[styles.totalRow, styles.netAmountRow]}>
              <View style={styles.totalValCell}>
                <Text style={styles.netAmountValText}>{formatExactAmount(grandTotal)}</Text>
              </View>
              <View style={styles.totalLabelCell}>
                <Text style={styles.totalLabelAr}>صافي قيمة الفاتورة</Text>
                <Text style={styles.totalLabelDash}>-</Text>
                <Text style={styles.totalLabelEn}>Invoice Net Amount</Text>
              </View>
            </View>
          </View>

          {/* Right Block: Additional Information Box */}
          <View style={styles.additionalInfoBox}>
            <View style={styles.additionalInfoHeader}>
              <Text style={styles.addInfoEn}>Information Additional</Text>
              <Text style={styles.addInfoAr}>بيانات اضافية</Text>
            </View>
            <View style={styles.additionalInfoBody}>
              {invoice.notes ? (
                <View style={styles.infoLineContainer}>
                  <Text style={styles.infoLineTitle}>الملاحظات:</Text>
                  <Text style={styles.infoLineContent}>{invoice.notes}</Text>
                </View>
              ) : null}
              {invoice.terms ? (
                <View style={styles.infoLineContainer}>
                  <Text style={styles.infoLineTitle}>الشروط والأحكام:</Text>
                  <Text style={styles.infoLineContent}>{invoice.terms}</Text>
                </View>
              ) : null}
              {company.website ? (
                <Text style={styles.infoWebsiteText}>{company.website}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── 6. TAFQEET RIBBON (Spelled-out words) ─── */}
        <View style={styles.tafqeetRibbon} wrap={false}>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>ريال سعودي</Text>
          </View>
          <View style={styles.tafqeetCenter}>
            <Text style={styles.tafqeetWords}>{tafqeetText}</Text>
          </View>
          <View style={styles.tafqeetLabelBadge}>
            <Text style={styles.tafqeetLabelBadgeText}>صافي قيمة الفاتورة (كتابة)</Text>
          </View>
        </View>

        {/* ─── 7. LOWER SIGNATURE & VERIFICATION SECTION ─── */}
        <View style={styles.acknowledgmentSection} wrap={false}>
          {/* Left: Quality Certification & Official ZATCA QR Code */}
          <View style={styles.certQrBlock}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.zatcaQrImage} />
            ) : null}
            <View style={styles.certTextBlock}>
              <Text style={styles.certTitleAr}>معتمد ومطابق للمواصفات</Text>
              <Text style={styles.certTitleEn}>Certified Tax Invoice</Text>
            </View>
          </View>

          {/* Right: Signature Grid (Removed "استلمت البضاعة كاملة وبحالة سليمة" header line) */}
          <View style={styles.signaturesTable}>
            <View style={styles.sigColsRow}>
              {/* Received By */}
              <View style={styles.sigCol}>
                <View style={styles.sigColTitle}>
                  <Text style={styles.sigTitleEn}>Received By</Text>
                  <Text style={styles.sigTitleAr}>المستلم</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Name / الاسم</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Sign / التوقيع</Text>
                </View>
              </View>

              {/* Salesman */}
              <View style={[styles.sigCol, styles.cellBorderLeft]}>
                <View style={styles.sigColTitle}>
                  <Text style={styles.sigTitleEn}>Salesman</Text>
                  <Text style={styles.sigTitleAr}>مندوب المبيعات</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Name / الاسم</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Sign / التوقيع</Text>
                </View>
              </View>

              {/* Entered By */}
              <View style={[styles.sigCol, styles.cellBorderLeft]}>
                <View style={styles.sigColTitle}>
                  <Text style={styles.sigTitleEn}>Entered By</Text>
                  <Text style={styles.sigTitleAr}>إعداد الفاتورة</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Name / الاسم</Text>
                </View>
                <View style={styles.sigEntryRow}>
                  <Text style={styles.sigSmallLabel}>Sign / التوقيع</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 8. BOTTOM ANGULAR BLUE FOOTER ─── */}
        <View style={styles.bottomBanner} wrap={false}>
          <Svg style={styles.bannerPolygon} viewBox="0 0 555 30">
            <Polygon
              points="0,30 18,0 555,0 555,30"
              fill="#005B94"
            />
          </Svg>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerArText}>
              {company.footerText || formatCompanyFullAddress(company)}
              {company.phone ? ` - جوال: ${company.phone}` : ""}
            </Text>
            {company.website || company.email ? (
              <Text style={styles.bannerSubText}>
                {[company.website, company.email].filter(Boolean).join(" - ")}
              </Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
    objectFit: "contain",
  },

  // 1. Header
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  headerLeft: {
    width: "35%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  companyLogo: {
    width: 75,
    height: 45,
    objectFit: "contain",
  },
  headerRight: {
    width: "60%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#005B94",
    marginBottom: 2,
  },
  companyNameEn: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#003865",
    marginBottom: 3,
    fontFamily: "Helvetica",
  },
  crVatRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 2,
  },
  bidiInlinePair: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 7,
    color: "#333333",
  },
  metaColon: {
    fontSize: 7,
    marginHorizontal: 2,
    color: "#333333",
  },
  metaValue: {
    fontSize: 7,
    color: "#000000",
    fontWeight: "bold",
  },
  metaSeparator: {
    fontSize: 7,
    marginHorizontal: 3,
    color: "#555555",
  },
  metaSubText: {
    fontSize: 6.5,
    color: "#444444",
    fontFamily: "Helvetica",
  },

  // 2. Title
  titleContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  titleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
  },

  // 3. Metadata Grid
  metaGrid: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 16,
  },
  gridCell: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  cellBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
  },
  cellWidth30: { width: "30%" },
  cellWidth33: { width: "33.33%" },
  cellWidth34: { width: "33.34%" },
  cellWidth35: { width: "35%" },
  cellWidth50: { width: "50%" },
  cellWidth67: { width: "66.67%" },
  cellLabelEn: {
    fontSize: 6.5,
    color: "#000000",
    fontFamily: "Helvetica",
    fontWeight: "bold",
  },
  cellLabelAr: {
    fontSize: 7,
    color: "#000000",
    fontWeight: "bold",
  },
  cellValueCenter: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  cellValueCenterBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  subHeaderRow: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0,
  },
  subHeaderTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
  },
  subHeaderAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // 4. Items Table
  itemsTable: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#005B94",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 20,
  },
  thCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  thAr: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEn: {
    color: "#FFFFFF",
    fontSize: 5.5,
    fontFamily: "Helvetica",
    textAlign: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
    minHeight: 16,
    alignItems: "center",
  },
  altRowBg: {
    backgroundColor: "#F9FBFC",
  },
  emptyFillerRow: {
    flexDirection: "row",
  },
  tdCell: {
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 1.5,
    borderRightWidth: 1,
    borderRightColor: "#DDDDDD",
    height: "100%",
  },
  colVal: { width: "13%" },
  colVat: { width: "11%" },
  colUPrice: { width: "12%" },
  colUnit: { width: "9%" },
  colQty: { width: "9%" },
  colDesc: { width: "31%" },
  colCode: { width: "10%" },
  colNo: { width: "5%", borderRightWidth: 0 },

  cellNumber: {
    fontSize: 7,
    textAlign: "center",
  },
  cellNumberBold: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  cellCenterText: {
    fontSize: 7,
    textAlign: "center",
  },
  descText: {
    fontSize: 7,
    textAlign: "right",
  },
  discountHint: {
    fontSize: 5.5,
    color: "#C53030",
    textAlign: "right",
  },

  // 5. Totals & Additional Info Section
  summarySection: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  totalsTable: {
    width: "48%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    height: 15,
  },
  totalValCell: {
    width: "42%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 2,
  },
  totalValText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  totalLabelCell: {
    width: "58%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#005B94",
    paddingHorizontal: 4,
  },
  totalLabelAr: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: "bold",
  },
  totalLabelDash: {
    color: "#FFFFFF",
    fontSize: 6.5,
  },
  totalLabelEn: {
    color: "#FFFFFF",
    fontSize: 5.5,
    fontFamily: "Helvetica",
  },
  netAmountRow: {
    borderBottomWidth: 0,
  },
  netAmountValText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#005B94",
  },

  additionalInfoBox: {
    width: "52%",
    flexDirection: "column",
  },
  additionalInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    backgroundColor: "#F2F4F7",
  },
  addInfoAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  addInfoEn: {
    fontSize: 6,
    fontFamily: "Helvetica",
    fontWeight: "bold",
    color: "#000000",
  },
  additionalInfoBody: {
    padding: 4,
    flex: 1,
  },
  infoLineContainer: {
    marginBottom: 2,
  },
  infoLineTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#005B94",
  },
  infoLineContent: {
    fontSize: 6,
    color: "#333333",
  },
  infoWebsiteText: {
    fontSize: 6.5,
    color: "#005B94",
    fontFamily: "Helvetica",
    textAlign: "center",
    marginTop: 3,
  },

  // 6. Tafqeet Ribbon
  tafqeetRibbon: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    height: 16,
    alignItems: "center",
    marginBottom: 4,
  },
  currencyBadge: {
    width: "18%",
    height: "100%",
    backgroundColor: "#005B94",
    justifyContent: "center",
    alignItems: "center",
  },
  currencyBadgeText: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: "bold",
  },
  tafqeetCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tafqeetWords: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  tafqeetLabelBadge: {
    width: "25%",
    height: "100%",
    backgroundColor: "#005B94",
    justifyContent: "center",
    alignItems: "center",
  },
  tafqeetLabelBadgeText: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: "bold",
  },

  // 7. Acknowledgment & Signatures
  acknowledgmentSection: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
    minHeight: 46,
  },
  certQrBlock: {
    width: "28%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  zatcaQrImage: {
    width: 64,
    height: 64,
  },
  qrPlaceholder: {
    width: 64,
    height: 64,
  },
  certTextBlock: {
    marginLeft: 3,
    alignItems: "center",
  },
  certTitleAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#005B94",
  },
  certTitleEn: {
    fontSize: 5,
    fontFamily: "Helvetica",
    color: "#444444",
  },
  signaturesTable: {
    width: "72%",
    flexDirection: "column",
  },
  sigColsRow: {
    flexDirection: "row",
    flex: 1,
  },
  sigCol: {
    flex: 1,
    flexDirection: "column",
  },
  sigColTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
    backgroundColor: "#FAFAFA",
  },
  sigTitleAr: {
    fontSize: 6,
    fontWeight: "bold",
  },
  sigTitleEn: {
    fontSize: 5.5,
    fontFamily: "Helvetica",
  },
  sigEntryRow: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  sigSmallLabel: {
    fontSize: 5.5,
    color: "#777777",
  },

  // 8. Bottom Banner
  bottomBanner: {
    marginTop: "auto",
    height: 28,
    position: "relative",
    justifyContent: "center",
  },
  bannerPolygon: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 28,
  },
  bannerContent: {
    paddingLeft: 20,
    paddingRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerArText: {
    color: "#FFFFFF",
    fontSize: 6,
    textAlign: "center",
  },
  bannerSubText: {
    color: "#E2E8F0",
    fontSize: 5.5,
    fontFamily: "Helvetica",
    textAlign: "center",
    marginTop: 1,
  },
});
