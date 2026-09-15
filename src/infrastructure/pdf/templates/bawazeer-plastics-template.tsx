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

export interface BawazeerPlasticsTemplateProps {
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
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text;
}

function formatNumber(val: string | number, decimals: number = 2): string {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "P" : "A";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return iso;
  }
}

export function BawazeerPlasticsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: BawazeerPlasticsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);
  const dueDateStr = invoice.dueDate ? formatDate(invoice.dueDate) : "";

  // Seller Details
  const companyNameAr = company.nameAr || "";
  const companyCity = company.addressCity || "";
  const companyStreet = company.addressStreet || "";
  const companyBuilding = company.addressBuildingNumber || "";
  const companyDistrict = company.addressDistrict || "";
  const companyPostalCode = company.addressPostalCode || "";
  const companyAdditionalNo = company.addressAdditionalNumber || "";
  const companyVatNo = company.vatNumber || "";
  const companyCrn = company.crNumber || "";
  const companyPhone1 = company.phone || "";
  // NOTE: company.clientEmployee ("تابع للعميل") is admin-only and must never
  // appear on invoice/receipt PDFs — no seller/cashier line may use it.

  // Buyer Details
  const customerNameAr = customer.nameAr || "";
  const customerBuilding = (customer as any).addressBuildingNumber || "";
  const customerStreet = customer.addressStreet || "";
  const customerDistrict = (customer as any).addressDistrict || "";
  const customerCity = customer.addressCity || "";
  const customerPostalCode = customer.addressPostalCode || "";
  const customerAdditionalNo = (customer as any).addressAdditionalNumber || (customer as any).addressAdditionalNo || "";
  const customerVatNo = customer.vatNumber || "";
  const customerCrn = customer.unifiedNumber || (customer as any).crNumber || "";
  const customerOtherId = customer.unifiedNumber || (customer as any).otherId || "";

  // Calculations
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotalVal = Number(invoice.subtotal || 0);
  const discountVal = Number((invoice as any).discountTotal || 0);
  const taxableVal = Number((invoice as any).taxableAmount ?? (subtotalVal - discountVal));
  const vatVal = Number(invoice.vatAmount || 0);
  const totalVal = Number(invoice.total || 0);

  const tafqeetText = totalVal > 0 ? tafqeet(totalVal) : "";

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyNameAr}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION (QR | TITLE & LOGO | METADATA) ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column: ZATCA QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder} />
            )}
          </View>

          {/* Center Column: Logo (if available), Page Number & Invoice Title */}
          <View style={styles.centerCol}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.headerLogoImage} />
            ) : null}

            <Text
              style={styles.pageNumberText}
              render={({ pageNumber, totalPages }) => `Page\n${pageNumber} of ${totalPages}`}
            />

            <View style={styles.invoiceTitleWrap}>
              <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
              <Text style={styles.invoiceTitleEn}>Tax Invoice</Text>
            </View>
          </View>

          {/* Right Column: Company Header & Invoice Details */}
          <View style={styles.rightCol}>
            <View style={styles.companyInfoWrap}>
              <Text style={styles.companyNameText}>{companyNameAr}</Text>
              <View style={styles.companySubRow}>
                {companyPhone1 ? (
                  <View style={styles.branchPhoneRight}>
                    <Text style={styles.branchLabel}>هاتف / جوال</Text>
                    <Text style={styles.branchNumber}>{companyPhone1}</Text>
                  </View>
                ) : null}
                {companyStreet ? (
                  <Text style={styles.companyStreetText}>{companyStreet}</Text>
                ) : null}
              </View>
            </View>

            {/* Metadata Rows */}
            <View style={styles.metaRowsContainer}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabelEn}>Invoice Number</Text>
                <Text style={styles.metaLabelSlash}>/</Text>
                <Text style={styles.metaLabelAr}>رقم الفاتورة :</Text>
                <Text style={styles.metaInvoiceNum}>{invoiceNum}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabelEn}>Invoice Date</Text>
                <Text style={styles.metaLabelSlash}>/</Text>
                <Text style={styles.metaLabelAr}>تاريخ الفاتورة :</Text>
                <Text style={styles.metaValText}>{issueDateStr}</Text>
              </View>

              {dueDateStr ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabelEn}>Due Date</Text>
                  <Text style={styles.metaLabelSlash}>/</Text>
                  <Text style={styles.metaLabelAr}>تاريخ الاستحقاق :</Text>
                  <Text style={styles.metaValText}>{dueDateStr}</Text>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabelEn}>Payment Method</Text>
                <Text style={styles.metaLabelSlash}>/</Text>
                <Text style={styles.metaLabelAr}>طريقة الدفع :</Text>
                <Text style={styles.metaValText}>
                  {(invoice as any).paymentMethod === "card"
                    ? "Card / شبكة"
                    : (invoice as any).paymentMethod === "transfer"
                    ? "Transfer / تحويل"
                    : (invoice as any).paymentMethod === "credit"
                    ? "Credit / آجل"
                    : "Cash / نقد"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 2. SELLER & BUYER DUAL CARDS ─── */}
        <View style={styles.cardsContainer}>
          {/* Seller Card (Left) */}
          <View style={styles.partyCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderLabelEn}>Seller :</Text>
              <Text style={styles.cardHeaderLabelAr}>: المورد</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Name :</Text>
                <Text style={styles.rowValueCenterBold}>{companyNameAr}</Text>
                <Text style={styles.rowLabelAr}>: الإسم</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Building :</Text>
                <Text style={styles.rowValueCenter}>{companyBuilding}</Text>
                <Text style={styles.rowLabelAr}>: المبنى</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Street :</Text>
                <Text style={styles.rowValueCenter}>{companyStreet}</Text>
                <Text style={styles.rowLabelAr}>: الشارع</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>District :</Text>
                <Text style={styles.rowValueCenter}>{companyDistrict}</Text>
                <Text style={styles.rowLabelAr}>: الحي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>City :</Text>
                <Text style={styles.rowValueCenter}>{companyCity}</Text>
                <Text style={styles.rowLabelAr}>: المدينة</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Country :</Text>
                <Text style={styles.rowValueCenter}>المملكة العربية السعودية</Text>
                <Text style={styles.rowLabelAr}>: الدولة</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Postal Code :</Text>
                <Text style={styles.rowValueCenter}>{companyPostalCode}</Text>
                <Text style={styles.rowLabelAr}>: الرمز البريدي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Additional No :</Text>
                <Text style={styles.rowValueCenter}>{companyAdditionalNo}</Text>
                <Text style={styles.rowLabelAr}>: الرقم الإضافي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Vat No :</Text>
                <Text style={styles.rowValueCenterBold}>{companyVatNo}</Text>
                <Text style={styles.rowLabelAr}>: الرقم الضريبي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>CRN :</Text>
                <Text style={styles.rowValueCenter}>{companyCrn}</Text>
                <Text style={styles.rowLabelAr}>: السجل التجاري</Text>
              </View>

              <View style={styles.cardDataRowLast}>
                <Text style={styles.rowLabelEn}>Other ID :</Text>
                <Text style={styles.rowValueCenter}>{companyCrn ? "CRN" : ""}</Text>
                <Text style={styles.rowLabelAr}>: معرف آخر</Text>
              </View>
            </View>
          </View>

          {/* Buyer Card (Right) */}
          <View style={styles.partyCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderLabelEn}>Buyer :</Text>
              <Text style={styles.cardHeaderLabelAr}>: العميل</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Name :</Text>
                <Text style={styles.rowValueCenterBold}>{customerNameAr}</Text>
                <Text style={styles.rowLabelAr}>: الإسم</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Building :</Text>
                <Text style={styles.rowValueCenter}>{customerBuilding}</Text>
                <Text style={styles.rowLabelAr}>: المبنى</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Street :</Text>
                <Text style={styles.rowValueCenter}>{customerStreet}</Text>
                <Text style={styles.rowLabelAr}>: الشارع</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>District :</Text>
                <Text style={styles.rowValueCenter}>{customerDistrict}</Text>
                <Text style={styles.rowLabelAr}>: الحي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>City :</Text>
                <Text style={styles.rowValueCenter}>{customerCity}</Text>
                <Text style={styles.rowLabelAr}>: المدينة</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Country :</Text>
                <Text style={styles.rowValueCenter}>المملكة العربية السعودية</Text>
                <Text style={styles.rowLabelAr}>: الدولة</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Postal Code :</Text>
                <Text style={styles.rowValueCenter}>{customerPostalCode}</Text>
                <Text style={styles.rowLabelAr}>: الرمز البريدي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Additional No :</Text>
                <Text style={styles.rowValueCenter}>{customerAdditionalNo}</Text>
                <Text style={styles.rowLabelAr}>: الرقم الإضافي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>Vat No :</Text>
                <Text style={styles.rowValueCenterBold}>{customerVatNo}</Text>
                <Text style={styles.rowLabelAr}>: الرقم الضريبي</Text>
              </View>

              <View style={styles.cardDataRow}>
                <Text style={styles.rowLabelEn}>CRN :</Text>
                <Text style={styles.rowValueCenter}>{customerCrn}</Text>
                <Text style={styles.rowLabelAr}>: السجل التجاري</Text>
              </View>

              <View style={styles.cardDataRowLast}>
                <Text style={styles.rowLabelEn}>Other ID :</Text>
                <Text style={styles.rowValueCenter}>{customerOtherId}</Text>
                <Text style={styles.rowLabelAr}>: معرف آخر</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. SUB-HEADER: DESCRIPTION / البيان ─── */}
        {invoice.notes ? (
          <View style={styles.descriptionRow}>
            <Text style={styles.descriptionLabel}>Description / البيان</Text>
            <Text style={styles.descriptionValue}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ─── 4. ITEMS TABLE (7 COLUMNS) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* Col 1: Item ID */}
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thTextAr}>الكود</Text>
              <Text style={styles.thTextEn}>Item ID</Text>
            </View>

            {/* Col 2: Item Name / Description */}
            <View style={[styles.thCell, { width: "35%" }]}>
              <Text style={styles.thTextAr}>اسم الصنف / البيان</Text>
              <Text style={styles.thTextEn}>Item Name / Description</Text>
            </View>

            {/* Col 3: Quantity */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextAr}>الكمية</Text>
              <Text style={styles.thTextEn}>Quantity</Text>
            </View>

            {/* Col 4: Amount */}
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thTextAr}>القيمة</Text>
              <Text style={styles.thTextEn}>Amount</Text>
            </View>

            {/* Col 5: Discount */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>الخصم</Text>
              <Text style={styles.thTextEn}>Discount</Text>
            </View>

            {/* Col 6: Tax */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextAr}>الضريبة</Text>
              <Text style={styles.thTextEn}>Tax</Text>
            </View>

            {/* Col 7: Total Due */}
            <View style={[styles.thCell, { width: "12%", borderRightWidth: 0 }]}>
              <Text style={styles.thTextAr}>الإجمالي</Text>
              <Text style={styles.thTextEn}>Total Due</Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item, index) => {
            const itemCode = (item as any).itemCode || (item as any).sku || (item.savedProductId ? String(item.savedProductId).slice(0, 8) : String(index + 1));
            const unitName = (item as any).unit || "";
            const itemQty = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const lineAmount = Number(item.lineSubtotal ?? (unitPrice * itemQty));
            const lineDisc = Number(item.discountAmount || (item as any).discount || 0);
            const lineVat = Number(item.lineVat || 0);
            const lineTotal = Number(item.lineTotal || 0);

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index % 2 === 1 ? styles.tableRowEven : {},
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* Col 1: Item ID */}
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdCenterText}>{itemCode}</Text>
                </View>

                {/* Col 2: Item Name / Description */}
                <View style={[styles.tdCell, { width: "35%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdRightText}>{item.description}</Text>
                </View>

                {/* Col 3: Quantity (Stacked Unit & Value) */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  {unitName ? <Text style={styles.tdUnitText}>{unitName}</Text> : null}
                  <Text style={styles.tdCenterBoldText}>{itemQty}</Text>
                </View>

                {/* Col 4: Amount */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdCenterText}>{formatNumber(lineAmount, 2)}</Text>
                </View>

                {/* Col 5: Discount */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenterText}>{formatNumber(lineDisc, 2)}</Text>
                </View>

                {/* Col 6: Tax */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenterText}>{formatNumber(lineVat, 2)}</Text>
                </View>

                {/* Col 7: Total Due */}
                <View style={[styles.tdCell, { width: "12%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdRightBoldText}>{formatNumber(lineTotal, 2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TAFQEET SPELLED OUT STRIP ─── */}
        <View style={styles.tafqeetRow}>
          <View style={styles.tafqeetTextWrap}>
            <Text style={styles.tafqeetText}>{tafqeetText}</Text>
          </View>
          <View style={styles.tafqeetCurrencyBox}>
            <Text style={styles.tafqeetCurrencyText}>SAR</Text>
          </View>
          <View style={styles.tafqeetAmountBox}>
            <Text style={styles.tafqeetAmountText}>{formatNumber(totalVal, 2)}</Text>
          </View>
        </View>

        {/* ─── 6. SUMMARY & TOTALS SECTION ─── */}
        <View style={styles.summaryContainer}>
          {/* Left Block: Total Quantity Highlighted */}
          <View style={styles.totalQtyBlock}>
            <Text style={styles.totalQtyLabel}>إجمالي الكمية / Total QTY</Text>
            <Text style={styles.totalQtyValue}>{totalQty}</Text>
          </View>

          {/* Right Block: Comprehensive Totals Breakdown */}
          <View style={styles.totalsTableBlock}>
            {/* Row 1: Total Excluding VAT */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatNumber(subtotalVal, 2)}</Text>
              <Text style={styles.totalsLabel}>الإجمالي غير شامل ضريبة القيمة المضافة / Total Excluding VAT</Text>
            </View>

            {/* Row 2: Discount */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatNumber(discountVal, 2)}</Text>
              <Text style={styles.totalsLabel}>Discount / الخصم</Text>
            </View>

            {/* Row 3: Charges */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>0.00</Text>
              <Text style={styles.totalsLabel}>Charges / الأعباء</Text>
            </View>

            {/* Row 4: Total Taxable Amount */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatNumber(taxableVal, 2)}</Text>
              <Text style={styles.totalsLabel}>Total Taxable Amount / الإجمالي الخاضع للضريبة</Text>
            </View>

            {/* Row 5: 15% Tax (with red 15%) */}
            <View style={styles.totalsTableRow}>
              <Text style={styles.totalsVal}>{formatNumber(vatVal, 2)}</Text>
              <View style={styles.taxLabelRow}>
                <Text style={styles.totalsLabel}>الضريبة / </Text>
                <Text style={styles.taxRedText}>15% </Text>
                <Text style={styles.totalsLabel}>Tax</Text>
              </View>
            </View>

            {/* Row 6: Final Total with Tax */}
            <View style={[styles.totalsTableRow, styles.totalsFinalRow]}>
              <Text style={styles.totalsFinalVal}>{formatNumber(totalVal, 2)}</Text>
              <Text style={styles.totalsFinalLabel}>الإجمالي النهائي شامل الضريبة / Total Amt With Tax</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 22,
    paddingRight: 22,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Top Header Section ───
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 6,
  },
  qrCol: {
    width: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: "#9CA3AF",
  },

  centerCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
  },
  headerLogoImage: {
    maxHeight: 45,
    maxWidth: 120,
    objectFit: "contain",
    marginBottom: 4,
  },
  pageNumberText: {
    fontSize: 7,
    color: "#2563EB",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 1.2,
  },
  invoiceTitleWrap: {
    alignItems: "center",
    marginTop: 2,
  },
  invoiceTitleAr: {
    fontSize: 12.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  invoiceTitleEn: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },

  rightCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  companyInfoWrap: {
    alignItems: "flex-end",
    marginBottom: 6,
  },
  companyNameText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    marginBottom: 2,
  },
  companySubRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
  },
  companyStreetText: {
    fontSize: 8,
    color: "#374151",
    textAlign: "right",
  },
  branchPhoneRight: {
    alignItems: "center",
  },
  branchLabel: {
    fontSize: 7.5,
    color: "#4B5563",
    textAlign: "right",
  },
  branchNumber: {
    fontSize: 8,
    color: "#111827",
    fontWeight: "bold",
  },

  metaRowsContainer: {
    alignItems: "flex-end",
    width: "100%",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 2,
    gap: 3,
  },
  metaLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  metaLabelSlash: {
    fontSize: 7.5,
    color: "#6B7280",
  },
  metaLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  metaInvoiceNum: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    marginRight: 4,
  },
  metaValText: {
    fontSize: 7.5,
    color: "#111827",
    marginRight: 4,
  },

  // ─── Dual Party Cards ───
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#FFFFFF",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
  },
  cardHeaderLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  cardHeaderLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  cardBody: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cardDataRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 1.5,
  },
  cardDataRowLast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  rowLabelEn: {
    width: "28%",
    fontSize: 6.8,
    color: "#4B5563",
    textAlign: "left",
  },
  rowValueCenter: {
    width: "44%",
    fontSize: 6.8,
    color: "#111827",
    textAlign: "center",
  },
  rowValueCenterBold: {
    width: "44%",
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  rowLabelAr: {
    width: "28%",
    fontSize: 6.8,
    color: "#4B5563",
    textAlign: "right",
  },

  // ─── Description Row ───
  descriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
    paddingHorizontal: 2,
  },
  descriptionLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  descriptionValue: {
    fontSize: 7.5,
    color: "#374151",
  },

  // ─── Items Table ───
  table: {
    borderWidth: 1,
    borderColor: "#4B5563",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#4B5563",
    minHeight: 26,
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  thTextEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 22,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#FAFAFA",
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenterText: {
    fontSize: 7,
    color: "#111827",
    textAlign: "center",
  },
  tdCenterBoldText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  tdUnitText: {
    fontSize: 6.2,
    color: "#4B5563",
    textAlign: "center",
  },
  tdRightText: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
  },
  tdRightBoldText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },

  // ─── Tafqeet Strip ───
  tafqeetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#9CA3AF",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    marginBottom: 6,
    gap: 6,
  },
  tafqeetTextWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  tafqeetText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "right",
  },
  tafqeetCurrencyBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  tafqeetCurrencyText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },
  tafqeetAmountBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    minWidth: 60,
    alignItems: "center",
  },
  tafqeetAmountText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "center",
  },

  // ─── Summary & Totals ───
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  totalQtyBlock: {
    width: "30%",
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: "#FAFAFA",
  },
  totalQtyLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  totalQtyValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2563EB",
    textAlign: "center",
  },

  totalsTableBlock: {
    width: "70%",
  },
  totalsTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  totalsFinalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#F9FAFB",
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
  },
  totalsFinalLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  taxLabelRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  taxRedText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  totalsVal: {
    fontSize: 7.5,
    color: "#111827",
    textAlign: "left",
  },
  totalsFinalVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "left",
  },
});
