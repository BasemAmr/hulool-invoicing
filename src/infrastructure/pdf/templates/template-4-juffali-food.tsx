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

export interface Template4JuffaliFoodProps {
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

// ─── Number to Arabic Words Tafqeet Helpers ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
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

  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  let out = "";

  if (thousands > 0) {
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

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  text += " لا غير";
  return text;
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(val: string | number | null | undefined, decimals = 2): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatUnitPrice(val: string | number | null | undefined): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return iso;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function getProductCode(item: InvoiceItemDto, index: number): string {
  const rec = item as InvoiceItemDto & {
    productCode?: string | null;
    code?: string | null;
    itemCode?: string | null;
  };
  const candidates = [rec.itemCode, rec.productCode, rec.code, rec.savedProductId];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (text === "" || isUuidLike(text)) continue;
    return text;
  }
  return String(index + 1);
}

interface ExtendedItemProps {
  itemRef?: string | null;
  packSize?: string | null;
  packaging?: string | null;
  uom?: string | null;
}

function getItemRef(item: InvoiceItemDto): string {
  const rec = item as InvoiceItemDto & ExtendedItemProps;
  return rec.itemRef || "";
}

function getItemPackSize(item: InvoiceItemDto): string {
  const rec = item as InvoiceItemDto & ExtendedItemProps;
  return rec.packSize || rec.packaging || rec.uom || "";
}

export function Template4JuffaliFood({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template4JuffaliFoodProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // Invoice identifiers & dates
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateFormatted = formatDate(invoice.issueDate);

  // Seller Details
  const companyNameEn = company.nameEn || "";
  const companyNameAr = company.nameAr || "";
  const companyCr = company.crNumber || "";
  const companyPhone = company.phone || "";
  const companyFax = (company as any).fax || "";
  const companyPoBox = (company as any).poBox || (company as any).addressPostalCode || "";
  const companyCity = company.addressCity || "";
  const companyCountry = (company as any).country || "Saudi Arabia";
  const companyBuildingNo = company.addressBuildingNumber || "";
  const companyAdditionalNo = (company as any).addressAdditionalNumber || (company as any).addressAdditionalNo || "";
  const companyVatNo = company.vatNumber || "";

  // Buyer Details
  const customerNameEn = (customer as any).nameEn || customer.nameAr || "";
  const customerNameAr = customer.nameAr || (customer as any).nameEn || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = (customer as any).addressDistrict || "";
  const customerBuilding = (customer as any).addressBuildingNumber || "";
  const customerCity = customer.addressCity || "";
  const customerPostalCode = customer.addressPostalCode || "";
  const customerCountry = (customer as any).country || "SAUDI ARABIA";
  const customerPhone = customer.phone || "";
  const customerRegion = (customer as any).region || "";
  const customerPo = (invoice as any).customerPo || (invoice as any).poNumber || "";
  const customerVatNo = customer.vatNumber || "";
  const customerUnifiedNo = customer.unifiedNumber || (customer as any).crNumber || "";

  // Meta bar values
  const customerId = (customer as any).customerId || (customer as any).code || (customer as any).id || "";
  const customerIdDisplay = isUuidLike(String(customerId)) ? "" : String(customerId);
  const deliveryNo = (invoice as any).deliveryNumber || (invoice as any).deliveryNo || "";
  const priceList = (invoice as any).priceList || (invoice as any).priceListCode || "";
  const paymentTerms = (invoice as any).paymentTerms || (invoice as any).terms || (invoice as any).paymentTermsDays || "30";
  const salesmanName = (invoice as any).salesmanName || (invoice as any).salesperson || "";
  const salesmanId = (invoice as any).salesmanId || "";

  // Calculations
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, it) => sum + toNumber(it.quantity), 0);

