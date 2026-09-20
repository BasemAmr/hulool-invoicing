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

export interface JoyInvoiceTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
  isPurchase?: boolean;
}

// ─── Tafqeet (Arabic Number to Words) ───
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
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text;
}

/**
 * Format monetary amount with exact decimal representation — NEVER floor, ceiling, or round.
 * Preserves the exact raw decimal tail (e.g. 23.4646916641601264) and formats integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
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
 * Strict date formatting: DD/MM/YYYY only — NO hours/time.
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

/**
 * Strict React-PDF BiDi Detail Row helper:
 * Renders in row-reverse order:
 * [Arabic label on RIGHT] + [independent ':' in MIDDLE] + [value on LEFT]
 * Completely avoids React-PDF colon flipping bug.
 */
function DetailRow({
  label,
  value,
  labelStyle = styles.detailLabel,
  colonStyle = styles.detailColon,
  valueStyle = styles.detailValue,
  containerStyle,
}: {
  label: string;
  value?: string | number | null;
  labelStyle?: any;
  colonStyle?: any;
  valueStyle?: any;
  containerStyle?: any;
}) {
  if (!value && value !== 0 && value !== "0") return null;
  return (
    <View style={[styles.detailRow, containerStyle]}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={colonStyle}>:</Text>
      <Text style={valueStyle}>{String(value)}</Text>
    </View>
  );
}

