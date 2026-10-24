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

export interface AlQahwaAlBarriahTemplateProps {
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

// ─── Number to Arabic Words (Tafqeet) ─────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toEasternArabicDigits(str?: string | number | null): string {
  if (str === null || str === undefined) return "";
  return String(str).replace(/\d/g, (d) => EASTERN_DIGITS[Number(d)] ?? d);
}

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

function formatDateTime(dateStr?: string | null, timeStr?: string | null): { dateAr: string; timeAr: string } {
  if (!dateStr) return { dateAr: "", timeAr: "" };
  const d = dateStr.slice(0, 10).split("-");
  const formattedDate = d && d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : dateStr;
  const dateAr = toEasternArabicDigits(formattedDate);

  let timeAr = "";
  if (timeStr && timeStr.trim().length > 0) {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const mins = parts[1] || "00";
    const secs = parts[2] || "00";
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const timeFormatted = `${String(h12).padStart(2, "0")}:${mins}:${secs}`;
    timeAr = `${toEasternArabicDigits(timeFormatted)} ${ampm}`;
  }

  return { dateAr, timeAr };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlQahwaAlBarriahTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: AlQahwaAlBarriahTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Address assembly — strict no-fallback policy: only include fields that actually exist
  const companyAddressParts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
  ].filter((p): p is string => Boolean(p && p.trim().length > 0));
  const companyAddress = companyAddressParts.length > 0 ? companyAddressParts.join(" - ") : null;

  const customerAddressParts = [
    customer.addressStreet,
    customer.addressDistrict,
    customer.addressCity,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    customer.addressAdditionalNumber ? `الرقم الإضافي ${customer.addressAdditionalNumber}` : null,
  ].filter((p): p is string => Boolean(p && p.trim().length > 0));
  const customerAddress = customerAddressParts.length > 0 ? customerAddressParts.join(" - ") : null;

  // Customer display name
  const customerDisplay = [customer.clientEmployee, customer.nameAr || customer.nameEn]
    .filter(Boolean)
    .join("-");

  // Date and Time — purely from actual invoice data, no fallbacks
  const { dateAr: issueDateAr, timeAr: issueTimeAr } = formatDateTime(invoice.issueDate, invoice.issueTime);
  const invoiceNumAr = invoice.invoiceNumber ? toEasternArabicDigits(invoice.invoiceNumber) : "";
  const invoiceTypeLabel = invoice.invoiceType === "simplified" ? "مبسطة" : "آجل";

  // Warehouse / branch: only actual data if present
  const warehouse = (invoice as { warehouse?: string }).warehouse || (company as { warehouse?: string }).warehouse || null;

  // Items processing
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

    const itemCode = (item as { itemCode?: string }).itemCode || (item.savedProductId ? item.savedProductId.slice(0, 6) : "") || "";
    const itemUnit = (item as { unit?: string }).unit || "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      code: itemCode,
      desc: item.description || "",
      unit: itemUnit,
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

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const tafqeetText = tafqeet(grandTotal);

  // Dynamic single-page height sizing
  const extraItemsCount = Math.max(0, rows.length - 5);
  let extraHeight = extraItemsCount * 22;
  if (invoice.notes) extraHeight += 18 + Math.min(invoice.notes.split("\n").length, 4) * 8;
  if (invoice.terms) extraHeight += 18 + Math.min(invoice.terms.split("\n").length, 4) * 8;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Sales Invoice ${invoice.invoiceNumber ?? "DRAFT"}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="TAX INVOICE - AL QAHWA AL BARRIAH"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {/* Background Watermark if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER BOX WITH ROUNDED BORDER ─── */}
        <View style={styles.headerBox}>
          {/* Left Column: English info */}
          <View style={styles.headerLeftCol}>
            {company.nameEn ? (
              <Text style={styles.headerCompanyEn}>{company.nameEn}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerMetaEn}>Tax No. (TIN) : {company.vatNumber}</Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.headerMetaEn}>CRN : {company.crNumber}</Text>
            ) : null}
          </View>

          {/* Center Column: Logo & Titles */}
          <View style={styles.headerCenterCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logo} />
            ) : (
              <View style={styles.logoSpacer} />
            )}
            <Text style={styles.titleAr}>فاتورة المبيعات</Text>
            <Text style={styles.titleEn}>Sales Invoice</Text>
          </View>

          {/* Right Column: Arabic info (RTL) */}
          <View style={styles.headerRightCol}>
            {company.nameAr ? (
              <Text style={styles.headerCompanyAr}>{company.nameAr}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerAddressAr}>{companyAddress}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerMetaAr}>
                الرقم الضريبي : {toEasternArabicDigits(company.vatNumber)}
              </Text>
            ) : null}
            {company.crNumber ? (
              <Text style={styles.headerMetaAr}>
                رقم السجل التجاري : {toEasternArabicDigits(company.crNumber)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. METADATA & ZATCA QR BOX ─── */}
        <View style={styles.metaBox}>
          {/* Left: Large ZATCA 2D QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.draftBox}>
                <Text style={styles.draftText}>مسودة DRAFT</Text>
              </View>
            )}
          </View>

          {/* Right: Metadata Grid in Arabic */}
          <View style={styles.metaDataCol}>
            {/* Row 1: Invoice No, Type, Date */}
            <View style={styles.metaRow}>
              {invoiceNumAr ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>رقم الفاتورة :</Text>
                  <Text style={styles.metaValue}>{invoiceNumAr}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>نوع الفاتورة :</Text>
                <Text style={styles.metaValue}>{invoiceTypeLabel}</Text>
              </View>
              {issueDateAr ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>التاريخ :</Text>
                  <Text style={styles.metaValue}>
                    {issueDateAr}
                    {issueTimeAr ? ` ${issueTimeAr}` : ""}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Row 2: Currency & Warehouse (only if exists) */}
            <View style={styles.metaRow}>
              {invoice.currency ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>العملة :</Text>
                  <Text style={styles.metaValue}>{invoice.currency}</Text>
                </View>
              ) : null}
              {warehouse ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>المخزن :</Text>
                  <Text style={styles.metaValue}>{warehouse}</Text>
                </View>
              ) : null}
            </View>

            {/* Row 3: Customer Name */}
            {customerDisplay ? (
              <View style={styles.metaRow}>
                <View style={[styles.metaItem, { width: "100%" }]}>
                  <Text style={styles.metaLabel}>اسم العميل :</Text>
                  <Text style={styles.metaValue}>{customerDisplay}</Text>
                </View>
              </View>
            ) : null}

            {/* Row 4: Customer VAT & Phone */}
            <View style={styles.metaRow}>
              {customer.vatNumber ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>الرقم الضريبي :</Text>
                  <Text style={styles.metaValue}>{toEasternArabicDigits(customer.vatNumber)}</Text>
                </View>
              ) : null}
              {customer.phone ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>رقم التلفون :</Text>
                  <Text style={styles.metaValue}>{toEasternArabicDigits(customer.phone)}</Text>
                </View>
              ) : null}
            </View>

            {/* Row 5: Customer Address */}
            {customerAddress ? (
              <View style={styles.metaRow}>
                <View style={[styles.metaItem, { width: "100%" }]}>
                  <Text style={styles.metaLabel}>العنوان :</Text>
                  <Text style={styles.metaValue}>{customerAddress}</Text>
                </View>
              </View>
            ) : null}

            {/* Row 6: Notice Line */}
            <View style={[styles.metaRow, { marginTop: 2 }]}>
              <Text style={styles.metaNotice}>عليكم فاتورة مبيعات</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. LINE ITEMS TABLE (11 COLUMNS) ─── */}
        <View style={styles.table}>
          {/* Table Header (RTL order: # on Right, Total SAR on Left) */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, styles.colPos]}>
              <Text style={styles.thText}>رقم{"\n"}مسلسل</Text>
            </View>
            <View style={[styles.thCell, styles.colCode]}>
              <Text style={styles.thText}>رقم الصنف</Text>
            </View>
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thText}>اسم الصنف</Text>
            </View>
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thText}>الوحدة</Text>
            </View>
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thText}>السعر</Text>
            </View>
            <View style={[styles.thCell, styles.colDiscount]}>
              <Text style={styles.thText}>الخصم</Text>
            </View>
            <View style={[styles.thCell, styles.colTaxable]}>
              <Text style={styles.thText}>السعر{"\n"}الإجمالي{"\n"}غير شامل ضريبة</Text>
            </View>
            <View style={[styles.thCell, styles.colVatRate]}>
              <Text style={styles.thText}>ضريبة{"\n"}القيمة{"\n"}المضافة %</Text>
            </View>
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thText}>ضريبة{"\n"}القيمة{"\n"}المضافة ريال</Text>
            </View>
            <View style={[styles.thCell, styles.colTotal, { borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>الإجمالي ريال{"\n"}سعودي</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              <View style={[styles.tdCell, styles.colPos]}>
                <Text style={styles.tdCenterText}>{row.index}</Text>
              </View>
              <View style={[styles.tdCell, styles.colCode]}>
                <Text style={styles.tdCenterText}>{row.code}</Text>
              </View>
              <View style={[styles.tdCell, styles.colDesc]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>
              <View style={[styles.tdCell, styles.colUnit]}>
                <Text style={styles.tdCenterText}>{row.unit}</Text>
              </View>
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterText}>{formatQty(row.qty)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.unitPrice)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colDiscount]}>
                <Text style={styles.tdCenterText}>
                  {row.lineDiscount > 0 ? formatExactAmount(row.lineDiscount) : "0.00"}
                </Text>
              </View>
              <View style={[styles.tdCell, styles.colTaxable]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.taxableSubtotal)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colVatRate]}>
                <Text style={styles.tdCenterText}>{formatQty(row.vatRate)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colVatAmount]}>
                <Text style={styles.tdCenterText}>{formatExactAmount(row.lineVat)}</Text>
              </View>
              <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                <Text style={styles.tdTotalText}>{formatExactAmount(row.lineTotal)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 4. TOTALS SECTION (ALIGNED ON THE LEFT IN DARK RED) ─── */}
        <View style={styles.totalsCard} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formatExactAmount(taxableAmount)}</Text>
            <Text style={styles.totalColon}>:</Text>
            <Text style={styles.totalLabel}>الإجمالي غير شامل ضريبة القيمة المضافة</Text>
          </View>
          {invoiceDiscount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>-{formatExactAmount(invoiceDiscount)}</Text>
              <Text style={styles.totalColon}>:</Text>
              <Text style={styles.totalLabel}>خصم الفاتورة</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>0.00</Text>
            <Text style={styles.totalColon}>:</Text>
            <Text style={styles.totalLabel}>الأعباء</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formatExactAmount(totalVat)}</Text>
            <Text style={styles.totalColon}>:</Text>
            <Text style={styles.totalLabel}>الضريبة المضافة</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formatExactAmount(grandTotal)}</Text>
            <Text style={styles.totalColon}>:</Text>
            <Text style={styles.totalLabel}>المجموع شامل الضريبة المضافة</Text>
          </View>
        </View>

        {/* ─── 5. TAFQEET LINE ─── */}
        <View style={styles.tafqeetSection} wrap={false}>
          <Text style={styles.tafqeetText}>{tafqeetText}</Text>
        </View>

        {/* ─── 6. SIX SIGNATURES HORIZONTALLY DISTRIBUTED ─── */}
        <View style={styles.signaturesRow} wrap={false}>
          {/* 1. العميل */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureTitle}>العميل</Text>
          </View>

          {/* 2. المحاسب */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace}>
              {signatureDataUrl ? (
                <Image src={signatureDataUrl} style={styles.signatureImage} />
              ) : null}
            </View>
            <Text style={styles.signatureTitle}>المحاسب</Text>
          </View>

          {/* 3. مندوب المبيعات */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureTitle}>مندوب المبيعات</Text>
          </View>

          {/* 4. المخازن */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureTitle}>المخازن</Text>
          </View>

          {/* 5. مدير الحسابات */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureTitle}>مدير الحسابات</Text>
          </View>

          {/* 6. مدير المبيعات */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureTitle}>مدير المبيعات</Text>
          </View>
        </View>

        {/* ─── 7. BOTTOM FOOTER WITH HORIZONTAL DIVIDER ─── */}
        <View style={styles.footer} wrap={false}>
          <Text style={styles.footerLeft}>1 / 1</Text>
          {company.footerText ? (
            <Text style={styles.footerRight}>{company.footerText}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.06,
  },

  // 1. Header Box
  headerBox: {
    borderWidth: 1.2,
    borderColor: "#000000",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeftCol: {
    width: "35%",
    alignItems: "flex-start",
    textAlign: "left",
  },
  headerCompanyEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    marginBottom: 1,
    color: "#000000",
  },
  headerMetaEn: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    marginTop: 1,
    color: "#000000",
  },
  headerCenterCol: {
    width: "30%",
    alignItems: "center",
    textAlign: "center",
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    marginBottom: 2,
  },
  logoSpacer: {
    height: 10,
  },
  titleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#000000",
  },
  titleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
  },
  headerRightCol: {
    width: "35%",
    alignItems: "flex-end",
    textAlign: "right",
  },
  headerCompanyAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    marginBottom: 1,
    color: "#000000",
  },
  headerAddressAr: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    marginBottom: 1,
    color: "#000000",
  },
  headerMetaAr: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    marginTop: 1,
    color: "#000000",
  },

  // 2. Metadata Box
  metaBox: {
    borderWidth: 1.2,
    borderColor: "#000000",
    padding: 6,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  qrCol: {
    width: 78,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 74,
    height: 74,
  },
  draftBox: {
    width: 74,
    height: 74,
    borderWidth: 1,
    borderColor: "#999999",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 7.5,
    color: "#999999",
    fontFamily: "Tajawal",
  },
  metaDataCol: {
    flex: 1,
    paddingLeft: 10,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    marginBottom: 2,
  },
  metaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginLeft: 14,
  },
  metaLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    marginLeft: 3,
  },
  metaValue: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
  },
  metaNotice: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "right",
  },

  // 3. Line Items Table
  table: {
    width: "100%",
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#BBDCF8",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 28,
  },
  tableDataRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 20,
    alignItems: "center",
  },
  thCell: {
    borderLeftWidth: 1,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  tdCell: {
    borderLeftWidth: 1,
    borderColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    height: "100%",
    justifyContent: "center",
  },
  thText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  tdTotalText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (Sum = 100%)
  colPos: { width: "4%" },
  colCode: { width: "8%" },
  colDesc: { width: "27%" },
  colUnit: { width: "6%" },
  colQty: { width: "6%" },
  colPrice: { width: "8%" },
  colDiscount: { width: "7%" },
  colTaxable: { width: "12%" },
  colVatRate: { width: "7%" },
  colVatAmount: { width: "7%" },
  colTotal: { width: "8%" },

  // 4. Totals Card
  totalsCard: {
    width: "48%",
    marginTop: 6,
    alignSelf: "flex-start",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  totalLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    textAlign: "right",
  },
  totalColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    marginHorizontal: 3,
  },
  totalValue: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#800000",
    textAlign: "left",
    minWidth: 70,
  },

  // 5. Tafqeet Section
  tafqeetSection: {
    borderTopWidth: 0.8,
    borderColor: "#E5E7EB",
    marginTop: 6,
    paddingTop: 4,
  },
  tafqeetText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#800000",
    textAlign: "right",
  },

  // 6. Signatures Row
  signaturesRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 4,
  },
  signatureCol: {
    width: "15%",
    alignItems: "center",
    textAlign: "center",
  },
  signatureSpace: {
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  signatureImage: {
    maxHeight: 28,
    maxWidth: 60,
    objectFit: "contain",
  },
  signatureTitle: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },

  // 7. Footer
  footer: {
    borderTopWidth: 1.2,
    borderColor: "#000000",
    marginTop: "auto",
    paddingTop: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
  },
  footerRight: {
    fontFamily: "Tajawal",
    fontSize: 7,
    color: "#000000",
  },
});
