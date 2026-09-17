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

export interface Template6JabalAlRayanProps {
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

// ─── Optional extension fields (safely extracted, default to empty/zero) ───
interface InvoiceExtensions {
  store?: string | null;
  salesman?: string | null;
  salesmanName?: string | null;
  invoiceType?: string | null;
  paymentType?: string | null;
  customerNo?: string | null;
  receiver?: string | null;
  discountTotal?: number | string | null;
  discount?: number | string | null;
}

interface ItemExtensions {
  partNo?: string | null;
  itemNo?: string | null;
  itemCode?: string | null;
  code?: string | null;
  tensile?: string | number | null;
  pack?: string | number | null;
  unit?: string | null;
  unitName?: string | null;
  uom?: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  const text = value.trim();
  if (UUID_RE.test(text)) return true;
  if (
    text.length >= 20 &&
    (text.match(/-/g) || []).length >= 2 &&
    /^[0-9a-f-]+$/i.test(text)
  ) {
    return true;
  }
  return false;
}

function getItemPartNo(item: InvoiceItemDto, index: number): string {
  const ext = item as InvoiceItemDto & ItemExtensions;
  const candidates = [ext.partNo, ext.itemNo, ext.itemCode, ext.code, item.savedProductId];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s === "" || isUuidLike(s)) continue;
    return s;
  }
  return "";
}

function getItemUnit(item: InvoiceItemDto): string {
  const ext = item as InvoiceItemDto & ItemExtensions;
  return ext.unit ?? ext.unitName ?? ext.uom ?? "";
}

function getItemTensile(item: InvoiceItemDto): string {
  const ext = item as InvoiceItemDto & ItemExtensions;
  const val = ext.tensile ?? ext.pack;
  if (val === null || val === undefined) return "";
  return String(val);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(
  val: string | number | null | undefined,
  decimals = 2,
): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return clean;
}

