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

export interface SaddtAlkhaleejTemplateProps {
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

// ─── Arabic Tafqeet (Number to Words) ─────────────────────────────────────────

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

function formatDateTimeSlash(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return "";
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-");
  const formattedDate =
    parts.length === 3 && parts[0] && parts[1] && parts[2]
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : clean;

  if (timeStr && timeStr.trim().length > 0 && timeStr !== "00:00") {
    const tParts = timeStr.trim().split(":");
    const hh = tParts[0] || "00";
    const mm = tParts[1] || "00";
    const ss = tParts[2] || "00";
    return `${formattedDate} ${hh}:${mm}:${ss}`;
  }
  return formattedDate;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SaddtAlkhaleejTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: SaddtAlkhaleejTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Invoice Metadata
  const invoiceSerial = invoice.invoiceNumber ?? "";
  const invoiceDateTime = formatDateTimeSlash(invoice.issueDate, invoice.issueTime);
  const supplyDate = "";
  const refNo = "";

  // Seller / Company fields
  const sellerName = company.nameAr || company.nameEn || "";
  const sellerVat = company.vatNumber || "";
  const sellerCr = company.crNumber || "";
  const sellerStreet = company.addressStreet || "";
  const sellerBuilding = company.addressBuildingNumber || "";
  const sellerDistrict = company.addressDistrict ? `حي ${company.addressDistrict.replace(/^حي\s+/, "")}` : "";
  const sellerPostal = company.addressPostalCode || "";
  const sellerCountry = "المملكة العربية السعودية";
  const sellerAddNo = company.addressAdditionalNumber || "";
  const sellerCity = company.addressCity || "";
  const sellerShortAddr = (company as { shortAddress?: string }).shortAddress || "";

  // Customer / Buyer fields
  const buyerName = customer.nameAr || customer.nameEn || "";
  const buyerCode = (customer as { customerCode?: string }).customerCode || customer.clientEmployee || "";
  const buyerVat = customer.vatNumber || "";
  const buyerCr = customer.unifiedNumber || (customer as { crNumber?: string }).crNumber || "";
  const buyerStreet = customer.addressStreet || "";
  const buyerBuilding = customer.addressBuildingNumber || "";
  const buyerDistrict = customer.addressDistrict ? `حي ${customer.addressDistrict.replace(/^حي\s+/, "")}` : "";
  const buyerPostal = customer.addressPostalCode || "";
  const buyerCountry = "المملكة العربية السعودية";
  const buyerAddNo = customer.addressAdditionalNumber || "";
  const buyerCity = customer.addressCity || "";
  const buyerShortAddr = (customer as { shortAddress?: string }).shortAddress || "";

  // Items & Financial Calculations
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
      item.lineSubtotal !== undefined && item.lineSubtotal !== null && item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Math.max(0, gross - lineDiscount);

    const vatPct =
      item.vatRate !== undefined && item.vatRate !== null
        ? normalizeVatRatePercent(toNumber(item.vatRate))
        : 15;

    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null && item.lineVat !== ""
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatPct / 100);

    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null && item.lineTotal !== ""
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;

    // Generic unit (NOT hardcoded to كرتون)
    const unit = (item as { unit?: string }).unit || "وحدة";
    const taxCode = vatPct > 0 ? "S" : "Z";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      unit,
      qty,
      unitPrice,
      lineDiscount,
      taxableSubtotal,
      vatPct,
      taxCode,
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
  const totalDiscountVal = computedDiscount + invoiceDiscount;
  const taxableAfterDiscount = Math.max(0, taxableAmount - invoiceDiscount);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  const tafqeetText = tafqeet(grandTotal);
  const summaryTaxCode = totalVat > 0 ? "S" : "Z";

