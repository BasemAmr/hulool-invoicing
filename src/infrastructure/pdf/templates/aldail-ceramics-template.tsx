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

export interface AldailCeramicsTemplateProps {
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

const DEFAULT_TERMS_AR: string[] = [
  "عند إرجاع أي كمية يتم خصم نسبتها من العميل بمقدار 10% من قيمتها الأساسية.",
  "يجب تحصيل الفاتورة / الأسعار عند الاستلام ولا يقبل أي إرجاع بعد 30 يوم من تاريخ إصدار الفاتورة والمرتجع سوف يكون تحويل بنكي خلال 24 ساعة.",
  "يجب أن تكون البضاعة سليمة وخالية من أي عيوب سوء التخزين وأن تكون بنفس حالتها السليمة.",
  "يتم استلام البضاعة في مستوى مستودعاتنا بينما النقل على حساب العميل.",
  "الشركة تعتبر عن قبول أي شكوى عن البضاعة بعد التوقيع فعلى الفور يرجى التأكد من البضاعة المستلمة قبل التوقيع.",
];

export function AldailCeramicsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: AldailCeramicsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const currencyText = invoice.currency || "SAR";

  // Company details
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as any).unifiedNumber || "";
  const companyEmail = company.email || "";
  const companyWebsite = (company as any).website || "";
  const companyCity = company.addressCity || "";
  const companyStreet = company.addressStreet || "";
  const companyDistrict = company.addressDistrict || "";

  // Full Arabic address: (Additional No. - Postal Code - Street - Building No. - District - City - Country)
  const companyAddressPartsAr = [
    company.addressAdditionalNumber ? `الرقم الإضافي: ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي: ${company.addressPostalCode}` : "",
    company.addressStreet || "",
    company.addressBuildingNumber ? `مبنى: ${company.addressBuildingNumber}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity || "",
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddressAr = companyAddressPartsAr.join(" - ");

  // Customer details
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerUnifiedOrCr = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerCity = customer.addressCity || "";

  const customerAddressParts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet || "",
    customer.addressBuildingNumber ? `مبنى: ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : "",
    customer.addressCity || "",
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  const clientNoText = (customer as any).clientNo || (customer as any).customerNumber || "";
  const bayanText = (invoice as any).bayan || invoice.notes || "";

  // Items & Calculations
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

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

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // Terms & Conditions
  const termsList: string[] =
    invoice.terms && invoice.terms.trim().length > 0
      ? invoice.terms
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean)
      : DEFAULT_TERMS_AR;

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const basePageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes)
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  if (invoice.terms)
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  if (company.footerText) extraContentHeight += 18;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        <View style={styles.outerFrame}>
          {/* ─── 1. HEADER: dynamic company data (EN left / Logo & Clear Title center / AR right) ─── */}
          <View style={styles.headerBox}>
            <View style={styles.headerLeft}>
              {companyNameEn ? <Text style={styles.headerEnName}>{companyNameEn}</Text> : null}
              <Text style={styles.headerEnLine}>For Trading, Industry &amp; Contracting</Text>
              {companyCity || companyStreet ? (
                <Text style={styles.headerEnLine}>
                  KSA - {companyCity}
                  {companyStreet ? ` - ${companyStreet}` : ""}
                </Text>
              ) : null}
              {companyDistrict ? <Text style={styles.headerEnLine}>{companyDistrict}</Text> : null}
              {companyPhone ? <Text style={styles.headerEnLine}>Tele No. {companyPhone}</Text> : null}
              {companyVat ? <Text style={styles.headerEnLine}>Tax No : {companyVat}</Text> : null}
              {companyCr ? <Text style={styles.headerEnLine}>C.R : {companyCr}</Text> : null}
            </View>

            <View style={styles.headerCenter}>
              {logoSource ? <Image src={logoSource} style={styles.logoImg} /> : null}
              <Text style={styles.titleAr}>فاتورة ضريبية</Text>
              <Text style={styles.titleEn}>TAX INVOICE</Text>
            </View>

            <View style={styles.headerRight}>
              {companyNameAr ? <Text style={styles.headerArName}>{companyNameAr}</Text> : null}
              {companyAddressAr ? (
                <Text style={styles.headerArLine}>{companyAddressAr}</Text>
              ) : (
                <>
                  {companyStreet || companyDistrict ? (
                    <Text style={styles.headerArLine}>
                      {[companyStreet, companyDistrict ? `حي ${companyDistrict}` : ""]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                  ) : null}
                  {companyCity ? <Text style={styles.headerArLine}>{companyCity} - المملكة العربية السعودية</Text> : null}
                </>
              )}
              {companyPhone ? <Text style={styles.headerArLine}>هاتف : {companyPhone}</Text> : null}
              {companyVat ? <Text style={styles.headerArLine}>الرقم الضريبي : {companyVat}</Text> : null}
              {companyCr ? <Text style={styles.headerArLine}>س.ت : {companyCr}</Text> : null}
            </View>
          </View>

          {/* ─── 2. CLIENT / META BOX: ONLY ZATCA QR Code (Left) + Client/Invoice Info (Right) ─── */}
          <View style={styles.clientBox}>
            <View style={styles.qrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>QR Code</Text>
                </View>
              )}
            </View>

            <View style={styles.metaCol}>
              {/* Row 1: Invoice Number & Issue Date */}
              <View style={styles.metaRowTwoCol}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>رقم الفاتورة / Inv. No</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{invoiceNum}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>تاريخ الإصدار / Issue Date</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{issueDateStr}</Text>
                </View>
              </View>

              {/* Row 2: Customer Name & Currency */}
              <View style={styles.metaRowTwoCol}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>اسم العميل / Client Name</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValBold}>{customerNameAr}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>العملة / Currency</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{currencyText}</Text>
                </View>
              </View>

              {/* Row 3: Customer VAT & Customer Unified / CR */}
              <View style={styles.metaRowTwoCol}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>الرقم الضريبي / Tax No</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{customerVat || "غير مسجل / Not Registered"}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>الرقم الموحد/السجل / Unified/CR</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{customerUnifiedOrCr || "-"}</Text>
                </View>
              </View>

              {/* Row 4: Customer Address & City */}
              <View style={styles.metaRowTwoCol}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>العنوان / Address</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{customerAddress || "-"}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>المدينة / City</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{customerCity || "-"}</Text>
                </View>
              </View>

              {/* Row 5: Customer Phone & Email / Client No */}
              <View style={styles.metaRowTwoCol}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>الهاتف / Phone</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{customerPhone || "-"}</Text>
                </View>
                {clientNoText ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>رقم العميل / Client No</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaVal}>{clientNoText}</Text>
                  </View>
                ) : customerEmail ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>البريد / Email</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaVal}>{customerEmail}</Text>
                  </View>
                ) : (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>الرمز البريدي / Postal Code</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaVal}>{customer.addressPostalCode || "-"}</Text>
                  </View>
                )}
              </View>

              {/* Row 6: Bayan / Description (if present) */}
              {bayanText ? (
                <View style={styles.metaRowSingle}>
                  <Text style={styles.metaLabel}>البيان / Description</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaVal}>{bayanText}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── 3. ITEMS TABLE (RTL visual order: Index on right, Total Inc. VAT on left) ─── */}
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.tableHeaderRow}>
              {/* 1. Subtotal Inc. VAT (Leftmost) */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colTotalWithDisc : styles.colTotalNoDisc, { borderLeftWidth: 0 }]}>
                <Text style={styles.thAr}>المجموع شامل الضريبة</Text>
                <Text style={styles.thEn}>Total Inc. VAT</Text>
              </View>

              {/* 2. VAT Amount */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colVatWithDisc : styles.colVatNoDisc]}>
                <Text style={styles.thAr}>مبلغ الضريبة</Text>
                <Text style={styles.thEn}>VAT Amount</Text>
              </View>

              {/* 3. VAT Rate */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colRateWithDisc : styles.colRateNoDisc]}>
                <Text style={styles.thAr}>نسبة الضريبة</Text>
                <Text style={styles.thEn}>VAT Rate</Text>
              </View>

              {/* 4. Discount (rendered only when discount exists on items) */}
              {hasAnyDiscount ? (
                <View style={[styles.thCell, styles.colDisc]}>
                  <Text style={styles.thAr}>الخصم</Text>
                  <Text style={styles.thEn}>Discount</Text>
                </View>
              ) : null}

              {/* 5. Unit Price */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colPriceWithDisc : styles.colPriceNoDisc]}>
                <Text style={styles.thAr}>سعر الوحدة</Text>
                <Text style={styles.thEn}>Unit Price</Text>
              </View>

              {/* 6. Quantity */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colQtyWithDisc : styles.colQtyNoDisc]}>
                <Text style={styles.thAr}>الكمية</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>

              {/* 7. Description */}
              <View style={[styles.thCell, hasAnyDiscount ? styles.colDescWithDisc : styles.colDescNoDisc]}>
                <Text style={styles.thAr}>اسم الصنف والوصف</Text>
                <Text style={styles.thEn}>Item Name &amp; Description</Text>
              </View>

              {/* 8. Index (Rightmost) */}
              <View style={[styles.thCell, styles.colIndex]}>
                <Text style={styles.thAr}>م</Text>
                <Text style={styles.thEn}>No.</Text>
              </View>
            </View>

            {/* Table Rows */}
            {items.map((item: InvoiceItemDto, idx: number) => {
              const itemQty = Number(item.quantity || 1);
              const unitPrice = Number(item.unitPrice || 0);
              const lineDisc = Number(
                item.discountAmount || (item as any).discount || 0
              );
              const rawLineSubtotal = unitPrice * itemQty;
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

              return (
                <View key={item.position ?? idx} style={styles.tableRow}>
                  {/* 1. Subtotal Inc. VAT (Leftmost) */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colTotalWithDisc : styles.colTotalNoDisc, { borderLeftWidth: 0 }]}>
                    <Text style={styles.tdTextBold}>
                      {formatExactAmount(lineTotalIncVat)}
                    </Text>
                  </View>

                  {/* 2. VAT Amount */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colVatWithDisc : styles.colVatNoDisc]}>
                    <Text style={styles.tdText}>{formatExactAmount(lineVat)}</Text>
                  </View>

                  {/* 3. VAT Rate */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colRateWithDisc : styles.colRateNoDisc]}>
                    <Text style={styles.tdText}>{vatPctStr}</Text>
                  </View>

                  {/* 4. Discount */}
                  {hasAnyDiscount ? (
                    <View style={[styles.tdCell, styles.colDisc]}>
                      <Text style={styles.tdText}>
                        {lineDisc > 0 ? formatExactAmount(lineDisc) : "-"}
                      </Text>
                    </View>
                  ) : null}

                  {/* 5. Unit Price */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colPriceWithDisc : styles.colPriceNoDisc]}>
                    <Text style={styles.tdText}>{formatExactAmount(unitPrice)}</Text>
                  </View>

                  {/* 6. Quantity */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colQtyWithDisc : styles.colQtyNoDisc]}>
                    <Text style={styles.tdTextBold}>{formatExactAmount(itemQty)}</Text>
                  </View>

                  {/* 7. Description */}
                  <View style={[styles.tdCell, hasAnyDiscount ? styles.colDescWithDisc : styles.colDescNoDisc, styles.tdDescAlign]}>
                    <Text style={styles.descTitle}>{item.description || ""}</Text>
                    {lineDisc > 0 ? (
                      <View style={styles.discountSubBox}>
                        <Text style={styles.discountSubText}>
                          خصم: {formatExactAmount(lineDisc)} (قبل: {formatExactAmount(rawLineSubtotal)} | بعد: {formatExactAmount(discountedSubtotal)})
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 8. Index (Rightmost) */}
                  <View style={[styles.tdCell, styles.colIndex]}>
                    <Text style={styles.tdText}>{idx + 1}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ─── 4. TOTALS (Preserving Al-Dail Ceramics 3-Section Grid Layout) ─── */}
          <View style={styles.totalsBox}>
            {/* Gross Subtotal */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.totalsKey}>المجموع غير شامل الضريبة / Total Excl. VAT</Text>
              <Text style={styles.totalsQty}>إجمالي الكمية: {formatExactAmount(totalQty)}</Text>
            </View>

            {/* Total Discount (if discount exists) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsVal}>{formatExactAmount(discountVal)}</Text>
                <Text style={styles.totalsKey}>إجمالي الخصم / Total Discount</Text>
                <Text style={styles.totalsQty}>خصم تجاري / Trade Discount</Text>
              </View>
            ) : null}

            {/* Taxable Amount (if discount exists) */}
            {hasAnyDiscount || Number(discountVal) > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsVal}>{formatExactAmount(taxableVal)}</Text>
                <Text style={styles.totalsKey}>المجموع الخاضع للضريبة / Taxable Amount</Text>
                <Text style={styles.totalsQty}>الوعاء الضريبي بعد الخصم</Text>
              </View>
            ) : null}

            {/* VAT Amount */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(vatVal)}</Text>
              <Text style={styles.totalsKey}>ضريبة القيمة المضافة / VAT ({vatRatePercentage})</Text>
              <Text style={styles.totalsQty}>نسبة الضريبة المستحقة</Text>
            </View>

            {/* Grand Total with VAT */}
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsVal, styles.grandVal]}>{formatExactAmount(totalVal)}</Text>
              <Text style={[styles.totalsKey, styles.grandVal]}>الإجمالي شامل الضريبة / Total with VAT</Text>
              <Text style={[styles.totalsQty, styles.grandVal]}>{tafqeetText}</Text>
            </View>

            {/* Invoice Paid */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.totalsKey}>المبلغ المدفوع / Invoice Paid</Text>
              <Text style={styles.totalsQty}>مدفوع بالكامل / Fully Paid</Text>
            </View>

            {/* Balance Due */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalsVal}>0.00</Text>
              <Text style={styles.totalsKey}>المبلغ المتبقي / Balance Due</Text>
              <Text style={styles.totalsQty}>لا يوجد رصيد مستحق / Nil</Text>
            </View>
          </View>

          {/* ─── 5. TAFQEET FULL-WIDTH BAR ─── */}
          {tafqeetText ? (
            <View style={styles.tafqeetBox}>
              <View style={styles.tafqeetRow}>
                <Text style={styles.tafqeetLabel}>المبلغ كتابة / Spelled-out Total</Text>
                <Text style={styles.tafqeetColon}>:</Text>
                <Text style={styles.tafqeetValue}>{tafqeetText}</Text>
              </View>
            </View>
          ) : null}

          {/* ─── 6. NOTES (if present) ─── */}
          {invoice.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>ملاحظات / Notes :</Text>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          ) : null}

          {/* ─── 7. TERMS & CONDITIONS ─── */}
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>الشروط والأحكام / Terms &amp; Conditions :</Text>
            {termsList.map((line, i) => (
              <Text key={i} style={styles.termsLine}>
                • {line}
              </Text>
            ))}
          </View>

          {/* ─── 8. CUSTOM FOOTER TEXT (if present) ─── */}
          {company.footerText ? (
            <View style={styles.customFooterBox}>
              <Text style={styles.customFooterText}>{company.footerText}</Text>
            </View>
          ) : null}

          {/* ─── 9. FOOTER CONTACTS ─── */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {companyPhone ? `Phone: ${companyPhone}` : " "}
            </Text>
            <Text style={styles.footerText}>
              {companyWebsite ? `Web: ${companyWebsite}` : " "}
            </Text>
            <Text style={styles.footerText}>
              {companyEmail ? `Email: ${companyEmail}` : " "}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 7.5,
    color: "#111111",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  outerFrame: {
    borderWidth: 1.25,
    borderColor: "#111111",
    padding: 6,
  },
  // ─── Header ───
  headerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111111",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "34%",
    alignItems: "flex-start",
  },
  headerEnName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
    textAlign: "left",
  },
  headerEnLine: {
    fontSize: 6.8,
    color: "#333333",
    lineHeight: 1.3,
    textAlign: "left",
  },
  headerCenter: {
    width: "30%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logoImg: {
    width: 70,
    height: 50,
    objectFit: "contain",
    marginBottom: 3,
  },
  titleAr: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#7A1F1F",
    textAlign: "center",
  },
  titleEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "center",
  },
  headerRight: {
    width: "34%",
    alignItems: "flex-end",
  },
  headerArName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
    textAlign: "right",
  },
  headerArLine: {
    fontSize: 6.8,
    color: "#333333",
    lineHeight: 1.3,
    textAlign: "right",
  },
  // ─── Client / Meta box ───
  clientBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
    minHeight: 145,
  },
  qrCol: {
    width: "28%",
    borderRightWidth: 1,
    borderRightColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  qrImage: {
    width: 140,
    height: 140,
  },
  qrPlaceholder: {
    width: 140,
    height: 140,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 9,
    color: "#9CA3AF",
  },
  metaCol: {
    width: "72%",
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  metaRowTwoCol: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  metaItem: {
    width: "49%",
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  metaRowSingle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "right",
  },
  metaColon: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E5631",
    marginHorizontal: 2.5,
  },
  metaVal: {
    fontSize: 7,
    color: "#111111",
    textAlign: "right",
    flexShrink: 1,
  },
  metaValBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
    flexShrink: 1,
  },
  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D9EAF3",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#6B7280",
    minHeight: 20,
    alignItems: "stretch",
  },
  tdCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#6B7280",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdDescAlign: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 4,
  },
  tdText: {
    fontSize: 6.8,
    color: "#111111",
    textAlign: "center",
  },
  tdTextBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  descTitle: {
    fontSize: 6.8,
    color: "#111111",
    textAlign: "right",
  },
  discountSubBox: {
    marginTop: 1,
  },
  discountSubText: {
    fontSize: 5.8,
    color: "#7A1F1F",
    textAlign: "right",
  },

  // Column Widths with Discount (Total = 100%)
  colTotalWithDisc: { width: "16%" },
  colVatWithDisc: { width: "12%" },
  colRateWithDisc: { width: "8%" },
  colDisc: { width: "8%" },
  colPriceWithDisc: { width: "12%" },
  colQtyWithDisc: { width: "8%" },
  colDescWithDisc: { width: "31%" },

  // Column Widths without Discount (Total = 100%)
  colTotalNoDisc: { width: "16%" },
  colVatNoDisc: { width: "12%" },
  colRateNoDisc: { width: "8%" },
  colPriceNoDisc: { width: "12%" },
  colQtyNoDisc: { width: "8%" },
  colDescNoDisc: { width: "39%" },

  colIndex: { width: "5%" },

  // ─── Totals ───
  totalsBox: {
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#6B7280",
    minHeight: 16,
    alignItems: "center",
  },
  totalsRowGrand: {
    borderBottomWidth: 0.5,
    backgroundColor: "#F9FAFB",
  },
  totalsVal: {
    width: "20%",
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#6B7280",
    paddingVertical: 2,
  },
  totalsKey: {
    width: "34%",
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#6B7280",
    paddingVertical: 2,
  },
  totalsQty: {
    width: "46%",
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "right",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  grandVal: {
    color: "#7A1F1F",
  },

  // ─── Tafqeet Box ───
  tafqeetBox: {
    borderWidth: 1,
    borderColor: "#1E5631",
    backgroundColor: "#F4F8F5",
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 2,
  },
  tafqeetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  tafqeetLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E5631",
  },
  tafqeetColon: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1E5631",
    marginHorizontal: 3,
  },
  tafqeetValue: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#7A1F1F",
  },

  // ─── Notes & Terms ───
  notesBox: {
    borderWidth: 0.5,
    borderColor: "#6B7280",
    padding: 4,
    marginBottom: 4,
  },
  notesTitle: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "right",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 6.5,
    color: "#111111",
    textAlign: "right",
    lineHeight: 1.3,
  },
  termsBox: {
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  termsTitle: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#1E5631",
    textAlign: "right",
    marginBottom: 2,
  },
  termsLine: {
    fontSize: 6.2,
    color: "#333333",
    textAlign: "right",
    lineHeight: 1.3,
  },
  customFooterBox: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  customFooterText: {
    fontSize: 6.5,
    color: "#4B5563",
    textAlign: "center",
  },

  // ─── Footer ───
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111111",
    paddingTop: 3,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111111",
  },
});
