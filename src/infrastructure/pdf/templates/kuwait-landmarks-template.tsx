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

export interface KuwaitLandmarksTemplateProps {
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

// ─── Extended types for optional ERP fields ───
interface ExtendedInvoice {
  paymentMethod?: string | null;
  paymentType?: string | null;
  paymentMethodLabel?: string | null;
  salesman?: string | null;
  salesmanName?: string | null;
  sellerName?: string | null;
  branchName?: string | null;
  branch?: string | null;
  customVatRate?: number | string | null;
}

interface ExtendedCustomer {
  unifiedNumber?: string | number | null;
  unifiedNo?: string | number | null;
  crNumber?: string | number | null;
  commercialReg?: string | number | null;
  addressDistrict?: string | null;
  district?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ExtendedCompany {
  unifiedNumber?: string | number | null;
  unifiedNo?: string | number | null;
  footerText?: string | null;
  addressCountry?: string | null;
  country?: string | null;
}

interface ExtendedSettings {
  footerText?: string | null;
}

interface ExtendedItem {
  barcode?: string | null;
  itemCode?: string | null;
  code?: string | null;
  sku?: string | null;
  unitName?: string | null;
  unit?: string | null;
  productName?: string | null;
  name?: string | null;
}

// ─── Exact decimal precision formatting (never round, floor, or ceiling) ───
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

// ─── Format date to DD/MM/YYYY only (strictly no hours or time) ───
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

// ─── Arabic Words Tafqeet ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";

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

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;
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

function tafqeet(val: string | number | null | undefined): string {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0)) || 0;
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  if (riyals === 0 && halalas === 0) {
    return "فقط صفر ريال سعودي لا غير";
  }

  let text = "فقط ";
  if (riyals > 0) {
    text += numberToArabicWords(riyals) + " ريال سعودي";
    if (halalas > 0) {
      text += " و" + numberToArabicWords(halalas) + " هللة";
    }
  } else {
    text += numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

// ─── Header metadata row with strict BiDi middle-colon pattern ───
function HeaderMetaRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.headerMetaRow}>
      <Text style={styles.headerMetaLabel}>{label}</Text>
      <Text style={styles.headerMetaColon}>:</Text>
      <Text style={styles.headerMetaVal}>{String(value)}</Text>
    </View>
  );
}

// ─── Client card row with strict BiDi middle-colon pattern and English key ───
function ClientCardRow({
  enKey,
  arKey,
  value,
}: {
  enKey: string;
  arKey: string;
  value?: string | number | null;
}) {
  const valStr = value !== null && value !== undefined ? String(value).trim() : "";
  return (
    <View style={styles.cardRow}>
      <Text style={styles.cardKeyEn}>{enKey}</Text>
      <View style={styles.cardArGroup}>
        <Text style={styles.cardKeyAr}>{arKey}</Text>
        <Text style={styles.cardColon}>:</Text>
        <Text style={styles.cardVal}>{valStr}</Text>
      </View>
    </View>
  );
}

