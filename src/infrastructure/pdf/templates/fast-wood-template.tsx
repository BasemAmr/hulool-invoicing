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

export interface FastWoodTemplateProps {
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

// ─── Safe Arabic Tafqeet (Zero-Undefined Guaranteed) ──────────────────────────

const AR_ONES = [
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

const AR_TEENS = [
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

const AR_TENS = [
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

const AR_HUNDREDS = [
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

function convertGroupAr(n: number): string {
  const safe = Math.max(0, Math.min(999, Math.floor(Number.isFinite(n) ? n : 0)));
  if (safe === 0) return "";

  const h = Math.floor(safe / 100);
  const rem = safe % 100;
  const parts: string[] = [];

  const hundredWord = AR_HUNDREDS[h] ?? "";
  if (h > 0 && hundredWord) {
    parts.push(hundredWord);
  }

  if (rem > 0) {
    if (rem <= 10) {
      const w = AR_ONES[rem] ?? "";
      if (w) parts.push(w);
    } else if (rem < 20) {
      const w = AR_TEENS[rem - 10] ?? "";
      if (w) parts.push(w);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const onesWord = AR_ONES[u] ?? "";
      const tensWord = AR_TENS[t] ?? "";
      if (onesWord && tensWord) {
        parts.push(`${onesWord} و${tensWord}`);
      } else if (tensWord) {
        parts.push(tensWord);
      } else if (onesWord) {
        parts.push(onesWord);
      }
    }
  }

  return parts.join(" و");
}

function numberToArabicWords(num: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(num) ? num : 0));
  if (safe === 0) return "صفر";

  const billions = Math.floor(safe / 1_000_000_000);
  const millions = Math.floor((safe % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((safe % 1_000_000) / 1_000);
  const remainder = safe % 1_000;

  const segments: string[] = [];

  if (billions > 0) {
    if (billions === 1) segments.push("مليار");
    else if (billions === 2) segments.push("ملياران");
    else if (billions >= 3 && billions <= 10) {
      segments.push(`${convertGroupAr(billions)} مليارات`);
    } else {
      segments.push(`${convertGroupAr(billions)} مليار`);
    }
  }

  if (millions > 0) {
    if (millions === 1) segments.push("مليون");
    else if (millions === 2) segments.push("مليونان");
    else if (millions >= 3 && millions <= 10) {
      segments.push(`${convertGroupAr(millions)} ملايين`);
    } else {
      segments.push(`${convertGroupAr(millions)} مليون`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) segments.push("ألف");
    else if (thousands === 2) segments.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) {
      segments.push(`${convertGroupAr(thousands)} آلاف`);
    } else {
      segments.push(`${convertGroupAr(thousands)} ألف`);
    }
  }

  if (remainder > 0) {
    const remWords = convertGroupAr(remainder);
    if (remWords) segments.push(remWords);
  }

  return segments.length > 0 ? segments.join(" و") : "صفر";
}

function tafqeetAr(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  if (!Number.isFinite(num) || num <= 0) {
    return "فقط صفر ريال سعودي لاغير";
  }

  const totalHalalas = Math.round(num * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;

  let text = "";
  if (riyals > 0) {
    text = `${numberToArabicWords(riyals)} ريال سعودي`;
  }
  if (halalas > 0) {
    const halalaText = `${numberToArabicWords(halalas)} هللة`;
    text = text ? `${text} و ${halalaText}` : halalaText;
  }

  return text ? `فقط ${text} لاغير` : "فقط صفر ريال سعودي لاغير";
}

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

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
  if (val === null || val === undefined || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateDash(iso?: string | null): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return clean;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FastWoodTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: FastWoodTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Company dynamic fields (NO seller name per user instruction)
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyTagline = company.organizationType || "";
  const companyCr = company.crNumber || "";
  const companyVat = company.vatNumber || "";
  const companyBranch =
    (company as { branchName?: string }).branchName ||
    company.addressCity ||
    "";

  // Footer address & contact lines (strictly dynamic)
  const footerRightAddress = [
    company.addressCity,
    company.addressDistrict
      ? `حي ${company.addressDistrict.replace(/^حي\s+/, "")}`
      : null,
    company.addressStreet
      ? `طريق ${company.addressStreet.replace(/^(شارع|طريق)\s+/, "")}`
      : null,
    company.phone ? `جوال : ${company.phone}` : null,
  ]
    .filter((v): v is string => Boolean(v && v.trim().length > 0))
    .join(" - ");

  const footerRightEmail = company.email
    ? `البريد الإلكتروني ${company.email}`
    : "";

  const footerLeftText = company.footerText?.trim() || "";

  // Invoice metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const serialInvoiceNumber =
    (invoice as { serialNumber?: string }).serialNumber || invoiceNumber;
  const issueDateStr = formatDateDash(invoice.issueDate);

  // Customer dynamic fields
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCr =
    customer.unifiedNumber ||
    (customer as { crNumber?: string }).crNumber ||
    "";
  const customerAddressParts = [
    customer.addressBuildingNumber,
    customer.addressStreet,
    customer.addressDistrict,
    customer.addressCity,
    customer.addressPostalCode,
    customer.addressAdditionalNumber,
    customer.addressCity || customer.addressStreet || customer.addressDistrict
      ? "السعودية"
      : null,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));
  const customerAddressLine = customerAddressParts.join(" - ");

  // Line Items & Totals Calculations
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
    const taxableSubtotal =
      item.lineSubtotal !== undefined &&
      item.lineSubtotal !== null &&
      item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Math.max(0, gross - lineDiscount);

    const vatPct =
      item.vatRate !== undefined && item.vatRate !== null
        ? normalizeVatRatePercent(toNumber(item.vatRate))
        : 15;

    const lineVat =
      item.lineVat !== undefined &&
      item.lineVat !== null &&
      item.lineVat !== ""
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatPct / 100);

    const lineTotal =
      item.lineTotal !== undefined &&
      item.lineTotal !== null &&
      item.lineTotal !== ""
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
      unitPrice,
      qty,
      taxableSubtotal,
      vatPct,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null &&
    invoice.subtotal !== undefined &&
    invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null &&
    invoice.vatAmount !== undefined &&
    invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);
  const totalDiscountVal = computedDiscount + invoiceDiscount;

  const grandTotal =
    invoice.total !== null &&
    invoice.total !== undefined &&
    invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const tafqeetText = tafqeetAr(grandTotal);

  // Dynamic single-page height calculation
  const extraItemsCount = Math.max(0, rows.length - 6);
  let extraHeight = extraItemsCount * 24;
  if (invoice.notes) extraHeight += 20;
  if (invoice.terms) extraHeight += 20;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={companyNameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Fast Wood"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {/* Optional Background Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Outer Thin Border */}
        <View style={styles.outerFrame}>
          {/* ─── 1. TOP MINT-GREEN HEADER BANNER ─── */}
          <View style={styles.headerBanner}>
            {/* Left Column: CR Number, VAT Number, Branch Name (NO Seller Name) */}
            <View style={styles.headerLeftMetaCol}>
              {companyCr ? (
                <View style={styles.headerMetaRow}>
                  {/* BiDi rule: Arabic label first (row-reverse = right), then a standalone colon, then the value. */}
                  <Text style={styles.headerMetaLabel}>سجل تجاري</Text>
                  <Text style={styles.headerMetaColon}>:</Text>
                  <Text style={styles.headerMetaVal}>{companyCr}</Text>
                </View>
              ) : null}

              {companyVat ? (
                <View style={styles.headerMetaRow}>
                  <Text style={styles.headerMetaLabel}>الرقم الضريبي</Text>
                  <Text style={styles.headerMetaColon}>:</Text>
                  <Text style={styles.headerMetaVal}>{companyVat}</Text>
                </View>
              ) : null}

              {companyBranch ? (
                <View style={[styles.headerMetaRow, { marginBottom: 0 }]}>
                  <Text style={styles.headerMetaLabel}>إسم الفرع</Text>
                  <Text style={styles.headerMetaColon}>:</Text>
                  <Text style={styles.headerMetaVal}>{companyBranch}</Text>
                </View>
              ) : null}
            </View>

            {/* Center Column: White Rounded Logo Badge (Conditional — no placeholder) */}
            <View style={styles.headerCenterLogoCol}>
              {logoSource ? (
                <View style={styles.logoCard}>
                  <Image src={logoSource} style={styles.logoImage} />
                </View>
              ) : null}
            </View>

            {/* Right Column: Company Arabic Name, English Name & Activity Tagline */}
            <View style={styles.headerRightTitleCol}>
              {companyNameAr ? (
                <Text style={styles.companyNameAr}>{companyNameAr}</Text>
              ) : null}

              {companyNameEn ? (
                <Text style={styles.companyNameEn}>{companyNameEn}</Text>
              ) : null}

              {companyTagline ? (
                <Text style={styles.companyTagline}>{companyTagline}</Text>
              ) : null}
            </View>
          </View>

          {/* ─── 2. INVOICE META & CUSTOMER SECTION + ZATCA QR (LEFT) ─── */}
          <View style={styles.metaAndQrSection}>
            {/* Left: ZATCA QR Code */}
            <View style={styles.qrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>

            {/* Right: 4-Row Horizontal Meta & Customer Lines */}
            <View style={styles.metaLinesCol}>
              {/* Row 1: Invoice No (Left) | Serial Invoice No (Center) | Date (Right) */}
              <View style={styles.metaBandRow}>
                <View style={styles.band1Left}>
                  <Text style={styles.metaLabelBold}>رقم الفاتورة</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{invoiceNumber}</Text>
                </View>

                <View style={styles.band1Center}>
                  <Text style={styles.metaLabelBold}>رقم الفاتورة التسلسلي</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{serialInvoiceNumber}</Text>
                </View>

                <View style={styles.band1Right}>
                  <Text style={styles.metaLabelBold}>التاريخ</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{issueDateStr}</Text>
                </View>
              </View>

              {/* Row 2: Customer Name on Right */}
              <View style={styles.metaBandRow}>
                <View style={styles.bandFullRight}>
                  <Text style={styles.metaLabelBold}>اسم العميل</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{customerName}</Text>
                </View>
              </View>

              {/* Row 3: Red "فاتورة ضريبية" (Center) | Customer VAT & CR (Right) | NO client number 2 */}
              <View style={styles.metaBandRow}>
                <View style={styles.band3LeftSpacer} />

                <View style={styles.band3Center}>
                  <Text style={styles.taxInvoiceRedTitle}>فاتورة ضريبية</Text>
                </View>

                <View style={styles.band3Right}>
                  {customerVat ? (
                    <View style={styles.inlineRightPair}>
                      <Text style={styles.metaLabelBold}>الرقم الضريبي</Text>
                      <Text style={styles.metaColon}>:</Text>
                      <Text style={styles.metaValBold}>{customerVat}</Text>
                    </View>
                  ) : null}
                  {customerCr ? (
                    <View style={[styles.inlineRightPair, { marginTop: 1.5 }]}>
                      <Text style={styles.metaLabelBold}>السجل التجاري</Text>
                      <Text style={styles.metaColon}>:</Text>
                      <Text style={styles.metaValBold}>{customerCr}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Row 4: Full-Width Customer Address */}
              <View style={styles.metaAddressRow}>
                <Text style={styles.metaLabelBold}>عنوان العميل</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.metaAddressVal}>{customerAddressLine}</Text>
              </View>
            </View>
          </View>

          {/* ─── 3. LINE ITEMS TABLE (8 COLUMNS, RTL) ─── */}
          <View style={styles.table}>
            {/* Table Header Strip (Warm Beige-Gray, Top & Bottom Borders) */}
            <View style={styles.tableHeaderRow}>
              {/* 1. # / Index */}
              <View style={[styles.thCell, styles.colIndex]}>
                <Text style={styles.thText}></Text>
              </View>

              {/* 2. اسم المادة */}
              <View style={[styles.thCell, styles.colItemName]}>
                <Text style={styles.thText}>اسم المادة</Text>
              </View>

              {/* 3. السعر */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thText}>السعر</Text>
              </View>

              {/* 4. الكمية */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thText}>الكمية</Text>
              </View>

              {/* 5. السعر الإفرادي */}
              <View style={[styles.thCell, styles.colUnitSubtotal]}>
                <Text style={styles.thText}>السعر</Text>
                <Text style={styles.thText}>الإفرادي</Text>
              </View>

              {/* 6. ضريبة القيمة المضافة 15% */}
              <View style={[styles.thCell, styles.colVatPct]}>
                <Text style={styles.thText}>ضريبة القيمة</Text>
                <Text style={styles.thText}>المضافة 15%</Text>
              </View>

              {/* 7. مبلغ الضريبة */}
              <View style={[styles.thCell, styles.colVatAmt]}>
                <Text style={styles.thText}>مبلغ</Text>
                <Text style={styles.thText}>الضريبة</Text>
              </View>

              {/* 8. السعر الإجمالي */}
              <View style={[styles.thCell, styles.colTotal]}>
                <Text style={styles.thText}>السعر</Text>
                <Text style={styles.thText}>الإجمالي</Text>
              </View>
            </View>

            {/* Table Data Rows (Boxed Cells) */}
            {rows.map((row) => (
              <View key={row.key} style={styles.tableDataRow} wrap={false}>
                {/* 1. Index */}
                <View style={[styles.tdCell, styles.colIndex]}>
                  <Text style={styles.tdCenterBold}>{row.index}</Text>
                </View>

                {/* 2. Item Name / Description */}
                <View style={[styles.tdCell, styles.colItemName]}>
                  <Text style={styles.tdDescText}>{row.desc}</Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.unitPrice)}
                  </Text>
                </View>

                {/* 4. Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdCenterBold}>{formatQty(row.qty)}</Text>
                </View>

                {/* 5. Taxable Subtotal (السعر الإفرادي) */}
                <View style={[styles.tdCell, styles.colUnitSubtotal]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.taxableSubtotal)}
                  </Text>
                </View>

                {/* 6. VAT Rate % */}
                <View style={[styles.tdCell, styles.colVatPct]}>
                  <Text style={styles.tdCenterBold}>
                    % {row.vatPct.toFixed(2)}
                  </Text>
                </View>

                {/* 7. VAT Amount */}
                <View style={[styles.tdCell, styles.colVatAmt]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.lineVat)}
                  </Text>
                </View>

                {/* 8. Total Including VAT */}
                <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0.8 }]}>
                  <Text style={styles.tdCenterBold}>
                    {formatExactAmount(row.lineTotal)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 4. TOTALS STACK (LEFT) & ARABIC TAFQEET (RIGHT) ─── */}
          <View style={styles.totalsAndTafqeetSection} wrap={false}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalNarrowRow}>
              <Text style={styles.totalValText}>
                {formatExactAmount(taxableAmount)}
              </Text>
              <Text style={styles.totalLabelText}>إجمالي القيمة</Text>
            </View>