// ─── Arabic tafqeet (number → words) ───
const ONES_AR = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS_AR = [
  "عشرة",
  "أحد عشر",
  "إثنا عشر",
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

function tafqeet(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  const groups: string[] = [];
  const millions = Math.floor(riyals / 1000000);
  const thousands = Math.floor((riyals % 1000000) / 1000);
  const rest = riyals % 1000;

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
  text += " ريال سعودي";
  if (halalas > 0) {
    text += ` و${convertThreeDigits(halalas)} هللة`;
  }
  return text;
}

export function Template6JabalAlRayan({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: Template6JabalAlRayanProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const compExt = company as CompanyRecord & {
    activityDescription?: string | null;
    mobile?: string | null;
  };
  const invExt = invoice as InvoiceDto & InvoiceExtensions;
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateFormatted = formatDate(invoice.issueDate);
  const store = invExt.store ?? "";
  const salesman = invExt.salesman ?? invExt.salesmanName ?? "";
  const invoiceType = invExt.invoiceType ?? invExt.paymentType ?? "تحويل";
  const customerNo = invExt.customerNo ?? customer.unifiedNumber ?? "";
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const receiver = invExt.receiver ?? "";

  // Totals
  const subtotal = toNumber(invoice.subtotal);
  const vatAmount = toNumber(invoice.vatAmount);
  const discountTotal = toNumber(invExt.discountTotal ?? invExt.discount ?? 0);
  const total = toNumber(invoice.total);
  const tafqeetText = total > 0 ? tafqeet(total) : "";

  // Items
  const items = invoice.items ?? [];
  const minRows = 16;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  return (
    <Document
      title={`فاتورة ضريبية - ${invoiceNum}`}
      author={company.nameAr || company.nameEn || "شركة جبل الريان"}
      subject="Tax Invoice - فاتورة مبيعات"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* Background watermark if supplied */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.watermarkBg} />
        ) : null}

        {/* ─── OUTER MAROON FRAME ─── */}
        <View style={styles.outerFrame}>
          {/* ─── 1. TOP HEADER SECTION ─── */}
          <View style={styles.headerContainer}>
            {/* Top row: English on left, Logo in center, Arabic on right */}
            <View style={styles.headerTopRow}>
              {/* Left Column (English) */}
              <View style={styles.headerLeftCol}>
                <Text style={styles.companyNameEn}>
                  {company.nameEn || "Jabal Al Rayan Trading Company"}
                </Text>
                <Text style={styles.headerSubTextEn}>
                  {(company as any).activityDescription || "For wholesale trade in household utensils,stationery, stationery, and childrene toys"}
                </Text>
                <Text style={styles.headerCrLine}>
                  {company.crNumber ? `C.R.: ${company.crNumber}` : ""}
                  {company.addressCity ? ` - ${company.addressCity}` : ""}
                  {company.addressPostalCode ? `: ${company.addressPostalCode}` : ""}
                </Text>
                <Text style={styles.headerBranchEn}>
                  {[
                    company.addressDistrict ? `${company.addressDistrict}` : "",
                    company.phone ? `PHONE: ${company.phone}` : "",
                    (company as any).mobile ? `MOBILE: ${(company as any).mobile}` : "",
                  ].filter(Boolean).join(" - ")}
                </Text>
              </View>

              {/* Center Column (Logo & Tax Invoice text) */}
              <View style={styles.headerCenterCol}>
                {logoDataUrl ? (
                  <Image src={logoDataUrl} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoFallback}>
                    <Text style={styles.logoFallbackText}>JR</Text>
                  </View>
                )}
                <Text style={styles.taxInvoiceTitleCenter}>فاتورة ضريبية</Text>
              </View>

              {/* Right Column (Arabic) */}
              <View style={styles.headerRightCol}>
                <Text style={styles.companyNameAr}>
                  {company.nameAr || "شركة جبل الريان التجارية"}
                </Text>
                <Text style={styles.headerSubTextAr}>
                  {(company as any).activityDescription || "للتجارة الجملة في الاواني المنزلية والأدوات المكتبية القرطاسية والعاب الأطفال"}
                </Text>
                <Text style={styles.headerCrLine}>
                  {company.crNumber ? `س.ت: ${company.crNumber}` : ""}
                  {company.addressCity ? ` - ${company.addressCity}` : ""}
                  {company.addressPostalCode ? `: ${company.addressPostalCode}` : ""}
                </Text>
                <Text style={styles.headerBranchAr}>
                  {[
                    company.addressDistrict ? `${company.addressDistrict}` : "",
                    company.phone ? `تليفون : ${company.phone}` : "",
                    (company as any).mobile ? `جوال : ${(company as any).mobile}` : "",
                  ].filter(Boolean).join(" - ")}
                </Text>
              </View>
            </View>

            {/* Bottom Row of Header: Full-width VAT line */}
            <View style={styles.headerVatStrip}>
              <Text style={styles.headerVatText}>
                {company.vatNumber
                  ? `VAT| ${company.vatNumber} | الرقم الضريبي`
                  : ""}
              </Text>
            </View>
          </View>

          {/* ─── 2. SALES INVOICE CALLIGRAPHIC PILL BANNER ─── */}
          <View style={styles.salesInvoiceBannerWrap}>
            <View style={styles.salesInvoiceBannerPill}>
              <Text style={styles.salesInvoiceBannerText}>فاتورة مبيعات</Text>
            </View>
          </View>

          {/* ─── 3. METADATA CAPSULE CELLS (ROW 1) ─── */}
          <View style={styles.metaRow1}>
            {/* Cell 1: STORE / المخزن */}
            <View style={[styles.capsuleCell, { flex: 1.2 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>STORE</Text>
                <Text style={styles.capsuleLabelAr}>المخزن</Text>
              </View>
              <Text style={styles.capsuleValueText}>{store}</Text>
            </View>

            {/* Cell 2: SALESMAN / البائع */}
            <View style={[styles.capsuleCell, { flex: 1.2 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>SALESMAN</Text>
                <Text style={styles.capsuleLabelAr}>البائع</Text>
              </View>
              <Text style={styles.capsuleValueText}>{salesman}</Text>
            </View>

            {/* Cell 3: INVOICE NO. نوع الفاتورة (Payment method / invoice notes) */}
            <View style={[styles.capsuleCell, { flex: 1.5 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>INVOICE NO.</Text>
                <Text style={styles.capsuleLabelAr}>نوع الفاتورة</Text>
              </View>
              <Text style={styles.capsuleValueText}>{invoiceType}</Text>
            </View>

            {/* Cell 4: INVOICETYPE رقم الفاتورة (Actual Invoice No.) */}
            <View style={[styles.capsuleCell, { flex: 1.4 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>INVOICETYPE</Text>
                <Text style={styles.capsuleLabelAr}>رقم الفاتورة</Text>
              </View>
              <Text style={styles.capsuleValueTextBold}>{invoiceNum}</Text>
            </View>

            {/* Cell 5: DATE التاريخ */}
            <View style={[styles.capsuleCell, { flex: 1.3 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>DATE</Text>
                <Text style={styles.capsuleLabelAr}>التاريخ</Text>
              </View>
              <Text style={styles.capsuleValueText}>{issueDateFormatted}</Text>
            </View>
          </View>

          {/* ─── 4. CUSTOMER INFO CAPSULE CELLS (ROW 2) ─── */}
          <View style={styles.metaRow2}>
            {/* Cell 1: VAT NUMBER OF CLIENT / الرقم الضريبي */}
            <View style={[styles.capsuleCell, { flex: 1.8 }]}>
              <Text style={styles.capsuleLabelCenter}>الرقم الضريبي</Text>
              <Text style={styles.capsuleValueText}>{customerVat}</Text>
            </View>

            {/* Cell 2: CUSTOMER NAME / إسم العميل */}
            <View style={[styles.capsuleCell, { flex: 3.5 }]}>
              <Text style={styles.capsuleLabelCenter}>إسم العميل</Text>
              <Text style={styles.capsuleValueCustomerName}>{customerName}</Text>
              <Text style={styles.capsuleSubLabelCenter}>CUSTOMER NAME</Text>
            </View>

            {/* Cell 3: CUSTOMER NO. رقم العميل */}
            <View style={[styles.capsuleCell, { flex: 1.8 }]}>
              <View style={styles.capsuleHeader}>
                <Text style={styles.capsuleLabelEn}>CUSTOMER NO.</Text>
                <Text style={styles.capsuleLabelAr}>رقم العميل</Text>
              </View>
              <Text style={styles.capsuleValueText}>{customerNo}</Text>
            </View>
          </View>

          {/* ─── 5. PRODUCT ITEMS TABLE ─── */}
          <View style={styles.tableContainer}>
            {/* Header Row */}
            <View style={styles.tableHeaderRow}>
              {/* Col 1: الرقم التسلسلي / PART NO */}
              <View style={[styles.thCell, styles.colSeq]}>
                <Text style={styles.thTextAr}>الرقم</Text>
                <Text style={styles.thTextAr}>التسلسلي</Text>
                <Text style={styles.thTextEn}>PART NO</Text>
              </View>

              {/* Col 2: رقم الصنف / PART NO. */}
              <View style={[styles.thCell, styles.colPartNo]}>
                <Text style={styles.thTextAr}>رقم الصنف</Text>
                <Text style={styles.thTextEn}>PART NO.</Text>
              </View>

              {/* Col 3: إسم الصنف / DESCRIPTION */}
              <View style={[styles.thCell, styles.colDesc]}>
                <Text style={styles.thTextAr}>إسم الصنف</Text>
                <Text style={styles.thTextEn}>DESCRIPTION</Text>
              </View>

              {/* Col 4: الوحدة / UNIT */}
              <View style={[styles.thCell, styles.colUnit]}>
                <Text style={styles.thTextAr}>الوحدة</Text>
                <Text style={styles.thTextEn}>UNIT</Text>
              </View>

              {/* Col 5: الشد / TENSILE */}
              <View style={[styles.thCell, styles.colTensile]}>
                <Text style={styles.thTextAr}>الشد</Text>
                <Text style={styles.thTextEn}>TENSILE</Text>
              </View>

              {/* Col 6: الكمية / QUANTITY */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thTextAr}>الكمية</Text>
                <Text style={styles.thTextEn}>QUANTITY</Text>
              </View>

              {/* Col 7: السعر / PRICE */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thTextAr}>السعر</Text>
                <Text style={styles.thTextEn}>PRICE</Text>
              </View>

              {/* Col 8: الإجمالي / TOTAL (last, no right border) */}
              <View style={[styles.thCell, styles.colTotal, { borderRightWidth: 0 }]}>
                <Text style={styles.thTextAr}>الإجمالي</Text>
                <Text style={styles.thTextEn}>TOTAL</Text>
              </View>
            </View>

            {/* Table Body Rows */}
            {items.map((item, idx) => {
              const partNo = getItemPartNo(item, idx);
              const desc = item.description || "";
              const unit = getItemUnit(item);
              const tensile = getItemTensile(item);
              const qty = toNumber(item.quantity);
              const price = toNumber(item.unitPrice);
              const lineTotal = toNumber(item.lineTotal || qty * price);

              return (
                <View key={item.position ?? idx} style={styles.tableBodyRow}>
                  {/* Seq No */}
                  <View style={[styles.tdCell, styles.colSeq]}>
                    <Text style={styles.tdTextCenter}>{idx + 1}</Text>
                  </View>

                  {/* Part No */}
                  <View style={[styles.tdCell, styles.colPartNo]}>
                    <Text style={styles.tdTextLeft}>{partNo}</Text>
                  </View>

                  {/* Description */}
                  <View style={[styles.tdCell, styles.colDesc]}>
                    <Text style={styles.tdTextDesc}>{desc}</Text>
                  </View>

                  {/* Unit */}
                  <View style={[styles.tdCell, styles.colUnit]}>
                    <Text style={styles.tdTextCenter}>{unit}</Text>
                  </View>

                  {/* Tensile */}
                  <View style={[styles.tdCell, styles.colTensile]}>
                    <Text style={styles.tdTextCenter}>{tensile}</Text>
                  </View>

                  {/* Quantity */}
                  <View style={[styles.tdCell, styles.colQty]}>
                    <Text style={styles.tdTextCenter}>
                      {qty > 0 ? (Number.isInteger(qty) ? String(qty) : formatNumber(qty, 2)) : ""}
                    </Text>
                  </View>

                  {/* Price */}
                  <View style={[styles.tdCell, styles.colPrice]}>
                    <Text style={styles.tdTextRight}>
                      {price > 0 ? formatNumber(price, 2) : ""}
                    </Text>
                  </View>

                  {/* Line Total */}
                  <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}>
                    <Text style={styles.tdTextRight}>
                      {lineTotal > 0 ? formatNumber(lineTotal, 2) : ""}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Empty filler rows to preserve the authentic pre-printed form appearance */}
            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.tableBodyRow}>
                <View style={[styles.tdCell, styles.colSeq]}>
                  <Text style={styles.tdTextCenter}>{items.length + idx + 1}</Text>
                </View>
                <View style={[styles.tdCell, styles.colPartNo]}>
                  <Text style={styles.tdTextLeft}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colDesc]}>
                  <Text style={styles.tdTextDesc}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.tdTextCenter}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colTensile]}>
                  <Text style={styles.tdTextCenter}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdTextCenter}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdTextRight}>{""}</Text>
                </View>
                <View style={[styles.tdCell, styles.colTotal, { borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextRight}>{""}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 6. FOOTER SECTION (QR, SIGNATURES, TOTALS SUMMARY) ─── */}
          <View style={styles.footerContainer}>
            {/* Left Block: QR Code in border */}
            <View style={styles.footerQrBlock}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>QR</Text>
                </View>
              )}
            </View>

            {/* Center Block: Signatures / Handlers */}
            <View style={styles.footerCenterBlock}>
              <View style={styles.signaturesHeadersRow}>
                {/* مستودع / STORE */}
                <View style={styles.sigCol}>
                  <Text style={styles.sigTitleAr}>مستودع</Text>
                  <Text style={styles.sigTitleEn}>STORE</Text>
                </View>

                {/* البائع / SALESMAN */}
                <View style={styles.sigCol}>
                  <Text style={styles.sigTitleAr}>البائع</Text>
                  <Text style={styles.sigTitleEn}>SALESMAN</Text>
                </View>

                {/* المستلم / RECEIVER */}
                <View style={styles.sigCol}>
                  <Text style={styles.sigNoteNumber}>{receiver ? "" : ""}</Text>
                  <Text style={styles.sigTitleAr}>المستلم</Text>
                  <Text style={styles.sigTitleEn}>RECEIVER</Text>
                </View>
              </View>

              {/* Signature area */}
              <View style={styles.signatureArea}>
                {signatureDataUrl ? (
                  <Image src={signatureDataUrl} style={styles.signatureImage} />
                ) : null}
              </View>
            </View>

            {/* Right Block: Totals Summary Grid */}
            <View style={styles.footerTotalsBlock}>
              {/* Row 1: TOTAL / الإجمالي */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>الإجمالي</Text>
                  <Text style={styles.totalsLabelEn}>TOTAL</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatNumber(subtotal, 2)}</Text>
                </View>
              </View>

              {/* Row 2: VAT / الضريبة المضافة */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>الضريبة المضافة</Text>
                  <Text style={styles.totalsLabelEn}>VAT</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatNumber(vatAmount, 2)}</Text>
                </View>
              </View>

              {/* Row 3: DISCOUNT / الخصم */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelAr}>الخصم</Text>
                  <Text style={styles.totalsLabelEn}>DISCOUNT</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueText}>{formatNumber(discountTotal, 2)}</Text>
                </View>
              </View>

              {/* Row 4: NET TOTAL / الصافي */}
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalsLabelCol}>
                  <Text style={styles.totalsLabelArBold}>الصافي</Text>
                  <Text style={styles.totalsLabelEn}>NET TOTAL</Text>
                </View>
                <View style={styles.totalsValueCol}>
                  <Text style={styles.totalsValueTextBold}>{formatNumber(total, 2)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── 7. TAFQEET AMOUNT IN WORDS STRIP ─── */}
          <View style={styles.tafqeetStrip}>
            <Text style={styles.tafqeetText}>
              {tafqeetText ? `${tafqeetText} فقط لا غير` : ""}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── MAROON THEME PALETTE ───
const MAROON = "#8A1528";
const MAROON_LIGHT = "#A62035";
const MAROON_LINE = "#8A1528";
const MAROON_FILL = "#FDF4F5";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 7,
    color: MAROON,
  },
  watermarkBg: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },
  outerFrame: {
    borderWidth: 1.5,
    borderColor: MAROON_LINE,
    borderRadius: 6,
    padding: 6,
    flexDirection: "column",
    flex: 1,
  },

  // ─── Header ───
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: MAROON_LINE,
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeftCol: {
    width: "36%",
    alignItems: "flex-start",
  },
  companyNameEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "left",
    marginBottom: 1,
  },
  headerSubTextEn: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "left",
    lineHeight: 1.2,
    marginBottom: 1,
  },
  headerCrLine: {
    fontSize: 6,
    color: MAROON,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 1,
  },
  headerBranchEn: {
    fontSize: 5,
    color: MAROON,
    textAlign: "left",
    lineHeight: 1.2,
  },
  headerCenterCol: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 65,
    height: 40,
    objectFit: "contain",
    marginBottom: 2,
  },
  logoFallback: {
    width: 50,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: MAROON,
    backgroundColor: MAROON_FILL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  logoFallbackText: {
    fontSize: 14,
    fontWeight: "bold",
    color: MAROON,
  },
  taxInvoiceTitleCenter: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    marginTop: 1,
  },
  headerRightCol: {
    width: "38%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
    marginBottom: 1,
  },
  headerSubTextAr: {
    fontSize: 5.5,
    color: MAROON,
    textAlign: "right",
    lineHeight: 1.2,
    marginBottom: 1,
  },
  headerBranchAr: {
    fontSize: 5,
    color: MAROON,
    textAlign: "right",
    lineHeight: 1.2,
  },
  headerVatStrip: {
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  headerVatText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    letterSpacing: 0.5,
  },

  // ─── Sales Invoice Banner ───
  salesInvoiceBannerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  salesInvoiceBannerPill: {
    borderWidth: 1.2,
    borderColor: MAROON_LINE,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  salesInvoiceBannerText: {
    fontSize: 13,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },

  // ─── Capsule Metadata Cells ───
  metaRow1: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  metaRow2: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 5,
  },
  capsuleCell: {
    borderWidth: 1,
    borderColor: MAROON_LINE,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 28,
  },
  capsuleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2,
    marginBottom: 1,
  },
  capsuleLabelEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "left",
  },
  capsuleLabelAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  capsuleLabelCenter: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    marginBottom: 1,
  },
  capsuleSubLabelCenter: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    marginTop: 1,
  },
  capsuleValueText: {
    fontSize: 7.5,
    color: MAROON,
    textAlign: "center",
  },
  capsuleValueTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  capsuleValueCustomerName: {
    fontSize: 8,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },

  // ─── Products Table ───
  tableContainer: {
    borderWidth: 1,
    borderColor: MAROON_LINE,
    marginBottom: 5,
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MAROON_LINE,
    backgroundColor: MAROON_FILL,
    minHeight: 22,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.1,
  },
  thTextEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
    lineHeight: 1.1,
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: MAROON_LINE,
    minHeight: 15,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: MAROON_LINE,
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdTextCenter: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "center",
  },
  tdTextLeft: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "left",
  },
  tdTextRight: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "right",
  },
  tdTextDesc: {
    fontSize: 6.5,
    color: MAROON,
    textAlign: "right",
  },

  // Column Widths
  colSeq: { width: "6%" },
  colPartNo: { width: "13%" },
  colDesc: { width: "37%" },
  colUnit: { width: "8%" },
  colTensile: { width: "7%" },
  colQty: { width: "9%" },
  colPrice: { width: "9%" },
  colTotal: { width: "11%" },

  // ─── Footer Section ───
  footerContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: MAROON_LINE,
    minHeight: 65,
    alignItems: "stretch",
  },
  footerQrBlock: {
    width: "20%",
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  qrImage: {
    width: 58,
    height: 58,
  },
  qrPlaceholder: {
    width: 54,
    height: 54,
    borderWidth: 0.5,
    borderColor: MAROON_LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 8,
    color: MAROON,
  },

  footerCenterBlock: {
    width: "48%",
    borderRightWidth: 1,
    borderRightColor: MAROON_LINE,
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 3,
  },
  signaturesHeadersRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  sigCol: {
    alignItems: "center",
    width: "32%",
  },
  sigNoteNumber: {
    fontSize: 6,
    color: MAROON,
    marginBottom: 1,
    textAlign: "center",
  },
  sigTitleAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  sigTitleEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
  signatureArea: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  signatureImage: {
    width: 70,
    height: 28,
    objectFit: "contain",
  },

  footerTotalsBlock: {
    width: "32%",
    flexDirection: "column",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: MAROON_LINE,
    flex: 1,
    alignItems: "center",
  },
  totalsLabelCol: {
    width: "50%",
    borderRightWidth: 0.5,
    borderRightColor: MAROON_LINE,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  totalsLabelAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsLabelArBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsLabelEn: {
    fontSize: 5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "right",
  },
  totalsValueCol: {
    width: "50%",
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  totalsValueText: {
    fontSize: 7.5,
    color: MAROON,
    textAlign: "center",
  },
  totalsValueTextBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },

  // ─── Tafqeet Words Strip ───
  tafqeetStrip: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: MAROON_LINE,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MAROON_FILL,
  },
  tafqeetText: {
    fontSize: 7,
    fontWeight: "bold",
    color: MAROON,
    textAlign: "center",
  },
});