  // Financial values
  const totalVal = toNumber(invoice.total);
  const vatVal = toNumber(invoice.vatAmount);
  const subtotalVal = toNumber(invoice.subtotal);
  const discountTotalVal = toNumber((invoice as any).discountTotal);
  const netSalesVal = (invoice as any).taxableAmount !== undefined && (invoice as any).taxableAmount !== null
    ? toNumber((invoice as any).taxableAmount)
    : (subtotalVal - discountTotalVal > 0 ? subtotalVal - discountTotalVal : subtotalVal);

  const tafqeetArabic = totalVal > 0 ? tafqeet(totalVal) : "";

  // VAT group label
  const firstItem = items[0] as (InvoiceItemDto & { taxRate?: number | null }) | undefined;
  const vatRate = firstItem && (firstItem.vatRate !== undefined || firstItem.taxRate !== undefined)
    ? toNumber(firstItem.vatRate ?? firstItem.taxRate)
    : 15;

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyNameEn || companyNameAr || "Hulool Invoicing"}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (Left English Box | Center Logo Badge | Right Arabic Box) ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column: English Details */}
          <View style={styles.headerLeftCol}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            <View style={styles.infoLine}>
              {companyCr ? <Text style={styles.infoText}>C.R. No. {companyCr}</Text> : null}
              {companyPhone ? <Text style={styles.infoText}> - Tel: {companyPhone}</Text> : null}
              {companyFax ? <Text style={styles.infoText}> - Fax: {companyFax}</Text> : null}
            </View>
            <View style={styles.infoLine}>
              {companyPoBox ? <Text style={styles.infoText}>P.O. Box: {companyPoBox} </Text> : null}
              {companyCity ? <Text style={styles.infoText}>{companyCity} </Text> : null}
              {companyCountry ? <Text style={styles.infoText}>{companyCountry}</Text> : null}
            </View>
            <View style={styles.infoLine}>
              {companyBuildingNo ? <Text style={styles.infoText}>Unit No. {companyBuildingNo} </Text> : null}
              {companyBuildingNo ? <Text style={styles.infoText}>Building No. {companyBuildingNo} </Text> : null}
              {companyAdditionalNo ? <Text style={styles.infoText}>Additional No. {companyAdditionalNo}</Text> : null}
            </View>
            {companyVatNo ? (
              <Text style={styles.companyVatEn}>VAT Registration No: {companyVatNo}</Text>
            ) : null}
          </View>

          {/* Center: Circular Red Logo Badge */}
          <View style={styles.headerCenterCol}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.centerLogoImage} />
            ) : (
              <View style={styles.centerLogoCircle}>
                <View style={styles.chefHat} />
                <View style={styles.chefFace} />
              </View>
            )}
          </View>

          {/* Right Column: Arabic Company Details */}
          <View style={styles.headerRightCol}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            <View style={styles.arabicInfoRow}>
              {companyCr ? <Text style={styles.companySubAr}>ست: {companyCr}</Text> : null}
              {companyPhone ? <Text style={styles.companySubAr}> - هاتف: {companyPhone}</Text> : null}
              {companyFax ? <Text style={styles.companySubAr}> - فاكس: {companyFax}</Text> : null}
            </View>
            <View style={styles.arabicInfoRow}>
              {companyPoBox ? <Text style={styles.companySubAr}>ص.ب: {companyPoBox} </Text> : null}
              {companyCity ? <Text style={styles.companySubAr}>{companyCity} </Text> : null}
              {companyCountry ? <Text style={styles.companySubAr}>{companyCountry}</Text> : null}
            </View>
            <View style={styles.arabicInfoRow}>
              {companyBuildingNo ? <Text style={styles.companySubAr}>رقم المبنى {companyBuildingNo} </Text> : null}
              {companyAdditionalNo ? <Text style={styles.companySubAr}>الرقم الإضافي {companyAdditionalNo}</Text> : null}
            </View>
            {companyVatNo ? (
              <Text style={styles.companyVatAr}>ضريبة القيمة المضافة: {companyVatNo}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. TITLE STRIP (Tax e-invoice No. | Tax Invoice فاتورة ضريبية | رقم الفاتورة الإلكترونية الضريبية) ─── */}
        <View style={styles.titleStrip}>
          <View style={styles.titleLeftCol}>
            <Text style={styles.titleLabelEn}>Tax e-invoice No.</Text>
          </View>
          <View style={styles.titleCenterCol}>
            <View style={styles.titleCenterHeading}>
              <Text style={styles.titleCenterText}>Tax Invoice</Text>
              <Text style={styles.titleCenterText}>فاتورة ضريبية</Text>
            </View>
            <View style={styles.invoiceNumberBox}>
              <Text style={styles.invoiceNumberText}>{invoiceNum}</Text>
            </View>
          </View>
          <View style={styles.titleRightCol}>
            <Text style={styles.titleLabelAr}>رقم الفاتورة الإلكترونية الضريبية</Text>
          </View>
        </View>

        {/* ─── 3. CUSTOMER / BUYER INFO GRID ─── */}
        <View style={styles.customerGrid}>
          {/* Row 1: Sold To */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Sold To</Text></View>
            <View style={styles.cellValueEn}><Text style={styles.valueText}>{customerNameEn}</Text></View>
            <View style={styles.cellValueAr}><Text style={styles.valueTextAr}>{customerNameAr}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>السادة</Text></View>
          </View>

          {/* Row 2: Ship To */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Ship To</Text></View>
            <View style={styles.cellValueEn}><Text style={styles.valueText}>{customerNameEn}</Text></View>
            <View style={styles.cellValueAr}><Text style={styles.valueTextAr}>{customerNameAr}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>إلى السادة</Text></View>
          </View>

          {/* Row 3: Address (multi-line) */}
          <View style={[styles.gridRow, { minHeight: 38 }]}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Address</Text></View>
            <View style={styles.cellValueEn}>
              {customerDistrict ? <Text style={styles.valueText}>{customerDistrict}</Text> : null}
              {customerStreet ? <Text style={styles.valueText}>{customerStreet}</Text> : null}
              {customerBuilding ? <Text style={styles.valueText}>{customerBuilding}</Text> : null}
              {customerPostalCode ? <Text style={styles.valueText}>{customerPostalCode}</Text> : null}
            </View>
            <View style={styles.cellValueAr}>
              {customerDistrict ? <Text style={styles.valueTextAr}>{customerDistrict}</Text> : null}
              {customerStreet ? <Text style={styles.valueTextAr}>{customerStreet}</Text> : null}
              {customerBuilding ? <Text style={styles.valueTextAr}>{customerBuilding}</Text> : null}
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>العنوان</Text></View>
          </View>

          {/* Row 4: City/Country */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>City/Country</Text></View>
            <View style={styles.cellCityHalf}><Text style={styles.valueText}>{customerCity}</Text></View>
            <View style={styles.cellCountryHalf}><Text style={styles.valueText}>{customerCountry}</Text></View>
            <View style={styles.cellCityHalfAr}><Text style={styles.valueTextAr}>{customerCountry === "SAUDI ARABIA" ? "المملكة العربية السعودية" : customerCountry}</Text></View>
            <View style={styles.cellCountryHalfAr}><Text style={styles.valueTextAr}>{customerCity}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>دولة</Text></View>
          </View>

          {/* Row 5: Tel /Region */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Tel /Region</Text></View>
            <View style={styles.cellCityHalf}><Text style={styles.valueText}>{customerPhone}</Text></View>
            <View style={styles.cellCountryHalf}><Text style={styles.valueText}>{customerRegion}</Text></View>
            <View style={styles.cellCombinedAr}><Text style={styles.valueTextAr}>{customerRegion}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>المنطقة</Text></View>
          </View>

          {/* Row 6: Customer PO */}
          <View style={styles.gridRow}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>Customer PO</Text></View>
            <View style={styles.cellValueWideEn}><Text style={styles.valueText}>{customerPo}</Text></View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>العميل</Text></View>
          </View>

          {/* Row 7: VAT Number */}
          <View style={[styles.gridRow, { borderBottomWidth: 1 }]}>
            <View style={styles.cellLabelLeft}><Text style={styles.labelEn}>VAT Number</Text></View>
            <View style={styles.cellValueWideVat}>
              <Text style={styles.vatValueText}>
                {customerVatNo ? `${customerVatNo}${customerUnifiedNo ? ` - ${customerUnifiedNo}` : ""}` : customerUnifiedNo}
              </Text>
            </View>
            <View style={styles.cellLabelRight}><Text style={styles.labelAr}>ض.ق.م</Text></View>
          </View>
        </View>

        {/* ─── 4. SECONDARY METADATA BAR (Customer ID | Delivery No. | Price List | Terms | Salesman Name | Salesman ID | Invoice Date) ─── */}
        <View style={styles.metaBar}>
          {/* Customer ID */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>رقم العميل</Text>
            <Text style={styles.metaCellLabelEn}>Customer ID</Text>
            <Text style={styles.metaCellValue}>{customerIdDisplay}</Text>
          </View>

          {/* Delivery No. */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>رقم سند الاستلام</Text>
            <Text style={styles.metaCellLabelEn}>Delivery No.</Text>
            <Text style={styles.metaCellValue}>{deliveryNo}</Text>
          </View>

          {/* Price List */}
          <View style={styles.metaCellNarrow}>
            <Text style={styles.metaCellLabelAr}>قائمة الاسعار</Text>
            <Text style={styles.metaCellLabelEn}>Price List</Text>
            <Text style={styles.metaCellValue}>{priceList}</Text>
          </View>

          {/* Terms */}
          <View style={styles.metaCellNarrow}>
            <Text style={styles.metaCellLabelAr}>شروط التسديد</Text>
            <Text style={styles.metaCellLabelEn}>Terms</Text>
            <Text style={styles.metaCellValue}>{paymentTerms}</Text>
          </View>

          {/* Salesman Name */}
          <View style={styles.metaCellWide}>
            <Text style={styles.metaCellLabelAr}>اسم المندوب</Text>
            <Text style={styles.metaCellLabelEn}>Salesman Name</Text>
            <Text style={styles.metaCellValue}>{salesmanName}</Text>
          </View>

          {/* Salesman ID */}
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabelAr}>رقم المندوب</Text>
            <Text style={styles.metaCellLabelEn}>Salesman ID</Text>
            <Text style={styles.metaCellValue}>{salesmanId}</Text>
          </View>

          {/* Invoice Date */}
          <View style={styles.metaCellDate}>
            <Text style={styles.metaCellLabelAr}>تاريخ الفاتورة</Text>
            <Text style={styles.metaCellLabelEn}>Invoice Date</Text>
            <Text style={styles.metaCellValue}>{issueDateFormatted}</Text>
          </View>
        </View>

        {/* ─── 5. MAIN PRODUCTS TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.colItemCode, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>رمز المنتج</Text>
              <Text style={styles.headerTextEn}>Item Code</Text>
            </View>
            <View style={[styles.colItemRef, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>رقم مرجع المنتج</Text>
              <Text style={styles.headerTextEn}>Item Ref#</Text>
            </View>
            <View style={[styles.colDescription, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>البيـــــــــان</Text>
              <Text style={styles.headerTextEn}>Description</Text>
            </View>
            <View style={[styles.colQty, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الكمية</Text>
              <Text style={styles.headerTextEn}>Qty</Text>
            </View>
            <View style={[styles.colUnitPrice, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>سعر الوحدة</Text>
              <Text style={styles.headerTextEn}>Unit Price</Text>
            </View>
            <View style={[styles.colGrossAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الإجمالي</Text>
              <Text style={styles.headerTextEn}>Gross Amt</Text>
            </View>
            <View style={[styles.colDiscAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>الخصم</Text>
              <Text style={styles.headerTextEn}>Disc Amt</Text>
            </View>
            <View style={[styles.colNetAmt, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>السعر النهائي</Text>
              <Text style={styles.headerTextEn}>Net Amt</Text>
            </View>
            <View style={[styles.colVatPercent, styles.tableHeaderCell]}>
              <Text style={styles.headerTextAr}>% الضريبة</Text>
              <Text style={styles.headerTextEn}>VAT%</Text>
            </View>
            <View style={[styles.colVatAmt, styles.tableHeaderCell, { borderRightWidth: 0 }]}>
              <Text style={styles.headerTextAr}>مبلغ الضريبة</Text>
              <Text style={styles.headerTextEn}>VAT Amt</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item, index) => {
            const extItem = item as InvoiceItemDto & {
              taxRate?: number | null;
              taxAmount?: number | null;
              discount?: number | string | null;
              subtotal?: number | string | null;
            };
            const itemCode = getProductCode(item, index);
            const itemRef = getItemRef(item);
            const packSize = getItemPackSize(item);
            const qty = toNumber(item.quantity);
            const unitPrice = toNumber(item.unitPrice);
            const grossAmt = qty * unitPrice;
            const discAmt = toNumber(item.discountAmount ?? extItem.discount);
            const netAmt = toNumber(item.lineSubtotal ?? extItem.subtotal ?? (grossAmt - discAmt));
            const itemVatRate = item.vatRate !== undefined ? toNumber(item.vatRate) : (extItem.taxRate !== undefined ? toNumber(extItem.taxRate) : vatRate);
            const itemVatAmt = toNumber(item.lineVat ?? extItem.taxAmount ?? ((netAmt * itemVatRate) / 100));

            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                <View style={[styles.colItemCode, styles.tableCell]}>
                  <Text style={styles.cellCodeText}>{itemCode}</Text>
                </View>
                <View style={[styles.colItemRef, styles.tableCell]}>
                  <Text style={styles.cellTextCenter}>{itemRef}</Text>
                </View>
                <View style={[styles.colDescription, styles.tableCellDesc]}>
                  <Text style={styles.cellDescAr}>{item.description}</Text>
                  {packSize ? (
                    <Text style={styles.cellPackSize}>{packSize}</Text>
                  ) : null}
                </View>
                <View style={[styles.colQty, styles.tableCellQty]}>
                  <Text style={styles.checkMark}>✓</Text>
                  <Text style={styles.cellQtyText}>{formatQty(qty)}</Text>
                </View>
                <View style={[styles.colUnitPrice, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatUnitPrice(unitPrice)}</Text>
                </View>
                <View style={[styles.colGrossAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatNumber(grossAmt, 2)}</Text>
                </View>
                <View style={[styles.colDiscAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{discAmt > 0 ? formatNumber(discAmt, 2) : ""}</Text>
                </View>
                <View style={[styles.colNetAmt, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatNumber(netAmt, 2)}</Text>
                </View>
                <View style={[styles.colVatPercent, styles.tableCellNum]}>
                  <Text style={styles.cellNumText}>{formatNumber(itemVatRate, 2)}</Text>
                </View>
                <View style={[styles.colVatAmt, styles.tableCellNum, { borderRightWidth: 0 }]}>
                  <Text style={styles.cellNumText}>{formatNumber(itemVatAmt, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 6. TOTALS BREAKDOWN SUMMARY ─── */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>(Net Sales Value)</Text>
            <Text style={styles.summaryLabelAr}>السعر النهائي بعد الخصم</Text>
            <Text style={styles.summaryVal}>{formatNumber(netSalesVal, 2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelEn}>%{vatRate} (Total VAT Amount @ {vatRate}%)</Text>
            <Text style={styles.summaryLabelAr}>ضريبة القيمة المضافة</Text>
            <Text style={styles.summaryVal}>{formatNumber(vatVal, 2)}</Text>
          </View>
        </View>

        {/* ─── 7. AMOUNT IN WORDS & GRAND TOTAL BOX ─── */}
        <View style={styles.grandTotalBar}>
          <View style={styles.wordsCell}>
            <Text style={styles.wordsText}>{tafqeetArabic}</Text>
          </View>
          <View style={styles.grandTotalLabelCell}>
            <Text style={styles.grandTotalLabel}>المجموع بالريال</Text>
            <Text style={styles.grandTotalSubLabel}>الكمية الإجمالية: {formatQty(totalQty)}</Text>
          </View>
          <View style={styles.grandTotalValueCell}>
            <Text style={styles.grandTotalValue}>{formatNumber(totalVal, 2)}</Text>
          </View>
        </View>

        {/* ─── 8. QR CODE SECTION ─── */}
        <View style={styles.qrSection}>
          {qrDataUrl ? (
            <Image src={qrDataUrl} style={styles.qrImage} />
          ) : (
            <View style={styles.qrPlaceholder} />
          )}
        </View>

        {/* ─── 9. FOOTER NOTICE & PAGE NUMBER ─── */}
        <View style={styles.footerNoteBox}>
          <View style={styles.footerNoteRow}>
            <Text style={styles.footerNoteHeader}>NOTE</Text>
            <Text style={styles.footerNoteHeaderAr}>ملاحظة</Text>
          </View>
          <View style={styles.footerNoteRow}>
            <Text style={styles.footerNoteEn}>This invoice can be considered as Delivery Note.</Text>
            <Text style={styles.footerNoteAr}>يمكن اعتبارها سند الاستلام.</Text>
          </View>
          <View style={styles.footerNoteRow}>
            <Text style={styles.footerNoteEn}>
              All responsibilities and risk are to the buyers account once the goods are loaded on the delivery vehicles at our factory.
            </Text>
            <Text style={styles.footerNoteAr}>
              المسؤوليات والأخطار على عاتق المشتري لحظة تحميل البضائع على سيارات التسليم في المصنع.
            </Text>
          </View>
          <View style={styles.footerNoteRow}>
            <Text style={styles.footerNoteEn}>This is computer generated invoice, does not require any signature.</Text>
            <Text style={styles.footerNoteAr}>هذه الفاتورة آلياً من نظام الحاسب الآلي ولا يتطلب التوقيع عليها.</Text>
          </View>
        </View>

        {/* Page Numbering */}
        <View style={styles.pageNumberWrap}>
          <Text
            style={styles.pageNumberText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 7,
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header ───
  headerContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#1A1A1A",
    marginBottom: 6,
    minHeight: 66,
  },
  headerLeftCol: {
    width: "43%",
    padding: 5,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#1A1A1A",
  },
  companyNameEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    lineHeight: 1.15,
  },
  infoLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    lineHeight: 1.15,
  },
  infoText: {
    fontSize: 5.8,
    color: "#000000",
  },
  companyVatEn: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 1,
  },

  headerCenterCol: {
    width: "14%",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#1A1A1A",
  },
  centerLogoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    objectFit: "contain",
  },
  centerLogoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#C51A1B",
    alignItems: "center",
    justifyContent: "center",
  },
  chefHat: {
    width: 16,
    height: 11,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    marginBottom: 1,
  },
  chefFace: {
    width: 13,
    height: 11,
    backgroundColor: "#FFE0BD",
    borderRadius: 6,
  },

  headerRightCol: {
    width: "43%",
    padding: 5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  companyNameAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    lineHeight: 1.15,
    marginBottom: 2,
  },
  arabicInfoRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    lineHeight: 1.15,
  },
  companySubAr: {
    fontSize: 5.8,
    color: "#000000",
    textAlign: "right",
  },
  companyVatAr: {
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginTop: 1,
  },

  // ─── Title Strip ───
  titleStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    marginBottom: 4,
  },
  titleLeftCol: {
    width: "28%",
  },
  titleLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  titleCenterCol: {
    width: "44%",
    alignItems: "center",
  },
  titleCenterHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleCenterText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
  },
  invoiceNumberBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 0.5,
    marginTop: 1,
  },
  invoiceNumberText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  titleRightCol: {
    width: "28%",
    alignItems: "flex-end",
  },
  titleLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Customer Grid ───
  customerGrid: {
    borderWidth: 0.75,
    borderColor: "#000000",
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderColor: "#000000",
    minHeight: 14,
  },
  cellLabelLeft: {
    width: 65,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  labelEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },
  cellValueEn: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  valueText: {
    fontSize: 6.5,
    color: "#000000",
  },
  cellValueAr: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  valueTextAr: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },
  cellLabelRight: {
    width: 50,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  labelAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  cellCityHalf: {
    width: "22%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellCountryHalf: {
    width: "20%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellCityHalfAr: {
    width: "26%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCountryHalfAr: {
    width: "16%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCombinedAr: {
    width: "42%",
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellValueWideEn: {
    flex: 2,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: "center",
  },
  cellValueWideVat: {
    flex: 2,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vatValueText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 0.5,
  },

  // ─── Secondary Metadata Bar ───
  metaBar: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 5,
  },
  metaCell: {
    flex: 1.1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellNarrow: {
    flex: 0.8,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellWide: {
    flex: 1.5,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellDate: {
    flex: 1.3,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
  },
  metaCellLabelAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
  },
  metaCellLabelEn: {
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
    marginBottom: 1,
  },
  metaCellValue: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },

  // ─── Main Products Table ───
  tableContainer: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 0.75,
    borderColor: "#000000",
  },
  tableHeaderCell: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextAr: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
  },
  headerTextEn: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#000000",
    minHeight: 14,
  },
  tableCell: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tableCellDesc: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableCellQty: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tableCellNum: {
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cellCodeText: {
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
  },
  cellTextCenter: {
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
  },
  cellDescAr: {
    fontSize: 6,
    color: "#000000",
    flex: 1,
  },
  cellPackSize: {
    fontSize: 5.5,
    color: "#000000",
    marginLeft: 4,
  },
  checkMark: {
    fontSize: 6,
    color: "#DC2626",
    fontWeight: "bold",
  },
  cellQtyText: {
    fontSize: 6,
    color: "#000000",
    fontWeight: "bold",
  },
  cellNumText: {
    fontSize: 6,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths
  colItemCode: { width: "7%" },
  colItemRef: { width: "7%" },
  colDescription: { width: "32%" },
  colQty: { width: "6%" },
  colUnitPrice: { width: "9%" },
  colGrossAmt: { width: "8%" },
  colDiscAmt: { width: "7%" },
  colNetAmt: { width: "8%" },
  colVatPercent: { width: "7%" },
  colVatAmt: { width: "9%" },

  // ─── Summary Section ───
  summaryContainer: {
    marginTop: 3,
    marginBottom: 4,
    paddingRight: 6,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginBottom: 2,
  },
  summaryLabelEn: {
    fontSize: 6.5,
    color: "#000000",
  },
  summaryLabelAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },
  summaryVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    width: 60,
    textAlign: "right",
  },

  // ─── Grand Total & Words Bar ───
  grandTotalBar: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 8,
    minHeight: 18,
  },
  wordsCell: {
    flex: 1,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  wordsText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
  grandTotalLabelCell: {
    width: 90,
    borderRightWidth: 0.75,
    borderColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  grandTotalLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  grandTotalSubLabel: {
    fontSize: 5.5,
    color: "#000000",
    textAlign: "center",
  },
  grandTotalValueCell: {
    width: 80,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  grandTotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // ─── QR Section ───
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  qrImage: {
    width: 75,
    height: 75,
  },
  qrPlaceholder: {
    width: 75,
    height: 75,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },

  // ─── Footer Notice ───
  footerNoteBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  footerNoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 1,
  },
  footerNoteHeader: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
  },
  footerNoteHeaderAr: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  footerNoteEn: {
    fontSize: 5,
    color: "#000000",
    width: "48%",
  },
  footerNoteAr: {
    fontSize: 5,
    color: "#000000",
    textAlign: "right",
    width: "48%",
  },

  // ─── Page Numbering ───
  pageNumberWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  pageNumberText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },
});