            {/* Row 2: Discount */}
            <View style={styles.totalNarrowRow}>
              <Text style={styles.totalValText}>
                {formatExactAmount(totalDiscountVal)}
              </Text>
              <Text style={styles.totalLabelText}>إجمالي الخصم</Text>
            </View>

            {/* Row 3: VAT 15% */}
            <View style={styles.totalNarrowRow}>
              <Text style={styles.totalValText}>
                {formatExactAmount(totalVat)}
              </Text>
              <Text style={styles.totalLabelText}>الضريبة المضافة 15%</Text>
            </View>

            {/* Row 4: Grand Total + Full-Width Arabic Tafqeet Line */}
            <View style={styles.totalGrandFullRow}>
              <View style={styles.totalGrandLeftCell}>
                <Text style={styles.totalValText}>
                  {formatExactAmount(grandTotal)}
                </Text>
                <Text style={styles.totalLabelText}>إجمالي الفاتورة</Text>
              </View>

              <View style={styles.tafqeetRightCell}>
                <Text style={styles.tafqeetText}>{tafqeetText}</Text>
              </View>
            </View>
          </View>

          {/* Optional Notes / Terms */}
          {(invoice.notes || invoice.terms) ? (
            <View style={styles.notesBlock} wrap={false}>
              {invoice.notes ? (
                <Text style={styles.noteLineText}>ملاحظات: {invoice.notes}</Text>
              ) : null}
              {invoice.terms ? (
                <Text style={styles.noteLineText}>الشروط: {invoice.terms}</Text>
              ) : null}
            </View>
          ) : null}