export function JoyInvoiceTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: JoyInvoiceTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const poRef = (invoice as any).poReference || (invoice as any).reference || "";
  const issueDateStr = formatDate(invoice.issueDate);

  // Title: explicitly "فاتورة ضريبية / Tax Invoice" per guidelines
  const titleTextAr = "فاتورة ضريبية";
  const titleTextEn = "Tax Invoice";

  // Effective logo
  const effectiveLogo = logoDataUrl || company.logoUrl || null;

  // ─── Company / Supplier Details ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = (company as any).nameEn || "";
  const companyBuilding = company.addressBuildingNumber || "";
  const companyStreet = company.addressStreet || "";
  const companyDistrict = company.addressDistrict || "";
  const companyCity = company.addressCity || "";
  const companyPostalCode = company.addressPostalCode || "";
  const companyAdditionalNo = company.addressAdditionalNumber || "";
  const companyVatNo = company.vatNumber || "";
  const companyCrn = company.crNumber || (company as any).unifiedNumber || "";
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || (company as any).webSite || "";

  // Address formatting per guidelines:
  // (Additional No. - Postal Code - Street - Building No. - District - City - Country)
  const companyAddressParts = [
    companyAdditionalNo ? `الرقم الإضافي: ${companyAdditionalNo}` : null,
    companyPostalCode ? `الرمز البريدي: ${companyPostalCode}` : null,
    companyStreet,
    companyBuilding ? `مبنى ${companyBuilding}` : null,
    companyDistrict,
    companyCity,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  // ─── Customer / Buyer Details ───
  const customerNameAr = customer.nameAr || customer.nameEn || "";
  const customerNameEn = customer.nameEn && customer.nameEn !== customer.nameAr ? customer.nameEn : "";
  const customerCity = customer.addressCity || "";
  const customerPostalCode = customer.addressPostalCode || (customer as any).postalCode || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = (customer as any).addressDistrict || (customer as any).district || "";
  const customerVatNo = customer.vatNumber || "";
  const customerCrn = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";

  // Address formatting per guidelines:
  // (City - Postal Code - Street - District)
  const customerAddressParts = [
    customerCity,
    customerPostalCode ? `الرمز البريدي: ${customerPostalCode}` : null,
    customerStreet,
    customerDistrict,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  // ─── Line Items & Calculations ───
  const items = invoice.items || [];
  const itemCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const hasAnyDiscount = items.some(
    (item) => Number(item.discountAmount || (item as any).discount || 0) > 0
  );

  const discountVal =
    (invoice as any).discountTotal ??
    items.reduce((s, it) => s + Number(it.discountAmount || (it as any).discount || 0), 0);

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

  const taxableVal = invoice.subtotal ?? Math.max(0, grossSubtotal - Number(discountVal));
  const vatVal = invoice.vatAmount ?? items.reduce((s, it) => s + Number(it.lineVat || 0), 0);
  const totalVal = invoice.total ?? Number(taxableVal) + Number(vatVal);

  const firstItemVatRate = items.find((it) => it.vatRate !== undefined && it.vatRate !== null)?.vatRate;
  const vatRatePercentage = firstItemVatRate !== undefined ? `${Number(firstItemVatRate)}%` : "15%";

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "صفر ريال سعودي";

  // ─── Dynamic Single-Page Height Calculation ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const itemRowHeight = 28;
  const extraItemsCount = Math.max(0, items.length - 3);
  let extraContentHeight = extraItemsCount * itemRowHeight;

  if (hasAnyDiscount) {
    extraContentHeight += items.filter((it) => Number(it.discountAmount || (it as any).discount || 0) > 0).length * 12;
  }
  if (invoice.notes) extraContentHeight += 38 + Math.min(invoice.notes.split("\n").length, 6) * 12;
  if (invoice.terms) extraContentHeight += 38 + Math.min(invoice.terms.split("\n").length, 6) * 12;
  if (company.footerText) extraContentHeight += 26;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);

  return (
    <Document
      title={`${titleTextAr} ${invoiceNum}`}
      author={companyNameAr}
      subject="TAX INVOICE - فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={[pageWidth, dynamicHeight]} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO & INVOICE TITLE ─── */}
        <View style={styles.headerTopRow}>
          {/* Left: Optional Company Logo */}
          <View style={styles.logoWrap}>
            {effectiveLogo ? (
              <Image src={effectiveLogo} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>

          {/* Right: Bilingual Title */}
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitleAr}>{titleTextAr}</Text>
            <Text style={styles.headerTitleEn}>{titleTextEn}</Text>
          </View>
        </View>

        {/* ─── 2. QR CODE & INVOICE METADATA SECTION ─── */}
        <View style={styles.metaSection}>
          {/* Left: ZATCA QR Code (ONLY QR - ABSOLUTELY NO LINEAR BARCODES) */}
          <View style={styles.qrBox}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder} />
            )}
          </View>

          {/* Right: Invoice Metadata with Strict BiDi Middle-Colon */}
          <View style={styles.metaInfoBox}>
            <DetailRow
              label="الرقم التسلسلي للفاتورة"
              value={invoiceNum}
              labelStyle={styles.metaLabel}
              colonStyle={styles.metaColon}
              valueStyle={styles.metaValueBold}
            />
            <DetailRow
              label="تاريخ الإصدار"
              value={issueDateStr}
              labelStyle={styles.metaLabel}
              colonStyle={styles.metaColon}
              valueStyle={styles.metaValue}
            />
            {poRef ? (
              <DetailRow
                label="الرقم المرجعي"
                value={poRef}
                labelStyle={styles.metaLabel}
                colonStyle={styles.metaColon}
                valueStyle={styles.metaValue}
              />
            ) : null}
            <DetailRow
              label="نوع الفاتورة"
              value="فاتورة ضريبية"
              labelStyle={styles.metaLabel}
              colonStyle={styles.metaColon}
              valueStyle={styles.metaValue}
            />
            <DetailRow
              label="حالة الفاتورة"
              value="معتمدة"
              labelStyle={styles.metaLabel}
              colonStyle={styles.metaColon}
              valueStyle={styles.metaValue}
            />
          </View>
        </View>

        {/* ─── 3. PARTIES: SUPPLIER (من) & CUSTOMER (إلى) ─── */}
        <View style={styles.partiesSection}>
          {/* Left: إلى : Recipient / Customer */}
          <View style={styles.partyBox}>
            <View style={styles.partyHeaderRow}>
              <Text style={styles.partyHeaderEn}>Billed To / Customer</Text>
              <Text style={styles.partyHeaderAr}>العميل (إلى)</Text>
            </View>
            <View style={styles.partyBody}>
              <Text style={styles.partyNameBold}>{customerNameAr}</Text>
              {customerNameEn ? <Text style={styles.partyNameEn}>{customerNameEn}</Text> : null}
              {customerAddress ? (
                <DetailRow label="العنوان" value={customerAddress} />
              ) : null}
              {customerVatNo ? (
                <DetailRow label="الرقم الضريبي" value={customerVatNo} />
              ) : null}
              {customerCrn ? (
                <DetailRow label="الرقم الموحد / السجل" value={customerCrn} />
              ) : null}
              {customerPhone ? (
                <DetailRow label="الهاتف" value={customerPhone} />
              ) : null}
              {customerEmail ? (
                <DetailRow label="البريد الإلكتروني" value={customerEmail} />
              ) : null}
            </View>
          </View>

          {/* Right: من : Issuer / Company */}
          <View style={styles.partyBox}>
            <View style={styles.partyHeaderRow}>
              <Text style={styles.partyHeaderEn}>Issued By / Supplier</Text>
              <Text style={styles.partyHeaderAr}>المورد (من)</Text>
            </View>
            <View style={styles.partyBody}>
              <Text style={styles.partyNameBold}>{companyNameAr}</Text>
              {companyNameEn ? <Text style={styles.partyNameEn}>{companyNameEn}</Text> : null}
              {companyAddress ? (
                <DetailRow label="العنوان" value={companyAddress} />
              ) : null}
              {companyVatNo ? (
                <DetailRow label="الرقم الضريبي" value={companyVatNo} />
              ) : null}
              {companyCrn ? (
                <DetailRow label="السجل التجاري / الرقم الموحد" value={companyCrn} />
              ) : null}
              {companyPhone ? (
                <DetailRow label="الهاتف" value={companyPhone} />
              ) : null}
              {companyEmail ? (
                <DetailRow label="البريد الإلكتروني" value={companyEmail} />
              ) : null}
              {companyWebsite ? (
                <DetailRow label="الموقع الإلكتروني" value={companyWebsite} />
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (JOY SKY BLUE ACCENT) ─── */}
        <View style={styles.table}>
          {/* Table Header Row (RTL Order rendered Left to Right) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. المجموع شامل الضريبة / Subtotal Inc. VAT */}
            <View style={[styles.thCell, { width: "16%" }]}>
              <Text style={styles.thTextAr}>المجموع شامل الضريبة</Text>
              <Text style={styles.thTextEn}>Total (Inc. VAT)</Text>
            </View>

            {/* 2. مبلغ الضريبة / Tax Amount */}
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thTextAr}>مبلغ الضريبة</Text>
              <Text style={styles.thTextEn}>VAT Amount</Text>
            </View>

            {/* 3. نسبة الضريبة / Tax Rate */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>نسبة الضريبة</Text>
              <Text style={styles.thTextEn}>VAT Rate</Text>
            </View>

            {/* 4. سعر الوحدة / Unit Price */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thTextAr}>سعر الوحدة</Text>
              <Text style={styles.thTextEn}>Unit Price</Text>
            </View>

            {/* 5. الكمية / QTY */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Qty</Text>
            </View>

            {/* 6. وصف الصنف أو الخدمة / Description */}
            <View style={[styles.thCell, { width: "32%" }]}>
              <Text style={styles.thTextAr}>وصف السلعة أو الخدمة</Text>
              <Text style={styles.thTextEn}>Description</Text>
            </View>

            {/* 7. مسلسل / Sr. No */}
            <View style={[styles.thCell, { width: "7%", borderLeftWidth: 0 }]}>
              <Text style={styles.thTextAr}>مسلسل</Text>
              <Text style={styles.thTextEn}>No.</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {items.map((item, index) => {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const grossLineTotal = qty * unitPrice;
            const itemDiscount = Number(item.discountAmount || (item as any).discount || 0);
            const netSubtotal = Math.max(0, grossLineTotal - itemDiscount);
            const itemVatRate =
              item.vatRate !== undefined && item.vatRate !== null ? Number(item.vatRate) : 15;
            const lineVat =
              item.lineVat !== undefined && item.lineVat !== null
                ? Number(item.lineVat)
                : (netSubtotal * itemVatRate) / 100;
            const lineTotalIncVat =
              item.lineTotal !== undefined && item.lineTotal !== null
                ? Number(item.lineTotal)
                : netSubtotal + lineVat;

            return (
              <View key={item.position ?? index} style={styles.tableBodyRow}>
                {/* 1. Total (Inc. VAT) */}
                <View style={[styles.tdCell, { width: "16%" }]}>
                  <Text style={styles.tdCenterBold}>﷼ {formatExactAmount(lineTotalIncVat)}</Text>
                  {itemDiscount > 0 ? (
                    <Text style={styles.tdDiscountSub}>
                      قبل: {formatExactAmount(grossLineTotal)} / بعد: {formatExactAmount(netSubtotal)}
                    </Text>
                  ) : null}
                </View>

                {/* 2. Tax Amount */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdCenter}>﷼ {formatExactAmount(lineVat)}</Text>
                </View>

                {/* 3. Tax Rate */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{itemVatRate}%</Text>
                </View>

                {/* 4. Unit Price */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdCenter}>﷼ {formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* 5. QTY */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 6. Description */}
                <View style={[styles.tdCell, { width: "32%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDescText}>{item.description}</Text>
                  {itemDiscount > 0 ? (
                    <Text style={styles.tdDiscountTag}>
                      خصم: ﷼ {formatExactAmount(itemDiscount)}
                    </Text>
                  ) : null}
                </View>

                {/* 7. Sr. No */}
                <View style={[styles.tdCell, { width: "7%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>
              </View>
            );
          })}

          {/* Total Quantity Sub-Bar */}
          <View style={styles.totalQtyRow}>
            <Text style={styles.totalQtyVal}>{formatExactAmount(totalQty)}</Text>
            <Text style={styles.totalQtyLabel}>اجمالي الكمية / Total Quantity</Text>
          </View>
        </View>

        {/* ─── 5. BOTTOM SECTION: DUAL SUMMARY CARDS ─── */}
        <View style={styles.bottomCardsWrap}>
          {/* Card 1 (Left): Amounts & Taxes Breakdown */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderBox}>
              <Text style={styles.cardHeaderTitleAr}>ملخص المبالغ والضريبة</Text>
              <Text style={styles.cardHeaderTitleEn}>Amounts & Taxes Summary</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardVal}>{itemCount}</Text>
              <Text style={styles.cardKey}>Items Count / عدد الأصناف</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.cardKey}>Gross Total Excl. VAT / الإجمالي قبل الضريبة</Text>
            </View>

            {Number(discountVal) > 0 ? (
              <View style={styles.summaryCardRow}>
                <Text style={styles.cardValDiscount}>- ﷼ {formatExactAmount(discountVal)}</Text>
                <Text style={styles.cardKey}>Total Discount / إجمالي الخصم</Text>
              </View>
            ) : null}

            {Number(discountVal) > 0 ? (
              <View style={styles.summaryCardRow}>
                <Text style={styles.cardValBold}>﷼ {formatExactAmount(taxableVal)}</Text>
                <Text style={styles.cardKey}>Taxable Amount / المبلغ الخاضع للضريبة</Text>
              </View>
            ) : null}

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatExactAmount(vatVal)}</Text>
              <Text style={styles.cardKey}>VAT ({vatRatePercentage}) / ضريبة القيمة المضافة</Text>
            </View>

            <View style={[styles.summaryCardRow, styles.summaryTotalRow]}>
              <Text style={styles.cardValTotal}>﷼ {formatExactAmount(totalVal)}</Text>
              <Text style={styles.cardKeyTotal}>Total Inc. VAT / المبلغ الكلي شامل الضريبة</Text>
            </View>
          </View>

          {/* Card 2 (Right): Payment Status & Balance Due */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderBox}>
              <Text style={styles.cardHeaderTitleAr}>حالة الدفع والرصيد</Text>
              <Text style={styles.cardHeaderTitleEn}>Payment Status & Balance</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValStatus}>معتمدة</Text>
              <Text style={styles.cardKey}>Invoice Status / حالة الفاتورة</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValBold}>﷼ {formatExactAmount(totalVal)}</Text>
              <Text style={styles.cardKey}>Invoice Paid / المبلغ المسدد</Text>
            </View>

            <View style={styles.summaryCardRow}>
              <Text style={styles.cardValZero}>﷼ 0.00</Text>
              <Text style={styles.cardKey}>Balance Due / الرصيد المتبقي</Text>
            </View>

            <View style={[styles.summaryCardRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.cardVal}>{issueDateStr}</Text>
              <Text style={styles.cardKey}>Issue Date / تاريخ الإصدار</Text>
            </View>
          </View>
        </View>

        {/* ─── 6. TAFQEET BOX (PROMINENT, GUARANTEED NEVER ZERO) ─── */}
        <View style={styles.tafqeetBox}>
          <Text style={styles.tafqeetLabel}>المبلغ المستحق كتابة / Amount in Words</Text>
          <Text style={styles.tafqeetText}>فقط {tafqeetText} لا غير</Text>
        </View>

        {/* ─── 7. NOTES & TERMS (CONDITIONAL) ─── */}
        {invoice.notes ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>ملاحظات / Notes</Text>
            <Text style={styles.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.terms ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>الشروط والأحكام / Terms & Conditions</Text>
            <Text style={styles.noteText}>{invoice.terms}</Text>
          </View>
        ) : null}

        {/* ─── 8. FOOTER TEXT ─── */}
        {company.footerText ? (
          <View style={styles.footerWrap}>
            <Text style={styles.footerContentText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header Top Row: Logo & Title ───
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#0284C7",
    paddingBottom: 8,
  },
  logoWrap: {
    width: 110,
    height: 48,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  logoImage: {
    maxWidth: 110,
    maxHeight: 48,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 1,
    height: 1,
  },
  headerTitleBox: {
    alignItems: "flex-end",
  },
  headerTitleAr: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0284C7",
    textAlign: "right",
  },
  headerTitleEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "right",
    marginTop: 1,
  },

  // ─── QR Code & Metadata ───
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  qrBox: {
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 2,
    borderRadius: 3,
  },
  qrImage: {
    width: 62,
    height: 62,
    objectFit: "contain",
  },
  qrPlaceholder: {
    width: 62,
    height: 62,
  },
  metaInfoBox: {
    alignItems: "flex-end",
    flex: 1,
    marginLeft: 16,
  },
  metaLabel: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right",
  },
  metaColon: {
    fontSize: 8,
    color: "#475569",
    marginHorizontal: 3,
  },
  metaValue: {
    fontSize: 8,
    color: "#0F172A",
    textAlign: "left",
  },
  metaValueBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0284C7",
    textAlign: "left",
  },

  // ─── BiDi Detail Row ───
  detailRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 7.5,
    color: "#64748B",
    textAlign: "right",
  },
  detailColon: {
    fontSize: 7.5,
    color: "#64748B",
    marginHorizontal: 2,
  },
  detailValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "left",
  },

  // ─── Parties ───
  partiesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  partyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#DCEAF5",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#93C5FD",
  },
  partyHeaderAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0369A1",
    textAlign: "right",
  },
  partyHeaderEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "left",
  },
  partyBody: {
    padding: 6,
    alignItems: "flex-end",
  },
  partyNameBold: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
    marginBottom: 2,
  },
  partyNameEn: {
    fontSize: 7.5,
    color: "#475569",
    textAlign: "right",
    marginBottom: 3,
  },

  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#DCEAF5",
    borderBottomWidth: 1,
    borderBottomColor: "#93C5FD",
    minHeight: 26,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#CBD5E1",
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    minHeight: 24,
    alignItems: "center",
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 7.5,
    color: "#1E293B",
    textAlign: "center",
  },
  tdCenterBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  tdDescText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  tdDiscountTag: {
    fontSize: 6.5,
    color: "#DC2626",
    textAlign: "right",
    marginTop: 1,
  },
  tdDiscountSub: {
    fontSize: 6,
    color: "#64748B",
    textAlign: "center",
    marginTop: 1,
  },

  totalQtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#F8FAFC",
  },
  totalQtyVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0284C7",
  },
  totalQtyLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E293B",
  },

  // ─── Bottom Summary Cards ───
  bottomCardsWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  cardHeaderBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#DCEAF5",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#93C5FD",
  },
  cardHeaderTitleAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0369A1",
    textAlign: "right",
  },
  cardHeaderTitleEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "left",
  },
  summaryCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  summaryTotalRow: {
    backgroundColor: "#F0F9FF",
    borderBottomWidth: 0,
    paddingVertical: 4,
  },
  cardKey: {
    fontSize: 7,
    color: "#475569",
    textAlign: "right",
  },
  cardKeyTotal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0369A1",
    textAlign: "right",
  },
  cardVal: {
    fontSize: 7.5,
    color: "#0F172A",
    textAlign: "left",
  },
  cardValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "left",
  },
  cardValDiscount: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#DC2626",
    textAlign: "left",
  },
  cardValTotal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0284C7",
    textAlign: "left",
  },
  cardValStatus: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#059669",
    textAlign: "left",
  },
  cardValZero: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "left",
  },

  // ─── Tafqeet Box ───
  tafqeetBox: {
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 4,
    backgroundColor: "#F0F9FF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  tafqeetLabel: {
    fontSize: 7,
    color: "#0369A1",
    marginBottom: 1.5,
    textAlign: "center",
  },
  tafqeetText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0C4A6E",
    textAlign: "center",
  },

  // ─── Notes & Terms ───
  noteBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRightWidth: 3,
    borderRightColor: "#0284C7",
    borderRadius: 3,
    backgroundColor: "#F8FAFC",
    padding: 6,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  noteTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0369A1",
    marginBottom: 2,
    textAlign: "right",
  },
  noteText: {
    fontSize: 7,
    color: "#334155",
    textAlign: "right",
    lineHeight: 1.3,
  },

  // ─── Footer ───
  footerWrap: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#CBD5E1",
    alignItems: "center",
  },
  footerContentText: {
    fontSize: 7,
    color: "#64748B",
    textAlign: "center",
  },
});