  // Dynamic single-page height sizing
  const extraItemsCount = Math.max(0, rows.length - 5);
  const extraHeight = extraItemsCount * 24;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`Tax Invoice ${invoiceSerial}`}
      author={company.nameAr || "Hulool Invoicing"}
      subject="Tax Invoice - Saddt Alkhaleej"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER BAR (LOGO LEFT | TITLE CENTER | COMPANY RIGHT) ─── */}
        <View style={styles.topHeaderContainer}>
          {/* Left: Company Logo */}
          <View style={styles.headerLeftLogoCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : (
              <View style={styles.logoSpacer} />
            )}
          </View>

          {/* Center: Tax Invoice Title with Gray Underline Bar */}
          <View style={styles.headerCenterTitleCol}>
            <Text style={styles.titleAr}>فاتورة ضريبية</Text>
            <Text style={styles.titleEn}>Tax Invoice</Text>
            <View style={styles.titleUnderlineBar} />
          </View>

          {/* Right: Company Arabic/English Name + Gray Divider + VAT Number */}
          <View style={styles.headerRightCompanyCol}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            <View style={styles.companyDividerBar} />
            {sellerVat ? (
              <View style={styles.headerVatRow}>
                <Text style={styles.headerVatVal}>{sellerVat}</Text>
                <Text style={styles.headerVatColon}> : </Text>
                <Text style={styles.headerVatLabel}>الرقم الضريبي</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Full-Width Blue Accent Line under Header */}
        <View style={styles.headerBlueLine} />

        {/* ─── 2. UPPER SECTION: SELLER & CUSTOMER (LEFT) + META & QR (RIGHT) ─── */}
        <View style={styles.upperSectionRow}>
          {/* Left Column (67%): Seller Box & Customer Box */}
          <View style={styles.partiesCol}>
            {/* ── Seller Box (Double/Thick Border, Outlined Gray Value Cells, Blue Text) ── */}
            <View style={styles.sellerOuterBox}>
              {/* Row 1: Full-width Seller Name */}
              <View style={styles.partyFieldRow}>
                <View style={[styles.sellerValBox, styles.fullValWidth]}>
                  <Text style={styles.sellerValTextBold}>{sellerName}</Text>
                </View>
                <View style={styles.partyLabelBoxWide}>
                  <Text style={styles.partyLabelText}>:Seller / المورد</Text>
                </View>
              </View>

              {/* Row 2: C.R (Left) | Tax Code (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.sellerValBoxSmall}>
                    <Text style={styles.sellerValText}>{sellerCr}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:C.R / السجل التجاري</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.sellerValBoxMid}>
                    <Text style={styles.sellerValText}>{sellerVat}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Tax Code / الرقم الضريبي</Text>
                  </View>
                </View>
              </View>

              {/* Row 3: Building (Left) | Street (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.sellerValBoxSmall}>
                    <Text style={styles.sellerValText}>{sellerBuilding}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Bulding / المبنى</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.sellerValBoxMid}>
                    <Text style={styles.sellerValText}>{sellerStreet}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Street / الشارع</Text>
                  </View>
                </View>
              </View>

              {/* Row 4: Post Code (Left) | Area (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.sellerValBoxSmall}>
                    <Text style={styles.sellerValText}>{sellerPostal}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Post Code / الرمز البريدي</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.sellerValBoxMid}>
                    <Text style={styles.sellerValText}>{sellerDistrict}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Area / الحي</Text>
                  </View>
                </View>
              </View>

              {/* Row 5: Add No (Left) | Country (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.sellerValBoxSmall}>
                    <Text style={styles.sellerValText}>{sellerAddNo}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Add No / الرقم الإضافي</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.sellerValBoxMid}>
                    <Text style={styles.sellerValText}>{sellerCountry}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Country / الدولة</Text>
                  </View>
                </View>
              </View>

              {/* Row 6: Shrt Adrs (Left) | City (Right) */}
              <View style={[styles.partyFieldRow, { marginBottom: 0 }]}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.sellerValBoxSmall}>
                    <Text style={styles.sellerValText}>{sellerShortAddr}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Shrt Adrs / عنوان مختصر</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.sellerValBoxMid}>
                    <Text style={styles.sellerValText}>{sellerCity}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:City / المدينة</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Customer Box (Thick Border, Borderless Gray Value Pills, Black Text) ── */}
            <View style={styles.customerOuterBox}>
              {/* Row 1: Cus.Code (Left) | Customer Name (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerCode}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Cus.Code / كود العميل</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValTextBold}>{buyerName}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Customer / العميل</Text>
                  </View>
                </View>
              </View>

              {/* Row 2: C.R (Left) | Tax Code (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerCr}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:C.R / السجل التجاري</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValText}>{buyerVat}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Tax Code / الرقم الضريبي</Text>
                  </View>
                </View>
              </View>

              {/* Row 3: Building (Left) | Street (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerBuilding}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Bulding / المبنى</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValText}>{buyerStreet}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Street / الشارع</Text>
                  </View>
                </View>
              </View>

              {/* Row 4: Post Code (Left) | Area (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerPostal}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Post Code / الرمز البريدي</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValText}>{buyerDistrict}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Area / الحي</Text>
                  </View>
                </View>
              </View>

              {/* Row 5: Add No (Left) | Country (Right) */}
              <View style={styles.partyFieldRow}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerAddNo}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Add No / الرقم الإضافي</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValText}>{buyerCountry}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:Country / الدولة</Text>
                  </View>
                </View>
              </View>

              {/* Row 6: Shrt Adrs (Left) | City (Right) */}
              <View style={[styles.partyFieldRow, { marginBottom: 0 }]}>
                <View style={styles.halfFieldGroup}>
                  <View style={styles.customerValBoxSmall}>
                    <Text style={styles.customerValText}>{buyerShortAddr}</Text>
                  </View>
                  <View style={styles.partyLabelBoxSmall}>
                    <Text style={styles.partyLabelText}>:Shrt Adrs / عنوان مختصر</Text>
                  </View>
                </View>
                <View style={styles.halfFieldGroupRight}>
                  <View style={styles.customerValBoxMid}>
                    <Text style={styles.customerValText}>{buyerCity}</Text>
                  </View>
                  <View style={styles.partyLabelBoxWide}>
                    <Text style={styles.partyLabelText}>:City / المدينة</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column (32%): Invoice Meta Fields (No Payment Method, No Store) + Page 1 of 1 + Large QR Code */}
          <View style={styles.metaAndQrCol}>
            {/* Row 1: Invoice Serial */}
            <View style={styles.metaRow}>
              <View style={styles.metaValBox}>
                <Text style={styles.metaSerialText}>{invoiceSerial}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <Text style={styles.metaLabelText}>:Invoice Serial / تسلسل الفاتورة</Text>
              </View>
            </View>

            {/* Row 2: Invoice Date */}
            <View style={styles.metaRow}>
              <View style={styles.metaValBox}>
                <Text style={styles.metaDateText}>{invoiceDateTime}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <Text style={styles.metaLabelText}>:Invoice Date / تاريخ الفاتورة</Text>
              </View>
            </View>

            {/* Row 3: Date Of Supply */}
            <View style={styles.metaRow}>
              <View style={styles.metaValBox}>
                <Text style={styles.metaDateText}>{supplyDate}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <Text style={styles.metaLabelText}>:Date Of Supply / تاريخ التوريد</Text>
              </View>
            </View>

            {/* Row 4: Ref. No */}
            <View style={styles.metaRow}>
              <View style={styles.metaValBox}>
                <Text style={styles.metaDateText}>{refNo}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <Text style={styles.metaLabelText}>:Ref. No/رقم المرجع</Text>
              </View>
            </View>

            {/* Page Indicator */}
            <View style={styles.pageIndicatorRow}>
              <Text style={styles.pageIndicatorText}>Page 1 of 1</Text>
            </View>

            {/* ZATCA QR Code */}
            <View style={styles.qrWrapper}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.draftText}>DRAFT</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── 3. DESCRIPTION BAR ABOVE ITEMS TABLE ─── */}
        <View style={styles.descriptionBarRow}>
          <View style={styles.descriptionValFill}>
            <Text style={styles.descriptionValText}>{invoice.notes || ""}</Text>
          </View>
          <View style={styles.descriptionLabelBox}>
            <Text style={styles.descriptionLabelText}>:Description / البيان</Text>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (9 COLUMNS — NO ITEM ID, GENERIC UNIT) ─── */}
        <View style={styles.table}>
          {/* Table Header Row (Left-to-Right matching reference image) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Item Subtotal Including Vat */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thAr}>المجموع شامل ضريبة</Text>
              <Text style={styles.thAr}>القيمة المضافة</Text>
              <Text style={styles.thEn}>Item Subtotal</Text>
              <Text style={styles.thEn}>Including Vat</Text>
            </View>

            {/* 2. Tax Amount In Riyal */}
            <View style={[styles.thCell, styles.colVatAmount]}>
              <Text style={styles.thAr}>مبلغ الضريبة</Text>
              <Text style={styles.thAr}>بالريال</Text>
              <Text style={styles.thEn}>Tax Amount In</Text>
              <Text style={styles.thEn}>Riyal</Text>
            </View>

            {/* 3. Tax Code */}
            <View style={[styles.thCell, styles.colTaxCode]}>
              <Text style={styles.thAr}>رمز الضريبة</Text>
              <Text style={styles.thEn}>Tax Code</Text>
            </View>

            {/* 4. Tax Rate */}
            <View style={[styles.thCell, styles.colTaxRate]}>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
              <Text style={styles.thEn}>Tax Rate</Text>
            </View>

            {/* 5. Taxable Amount */}
            <View style={[styles.thCell, styles.colTaxable]}>
              <Text style={styles.thAr}>المبلغ الخاضع</Text>
              <Text style={styles.thAr}>للضريبة</Text>
              <Text style={styles.thEn}>Taxable</Text>
              <Text style={styles.thEn}>Amount</Text>
            </View>

            {/* 6. Discount */}
            <View style={[styles.thCell, styles.colDiscount]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Discount</Text>
            </View>

            {/* 7. Unit Price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit Price</Text>
            </View>

            {/* 8. Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>

            {/* 9. Unit */}
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thAr}>الوحدة</Text>
              <Text style={styles.thEn}>Unit</Text>
            </View>

            {/* 10. Item Name (Rightmost column — No Item ID column per instruction) */}
            <View style={[styles.thCell, styles.colItemName, { borderRightWidth: 0 }]}>
              <Text style={styles.thAr}>اسم الصنف</Text>
              <Text style={styles.thEn}>Item Name</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* 1. Item Subtotal Including Vat */}
              <View style={[styles.tdCell, styles.colTotal]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineTotal)}</Text>
              </View>

              {/* 2. Tax Amount In Riyal */}
              <View style={[styles.tdCell, styles.colVatAmount]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineVat)}</Text>
              </View>

              {/* 3. Tax Code */}
              <View style={[styles.tdCell, styles.colTaxCode]}>
                <Text style={styles.tdCenterBold}>{row.taxCode}</Text>
              </View>

              {/* 4. Tax Rate */}
              <View style={[styles.tdCell, styles.colTaxRate]}>
                <Text style={styles.tdCenterBold}>{row.vatPct} %</Text>
              </View>

              {/* 5. Taxable Amount */}
              <View style={[styles.tdCell, styles.colTaxable]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.taxableSubtotal)}</Text>
              </View>

              {/* 6. Discount */}
              <View style={[styles.tdCell, styles.colDiscount]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.lineDiscount)}</Text>
              </View>

              {/* 7. Unit Price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterBold}>{formatExactAmount(row.unitPrice)}</Text>
              </View>

              {/* 8. Quantity */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterBold}>{formatQty(row.qty)}</Text>
              </View>

              {/* 9. Unit (Generic unit) */}
              <View style={[styles.tdCell, styles.colUnit]}>
                <Text style={styles.tdCenterBold}>{row.unit}</Text>
              </View>

              {/* 10. Item Name */}
              <View style={[styles.tdCell, styles.colItemName, { borderRightWidth: 0 }]}>
                <Text style={styles.tdDescText}>{row.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 5. TAFQEET & AMOUNT BANNER BOX ─── */}
        <View style={styles.tafqeetBannerBox} wrap={false}>
          <View style={styles.tafqeetLeftAmountCell}>
            <Text style={styles.caretSymbol}>^</Text>
            <Text style={styles.tafqeetAmountRed}>{formatExactAmount(grandTotal)}</Text>
          </View>
          <View style={styles.tafqeetRightWordsCell}>
            <Text style={styles.tafqeetWordsText}>{tafqeetText}</Text>
          </View>
        </View>

        {/* ─── 6. BOTTOM FINANCIAL SUMMARY (LEFT) + VAT SUMMARY TABLE & SIGN (RIGHT) ─── */}
        <View style={styles.bottomSummaryContainer} wrap={false}>
          {/* Left: 6 Financial Summary Rows */}
          <View style={styles.financialRowsCol}>
            {/* 1. Total Excluding VAT */}
            <View style={styles.finRow}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <Text style={styles.finAmountRed}>{formatExactAmount(taxableAmount)}</Text>
              </View>
              <Text style={styles.finLabelText}>
                :Total Excluding VAT / الإجمالي غير شامل ضريبة القيمة المضافة
              </Text>
            </View>

            {/* 2. Discount */}
            <View style={styles.finRow}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <Text style={styles.finAmountRed}>{formatExactAmount(totalDiscountVal)}</Text>
              </View>
              <Text style={styles.finLabelText}>:Discount / الخصم</Text>
            </View>

            {/* 3. Other Charges */}
            <View style={styles.finRow}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <Text style={styles.finAmountRed}>0.00</Text>
              </View>
              <Text style={styles.finLabelText}>:Other Charges / الاعباء</Text>
            </View>

            {/* 4. Total Taxable Amount-Excluding VAT */}
            <View style={styles.finRow}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <Text style={styles.finAmountRed}>{formatExactAmount(taxableAfterDiscount)}</Text>
              </View>
              <Text style={styles.finLabelText}>
                :Total Taxble Amount-Excluding VAT / الإجمالي الخاضع للضريبة-غير شامل ضريبة القيمة المضافة
              </Text>
            </View>

            {/* 5. Total Vat */}
            <View style={styles.finRow}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <Text style={styles.finAmountRed}>{formatExactAmount(totalVat)}</Text>
              </View>
              <View style={styles.finVatLabelGroup}>
                <Text style={styles.finLabelText}>:Total Vat /</Text>
                <Text style={[styles.finLabelText, { marginLeft: 18 }]}>
                  مجموع ضريبة القيمة المضافة 15%
                </Text>
              </View>
            </View>

            {/* 6. Total Amt Including Vat (With Gray Shaded Amount Box) */}
            <View style={[styles.finRow, { marginTop: 2 }]}>
              <View style={styles.finAmountWrap}>
                <Text style={styles.caretSymbolSmall}>^</Text>
                <View style={styles.finGrandTotalGrayBox}>
                  <Text style={styles.finAmountRed}>{formatExactAmount(grandTotal)}</Text>
                </View>
              </View>
              <Text style={styles.finLabelText}>
                :Total Amt Including Vat / الإجمالي النهائي شامل ضريبة القيمة المضافة
              </Text>
            </View>
          </View>

          {/* Right: VAT Summary Mini-Table + Sign Label */}
          <View style={styles.vatSummaryAndSignCol}>
            {/* VAT Summary Box */}
            <View style={styles.vatSummaryBox}>
              {/* Title Header */}
              <View style={styles.vatSummaryTitleRow}>
                <Text style={styles.vatSummaryTitleText}>
                  VAT Summary ملخص ضريبة القيمة المضافة
                </Text>
              </View>

              {/* Column Headers */}
              <View style={styles.vatSummaryHeaderRow}>
                <View style={[styles.vatSummaryThCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryThAr}>شامل الضريبة</Text>
                  <Text style={styles.vatSummaryThEn}>Inc Tax</Text>
                </View>
                <View style={[styles.vatSummaryThCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryThAr}>مبلغ الضريبة</Text>
                  <Text style={styles.vatSummaryThEn}>Tax Amount</Text>
                </View>
                <View style={[styles.vatSummaryThCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryThAr}>قبل الضريبة</Text>
                  <Text style={styles.vatSummaryThEn}>Before Tax</Text>
                </View>
                <View style={[styles.vatSummaryThCell, { width: "22%", borderRightWidth: 0 }]}>
                  <Text style={styles.vatSummaryThAr}>رمز الضريبة</Text>
                  <Text style={styles.vatSummaryThEn}>Tax Code</Text>
                </View>
              </View>

              {/* Data Row */}
              <View style={styles.vatSummaryDataRow}>
                <View style={[styles.vatSummaryTdCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryTdText}>{formatExactAmount(grandTotal)}</Text>
                </View>
                <View style={[styles.vatSummaryTdCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryTdText}>{formatExactAmount(totalVat)}</Text>
                </View>
                <View style={[styles.vatSummaryTdCell, { width: "26%" }]}>
                  <Text style={styles.vatSummaryTdText}>
                    {formatExactAmount(taxableAfterDiscount)}
                  </Text>
                </View>
                <View style={[styles.vatSummaryTdCell, { width: "22%", borderRightWidth: 0 }]}>
                  <Text style={styles.vatSummaryTdText}>{summaryTaxCode}</Text>
                </View>
              </View>
            </View>

            {/* Sign / التوقيع */}
            <View style={styles.signCol}>
              <Text style={styles.signLabelText}>Sign / التوقيع</Text>
              {signatureDataUrl ? (
                <Image src={signatureDataUrl} style={styles.signatureImage} />
              ) : null}
            </View>
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
    fontSize: 7.5,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 18,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // 1. Top Header Bar
  topHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeftLogoCol: {
    width: "26%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logoImage: {
    width: 78,
    height: 48,
    objectFit: "contain",
  },
  logoSpacer: {
    width: 78,
    height: 48,
  },
  headerCenterTitleCol: {
    width: "32%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  titleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 12,
    color: "#000000",
    textAlign: "center",
  },
  titleEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },
  titleUnderlineBar: {
    width: 86,
    height: 2,
    backgroundColor: "#A3A3A3",
    marginTop: 4,
  },
  headerRightCompanyCol: {
    width: "42%",
    alignItems: "center",
    justifyContent: "center",
  },
  companyNameAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 13,
    color: "#000000",
    textAlign: "center",
  },
  companyNameEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 9.5,
    color: "#000000",
    textAlign: "center",
    marginTop: 1,
  },
  companyDividerBar: {
    width: "95%",
    height: 2,
    backgroundColor: "#A3A3A3",
    marginVertical: 3,
  },
  headerVatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerVatVal: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },
  headerVatColon: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
  },
  headerVatLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#7BA68C",
  },
  headerBlueLine: {
    width: "100%",
    height: 1.2,
    backgroundColor: "#2B547E",
    marginBottom: 4,
  },

  // 2. Upper Section: Seller/Customer (Left) + Meta/QR (Right)
  upperSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  partiesCol: {
    width: "67%",
    flexDirection: "column",
  },
  sellerOuterBox: {
    borderWidth: 1.5,
    borderColor: "#595959",
    padding: 3,
    marginBottom: 5,
    backgroundColor: "#FFFFFF",
  },
  customerOuterBox: {
    borderWidth: 1.5,
    borderColor: "#595959",
    padding: 3,
    backgroundColor: "#FFFFFF",
  },
  partyFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2.5,
  },
  halfFieldGroup: {
    width: "40%",
    flexDirection: "row",
    alignItems: "center",
  },
  halfFieldGroupRight: {
    width: "59%",
    flexDirection: "row",
    alignItems: "center",
  },
  sellerValBox: {
    backgroundColor: "#E2E2E2",
    borderWidth: 0.7,
    borderColor: "#6E6E6E",
    minHeight: 13.5,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  fullValWidth: {
    width: "78%",
  },
  sellerValBoxSmall: {
    width: "50%",
    backgroundColor: "#E2E2E2",
    borderWidth: 0.7,
    borderColor: "#6E6E6E",
    minHeight: 13.5,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  sellerValBoxMid: {
    width: "63%",
    backgroundColor: "#E2E2E2",
    borderWidth: 0.7,
    borderColor: "#6E6E6E",
    minHeight: 13.5,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  sellerValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#1B4F9C",
    textAlign: "right",
  },
  sellerValTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#1B4F9C",
    textAlign: "right",
  },
  customerValBoxSmall: {
    width: "50%",
    backgroundColor: "#E2E2E2",
    minHeight: 13.5,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  customerValBoxMid: {
    width: "63%",
    backgroundColor: "#E2E2E2",
    minHeight: 13.5,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  customerValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
  },
  customerValTextBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
  },
  partyLabelBoxSmall: {
    width: "50%",
    paddingLeft: 3,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  partyLabelBoxWide: {
    width: "37%",
    paddingLeft: 3,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  partyLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "left",
  },

  // Right Column: Meta Fields & QR Code
  metaAndQrCol: {
    width: "32%",
    flexDirection: "column",
    alignItems: "center",
  },
  metaRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2.5,
  },
  metaValBox: {
    width: "48%",
    borderWidth: 0.7,
    borderColor: "#6E6E6E",
    backgroundColor: "#FFFFFF",
    minHeight: 14,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  metaSerialText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#8B1E1E",
    textAlign: "center",
  },
  metaDateText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#1B4F9C",
    textAlign: "center",
  },
  metaLabelBox: {
    width: "51%",
    paddingLeft: 2,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  metaLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.5,
    color: "#000000",
    textAlign: "left",
  },
  pageIndicatorRow: {
    width: "100%",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 3,
  },
  pageIndicatorText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#1E2952",
    textAlign: "center",
  },
  qrWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  qrImage: {
    width: 132,
    height: 132,
  },
  qrPlaceholder: {
    width: 132,
    height: 132,
    borderWidth: 1,
    borderColor: "#999999",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#999999",
  },

  // 3. Description Strip Above Table
  descriptionBarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  descriptionValFill: {
    width: "85%",
    backgroundColor: "#E2E2E2",
    minHeight: 12,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  descriptionValText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
  },
  descriptionLabelBox: {
    width: "15%",
    paddingLeft: 4,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  descriptionLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
  },

  // 4. Line Items Table (9 columns — no Item ID)
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    marginBottom: 3,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E2E2E2",
    borderBottomWidth: 1,
    borderColor: "#4A4A4A",
    minHeight: 28,
    alignItems: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.7,
    borderColor: "#4A4A4A",
    minHeight: 18,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.8,
    borderColor: "#4A4A4A",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  tdCell: {
    borderRightWidth: 0.8,
    borderColor: "#4A4A4A",
    height: "100%",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.3,
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.1,
    color: "#000000",
    textAlign: "center",
  },
  tdCenterBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  tdDescText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.2,
    color: "#000000",
    textAlign: "right",
    paddingRight: 2,
  },

  // Column Widths (Sum = 100%, 9 columns without Item ID)
  colTotal: { width: "10%" },
  colVatAmount: { width: "9%" },
  colTaxCode: { width: "6.5%" },
  colTaxRate: { width: "7.5%" },
  colTaxable: { width: "9%" },
  colDiscount: { width: "7.5%" },
  colPrice: { width: "8.5%" },
  colQty: { width: "6.5%" },
  colUnit: { width: "6.5%" },
  colItemName: { width: "29%" },

  // 5. Tafqeet Banner Box
  tafqeetBannerBox: {
    width: "100%",
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#6E6E6E",
    minHeight: 19,
    alignItems: "center",
    marginBottom: 5,
  },
  tafqeetLeftAmountCell: {
    width: "16%",
    borderRightWidth: 0.8,
    borderColor: "#6E6E6E",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  caretSymbol: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#000000",
    marginRight: 4,
  },
  tafqeetAmountRed: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#8B1E1E",
  },
  tafqeetRightWordsCell: {
    width: "84%",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },
  tafqeetWordsText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7.8,
    color: "#000000",
  },

  // 6. Bottom Financial Summary & VAT Summary Table
  bottomSummaryContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  financialRowsCol: {
    width: "55%",
    flexDirection: "column",
  },
  finRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2.5,
  },
  finAmountWrap: {
    width: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: 10,
  },
  caretSymbolSmall: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#000000",
    marginRight: 4,
  },
  finAmountRed: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#8B1E1E",
  },
  finGrandTotalGrayBox: {
    backgroundColor: "#E2E2E2",
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    minWidth: 58,
  },
  finLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 7,
    color: "#000000",
  },
  finVatLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Right Side: VAT Summary Mini-Table + Sign
  vatSummaryAndSignCol: {
    width: "44%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  vatSummaryBox: {
    width: "74%",
    borderWidth: 0.8,
    borderColor: "#4A4A4A",
  },
  vatSummaryTitleRow: {
    backgroundColor: "#E2E2E2",
    borderBottomWidth: 0.8,
    borderColor: "#4A4A4A",
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  vatSummaryTitleText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  vatSummaryHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E2E2E2",
    borderBottomWidth: 0.8,
    borderColor: "#4A4A4A",
    minHeight: 20,
    alignItems: "center",
  },
  vatSummaryThCell: {
    borderRightWidth: 0.8,
    borderColor: "#4A4A4A",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  vatSummaryThAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6,
    color: "#000000",
    textAlign: "center",
  },
  vatSummaryThEn: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 5.8,
    color: "#000000",
    textAlign: "center",
  },
  vatSummaryDataRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    minHeight: 14,
    alignItems: "center",
  },
  vatSummaryTdCell: {
    borderRightWidth: 0.8,
    borderColor: "#4A4A4A",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 1.5,
  },
  vatSummaryTdText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  signCol: {
    width: "24%",
    alignItems: "center",
    paddingTop: 2,
  },
  signLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 6.8,
    color: "#000000",
    textAlign: "center",
  },
  signatureImage: {
    marginTop: 4,
    width: 48,
    height: 28,
    objectFit: "contain",
  },
});
