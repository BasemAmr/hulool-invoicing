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

export interface TopTownTemplateProps {
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

// ─── Arabic Words (Tafqeet) ───
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
  if (num <= 0) return "صفر ريال سعودي";
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

export function TopTownTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: TopTownTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);

  // ─── Company Address & Metadata ───
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

  const companyCrOrUnified = company.crNumber || (company as any).unifiedNumber || "";

  // ─── Customer Details ───
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerVatNo = customer.vatNumber || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerNo = (customer as any).customerNumber || (customer as any).code || "";
  const customerAddress = [
    customer.addressCity,
    customer.addressPostalCode,
    customer.addressStreet,
    (customer as any).addressDistrict || (customer as any).district,
  ].filter(Boolean).join(" - ");

  // ─── Bank Info ───
  const bankAccount = (company as any).bankAccount || (settings as any)?.bankAccount || "";
  const ibanNumber = (company as any).iban || (company as any).ibanNumber || (settings as any)?.ibanNumber || "";
  const bankName = (company as any).bankName || (settings as any)?.bankName || "";

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

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Single-Page Dynamic Height Guarantee ───
  const basePageWidth = paperSize === "Letter" ? 612 : 595.28;
  const basePageHeight = paperSize === "Letter" ? 792 : 841.89;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 5);
  let extraContentHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes) {
    extraContentHeight += 24 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  }
  if (invoice.terms) {
    extraContentHeight += 24 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  }
  if (company.footerText) {
    extraContentHeight += 18;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const logoSource = logoDataUrl || company.logoUrl;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if provided */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER BOX WITH LOGO & COMPANY INFO ─── */}
        <View style={styles.headerBox}>
          {/* Logo on Left/Side if present */}
          {logoSource ? (
            <View style={styles.headerLogoWrap}>
              <Image src={logoSource} style={styles.logoImg} />
            </View>
          ) : null}

          {/* Company Texts (Right-to-Left in layout) */}
          <View style={logoSource ? styles.headerTextWrapWithLogo : styles.headerTextWrapFull}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            {companyAddressAr ? (
              <Text style={styles.companyAddressText}>{companyAddressAr}</Text>
            ) : null}

            {/* Header Meta: VAT & CR (Strict BiDi middle-colon rules) */}
            <View style={styles.headerMetaRow}>
              {company.vatNumber ? (
                <View style={styles.headerBiDiItem}>
                  <Text style={styles.headerMetaLbl}>الرقم الضريبي</Text>
                  <Text style={styles.headerMetaColon}>:</Text>
                  <Text style={styles.headerMetaVal}>{company.vatNumber}</Text>
                </View>
              ) : null}

              {company.vatNumber && companyCrOrUnified ? (
                <Text style={styles.headerMetaDivider}>|</Text>
              ) : null}

              {companyCrOrUnified ? (
                <View style={styles.headerBiDiItem}>
                  <Text style={styles.headerMetaLbl}>س.ت / الرقم الموحد</Text>
                  <Text style={styles.headerMetaColon}>:</Text>
                  <Text style={styles.headerMetaVal}>{companyCrOrUnified}</Text>
                </View>
              ) : null}
            </View>

            {/* Optional Contacts */}
            {company.phone || company.email || company.website ? (
              <View style={styles.headerContactRow}>
                {[
                  company.phone ? `هاتف: ${company.phone}` : "",
                  company.email ? `البريد: ${company.email}` : "",
                  company.website ? `الموقع: ${company.website}` : "",
                ]
                  .filter(Boolean)
                  .map((txt, i) => (
                    <Text key={i} style={styles.headerContactText}>
                      {i > 0 ? " | " : ""}
                      {txt}
                    </Text>
                  ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. METADATA 3-BOX GRID (Triple Info Cards) ─── */}
        <View style={styles.metaRow}>
          {/* Box 1 (Left): Customer Address & Extra Info */}
          <View style={styles.metaBoxLeft}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderText}>العنوان والتفاصيل</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>العنوان</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customerAddress || "-"}</Text>
              </View>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>رقم العميل</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customerNo || "-"}</Text>
              </View>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>البريد الإلكتروني</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customer.email || "-"}</Text>
              </View>
              <View style={[styles.metaLine, { borderBottomWidth: 0 }]}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>المرجع / سند</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>
                  {(invoice as any).outputSlip || (invoice as any).slipNumber || "-"}
                </Text>
              </View>
            </View>
          </View>

          {/* Box 2 (Center): Invoice Title & Core Metadata */}
          <View style={styles.metaBoxCenter}>
            <View style={styles.cardHeaderGold}>
              <Text style={styles.cardHeaderTextGold}>فاتورة ضريبية / TAX INVOICE</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>رقم الفاتورة</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaValBold}>{invoiceNum}</Text>
              </View>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>تاريخ الإصدار</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{issueDateStr}</Text>
              </View>
              <View style={[styles.metaLine, { borderBottomWidth: 0 }]}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>مكان التوريد</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>
                  {customer.addressCity || company.addressCity || "المملكة العربية السعودية"}
                </Text>
              </View>
            </View>
          </View>

          {/* Box 3 (Right): Customer Basic Details */}
          <View style={styles.metaBoxRight}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderText}>بيانات العميل</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>اسم العميل</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaValBold}>{customerNameAr || "-"}</Text>
              </View>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>الرقم الضريبي</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customerVatNo || "-"}</Text>
              </View>
              <View style={styles.metaLine}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>الرقم الموحد / س.ت</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customerCrOrUnified || "-"}</Text>
              </View>
              <View style={[styles.metaLine, { borderBottomWidth: 0 }]}>
                <View style={styles.metaLblGroup}>
                  <Text style={styles.metaLbl}>الهاتف / الجوال</Text>
                  <Text style={styles.metaColon}>:</Text>
                </View>
                <Text style={styles.metaVal}>{customer.phone || "-"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE ─── */}
        <View style={styles.tableWrap}>
          {/* Table Header (RTL order: Total Inc VAT to Index) */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, styles.colTotal]}>المجموع شامل الضريبة</Text>
            <Text style={[styles.thCell, styles.colVatAmount]}>مبلغ الضريبة</Text>
            <Text style={[styles.thCell, styles.colVatRate]}>نسبة الضريبة</Text>
            <Text style={[styles.thCell, styles.colPrice]}>سعر الوحدة</Text>
            <Text style={[styles.thCell, styles.colQty]}>الكمية</Text>
            <Text style={[styles.thCell, styles.colDesc]}>البيـــــــــــــــــــــــــــــــــان</Text>
            <Text style={[styles.thCell, styles.colIndex]}>م</Text>
          </View>

          {/* Table Body */}
          <View style={styles.tableBody}>
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const price = Number(item.unitPrice || 0);
              const lineDisc = Number(item.discountAmount || (item as any).discount || 0);
              const rawLineSubtotal = qty * price;
              const discountedSubtotal =
                lineDisc > 0 ? Math.max(0, rawLineSubtotal - lineDisc) : Number(item.lineSubtotal ?? rawLineSubtotal);

              const vatRate =
                item.vatRate !== undefined && item.vatRate !== null
                  ? Number(item.vatRate)
                  : (item as any).taxRate !== undefined
                  ? Number((item as any).taxRate)
                  : 15;
              const lineVat =
                item.lineVat !== undefined && item.lineVat !== null
                  ? Number(item.lineVat)
                  : (discountedSubtotal * vatRate) / 100;
              const lineTotal =
                item.lineTotal !== undefined && item.lineTotal !== null
                  ? Number(item.lineTotal)
                  : discountedSubtotal + lineVat;

              return (
                <View
                  key={idx}
                  style={[
                    styles.tableRow,
                    idx % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                >
                  <Text style={[styles.tdCell, styles.colTotal, styles.textBold]}>
                    {formatExactAmount(lineTotal)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colVatAmount]}>
                    {formatExactAmount(lineVat)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colVatRate]}>
                    {vatRate}%
                  </Text>
                  <Text style={[styles.tdCell, styles.colPrice]}>
                    {formatExactAmount(price)}
                  </Text>
                  <Text style={[styles.tdCell, styles.colQty]}>
                    {formatExactAmount(qty)}
                  </Text>
                  <View style={[styles.tdCell, styles.colDesc, styles.textRightCol]}>
                    <Text style={styles.descText}>{item.description || ""}</Text>
                    {lineDisc > 0 ? (
                      <View style={styles.discountSubBox}>
                        <Text style={styles.discountSubText}>
                          خصم: {formatExactAmount(lineDisc)} (قبل: {formatExactAmount(rawLineSubtotal)} | بعد: {formatExactAmount(discountedSubtotal)})
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.tdCell, styles.colIndex]}>{idx + 1}</Text>
                </View>
              );
            })}
          </View>

          {/* Vertical Bank Account text along the right margin if present */}
          {bankAccount ? (
            <View style={styles.verticalBankBox}>
              <Text style={styles.verticalBankText}>
                رقم الحساب {bankAccount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ─── 4. TAFQEET STRIP ─── */}
        {tafqeetText ? (
          <View style={styles.tafqeetStrip}>
            <View style={styles.tafqeetRow}>
              <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة</Text>
              <Text style={styles.tafqeetColon}>:</Text>
              <Text style={styles.tafqeetVal}>{tafqeetText}</Text>
            </View>
          </View>
        ) : null}

        {/* ─── 5. BOTTOM SECTION: BANK CARD, QR CODE & TOTALS ─── */}
        <View style={styles.bottomSection}>
          {/* Left Column: Bank Card & ZATCA QR Code */}
          <View style={styles.bottomLeftCol}>
            {/* Bank Card (Native Theme) */}
            <View style={styles.bankCardBox}>
              <View style={styles.bankCardHeader}>
                <Text style={styles.bankCardHeaderText}>البيانات البنكية / Bank Details</Text>
              </View>
              <View style={styles.bankCardBody}>
                {bankName ? (
                  <View style={styles.bankDataRow}>
                    <View style={styles.metaLblGroup}>
                      <Text style={styles.bankLbl}>اسم البنك</Text>
                      <Text style={styles.bankColon}>:</Text>
                    </View>
                    <Text style={styles.bankVal}>{bankName}</Text>
                  </View>
                ) : null}
                {bankAccount ? (
                  <View style={styles.bankDataRow}>
                    <View style={styles.metaLblGroup}>
                      <Text style={styles.bankLbl}>رقم الحساب</Text>
                      <Text style={styles.bankColon}>:</Text>
                    </View>
                    <Text style={styles.bankVal}>{bankAccount}</Text>
                  </View>
                ) : null}
                {ibanNumber ? (
                  <View style={[styles.bankDataRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.metaLblGroup}>
                      <Text style={styles.bankLbl}>الآيبان IBAN</Text>
                      <Text style={styles.bankColon}>:</Text>
                    </View>
                    <Text style={styles.bankVal}>{ibanNumber}</Text>
                  </View>
                ) : null}
                {!bankName && !bankAccount && !ibanNumber ? (
                  <View style={[styles.bankDataRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.bankPlaceholder}>
                      المملكة العربية السعودية - سداد عبر القنوات المعتمدة
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ONLY ZATCA QR Code (Strictly no 1D barcodes) */}
            <View style={styles.qrBox}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImg} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>ZATCA QR</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right Column: Totals Table */}
          <View style={styles.bottomRightCol}>
            <View style={styles.totalsTableWrap}>
              {/* Gross Subtotal */}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValCell}>
                  {formatExactAmount(grossSubtotal)} ريال
                </Text>
                <Text style={styles.totalsLblCell}>المجموع غير شامل الضريبة</Text>
              </View>

              {/* Total Discount (if any) */}
              {hasAnyDiscount || Number(discountVal) > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsValCell}>
                    {formatExactAmount(discountVal)} ريال
                  </Text>
                  <Text style={styles.totalsLblCell}>إجمالي الخصم</Text>
                </View>
              ) : null}

              {/* Taxable Amount after discount */}
              {hasAnyDiscount || Number(discountVal) > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsValCell}>
                    {formatExactAmount(taxableVal)} ريال
                  </Text>
                  <Text style={styles.totalsLblCell}>المبلغ الخاضع للضريبة</Text>
                </View>
              ) : null}

              {/* VAT Amount */}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValCell}>
                  {formatExactAmount(vatVal)} ريال
                </Text>
                <Text style={styles.totalsLblCell}>
                  ضريبة القيمة المضافة ({vatRatePercentage})
                </Text>
              </View>

              {/* Grand Total Inc VAT (Highlighted in warm gold/gray) */}
              <View style={[styles.totalsRow, styles.totalsGrandRow]}>
                <Text style={styles.totalsValBold}>
                  {formatExactAmount(totalVal)} ريال
                </Text>
                <Text style={styles.totalsLblBold}>
                  الإجمـــــــــــــــــــــــــالي شامل الضريبة
                </Text>
              </View>

              {/* Invoice Paid */}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsValCell}>
                  {formatExactAmount(totalVal)} ريال
                </Text>
                <Text style={styles.totalsLblCell}>المبلغ المدفوع</Text>
              </View>

              {/* Balance Due (Zero) */}
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.totalsValCell}>0.00 ريال</Text>
                <Text style={styles.totalsLblCell}>المبلغ المتبقي</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 6. NOTES & TERMS ─── */}
        {invoice.notes || invoice.terms ? (
          <View style={styles.notesTermsBox}>
            {invoice.notes ? (
              <View style={styles.notesLine}>
                <Text style={styles.notesLabel}>ملاحظات: </Text>
                <Text style={styles.notesVal}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.notesLine}>
                <Text style={styles.notesLabel}>الشروط والأحكام: </Text>
                <Text style={styles.notesVal}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 7. SIGNATURES ROW ─── */}
        <View style={styles.signaturesRow}>
          <Text style={styles.sigItem}>توقيع المستلم: ..........................</Text>
          <Text style={styles.sigItem}>المندوب: ..........................</Text>
          <Text style={styles.sigItem}>المحاسب: ..........................</Text>
          <Text style={styles.sigItem}>البائع: ..........................</Text>
        </View>

        {/* ─── 8. COMPANY CUSTOM FOOTER TEXT ─── */}
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
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#222222",
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
  headerBox: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    borderTopWidth: 3,
    borderTopColor: "#A68050",
    backgroundColor: "#FAF8F5",
  },
  headerTextWrapWithLogo: {
    width: "80%",
    alignItems: "center",
  },
  headerTextWrapFull: {
    width: "100%",
    alignItems: "center",
  },
  companyNameAr: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 2,
    textAlign: "center",
  },
  companyNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4A4A4A",
    marginBottom: 2,
    textAlign: "center",
  },
  companyAddressText: {
    fontSize: 7.5,
    color: "#555555",
    marginBottom: 3,
    textAlign: "center",
  },
  headerMetaRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  headerBiDiItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  headerMetaLbl: {
    fontSize: 7.5,
    color: "#4A4A4A",
  },
  headerMetaColon: {
    fontSize: 7.5,
    color: "#4A4A4A",
    marginHorizontal: 2,
  },
  headerMetaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
  },
  headerMetaDivider: {
    fontSize: 8,
    color: "#A68050",
    marginHorizontal: 6,
  },
  headerContactRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  headerContactText: {
    fontSize: 7,
    color: "#666666",
  },
  headerLogoWrap: {
    width: "18%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 65,
    height: 65,
    objectFit: "contain",
  },

  // ─── Metadata 3-Box Grid ───
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 6,
  },
  metaBoxLeft: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    overflow: "hidden",
  },
  metaBoxCenter: {
    width: "34%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    overflow: "hidden",
  },
  metaBoxRight: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 4,
    overflow: "hidden",
  },
  cardHeader: {
    backgroundColor: "#EFECE6",
    borderBottomWidth: 1,
    borderBottomColor: "#4A4A4A",
    paddingVertical: 3,
    alignItems: "center",
  },
  cardHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333333",
  },
  cardHeaderGold: {
    backgroundColor: "#A68050",
    borderBottomWidth: 1,
    borderBottomColor: "#4A4A4A",
    paddingVertical: 3,
    alignItems: "center",
  },
  cardHeaderTextGold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  cardBody: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  metaLine: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E2E2",
    paddingVertical: 2,
    minHeight: 15,
  },
  metaLblGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  metaLbl: {
    fontSize: 7,
    color: "#4A4A4A",
  },
  metaColon: {
    fontSize: 7,
    color: "#666666",
    marginRight: 2,
  },
  metaVal: {
    fontSize: 7,
    color: "#111111",
    textAlign: "left",
    flex: 1,
  },
  metaValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
    flex: 1,
  },

  // ─── Items Table ───
  tableWrap: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 3,
    position: "relative",
    marginBottom: 5,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EFECE6",
    borderBottomWidth: 1,
    borderBottomColor: "#4A4A4A",
    minHeight: 20,
    alignItems: "center",
  },
  thCell: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "center",
    paddingVertical: 3,
    borderRightWidth: 0.75,
    borderRightColor: "#4A4A4A",
    height: "100%",
  },
  tableBody: {
    minHeight: 120,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
    minHeight: 18,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#FAF8F5",
  },
  tdCell: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: "#CCCCCC",
    height: "100%",
  },
  textRightCol: {
    textAlign: "right",
    paddingRight: 6,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  descText: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "right",
  },
  textBold: {
    fontWeight: "bold",
  },
  discountSubBox: {
    marginTop: 1.5,
    backgroundColor: "#FFF2E8",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  discountSubText: {
    fontSize: 6.5,
    color: "#B45309",
    textAlign: "right",
  },

  // Column Widths (RTL order)
  colTotal: { width: "16%" },
  colVatAmount: { width: "12%" },
  colVatRate: { width: "10%" },
  colPrice: { width: "12%" },
  colQty: { width: "10%" },
  colDesc: { width: "35%" },
  colIndex: { width: "5%", borderRightWidth: 0 },

  // Vertical Bank Text along right margin
  verticalBankBox: {
    position: "absolute",
    bottom: 6,
    right: 4,
    transform: "rotate(-90deg)",
    transformOrigin: "right bottom",
  },
  verticalBankText: {
    fontSize: 6.5,
    color: "#888888",
  },

  // ─── Tafqeet Strip ───
  tafqeetStrip: {
    borderWidth: 1,
    borderColor: "#A68050",
    borderRadius: 3,
    backgroundColor: "#FAF8F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 5,
  },
  tafqeetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  tafqeetLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#A68050",
  },
  tafqeetColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#A68050",
    marginHorizontal: 3,
  },
  tafqeetVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#222222",
  },

  // ─── Bottom Section: Bank Card & QR Left, Totals Right ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bottomLeftCol: {
    width: "42%",
    flexDirection: "column",
    gap: 4,
  },
  bankCardBox: {
    borderWidth: 1,
    borderColor: "#A68050",
    borderRadius: 3,
    overflow: "hidden",
  },
  bankCardHeader: {
    backgroundColor: "#A68050",
    paddingVertical: 2.5,
    alignItems: "center",
  },
  bankCardHeaderText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  bankCardBody: {
    backgroundColor: "#FAF8F5",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  bankDataRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#EAE6DE",
    paddingVertical: 1.5,
  },
  bankLbl: {
    fontSize: 6.5,
    color: "#555555",
  },
  bankColon: {
    fontSize: 6.5,
    color: "#555555",
    marginRight: 2,
  },
  bankVal: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#222222",
    textAlign: "left",
  },
  bankPlaceholder: {
    fontSize: 6.5,
    color: "#666666",
    textAlign: "center",
    paddingVertical: 2,
  },
  qrBox: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 3,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  qrImg: {
    width: 65,
    height: 65,
  },
  qrPlaceholder: {
    width: 65,
    height: 65,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 7,
    color: "#888888",
  },

  // Totals Table
  bottomRightCol: {
    width: "56%",
  },
  totalsTableWrap: {
    borderWidth: 1,
    borderColor: "#4A4A4A",
    borderRadius: 3,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  totalsGrandRow: {
    backgroundColor: "#EDE8DF",
    borderTopWidth: 1,
    borderTopColor: "#A68050",
    borderBottomWidth: 1,
    borderBottomColor: "#A68050",
    paddingVertical: 3.5,
  },
  totalsLblCell: {
    width: "48%",
    fontSize: 7.5,
    color: "#333333",
    textAlign: "right",
  },
  totalsValCell: {
    width: "52%",
    fontSize: 7.5,
    color: "#111111",
    textAlign: "left",
  },
  totalsLblBold: {
    width: "48%",
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  totalsValBold: {
    width: "52%",
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "left",
  },

  // ─── Notes & Terms ───
  notesTermsBox: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 3,
    backgroundColor: "#FAF8F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 5,
  },
  notesLine: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginBottom: 1.5,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4A4A4A",
  },
  notesVal: {
    fontSize: 7,
    color: "#333333",
    flex: 1,
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#A0A0A0",
    marginBottom: 4,
  },
  sigItem: {
    fontSize: 7,
    color: "#444444",
  },

  // ─── Custom Footer ───
  footerWrap: {
    marginTop: 2,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#666666",
    textAlign: "center",
  },
});
