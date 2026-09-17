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

export interface Template3FikrAlmakatebProps {
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

// ─── Optional extension interfaces (legacy/custom ERP fields) ───
// Render empty string "" if not provided. Never invent dummy data.

interface FikrInvoiceExtensions {
  paymentMethod?: string | null;
  paymentType?: string | null;
  paymentMethodLabel?: string | null;
  discountTotal?: string | number | null;
  discount?: string | number | null;
  sellerName?: string | null;
  salesman?: string | null;
  salesmanName?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  bankIban?: string | null;
  returnPolicyNote?: string | null;
}

interface FikrCustomerExtensions {
  clientNo?: string | number | null;
  customerCode?: string | number | null;
  code?: string | number | null;
  crNumber?: string | null;
  commercialReg?: string | null;
  businessType?: string | null;
  marketType?: string | null;
  addressDistrict?: string | null;
  district?: string | null;
  addressBuildingNumber?: string | null;
  buildingNo?: string | null;
  buildingNumber?: string | null;
  addressAdditionalNumber?: string | null;
  additionalNo?: string | null;
  secondaryNumber?: string | null;
  country?: string | null;
  mobile?: string | null;
}

interface FikrCompanyExtensions {
  secondaryNumber?: string | null;
  mobile?: string | null;
  country?: string | null;
  bankName?: string | null;
  bankNameEn?: string | null;
  iban?: string | null;
}

interface FikrItemExtensions {
  itemCode?: string | number | null;
  itemNo?: string | number | null;
  code?: string | number | null;
  barcode?: string | number | null;
  sku?: string | number | null;
  unitName?: string | null;
  unit?: string | null;
}

function getInvoiceExt(invoice: InvoiceDto): FikrInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<FikrInvoiceExtensions>;
  return {
    paymentMethod: rec.paymentMethod ?? rec.paymentType ?? rec.paymentMethodLabel ?? null,
    discountTotal: rec.discountTotal ?? rec.discount ?? null,
    sellerName: rec.sellerName ?? rec.salesmanName ?? rec.salesman ?? null,
    bankName: rec.bankName ?? null,
    bankAccount: rec.bankAccount ?? null,
    iban: rec.iban ?? rec.bankIban ?? null,
    returnPolicyNote: rec.returnPolicyNote ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): FikrCustomerExtensions {
  const rec = customer as CustomerRecord & Partial<FikrCustomerExtensions>;
  return {
    clientNo: rec.clientNo ?? rec.customerCode ?? rec.code ?? null,
    crNumber: customer.unifiedNumber ?? rec.crNumber ?? rec.commercialReg ?? null,
    businessType: rec.businessType ?? rec.marketType ?? null,
    addressDistrict: rec.addressDistrict ?? rec.district ?? null,
    addressBuildingNumber: rec.addressBuildingNumber ?? rec.buildingNo ?? rec.buildingNumber ?? null,
    addressAdditionalNumber: rec.addressAdditionalNumber ?? rec.additionalNo ?? rec.secondaryNumber ?? null,
    country: rec.country ?? null,
    mobile: rec.mobile ?? customer.phone ?? null,
  };
}

function getCompanyExt(company: CompanyRecord): FikrCompanyExtensions {
  const rec = company as CompanyRecord & Partial<FikrCompanyExtensions>;
  return {
    secondaryNumber: rec.secondaryNumber ?? company.addressAdditionalNumber ?? null,
    mobile: rec.mobile ?? company.phone ?? null,
    country: rec.country ?? null,
    bankName: rec.bankName ?? null,
    bankNameEn: rec.bankNameEn ?? null,
    iban: rec.iban ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): FikrItemExtensions {
  const rec = item as InvoiceItemDto & Partial<FikrItemExtensions>;
  return {
    itemCode: rec.itemCode ?? rec.itemNo ?? rec.code ?? rec.barcode ?? rec.sku ?? null,
    unitName: rec.unitName ?? rec.unit ?? null,
  };
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Arabic Tafqeet (Number to Words) ───
const ONES_AR = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS_AR = [
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

function tafqeetArabic(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "صفر ريال سعودي فقط لا غير";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  const groups: string[] = [];
  const millions = Math.floor(riyals / 1000000);
  const remMillions = riyals % 1000000;
  const thousands = Math.floor(remMillions / 1000);
  const rest = remMillions % 1000;

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
  text += " فقط لا غير";
  return text;
}

export function Template3FikrAlmakateb({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: Template3FikrAlmakatebProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const custExt = getCustomerExt(customer);
  const compExt = getCompanyExt(company);

  // Top header labels
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const companyNameAr = company.nameAr || "";
  const companyVat = company.vatNumber || "";
  const companyPhone = compExt.mobile || company.phone || "";
  const companyCountry = compExt.country || "المملكة العربية السعودية";
  const companyCity = company.addressCity || "الرياض";
  const companyDistrict = company.addressDistrict || "";
  const companyStreet = company.addressStreet || "";
  const companyBuildingNo = company.addressBuildingNumber || "";
  const companySecondaryNo = compExt.secondaryNumber || company.addressAdditionalNumber || "";
  const companyPostalCode = company.addressPostalCode || "";

  // Customer block values
  const customerVat = customer.vatNumber || "";
  const customerCr = custExt.crNumber || "";
  const customerName = customer.nameAr || customer.nameEn || "";
  const paymentMethodVal = invExt.paymentMethod || (invoice.invoiceType === "simplified" ? "نقدي" : "نقدي");
  const customerCountry = custExt.country || "المملكة العربية السعودية";
  const customerCity = customer.addressCity || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = custExt.addressDistrict || "";
  const customerBuildingNo = custExt.addressBuildingNumber || "";
  const customerSecondaryNo = custExt.addressAdditionalNumber || "";
  const customerCode = custExt.clientNo ? toText(custExt.clientNo) : "";
  const customerMobile = custExt.mobile || customer.phone || "";

  // Items
  const items = invoice.items ?? [];

  // Totals calculations
  const subtotalVal = toNumber(invoice.subtotal);
  const discountVal = toNumber(invExt.discountTotal ?? 0);
  const vatVal = toNumber(invoice.vatAmount);
  const totalVal = toNumber(invoice.total);

  // Tafqeet in words
  const wordsText = tafqeetArabic(totalVal);

  // Bank Info (strictly dynamic from company/invoice extensions, default empty)
  const bankNameEn = compExt.bankNameEn || "";
  const bankNameAr = compExt.bankName || "";
  const bankIban = compExt.iban || invExt.iban || "";
  const hasBankInfo = Boolean(bankNameEn || bankNameAr || bankIban);

  // Seller info (strictly dynamic, default empty)
  const sellerName = invExt.sellerName || "";

  // Footnote policy
  const defaultPolicy =
    "*الإرجاع والاستبدال خلال (48)ساعة من تاريخ الفاتورة على ان تكون البضاعة بالحالة الأصلية وبالغلاف الأصلي";
  const returnPolicy = invExt.returnPolicyNote || company.footerText || defaultPolicy;

  return (
    <Document
      title={`فاتورة مبيعات ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Sales Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP TITLE BAR ─── */}
        <View style={styles.topTitleBar}>
          <Text style={styles.topTitleEn}>Tax Sales Invoice</Text>
          <Text style={styles.topTitleAr}>
            {companyNameAr ? companyNameAr : "مؤسسة فكر المكاتب للتجارة"}
          </Text>
        </View>

        {/* ─── 2. SUBTITLE & HEADER SECTION ─── */}
        <View style={styles.headerSection}>
          {/* Left Column: Subtitle + QR Code */}
          <View style={styles.headerLeftCol}>
            <Text style={styles.invoiceSubtitleAr}>فاتورة مبيعات ضريبية</Text>
            <View style={styles.qrContainer}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>QR Code</Text>
                </View>
              )}
            </View>
          </View>

          {/* Center Column: Company Logo */}
          <View style={styles.headerCenterCol}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.logoFallbackBox}>
                <Text style={styles.logoFallbackBrand}>FIKR</Text>
                <Text style={styles.logoFallbackBrand}>ALMAKATEB</Text>
                <View style={styles.logoGoldLine} />
                <Text style={styles.logoFallbackSub}>
                  {companyNameAr ? companyNameAr : "مؤسسة فكر المكاتب للتجارة"}
                </Text>
              </View>
            )}
          </View>

          {/* Right Column: Company Info Rows (RTL Key-Values) */}
          <View style={styles.headerRightCol}>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyVat}</Text>
              <Text style={styles.infoKey}> : الرقم الضريبي</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyPhone}</Text>
              <Text style={styles.infoKey}> : رقم الاتصال</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyCountry}</Text>
              <Text style={styles.infoKey}> : البلد</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyCity}</Text>
              <Text style={styles.infoKey}> : المدينة</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyDistrict}</Text>
              <Text style={styles.infoKey}> : الحي</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyStreet}</Text>
              <Text style={styles.infoKey}> : الشارع</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyBuildingNo}</Text>
              <Text style={styles.infoKey}> : رقم المبنى</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companySecondaryNo}</Text>
              <Text style={styles.infoKey}> : الرقم الإضافي</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{companyPostalCode}</Text>
              <Text style={styles.infoKey}> : الرمز البريدي</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. CUSTOMER DATA SECTION (بيانات العميل) ─── */}
        <View style={styles.customerSection}>
          <View style={styles.sectionHeaderBar}>
            <Text style={styles.sectionHeaderText}>بيانات العميل</Text>
          </View>

          {/* Grid Row 1: Headers (RTL: رقم الفاتورة | تاريخ الفاتورة | طريقة الدفع | اسم العميل | السجل التجاري | رقم ضريبة العميل) */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellHeader, { width: "16%" }]}>
              <Text style={styles.gridHeaderLabel}>رقم ضريبة العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "13%" }]}>
              <Text style={styles.gridHeaderLabel}>السجل التجاري</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "30%" }]}>
              <Text style={styles.gridHeaderLabel}>اسم العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "11%" }]}>
              <Text style={styles.gridHeaderLabel}>طريقة الدفع</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "14%" }]}>
              <Text style={styles.gridHeaderLabel}>تاريخ الفاتورة</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={styles.gridHeaderLabel}>رقم الفاتورة</Text>
            </View>
          </View>

          {/* Grid Row 1: Values */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellVal, { width: "16%" }]}>
              <Text style={styles.gridValBold}>{customerVat}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "13%" }]}>
              <Text style={styles.gridValBold}>{customerCr}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "30%" }]}>
              <Text style={styles.gridValBold}>{customerName}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "11%" }]}>
              <Text style={styles.gridValBold}>{paymentMethodVal}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "14%" }]}>
              <Text style={styles.gridValBold}>{issueDateStr}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={styles.gridValBold}>{invoiceNum}</Text>
            </View>
          </View>

          {/* Grid Row 2: Headers (RTL: البلد | المدينة | اسم الشارع | الحي | رقم المبنى | الرقم الإضافي | كود العميل | جوال العميل) */}
          <View style={styles.custGridRow}>
            <View style={[styles.custCellHeader, { width: "16%" }]}>
              <Text style={styles.gridHeaderLabel}>جوال العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "11%" }]}>
              <Text style={styles.gridHeaderLabel}>كود العميل</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "10%" }]}>
              <Text style={styles.gridHeaderLabel}>الرقم الإضافي</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "9%" }]}>
              <Text style={styles.gridHeaderLabel}>رقم المبنى</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "13%" }]}>
              <Text style={styles.gridHeaderLabel}>الحي</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "15%" }]}>
              <Text style={styles.gridHeaderLabel}>اسم الشارع</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "12%" }]}>
              <Text style={styles.gridHeaderLabel}>المدينة</Text>
            </View>
            <View style={[styles.custCellHeader, { width: "14%", borderRightWidth: 0 }]}>
              <Text style={styles.gridHeaderLabel}>البلد</Text>
            </View>
          </View>

          {/* Grid Row 2: Values */}
          <View style={[styles.custGridRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.custCellVal, { width: "16%" }]}>
              <Text style={styles.gridValText}>{customerMobile}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "11%" }]}>
              <Text style={styles.gridValText}>{customerCode}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "10%" }]}>
              <Text style={styles.gridValText}>{customerSecondaryNo}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "9%" }]}>
              <Text style={styles.gridValText}>{customerBuildingNo}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "13%" }]}>
              <Text style={styles.gridValText}>{customerDistrict}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "15%" }]}>
              <Text style={styles.gridValText}>{customerStreet}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "12%" }]}>
              <Text style={styles.gridValText}>{customerCity}</Text>
            </View>
            <View style={[styles.custCellVal, { width: "14%", borderRightWidth: 0 }]}>
              <Text style={styles.gridValText}>{customerCountry}</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE ─── */}
        {/* RTL Columns: مسلسل | رمز الصنف | اسم الصنف | الوحدة | الكمية | السعر | الاجمالي */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thText}>الاجمالي</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>السعر</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>الوحدة</Text>
            </View>
            <View style={[styles.thCell, { width: "45%" }]}>
              <Text style={styles.thText}>اسم الصنف</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>رمز الصنف</Text>
            </View>
            <View style={[styles.thCell, { width: "5%", borderRightWidth: 0 }]}>
              <Text style={styles.thText}>مسلسل</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {items.map((item, index) => {
            const itemExt = getItemExt(item);
            const itemCode = itemExt.itemCode ? toText(itemExt.itemCode) : "";
            const unitStr = itemExt.unitName || "وحدة";
            const lineTotalVal = toNumber(item.lineTotal || item.lineSubtotal);

            return (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdTextNum}>{formatNumber(lineTotalVal)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdTextNum}>{formatNumber(item.unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextNum}>{formatQty(item.quantity)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{unitStr}</Text>
                </View>
                <View style={[styles.tdCell, { width: "45%", alignItems: "flex-end", paddingRight: 6 }]}>
                  <Text style={styles.tdTextAr}>{item.description}</Text>
                </View>
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdTextCenter}>{itemCode}</Text>
                </View>
                <View style={[styles.tdCell, { width: "5%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{index + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. SUMMARY & FOOTER SECTION ─── */}
        <View style={styles.summarySection}>
          {/* Left Block: Thank you note + Amount in Words + Bank Info */}
          <View style={styles.summaryLeftCol}>
            <View style={styles.thankYouBox}>
              <Text style={styles.thankYouText}>*** نشكركم لزيارتكم ونتطلع لرؤيتكم مرة اخرى</Text>
            </View>

            <View style={styles.amountInWordsBox}>
              <Text style={styles.amountWordsLabel}>:المبلغ كتابة</Text>
              <Text style={styles.amountWordsVal}>{wordsText}</Text>
            </View>

            {/* Bank Info Box (only rendered when bank info is provided) */}
            {hasBankInfo ? (
              <View style={styles.bankBox}>
                <Text style={styles.bankEn}>{bankNameEn}</Text>
                <Text style={styles.bankIban}>{bankIban}</Text>
                <Text style={styles.bankAr}>{bankNameAr}</Text>
              </View>
            ) : null}
          </View>

          {/* Right Block: Boxed Totals Table */}
          <View style={styles.summaryRightCol}>
            <View style={styles.totalsTable}>
              {/* Row 1: Total before tax */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatNumber(subtotalVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>الاجمالي قبل الضريبة</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Total before tax</Text>
                </View>
              </View>

              {/* Row 2: Discount */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatNumber(discountVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>خصم</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Discount</Text>
                </View>
              </View>

              {/* Row 3: Total vat 15% */}
              <View style={styles.totalsRow}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValText}>{formatNumber(vatVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelAr}>قيمة الضريبة المضافة</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEn}>Total vat 15%</Text>
                </View>
              </View>

              {/* Row 4: Total after vat */}
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <View style={styles.totalsValCell}>
                  <Text style={styles.totalsValBold}>{formatNumber(totalVal)}</Text>
                </View>
                <View style={styles.totalsLabelArCell}>
                  <Text style={styles.totalsLabelArBold}>صافي المبلغ</Text>
                </View>
                <View style={styles.totalsLabelEnCell}>
                  <Text style={styles.totalsLabelEnBold}>Total after vat</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 6. SIGNATURES ROW ─── */}
        <View style={styles.signaturesRow}>
          {/* Left: Received By */}
          <View style={styles.receivedByWrap}>
            <Text style={styles.sigLabelEn}>Received By</Text>
            <Text style={styles.dottedLine}>........................................</Text>
            <Text style={styles.sigLabelAr}>المستلم</Text>
          </View>

          {/* Right: Seller Name + Signature */}
          <View style={styles.sellerWrap}>
            {sellerName ? <Text style={styles.sellerNameText}>{sellerName}</Text> : null}
            <View style={styles.sellerSigRow}>
              {signatureDataUrl ? (
                <Image src={signatureDataUrl} style={styles.signatureImg} />
              ) : (
                <Text style={styles.dottedLine}>........................................</Text>
              )}
              <Text style={styles.sigLabelAr}>البائع</Text>
            </View>
          </View>
        </View>

        {/* ─── 7. POLICY FOOTNOTE ─── */}
        <View style={styles.policyFootnote}>
          <Text style={styles.policyText}>{returnPolicy}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLESHEET ───
const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 22,
    fontSize: 7.5,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Top Title Bar ───
  topTitleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginBottom: 6,
  },
  topTitleEn: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    fontFamily: "Amiri",
    letterSpacing: 0.2,
  },
  topTitleAr: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Header Section ───
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "22%",
    alignItems: "flex-start",
  },
  invoiceSubtitleAr: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 4,
    textAlign: "left",
  },
  qrContainer: {
    alignItems: "flex-start",
  },
  qrImage: {
    width: 82,
    height: 82,
  },
  qrPlaceholder: {
    width: 82,
    height: 82,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 8,
    color: "#9CA3AF",
  },

  headerCenterCol: {
    width: "36%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  logoImage: {
    maxWidth: 160,
    maxHeight: 85,
    objectFit: "contain",
  },
  logoFallbackBox: {
    backgroundColor: "#1F1F1F",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 2,
    alignItems: "center",
    minWidth: 150,
  },
  logoFallbackBrand: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  logoGoldLine: {
    width: "80%",
    height: 1.5,
    backgroundColor: "#C59B27",
    marginVertical: 4,
  },
  logoFallbackSub: {
    color: "#E5E7EB",
    fontSize: 7.5,
    textAlign: "center",
  },

  headerRightCol: {
    width: "40%",
    alignItems: "flex-end",
    paddingRight: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 1.8,
  },
  infoVal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginRight: 2,
  },
  infoKey: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Customer Data Section ───
  customerSection: {
    borderWidth: 0.8,
    borderColor: "#000000",
    marginBottom: 6,
  },
  sectionHeaderBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1.5,
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
  },
  sectionHeaderText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
  },
  custGridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#000000",
    minHeight: 14,
    alignItems: "stretch",
  },
  custCellHeader: {
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  gridHeaderLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  custCellVal: {
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 1.5,
  },
  gridValBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  gridValText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },

  // ─── Items Table ───
  table: {
    borderWidth: 0.8,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
    minHeight: 16,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  thText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 16,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tdTextNum: {
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdTextCenter: {
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdTextAr: {
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Summary Section ───
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  summaryLeftCol: {
    width: "48%",
    paddingTop: 4,
  },
  thankYouBox: {
    marginBottom: 8,
  },
  thankYouText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  amountInWordsBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  amountWordsLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textDecoration: "underline",
    marginLeft: 4,
  },
  amountWordsVal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  bankBox: {
    borderWidth: 0.8,
    borderColor: "#000000",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  bankEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  bankIban: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 0.5,
  },
  bankAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  summaryRightCol: {
    width: "50%",
  },
  totalsTable: {
    borderWidth: 0.8,
    borderColor: "#000000",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#000000",
    minHeight: 16,
    alignItems: "stretch",
  },
  totalsLabelEnCell: {
    width: "40%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  totalsLabelEn: {
    fontSize: 7,
    color: "#000000",
  },
  totalsLabelEnBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  totalsLabelArCell: {
    width: "35%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "flex-end",
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
  },
  totalsLabelAr: {
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },
  totalsLabelArBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsValCell: {
    width: "25%",
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 0.6,
    borderRightColor: "#000000",
  },
  totalsValText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  totalsValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  receivedByWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  sigLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginRight: 4,
  },
  dottedLine: {
    fontSize: 7.5,
    color: "#000000",
  },
  sigLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 4,
  },
  sellerWrap: {
    alignItems: "center",
  },
  sellerNameText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
  },
  sellerSigRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  signatureImg: {
    width: 70,
    height: 25,
    objectFit: "contain",
  },

  // ─── Policy Footnote ───
  policyFootnote: {
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 4,
    alignItems: "center",
  },
  policyText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
});
