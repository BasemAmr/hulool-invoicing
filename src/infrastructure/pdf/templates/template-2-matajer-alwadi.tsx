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

export interface Template2MatajerAlwadiProps {
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

// ─── Optional extension interfaces (typesafe, non-breaking fallbacks) ───

interface ExtendedInvoice {
  paymentMethod?: string | null;
  paymentType?: string | null;
  paymentMethodLabel?: string | null;
  discountTotal?: string | number | null;
  discount?: string | number | null;
  discountAmount?: string | number | null;
  cashDiscount?: string | number | null;
  halalaDiscount?: string | number | null;
  totalQty?: string | number | null;
}

interface ExtendedCustomer {
  customerNumber?: string | number | null;
  code?: string | number | null;
  custCode?: string | number | null;
  clientNo?: string | number | null;
}

interface ExtendedItem {
  barcode?: string | null;
  code?: string | null;
  itemCode?: string | null;
  itemNo?: string | null;
  sku?: string | null;
  unitName?: string | null;
  unit?: string | null;
  packSize?: string | number | null;
  pack?: string | number | null;
  shad?: string | number | null;
  descriptionEn?: string | null;
  nameEn?: string | null;
}

// ─── Safe conversion & formatting helpers ───

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyNumber(val: string | number | null | undefined, decimals = 2): string {
  const n = toNumber(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
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

function getItemCode(item: InvoiceItemDto, index: number): string {
  const ext = item as InvoiceItemDto & ExtendedItem;
  const candidates = [ext.itemCode, ext.itemNo, ext.code, ext.barcode, ext.sku, ext.savedProductId];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s && !isUuidLike(s)) return s;
  }
  return String(index + 1);
}

function getCustomerAddress(customer: CustomerRecord): string {
  const custAny = customer as unknown as { addressDistrict?: string };
  const parts = [
    customer.addressCity,
    custAny.addressDistrict,
    customer.addressStreet,
  ].filter(Boolean);
  return parts.join(" - ");
}

// ─── Arabic tafqeet (Amount to Arabic Words) ───

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
  if (h > 0 && HUNDREDS_AR[h]) {
    parts.push(HUNDREDS_AR[h]);
  }
  if (rem > 0) {
    if (rem < 10) {
      if (ONES_AR[rem]) parts.push(ONES_AR[rem]!);
    } else if (rem < 20) {
      const teen = TEENS_AR[rem - 10];
      if (teen) parts.push(teen);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const tensLabel = TENS_AR[t];
      if (u > 0 && ONES_AR[u]) {
        parts.push(`${ONES_AR[u]} و${tensLabel}`);
      } else if (tensLabel) {
        parts.push(tensLabel);
      }
    }
  }
  return parts.join(" و");
}

function tafqeetArabic(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "صفر";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  const groups: string[] = [];
  const thousands = Math.floor(riyals / 1000);
  const rest = riyals % 1000;
  if (thousands > 0) {
    if (thousands === 1) groups.push("ألف");
    else if (thousands === 2) groups.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) groups.push(`${convertThreeDigits(thousands)} آلاف`);
    else groups.push(`${convertThreeDigits(thousands)} ألف`);
  }
  if (rest > 0) groups.push(convertThreeDigits(rest));

  let text = groups.length > 0 ? groups.join(" و") : "صفر";
  if (halalas > 0) {
    text += ` و${convertThreeDigits(halalas)} هللة`;
  }
  return text;
}

// ─── Main Template Component ───