          {/* ─── 5. FOOTER: SIGNATURES, GREEN DIVIDER & RED COMPANY FOOTER ─── */}
          <View style={styles.footerWrapper} wrap={false}>
            {/* Signatures Row */}
            <View style={styles.signaturesRow}>
              {/* Left: Seller Signature */}
              <View style={styles.sigCol}>
                {signatureDataUrl ? (
                  <Image src={signatureDataUrl} style={styles.signatureImage} />
                ) : null}
                <View style={styles.sigLineRow}>
                  <Text style={styles.greenDots}>
                    ..............................................
                  </Text>
                  <Text style={styles.redSigLabel}>توقيع البائع</Text>
                </View>
              </View>

              {/* Right: Receiver Signature */}
              <View style={styles.sigCol}>
                <View style={styles.sigLineRow}>
                  <Text style={styles.greenDots}>
                    ..............................................
                  </Text>
                  <Text style={styles.redSigLabel}>توقيع المستلم</Text>
                </View>
              </View>
            </View>

            {/* Solid Green Horizontal Bar */}
            <View style={styles.footerGreenLine} />

            {/* Bottom Red Contact & Address Info */}
            {(footerRightAddress || footerRightEmail || footerLeftText) ? (
              <View style={styles.footerContactRow}>
                {/* Left Footer Column */}
                <View style={styles.footerLeftCol}>
                  {footerLeftText ? (
                    <Text style={styles.footerRedText}>{footerLeftText}</Text>
                  ) : null}
                </View>

                {/* Right Footer Column */}
                <View style={styles.footerRightCol}>
                  {footerRightAddress ? (
                    <Text style={styles.footerRedText}>{footerRightAddress}</Text>
                  ) : null}
                  {footerRightEmail ? (
                    <Text style={[styles.footerRedText, { marginTop: 2 }]}>
                      {footerRightEmail}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES (PIXEL-PERFECT TAJAWAL TYPOGRAPHY) ────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "26%",
    left: "20%",
    width: "60%",
    opacity: 0.06,
  },
  outerFrame: {
    flex: 1,
    borderWidth: 0.6,
    borderColor: "#9CA3AF",
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexDirection: "column",
  },

  // 1. Top Mint-Green Header Banner
  headerBanner: {
    width: "100%",
    backgroundColor: "#DCEEDC",
    borderWidth: 1,
    borderColor: "#4C9A4C",
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeftMetaCol: {
    width: "35%",
    flexDirection: "column",
    justifyContent: "center",
  },
  headerMetaRow: {
    // BiDi rule: label right, colon middle, value left.
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 5,
  },
  headerMetaColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#D91E18",
    marginHorizontal: 2,
  },
  headerMetaLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#D91E18",
    textAlign: "right",
  },
  headerMetaVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#111827",
    textAlign: "left",
  },

  headerCenterLogoCol: {
    width: "26%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D91E18",
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 96,
    height: 62,
    objectFit: "contain",
  },

  headerRightTitleCol: {
    width: "37%",
    alignItems: "flex-end",
    justifyContent: "center",
    textAlign: "right",
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 17,
    color: "#D91E18",
    textAlign: "right",
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#111827",
    textAlign: "right",
    marginTop: 1,
  },
  companyTagline: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9,
    color: "#111827",
    textAlign: "right",
    marginTop: 4,
  },