export function KuwaitLandmarksTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: KuwaitLandmarksTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 842;

  const extInv = invoice as InvoiceDto & ExtendedInvoice;
  const extCust = customer as CustomerRecord & ExtendedCustomer;
  const extComp = company as CompanyRecord & ExtendedCompany;

  const extSettings = settings as (CompanySettingsRecord & ExtendedSettings) | null | undefined;

  const invoiceNum = invoice?.invoiceNumber || "";
  const issueDateStr = formatDate(invoice?.issueDate);

  // Company details
  const companyNameAr = company?.nameAr || "";
  const companyNameEn = company?.nameEn || "";
  const companyVat = company?.vatNumber || "";
  const companyCr = company?.crNumber || "";
  const companyUnified = extComp?.unifiedNumber || extComp?.unifiedNo || "";
  const companyPhone = company?.phone || "";
  const companyEmail = company?.email || "";
  const companyWebsite = company?.website || "";
  const companyCountry = extComp?.addressCountry || extComp?.country || "المملكة العربية السعودية";

  // Clean company address line: (Additional No. - Postal Code - Street Name - Building No. - District - City - Country)
  const companyAddressParts = [
    company?.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : "",
    company?.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : "",
    company?.addressStreet,
    company?.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company?.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company?.addressCity,
    companyCountry,
  ].filter(Boolean);
  const companyAddressLine = companyAddressParts.join(" - ");

  // Customer details
  const customerName = customer?.nameAr || customer?.nameEn || "";
  const customerVat = customer?.vatNumber || "";
  const customerUnified = extCust?.unifiedNumber || extCust?.unifiedNo || extCust?.crNumber || extCust?.commercialReg || "";
  const customerPhone = customer?.phone || extCust?.phone || "";
  const customerEmail = customer?.email || extCust?.email || "";

  // Clean customer address line: City - Postal Code - [Street Name / District]
  const customerAddressParts = [
    customer?.addressCity,
    customer?.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : "",
    extCust?.addressDistrict || extCust?.district ? `حي ${extCust?.addressDistrict || extCust?.district}` : "",
    customer?.addressStreet,
  ].filter(Boolean);
  const customerAddressLine = customerAddressParts.join(" - ");

  // Optional transaction attributes
  const salesman = extInv.salesman || extInv.salesmanName || extInv.sellerName || "";
  const branch = extInv.branch || extInv.branchName || company?.addressCity || "";

  // Items processing
  const items = invoice?.items || [];
  const discountTotal = items.reduce(
    (acc, it) => acc + Number(it.discountAmount || 0),
    0
  );
  const subtotalNum = Number(invoice?.subtotal || 0);
  const hasDiscount = discountTotal > 0;
  const afterDiscount = hasDiscount ? Math.max(0, subtotalNum - discountTotal) : subtotalNum;

  // Detect VAT rate
  const firstItem = items.length > 0 ? items[0] : undefined;
  const firstItemVatRate = firstItem && firstItem.vatRate !== undefined && firstItem.vatRate !== null
    ? Math.round(Number(firstItem.vatRate) * 100)
    : 15;
  const vatRateDisplay = extInv.customVatRate ? `${extInv.customVatRate}%` : `${firstItemVatRate}%`;

  // Custom footer text
  const footerText = extComp?.footerText || extSettings?.footerText || "";

  // Dynamic single-page height calculation so the invoice NEVER spills onto a 2nd page
  let extraHeight = Math.max(0, items.length - 4) * 26;
  if (invoice?.notes) extraHeight += 25 + invoice.notes.split("\n").length * 10;
  if (invoice?.terms) extraHeight += 25 + invoice.terms.split("\n").length * 10;
  if (footerText) extraHeight += 25;
  const pageHeight = Math.max(basePageHeight, basePageHeight + extraHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={[basePageWidth, pageHeight]} orientation="portrait" style={styles.page}>
        {/* Watermark Background */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER (ENGLISH ON LEFT, ARABIC ON RIGHT, LOGO OPTIONAL) ─── */}
        <View style={styles.headerTop}>
          {/* Left: English Company Name or Logo & Optional contact info */}
          <View style={styles.headerLeft}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : null}
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyWebsite ? (
              <Text style={styles.companyContactSub}>{companyWebsite}</Text>
            ) : null}
            {companyEmail ? (
              <Text style={styles.companyContactSub}>{companyEmail}</Text>
            ) : null}
          </View>

          {/* Right: Arabic Company Details with Middle Colon Pattern */}
          <View style={styles.headerRight}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            {companyAddressLine ? (
              <Text style={styles.companyAddressLine}>{companyAddressLine}</Text>
            ) : null}

            <HeaderMetaRow label="الرقم الضريبي" value={companyVat} />
            <HeaderMetaRow label="س.ت" value={companyCr} />
            {companyUnified && companyUnified !== companyCr ? (
              <HeaderMetaRow label="الرقم الموحد" value={companyUnified} />
            ) : null}
            <HeaderMetaRow label="الهاتف" value={companyPhone} />
          </View>
        </View>

        {/* Header Separator Line */}
        <View style={styles.headerDivider} />

        {/* ─── 2. TITLE BADGE, INVOICE BOX & QR CODE ─── */}
        <View style={styles.metaRowSection}>
          {/* Left: Invoice Box */}
          <View style={styles.metaLeftBoxCol}>
            {/* Title Box Centered Above the Box */}
            <View style={styles.titleBadgeWrap}>
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>فاتورة ضريبية</Text>
              </View>
            </View>

            {/* 2-Row Box: Invoice Number & Date (Strictly DD/MM/YYYY, no time) */}
            <View style={styles.invoiceNumberBox}>
              {/* Row 1: Invoice Number */}
              <View style={styles.invBoxRow1}>
                <Text style={styles.invBoxLabelEn}>Invoice Number</Text>
                <Text style={styles.invBoxVal}>{invoiceNum}</Text>
                <Text style={styles.invBoxLabelAr}>رقم الفاتورة</Text>
              </View>

              {/* Row 2: Date */}
              <View style={styles.invBoxRow2}>
                <Text style={styles.invBoxLabelEn}>Date</Text>
                <Text style={styles.invBoxVal}>{issueDateStr}</Text>
                <Text style={styles.invBoxLabelAr}>التاريخ</Text>
              </View>
            </View>
          </View>

          {/* Right: ZATCA QR Code */}
          <View style={styles.metaRightQr}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 3. CLIENT & METADATA SECTION (BORDERED CARD) ─── */}
        <View style={styles.clientCard}>
          {/* Left Column (Contacts & Metadata) */}
          <View style={styles.clientCardLeft}>
            <ClientCardRow enKey="Mobile" arKey="جوال" value={customerPhone} />
            <ClientCardRow enKey="Email" arKey="البريد" value={customerEmail} />
            <ClientCardRow enKey="SalesMan" arKey="المندوب" value={salesman} />
            <ClientCardRow enKey="Branch" arKey="الفرع" value={branch} />
          </View>

          {/* Right Column (Customer Primary Details) */}
          <View style={styles.clientCardRight}>
            <ClientCardRow enKey="Client" arKey="العميل" value={customerName} />
            <ClientCardRow enKey="Tax No." arKey="الرقم الضريبي" value={customerVat} />
            <ClientCardRow enKey="Unified No." arKey="الرقم الموحد" value={customerUnified} />
            <ClientCardRow enKey="Address" arKey="العنوان" value={customerAddressLine} />
          </View>
        </View>

        {/* ─── 4. LINE ITEMS TABLE (12 COLUMNS) ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. م (Right-most) */}
            <View style={[styles.thCell, { width: "3%" }]}>
              <Text style={styles.thText}>م</Text>
            </View>

            {/* 2. الباركود / Barcode */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thText}>الباركود</Text>
              <Text style={styles.thTextEn}>Barcode</Text>
            </View>

            {/* 3. الصنف / Item */}
            <View style={[styles.thCell, { width: "29%" }]}>
              <Text style={styles.thText}>الصنف</Text>
              <Text style={styles.thTextEn}>Item</Text>
            </View>

            {/* 4. الكمية / Quan */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>الكمية</Text>
              <Text style={styles.thTextEn}>Quan</Text>
            </View>

            {/* 5. السعر / Price */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>السعر</Text>
              <Text style={styles.thTextEn}>Price</Text>
            </View>

            {/* 6. الإجمالي / Total */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>الإجمالي</Text>
              <Text style={styles.thTextEn}>Total</Text>
            </View>

            {/* 7. الخصم / Disc */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>الخصم</Text>
              <Text style={styles.thTextEn}>Disc</Text>
            </View>

            {/* 8. الإجمالي بعد الخصم */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>الإجمالي بعد</Text>
              <Text style={styles.thText}>الخصم</Text>
            </View>

            {/* 9. ض.قيمة مضافة VAT% */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>ض.قيمة</Text>
              <Text style={styles.thText}>مضافة</Text>
              <Text style={styles.thTextEn}>VAT%</Text>
            </View>

            {/* 10. ض. القيمة المضافة / VAT */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thText}>ض. القيمة</Text>
              <Text style={styles.thText}>المضافة</Text>
              <Text style={styles.thTextEn}>VAT</Text>
            </View>

            {/* 11. الصافي / Net (Left-most) */}
            <View style={[styles.thCell, { width: "13%", borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>الصافي</Text>
              <Text style={styles.thTextEn}>Net</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item: InvoiceItemDto, index: number) => {
            const extItem = item as InvoiceItemDto & ExtendedItem;
            const rawSubtotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
            const discVal = Number(item.discountAmount || 0);
            const afterDisc = discVal > 0 ? Math.max(0, rawSubtotal - discVal) : rawSubtotal;
            const itemVatRate = item.vatRate !== undefined && item.vatRate !== null
              ? Math.round(Number(item.vatRate) * 100)
              : firstItemVatRate;

            const barcode = extItem.barcode || extItem.itemCode || extItem.code || extItem.sku || "";
            const itemName = extItem.productName || extItem.name || item.description || "";
            const hasExtraDesc = item.description && item.description !== itemName;

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. م */}
                <View style={[styles.tdCell, { width: "3%" }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>

                {/* 2. Barcode */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenter}>{barcode}</Text>
                </View>

                {/* 3. Item (Name & optional Description) */}
                <View style={[styles.tdCell, { width: "29%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdRightBold}>{itemName}</Text>
                  {hasExtraDesc ? (
                    <Text style={styles.tdRightDesc}>{item.description}</Text>
                  ) : null}
                </View>

                {/* 4. Quan */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.quantity)}</Text>
                </View>

                {/* 6. Price */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.unitPrice)}</Text>
                </View>

                {/* 7. Total (Subtotal before discount) */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(rawSubtotal)}</Text>
                </View>

                {/* 8. Disc */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{discVal > 0 ? formatExactAmount(discVal) : "0"}</Text>
                </View>

                {/* 9. After Disc */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(afterDisc)}</Text>
                </View>

                {/* 10. VAT% */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{itemVatRate}%</Text>
                </View>

                {/* 11. VAT */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.lineVat)}</Text>
                </View>

                {/* 12. Net (Total with VAT) */}
                <View style={[styles.tdCell, { width: "13%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{formatExactAmount(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION WITH STACKED BOXES AND TAFQEET ─── */}
        <View style={styles.totalsSection}>
          {/* Left Column: Stacked Boxed Numbers with Labels (NO trailing colons) */}
          <View style={styles.totalsStack}>
            {/* Row 1: Total Excluding VAT */}
            <View style={styles.totalBoxRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberBoxText}>{formatExactAmount(invoice?.subtotal)}</Text>
              </View>
              <View style={styles.labelGroup}>
                <Text style={styles.labelAr}>الإجمالي غير شامل ضريبة القيمة المضافة</Text>
                <Text style={styles.labelEn}>Total (Excluding VAT)</Text>
              </View>
            </View>

            {/* Row 2: Discount (Conditional if discount > 0) */}
            {hasDiscount ? (
              <View style={styles.totalBoxRow}>
                <View style={styles.numberBox}>
                  <Text style={styles.numberBoxText}>{formatExactAmount(discountTotal)}</Text>
                </View>
                <View style={styles.labelGroup}>
                  <Text style={styles.labelAr}>إجمالي الخصم</Text>
                  <Text style={styles.labelEn}>Total Discount</Text>
                </View>
              </View>
            ) : null}

            {/* Row 4: Total VAT */}
            <View style={styles.totalBoxRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberBoxText}>{formatExactAmount(invoice?.vatAmount)}</Text>
              </View>
              <View style={styles.labelGroup}>
                <Text style={styles.labelAr}>إجمالي ضريبة القيمة المضافة ({vatRateDisplay})</Text>
                <Text style={styles.labelEn}>Total VAT ({vatRateDisplay})</Text>
              </View>
            </View>

            {/* Row 5: Total Amount Due (Including VAT) */}
            <View style={styles.totalBoxRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberBoxText}>{formatExactAmount(invoice?.total)}</Text>
              </View>
              <View style={styles.labelGroup}>
                <Text style={styles.labelAr}>إجمالي المبلغ المستحق شامل ضريبة القيمة المضافة</Text>
                <Text style={styles.labelEn}>Total Amount Due (Including VAT)</Text>
              </View>
            </View>

            {/* Row 6: Invoice Paid */}
            <View style={styles.totalBoxRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberBoxText}>{formatExactAmount(invoice?.total)}</Text>
              </View>
              <View style={styles.labelGroup}>
                <Text style={styles.labelAr}>المبلغ المدفوع</Text>
                <Text style={styles.labelEn}>Invoice Paid</Text>
              </View>
            </View>

            {/* Row 7: Balance Due */}
            <View style={styles.totalBoxRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberBoxText}>0</Text>
              </View>
              <View style={styles.labelGroup}>
                <Text style={styles.labelAr}>المبلغ المتبقي</Text>
                <Text style={styles.labelEn}>Balance Due</Text>
              </View>
            </View>
          </View>

          {/* Right Column: Spelled-Out Arabic Words (Tafqeet) & Notes / Terms */}
          <View style={styles.tafqeetColumn}>
            {/* Tafqeet (Final Net) */}
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.tafqeetText}>{tafqeet(invoice?.total || 0)}</Text>
            </View>

            {/* Notes Section (NO trailing colon) */}
            {invoice?.notes ? (
              <View style={styles.notesWrap}>
                <Text style={styles.notesTitle}>ملاحظات</Text>
                <Text style={styles.notesBody}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Terms Section (NO trailing colon) */}
            {invoice?.terms ? (
              <View style={styles.notesWrap}>
                <Text style={styles.notesTitle}>الشروط والأحكام</Text>
                <Text style={styles.notesBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 6. FOOTER TEXT SECTION ─── */}
        {footerText ? (
          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>{footerText}</Text>
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
    paddingLeft: 28,
    paddingRight: 28,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── 1. Header ───
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    width: "42%",
    paddingTop: 2,
  },
  logoImage: {
    width: 90,
    height: 45,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameEn: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 2,
  },
  companyContactSub: {
    fontSize: 7.5,
    textAlign: "left",
    color: "#333333",
    marginBottom: 1,
  },
  headerRight: {
    width: "55%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  companyAddressLine: {
    fontSize: 7.5,
    textAlign: "right",
    marginBottom: 3,
    color: "#222222",
  },
  headerMetaRow: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 1.5,
  },
  headerMetaLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
    color: "#000000",
  },
  headerMetaColon: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
    marginHorizontal: 2,
    color: "#000000",
  },
  headerMetaVal: {
    fontSize: 7.5,
    textAlign: "left",
    color: "#000000",
  },
  headerDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    marginTop: 6,
    marginBottom: 8,
  },

  // ─── 2. Metadata, Title & QR ───
  metaRowSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  metaLeftBoxCol: {
    width: "60%",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  titleBadgeWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 4,
  },
  titleBadge: {
    borderWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 22,
    paddingVertical: 2,
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },

  invoiceNumberBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  invBoxRow1: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  invBoxRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  invBoxLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  invBoxVal: {
    fontSize: 8,
    fontWeight: "bold",
  },
  invBoxLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  metaRightQr: {
    width: "25%",
    alignItems: "flex-end",
  },
  qrImage: {
    width: 80,
    height: 80,
  },

  // ─── 3. Client & Metadata Card ───
  clientCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  clientCardLeft: {
    width: "48%",
    flexDirection: "column",
    gap: 3,
  },
  clientCardRight: {
    width: "52%",
    flexDirection: "column",
    gap: 3,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    minHeight: 14,
  },
  cardKeyEn: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "left",
    width: "26%",
  },
  cardArGroup: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "center",
    width: "74%",
  },
  cardKeyAr: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
    minWidth: 48,
  },
  cardColon: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    marginHorizontal: 2,
  },
  cardVal: {
    fontSize: 7,
    textAlign: "right",
    flex: 1,
  },

  // ─── 4. Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFFFF",
    minHeight: 30,
  },
  thCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6,
    textAlign: "center",
  },
  tableBodyRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    minHeight: 20,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 7,
    textAlign: "center",
  },
  tdRightBold: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
  },
  tdRightDesc: {
    fontSize: 6,
    textAlign: "right",
    color: "#555555",
    marginTop: 1,
  },

  // ─── 5. Totals & Tafqeet ───
  totalsSection: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  totalsStack: {
    width: "52%",
    flexDirection: "column",
    gap: 2,
  },
  totalBoxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numberBox: {
    width: 95,
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBoxText: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  labelGroup: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  labelAr: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "left",
  },
  labelEn: {
    fontSize: 6.5,
    textAlign: "left",
  },

  tafqeetColumn: {
    width: "45%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  tafqeetText: {
    fontSize: 7.5,
    color: "#1E3A8A",
    textAlign: "right",
    fontWeight: "bold",
  },
  notesWrap: {
    marginTop: 6,
    width: "100%",
    alignItems: "flex-end",
  },
  notesTitle: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 7,
    textAlign: "right",
    color: "#333333",
  },

  // ─── 6. Footer ───
  footerWrap: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#666666",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: "#444444",
    textAlign: "center",
  },
});