export function Template2MatajerAlwadi({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template2MatajerAlwadiProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const extInv = invoice as InvoiceDto & ExtendedInvoice;
  const extCust = customer as CustomerRecord & ExtendedCustomer;

  // Invoice metadata
  const invoiceNum = toText(invoice.invoiceNumber);
  const issueDate = invoice.issueDate ? invoice.issueDate.slice(0, 10) : "";

  // Payment type display (defaulting to "نقدا" if cash or unspecified)
  let paymentLabel = "نقدا";
  const rawPayment = extInv.paymentMethodLabel || extInv.paymentMethod || extInv.paymentType;
  if (rawPayment) {
    const lower = String(rawPayment).toLowerCase();
    if (lower.includes("credit") || lower.includes("أجل") || lower.includes("اجل")) {
      paymentLabel = "آجل";
    } else if (lower.includes("transfer") || lower.includes("تحويل")) {
      paymentLabel = "تحويل";
    } else if (lower.includes("card") || lower.includes("شبكة") || lower.includes("mada")) {
      paymentLabel = "شبكة";
    } else {
      paymentLabel = String(rawPayment);
    }
  }

  // Customer metadata
  const customerName = toText(customer.nameAr || customer.nameEn);
  const customerCode = toText(extCust.custCode ?? extCust.customerNumber ?? extCust.code ?? extCust.clientNo ?? "");
  const customerVat = toText(customer.vatNumber);
  const customerAddress = getCustomerAddress(customer);

  // Company metadata
  const companyNameAr = toText(company.nameAr);
  const companyNameEn = toText(company.nameEn);
  const companyVat = toText(company.vatNumber);
  const companyWebsite = toText(company.website);

  // Items processing
  const items = invoice.items || [];
  const rows = items.map((item, idx) => {
    const extItem = item as InvoiceItemDto & ExtendedItem;
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const lineVat = toNumber(item.lineVat);
    const lineTotal = toNumber(item.lineTotal);
    const code = getItemCode(item, idx);
    const unit = toText(extItem.unitName ?? extItem.unit ?? "");
    const pack = toText(extItem.packSize ?? extItem.pack ?? extItem.shad ?? "");
    const descAr = toText(item.description);
    const descEn = toText(extItem.descriptionEn ?? extItem.nameEn ?? "");

    return {
      key: item.position ?? idx,
      code,
      descAr,
      descEn,
      qty,
      unit,
      pack,
      unitPrice,
      lineVat,
      lineTotal,
    };
  });

  // Calculate totals
  const totalQuantity = rows.reduce((sum, r) => sum + r.qty, 0);
  const displayTotalQty = extInv.totalQty ? toNumber(extInv.totalQty) : totalQuantity;

  const subtotalVal = toNumber(invoice.subtotal);
  const discountVal = toNumber(extInv.discountTotal ?? extInv.discount ?? extInv.discountAmount ?? 0);
  const vatVal = toNumber(invoice.vatAmount);
  const totalVal = toNumber(invoice.total);

  // Subtotal minus discount
  const priceAfterDiscount = Math.max(0, (subtotalVal + vatVal) - discountVal);

  const wordsText = tafqeetArabic(totalVal);

  return (
    <Document
      title={`فاتورة ${invoiceNum}`}
      author={companyNameAr || "متاجر الوادي"}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ENCLOSURE ─── */}
        <View style={styles.headerContainer}>
          {/* Header Top Row: Logo (Left), QR Code (Center-Left), Company Names (Right) */}
          <View style={styles.headerTopRow}>
            {/* Left: Brand Logo & Website */}
            <View style={styles.headerLeftLogoCol}>
              {logoDataUrl ? (
                <Image src={logoDataUrl} style={styles.logoImage} />
              ) : (
                <View style={styles.brandFallbackBox}>
                  {/* Styled fallback apple icon & text matching brand colors */}
                  <View style={styles.brandLeafCircle}>
                    <Text style={styles.brandLeafText}>❦</Text>
                  </View>
                  <Text style={styles.brandSubTitle}>متاجر</Text>
                  <Text style={styles.brandMainTitle}>الــــوادي</Text>
                </View>
              )}
              {companyWebsite ? (
                <Text style={styles.headerWebsiteText}>{companyWebsite}</Text>
              ) : null}
            </View>

            {/* Center: QR Code / Barcode Stamp */}
            <View style={styles.headerCenterQrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.headerQrImage} />
              ) : (
                <View style={styles.qrPlaceholderBox}>
                  <Text style={styles.qrPlaceholderText}>QR Code</Text>
                </View>
              )}
            </View>

            {/* Right: Company Names (Arabic on top, English underneath) */}
            <View style={styles.headerRightInfoCol}>
              <Text style={styles.companyNameArText}>
                {companyNameAr || "مؤسسة متاجر الوادي التجارية"}
              </Text>
              <Text style={styles.companyNameEnText}>
                {companyNameEn || "MatajerAlwadi Est. For Trading"}
              </Text>
            </View>
          </View>

          {/* Double Decorative Bar: Green and Dark Green Lines */}
          <View style={styles.decorativeBarWrap}>
            <View style={styles.decorativeLineDark} />
            <View style={styles.decorativeLineGreen} />
          </View>

          {/* Tax Number Row (Right-aligned under header) */}
          <View style={styles.headerVatRow}>
            <Text style={styles.vatNumberValue}>{companyVat}</Text>
            <Text style={styles.vatNumberLabel}> الرقم الضريبي :</Text>
          </View>
        </View>

        {/* ─── 2. INFO PANEL (Bilingual Labels, Split Columns) ─── */}
        <View style={styles.infoPanelContainer}>
          {/* Row 1: Left (INV. No) | Center (Invoice / Payment) | Right (Date) */}
          <View style={styles.infoPanelRow}>
            {/* Left Cell: Invoice Number */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{invoiceNum}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>INV. No :</Text>
                <Text style={styles.infoLabelAr}>رقم الفاتورة :</Text>
              </View>
            </View>

            {/* Center Cell: "فاتورة" badge and payment mode */}
            <View style={styles.infoCellCenter}>
              <Text style={styles.invoiceTitleBadge}>فــاتــورة</Text>
              <Text style={styles.paymentMethodTag}>{paymentLabel}</Text>
            </View>

            {/* Right Cell: Date */}
            <View style={styles.infoCellRight}>
              <Text style={styles.infoValueText}>{issueDate}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Date :</Text>
                <Text style={styles.infoLabelAr}>تاريخ الفاتورة :</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Left (Cust. Code) | Center/Right (Cust. Name spanning across) */}
          <View style={styles.infoPanelRow}>
            {/* Left Cell: Customer Code */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{customerCode}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Cust. Code :</Text>
                <Text style={styles.infoLabelAr}>كود العميل :</Text>
              </View>
            </View>

            {/* Right Cell: Customer Name */}
            <View style={styles.infoCellCustomerSpan}>
              <Text style={[styles.infoValueText, styles.customerNameVal]}>
                {customerName}
              </Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Cust. Name :</Text>
                <Text style={styles.infoLabelAr}>اسم العميل :</Text>
              </View>
            </View>
          </View>

          {/* Row 3: Left (Customer VAT No) | Right (Customer Address) */}
          <View style={[styles.infoPanelRow, styles.infoPanelLastRow]}>
            {/* Left Cell: Customer VAT No */}
            <View style={styles.infoCellLeft}>
              <Text style={styles.infoValueText}>{customerVat}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>VAT .No :</Text>
                <Text style={styles.infoLabelAr}>الرقم الضريبي للعميل :</Text>
              </View>
            </View>

            {/* Right Cell: Customer Address */}
            <View style={styles.infoCellCustomerSpan}>
              <Text style={styles.infoValueText}>{customerAddress}</Text>
              <View style={styles.infoLabelGroup}>
                <Text style={styles.infoLabelEn}>Address :</Text>
                <Text style={styles.infoLabelAr}>العنوان :</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS DATA TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header (RTL Order: Right to Left) */}
          <View style={styles.tableHeaderRow}>
            {/* Leftmost (8): Total */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thText}>إجمالي القيمة</Text>
            </View>
            {/* (7): VAT */}
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thText}>الضريبة</Text>
            </View>
            {/* (6): Price */}
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thText}>السعر</Text>
            </View>
            {/* (5): Pack / Shad */}
            <View style={[styles.thCell, styles.colPack]}>
              <Text style={styles.thText}>الشد</Text>
            </View>
            {/* (4): Unit */}
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thText}>الوحدة</Text>
            </View>
            {/* (3): Quantity */}
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            {/* (2): Description / البيان */}
            <View style={[styles.thCell, styles.colDesc]}>
              <Text style={styles.thText}>البيـــــــــان</Text>
            </View>
            {/* Rightmost (1): Item Number (tinted teal/green header) */}
            <View style={[styles.thCell, styles.colItemCode, styles.thItemCode]}>
              <Text style={styles.thText}>رقم الصنف</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          <View style={styles.tableBody}>
            {rows.map((row, idx) => (
              <View key={row.key} style={styles.tableRow}>
                {/* Total */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={styles.tdNumberBold}>
                    {formatMoneyNumber(row.lineTotal)}
                  </Text>
                </View>

                {/* VAT */}
                <View style={[styles.tdCell, styles.colVat]}>
                  <Text style={styles.tdNumber}>
                    {formatMoneyNumber(row.lineVat)}
                  </Text>
                </View>

                {/* Unit Price */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdNumber}>
                    {formatMoneyNumber(row.unitPrice)}
                  </Text>
                </View>

                {/* Pack / الشد */}
                <View style={[styles.tdCell, styles.colPack]}>
                  <Text style={styles.tdCenterText}>{row.pack || ""}</Text>
                </View>

                {/* Unit / الوحدة */}
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.tdCenterText}>{row.unit || ""}</Text>
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdNumberBold}>
                    {formatQty(row.qty)}
                  </Text>
                </View>

                {/* Description: Arabic on top, English underneath */}
                <View style={[styles.tdCell, styles.colDesc, styles.tdDescCell]}>
                  <Text style={styles.itemDescAr}>{row.descAr}</Text>
                  {row.descEn ? (
                    <Text style={styles.itemDescEn}>{row.descEn}</Text>
                  ) : null}
                </View>

                {/* Item Number: Distinct light green shaded tint */}
                <View style={[styles.tdCell, styles.colItemCode, styles.tdItemCodeTint]}>
                  <Text style={styles.itemCodeText}>{row.code}</Text>
                </View>
              </View>
            ))}

            {/* Empty fallback row if no items present */}
            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, styles.colTotal]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colVat]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colPrice]}><Text style={styles.tdCenterText}>0.00</Text></View>
                <View style={[styles.tdCell, styles.colPack]}><Text style={styles.tdCenterText}> </Text></View>
                <View style={[styles.tdCell, styles.colUnit]}><Text style={styles.tdCenterText}> </Text></View>
                <View style={[styles.tdCell, styles.colQty]}><Text style={styles.tdCenterText}>0</Text></View>
                <View style={[styles.tdCell, styles.colDesc]}><Text style={styles.tdCenterText}>لا توجد عناصر</Text></View>
                <View style={[styles.tdCell, styles.colItemCode, styles.tdItemCodeTint]}><Text style={styles.tdCenterText}>-</Text></View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 4. TOTALS & SUMMARY SECTION ─── */}
        <View style={styles.bottomSectionContainer}>
          {/* Boxed Totals Container */}
          <View style={styles.totalsBoxContainer}>
            {/* Totals Row 1: Total Qty (Right) and Gross Total (Left) */}
            <View style={styles.totalsRow}>
              {/* Left Sub-column: الإجمالي شامل الضريبة */}
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValueBold}>
                  {formatMoneyNumber(subtotalVal + vatVal)}
                </Text>
                <Text style={styles.totalsLabel}>الإجمالي شامل الضريبة</Text>
              </View>
              {/* Right Sub-column: إجمالي الكمية */}
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsValueBold}>
                  {formatQty(displayTotalQty)}
                </Text>
                <Text style={styles.totalsLabel}>إجمالي الكمية</Text>
              </View>
            </View>

            {/* Totals Row 2: Discount */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>
                  {formatMoneyNumber(discountVal)}
                </Text>
                <Text style={styles.totalsLabel}>الخصم</Text>
              </View>
              <View style={styles.totalsCellRight}>
                {/* Empty spacer / status area */}
                <Text style={styles.totalsStatusText}> </Text>
              </View>
            </View>

            {/* Totals Row 3: Price After Discount */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValueBold}>
                  {formatMoneyNumber(priceAfterDiscount)}
                </Text>
                <Text style={styles.totalsLabel}>القيمة بعد الخصم شامل الضريبة</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsStatusText}>تم الدفع . المحصلة</Text>
              </View>
            </View>

            {/* Totals Row 4: VAT Tax Amount */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>
                  {formatMoneyNumber(vatVal)}
                </Text>
                <Text style={styles.totalsLabel}>ضريبة القيمة المضافة</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsStatusText}> </Text>
              </View>
            </View>

            {/* Totals Row 5: Halala Discount / خصم الهلل */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsCellLeft}>
                <Text style={styles.totalsValue}>
                  {formatMoneyNumber(extInv.halalaDiscount ?? 0)}
                </Text>
                <Text style={styles.totalsLabel}>خصم الهلل</Text>
              </View>
              <View style={styles.totalsCellRight}>
                <Text style={styles.totalsStatusText}> </Text>
              </View>
            </View>

            {/* Totals Row 6: Net Invoice Total & Arabic Words Line */}
            <View style={[styles.totalsRow, styles.totalsFinalRow]}>
              {/* Left: Net Invoice Total */}
              <View style={styles.totalsCellLeft}>
                <Text style={styles.netTotalValueBold}>
                  {formatMoneyNumber(totalVal)}
                </Text>
                <Text style={styles.netTotalLabelBold}>صافي الفاتورة</Text>
              </View>

              {/* Right: Amount in Words */}
              <View style={styles.totalsCellRightWords}>
                <Text style={styles.amountWordsText}>{wordsText}</Text>
                <Text style={styles.currencyBadge}>SAR</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Stylesheet ───

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontSize: 7.5,
    color: "#000000",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header Enclosure ───
  headerContainer: {
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  // Header Left (Logo & brand)
  headerLeftLogoCol: {
    width: "28%",
    alignItems: "flex-start",
  },
  logoImage: {
    width: 90,
    height: 48,
    objectFit: "contain",
  },
  brandFallbackBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  brandLeafCircle: {
    marginBottom: -2,
  },
  brandLeafText: {
    fontSize: 16,
    color: "#166534",
  },
  brandSubTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#166534",
  },
  brandMainTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B91C1C",
    letterSpacing: 1,
  },
  headerWebsiteText: {
    fontSize: 6,
    color: "#4B5563",
    marginTop: 2,
  },
  // Header Center (QR Code)
  headerCenterQrCol: {
    width: "22%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerQrImage: {
    width: 52,
    height: 52,
  },
  qrPlaceholderBox: {
    width: 48,
    height: 48,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 6.5,
    color: "#9CA3AF",
  },
  // Header Right (Company names)
  headerRightInfoCol: {
    width: "50%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  companyNameArText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEnText: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // Decorative lines
  decorativeBarWrap: {
    width: "100%",
    marginBottom: 4,
  },
  decorativeLineDark: {
    height: 2,
    backgroundColor: "#164E2E",
    width: "100%",
    marginBottom: 1,
  },
  decorativeLineGreen: {
    height: 1.5,
    backgroundColor: "#22C55E",
    width: "100%",
  },
  // VAT Number Row under decorative lines
  headerVatRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 1,
  },
  vatNumberValue: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    letterSpacing: 0.5,
  },
  vatNumberLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 4,
  },

  // ─── Info Panel ───
  infoPanelContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    borderRadius: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  infoPanelRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  infoPanelLastRow: {
    borderBottomWidth: 0,
  },
  infoCellLeft: {
    width: "36%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoCellCenter: {
    width: "18%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  infoCellRight: {
    width: "46%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoCellCustomerSpan: {
    width: "64%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabelEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    marginRight: 2,
  },
  infoLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  infoValueText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    flex: 1,
    textAlign: "right",
    paddingRight: 4,
  },
  customerNameVal: {
    fontSize: 8,
  },
  invoiceTitleBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000000",
  },
  paymentMethodTag: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Data Table ───
  tableContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 19,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thItemCode: {
    backgroundColor: "#E6F4EA",
    borderRightWidth: 0,
  },
  tableBody: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#D1D5DB",
    minHeight: 22,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  tdDescCell: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 4,
  },
  tdItemCodeTint: {
    backgroundColor: "#E6F4EA",
    borderRightWidth: 0,
  },
  itemCodeText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  itemDescAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  itemDescEn: {
    fontSize: 5.5,
    color: "#374151",
    textAlign: "right",
    marginTop: 1,
  },
  tdNumber: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdNumberBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tdCenterText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (Sum = 100%)
  colTotal: { width: "11%" },
  colVat: { width: "10%" },
  colPrice: { width: "10%" },
  colPack: { width: "7%" },
  colUnit: { width: "8%" },
  colQty: { width: "9%" },
  colDesc: { width: "32%" },
  colItemCode: { width: "13%" },

  // ─── Totals Section ───
  bottomSectionContainer: {
    width: "100%",
    marginTop: 2,
  },
  totalsBoxContainer: {
    borderWidth: 1.25,
    borderColor: "#000000",
    borderRadius: 4,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  totalsFinalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#FAFAFA",
    minHeight: 22,
  },
  totalsCellLeft: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsCellRight: {
    width: "52%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsCellRightWords: {
    width: "52%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsValue: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  totalsValueBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  totalsStatusText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
    width: "100%",
  },
  netTotalLabelBold: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  netTotalValueBold: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  amountWordsText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    flex: 1,
    paddingRight: 6,
  },
  currencyBadge: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
});