  // 2. Invoice Meta & Customer Info + Left QR
  metaAndQrSection: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  qrCol: {
    width: 112,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  qrImage: {
    width: 108,
    height: 108,
  },
  qrPlaceholder: {
    width: 108,
    height: 108,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#9CA3AF",
  },

  metaLinesCol: {
    flex: 1,
    marginLeft: 8,
    flexDirection: "column",
  },
  metaBandRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    paddingVertical: 3.5,
    paddingHorizontal: 4,
  },
  band1Left: {
    width: "26%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  band1Center: {
    width: "44%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
  },
  band1Right: {
    width: "30%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  bandFullRight: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  band3LeftSpacer: {
    width: "26%",
  },
  band3Center: {
    width: "34%",
    alignItems: "center",
    justifyContent: "center",
  },
  band3Right: {
    width: "40%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  inlineRightPair: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  metaAddressRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  metaLabelBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "right",
  },
  metaColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    marginHorizontal: 2,
  },
  metaValBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
  },
  metaAddressVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "right",
  },
  taxInvoiceRedTitle: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.2,
    color: "#D91E18",
    textAlign: "center",
  },

  // 3. Line Items Table (8 Columns, RTL)
  table: {
    width: "100%",
    paddingHorizontal: 4,
  },
  tableHeaderRow: {
    width: "100%",
    flexDirection: "row-reverse",
    backgroundColor: "#EAE8DF",
    borderTopWidth: 0.9,
    borderBottomWidth: 0.9,
    borderColor: "#111827",
    minHeight: 26,
    alignItems: "center",
    marginBottom: 2,
  },
  tableDataRow: {
    width: "100%",
    flexDirection: "row-reverse",
    minHeight: 18,
    alignItems: "center",
    marginBottom: 1.5,
  },
  thCell: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tdCell: {
    borderWidth: 0.8,
    borderColor: "#111827",
    borderLeftWidth: 0,
    height: "100%",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  thText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#111827",
    textAlign: "center",
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "center",
    width: "100%",
  },

  // Column Widths (Sum = 100%)
  colIndex: { width: "4%" },
  colItemName: { width: "42%" },
  colPrice: { width: "10%" },
  colQty: { width: "8%" },
  colUnitSubtotal: { width: "11%" },
  colVatPct: { width: "10%" },
  colVatAmt: { width: "7.5%" },
  colTotal: { width: "7.5%" },

  // 4. Totals Stack (Left) & Arabic Tafqeet (Right)
  totalsAndTafqeetSection: {
    width: "100%",
    paddingHorizontal: 4,
    marginTop: 1,
  },
  totalNarrowRow: {
    width: "32.5%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  totalGrandFullRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.8,
    borderColor: "#111827",
    paddingVertical: 3,
  },
  totalGrandLeftCell: {
    width: "32.5%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  tafqeetRightCell: {
    width: "67.5%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  totalValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "left",
  },
  totalLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "right",
  },
  tafqeetText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "center",
  },

  // Optional Notes
  notesBlock: {
    marginTop: 8,
    paddingHorizontal: 8,
    alignItems: "flex-end",
  },
  noteLineText: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#374151",
    textAlign: "right",
    marginBottom: 2,
  },

  // 5. Footer: Signatures, Green Bar & Red Company Info
  footerWrapper: {
    marginTop: "auto",
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  sigCol: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  signatureImage: {
    width: 68,
    height: 30,
    objectFit: "contain",
    marginBottom: 2,
  },
  sigLineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greenDots: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#4C9A4C",
    marginRight: 4,
  },
  redSigLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#D91E18",
  },
  footerGreenLine: {
    width: "100%",
    height: 1.5,
    backgroundColor: "#4C9A4C",
    marginBottom: 5,
  },
  footerContactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  footerLeftCol: {
    width: "46%",
    alignItems: "center",
    justifyContent: "center",
  },
  footerRightCol: {
    width: "52%",
    alignItems: "center",
    justifyContent: "center",
  },
  footerRedText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.8,
    color: "#D91E18",
    textAlign: "center",
  },
});
