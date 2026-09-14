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

export interface ShawagerInvestmentTemplateProps {
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
      if (res) res += " و";
      if (rem <= 10) res += ONES[rem];
      else if (rem < 20) res += TEENS[rem - 10];
      else {
        const u = rem % 10;
        const t = Math.floor(rem / 10);
        if (u > 0) res += ONES[u] + " و" + TENS[t];
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
    if (out) out += " و";
    out += convertGroup(remainder);
  }

  return out;
}

function tafqeetShawager(amount: number): string {
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال";
  if (halalas > 0) {
    text += ` و${halalas} هللة`;
  } else {
    text += " و00 هللة";
  }
  return text + " فقط";
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
    if (isNaN(d.getTime())) return `${iso} م`;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day} م`;
  } catch {
    return `${iso} م`;
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    return "";
  }
}

export function ShawagerInvestmentTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: ShawagerInvestmentTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);
  const dueDateStr = invoice.dueDate ? formatDate(invoice.dueDate) : "";
  const timeStr = formatTime(invoice.issueDate);

  // Company Details
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyWebsite = company.website || "";
  const companyEmail = company.email || "";
  const companyAddress = [company.addressCity, company.addressDistrict ? `حي ${company.addressDistrict}` : "", company.addressStreet]
    .filter(Boolean)
    .join(" - ");
  const companyEmployee = company.clientEmployee || "";

  // Customer Details
  const customerName = customer.nameAr || "";
  const customerVat = customer.vatNumber || "";
  const customerPhone = customer.phone || "";

  // Calculations
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotalVal = Number(invoice.subtotal || 0);
  const discountVal = Number((invoice as any).discountTotal || 0);
  const taxableVal = Number((invoice as any).taxableAmount ?? (subtotalVal - discountVal));
  const vatVal = Number(invoice.vatAmount || 0);
  const totalVal = Number(invoice.total || 0);

  const tafqeetText = totalVal > 0 ? tafqeetShawager(totalVal) : "";

  return (
    <Document
      title={`Sales Invoice ${invoiceNum}`}
      author={companyNameAr}
      subject="SALES INVOICE"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: COMPANY DETAILS & LOGO ─── */}
        <View style={styles.headerContainer}>
          {/* Left Column (English Details) */}
          <View style={styles.headerLeftCol}>
            {companyNameEn ? <Text style={styles.headerEnTitle}>{companyNameEn}</Text> : null}
            {companyWebsite ? <Text style={styles.headerEnText}>Website : {companyWebsite}</Text> : null}
            {companyEmail ? <Text style={styles.headerEnText}>E-mail : {companyEmail}</Text> : null}
            {companyCr ? <Text style={styles.headerEnText}>C.r. : {companyCr}</Text> : null}
            {companyAddress ? <Text style={styles.headerEnText}>Address : {companyAddress}</Text> : null}
          </View>

          {/* Center Column (Logo) */}
          <View style={styles.headerCenterLogo}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : null}
          </View>

          {/* Right Column (Arabic Details) */}
          <View style={styles.headerRightCol}>
            <Text style={styles.headerArTitle}>{companyNameAr}</Text>
            {companyPhone ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyPhone}</Text>
                <Text style={styles.headerArKey}>: هاتف</Text>
              </View>
            ) : null}
            {companyVat ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyVat}</Text>
                <Text style={styles.headerArKey}>: رقم الضريبي</Text>
              </View>
            ) : null}
            {companyAddress ? (
              <View style={styles.headerArRow}>
                <Text style={styles.headerArVal}>{companyAddress}</Text>
                <Text style={styles.headerArKey}>: العنوان</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Dual Colored Divider: Blue on top of Lime Green ─── */}
        <View style={styles.dividerWrap}>
          <View style={styles.dividerBlue} />
          <View style={styles.dividerLime} />
        </View>

        {/* ─── 2. INVOICE TITLE: فاتورة مبيعات ─── */}
        <View style={styles.titleWrap}>
          <Text style={styles.titleText}>فاتورة مبيعات</Text>
          <View style={styles.titleUnderline} />
        </View>

        {/* ─── 3. METADATA GRID BOX ─── */}
        <View style={styles.metaGrid}>
          {/* Row 1 */}
          <View style={styles.gridRow}>
            {/* Left: Invoice Number */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valBold}>{invoiceNum}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>رقم الفاتورة</Text>
            </View>

            {/* Middle: Amount & Payment Method */}
            <View style={[styles.gridCell, { width: "40%", flexDirection: "row", justifyContent: "space-between" }]}>
              <Text style={styles.valBold}>{formatNumber(totalVal)}</Text>
              <Text style={styles.valText}>
                {(invoice as any).paymentMethod === "credit"
                  ? "طريقة الدفع : آجل"
                  : (invoice as any).paymentMethod === "cash"
                  ? "طريقة الدفع : نقدي"
                  : (invoice as any).paymentMethod
                  ? `طريقة الدفع : ${(invoice as any).paymentMethod}`
                  : ""}
              </Text>
            </View>

            {/* Right: Branch */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{(company as any).branch || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>الفرع</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
            {/* Left: Issue Date */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{issueDateStr}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>تاريخ الفاتورة</Text>
            </View>

            {/* Middle: Empty space */}
            <View style={[styles.gridCell, { width: "40%" }]}>
              <Text style={styles.valText}></Text>
            </View>

            {/* Right: Warehouse */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{(invoice as any).warehouse || (company as any).warehouse || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>المستودع</Text>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.gridRow}>
            {/* Left: Due Date */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{dueDateStr}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabelUnderline}>تاريخ الإستحقاق</Text>
            </View>

            {/* Middle: Empty */}
            <View style={[styles.gridCell, { width: "40%" }]}>
              <Text style={styles.valText}></Text>
            </View>

            {/* Right: Quote No */}
            <View style={[styles.gridCell, { width: "25%" }]}>
              <Text style={styles.valText}>{(invoice as any).quotationNumber || (invoice as any).quoteNo || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>رقم العرض</Text>
            </View>
          </View>

          {/* Row 4 */}
          <View style={styles.gridRow}>
            {/* Left: VAT Number */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}>{customerVat}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "11%" }]}>
              <Text style={styles.blueLabel}>الرقم الضريبي</Text>
            </View>

            {/* Middle & Right: Customer Name & Timestamp */}
            <View style={[styles.gridCell, { width: "65%", flexDirection: "row", justifyContent: "space-between" }]}>
              <Text style={styles.valText}>{timeStr}</Text>
              <Text style={styles.valText}>
                {[(customer as any).customerNumber || (customer as any).code, customerName].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>العميل</Text>
            </View>
          </View>

          {/* Row 5 */}
          <View style={styles.gridRow}>
            {/* Left: Account zero */}
            <View style={[styles.gridCell, { width: "16%" }]}>
              <Text style={styles.valText}></Text>
            </View>
            <View style={[styles.gridCell, { width: "11%" }]}>
              <Text style={styles.valText}></Text>
            </View>

            {/* Middle & Right: Notes / Doc Ref */}
            <View style={[styles.gridCell, { width: "65%", alignItems: "flex-end" }]}>
              <Text style={styles.valText}>
                {invoice.notes || ""}
              </Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>ملاحظات</Text>
            </View>
          </View>

          {/* Row 6 */}
          <View style={styles.gridRow}>
            {/* Left: Phone */}
            <View style={[styles.gridCell, { width: "27%", alignItems: "center" }]}>
              <Text style={styles.blueLabel}>{customerPhone ? `رقم الجوال  ${customerPhone}` : "رقم الجوال"}</Text>
            </View>

            {/* Middle: ID Number */}
            <View style={[styles.gridCell, { width: "65%", alignItems: "center" }]}>
              <Text style={styles.blueLabel}>
                {(customer as any).nationalId || (customer as any).idNumber ? `رقم الهوية  ${(customer as any).nationalId || (customer as any).idNumber}` : "رقم الهوية"}
              </Text>
            </View>

            {/* Right: Receiver Name */}
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>إسم المستلم</Text>
            </View>
          </View>

          {/* Row 7 (Last) */}
          <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.gridCell, { width: "92%" }]}>
              <Text style={styles.valText}>{(customer as any).accountNumber || ""}</Text>
            </View>
            <View style={[styles.gridCellHeader, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.blueLabel}>الحساب</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. ITEMS TABLE (12 COLUMNS) ─── */}
        <View style={styles.table}>
          {/* Header Row (RTL) */}
          <View style={styles.tableHeaderRow}>
            {/* 1. ضريبة القيمة */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>ضريبة القيمة</Text>
            </View>

            {/* 2. نسبة */}
            <View style={[styles.thCell, { width: "4%" }]}>
              <Text style={styles.thText}>نسبة</Text>
            </View>

            {/* 3. القيمة */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>القيمة</Text>
            </View>

            {/* 4. صافي سعر */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>صافي سعر</Text>
            </View>

            {/* 5. خصم */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>خصم</Text>
            </View>

            {/* 6. نسبة الخصم */}
            <View style={[styles.thCell, { width: "5%" }]}>
              <Text style={styles.thText}>نسبة</Text>
              <Text style={styles.thText}>الخصم</Text>
            </View>

            {/* 7. سعر الوحدة */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thText}>سعر</Text>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* 8. الكمية */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>

            {/* 9. الوحدة */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>الوحدة</Text>
            </View>

            {/* 10. اسم الصنف */}
            <View style={[styles.thCell, { width: "28%" }]}>
              <Text style={styles.thText}>اســــــم الـصــنـــف</Text>
            </View>

            {/* 11. رقم الصنف */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>رقم الصنف</Text>
            </View>

            {/* 12. م */}
            <View style={[styles.thCell, { width: "4%", borderRightWidth: 0 }]}>
              <Text style={styles.thText}>م</Text>
            </View>
          </View>

          {/* Body Rows */}
          {invoice.items.map((item, index) => {
            const itemCode = (item as any).itemCode || (item as any).barcode || (item as any).sku || "";
            const unitName = (item as any).unitName || (item as any).unit || "";
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || 0);
            const taxable = Number(item.lineSubtotal ?? (unitPrice * qty));
            const vat = Number(item.lineVat ?? (taxable * 0.15));

            return (
              <View key={item.position ?? index} style={styles.tableBodyRow}>
                {/* 1. VAT Amount */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(vat, 2)}</Text>
                </View>

                {/* 2. VAT Rate */}
                <View style={[styles.tdCell, { width: "4%" }]}>
                  <Text style={styles.tdCenter}>15%</Text>
                </View>

                {/* 3. Taxable Amount */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(taxable, 2)}</Text>
                </View>

                {/* 4. Net Price */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(unitPrice, 2)}</Text>
                </View>

                {/* 5. Discount Amount */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>
                    {(item as any).discountAmount ? formatNumber((item as any).discountAmount, 2) : "0.00"}
                  </Text>
                </View>

                {/* 6. Discount % */}
                <View style={[styles.tdCell, { width: "5%" }]}>
                  <Text style={styles.tdCenter}>
                    {(item as any).discountPercent ? `${formatNumber((item as any).discountPercent, 2)}%` : "0.00"}
                  </Text>
                </View>

                {/* 7. Unit Price */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(unitPrice, 2)}</Text>
                </View>

                {/* 8. QTY */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(qty)}</Text>
                </View>

                {/* 9. Unit */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{unitName}</Text>
                </View>

                {/* 10. Description */}
                <View style={[styles.tdCell, { width: "28%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDesc}>{item.description || ""}</Text>
                </View>

                {/* 11. Item Code */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{itemCode}</Text>
                </View>

                {/* 12. Sequence */}
                <View style={[styles.tdCell, { width: "4%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION: TOTALS TABLE (LEFT) | QUANTITY (CENTER) | QR (RIGHT) ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Totals Table */}
          <View style={styles.totalsBox}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "60%" }]}>
                <Text style={styles.totalsValBold}>{formatNumber(subtotalVal, 2)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "40%" }]}>
                <Text style={styles.totalsKey}>الإجمالي</Text>
              </View>
            </View>

            {/* Row 2: Discount */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "60%", flexDirection: "row", justifyContent: "space-between" }]}>
                <Text style={styles.totalsVal}>{formatNumber(discountVal, 2)}</Text>
                <Text style={styles.totalsVal}>
                  {subtotalVal > 0 ? `% ${formatNumber((discountVal / subtotalVal) * 100, 2)}` : "% 0.00"}
                </Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "40%" }]}>
                <Text style={styles.totalsKey}>الخصم</Text>
              </View>
            </View>

            {/* Row 3: Total After Discount */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "60%" }]}>
                <Text style={styles.totalsValBold}>{formatNumber(taxableVal, 2)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "40%" }]}>
                <Text style={styles.totalsKey}>إجمالي بعد الخصم</Text>
              </View>
            </View>

            {/* Row 4: VAT */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, { width: "60%", flexDirection: "row", justifyContent: "space-between" }]}>
                <Text style={styles.totalsValBold}>{formatNumber(vatVal, 2)}</Text>
                <Text style={styles.totalsValBold}>15%</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "40%" }]}>
                <Text style={styles.totalsKey}>إجمالي قيمة الضريبة</Text>
              </View>
            </View>

            {/* Row 5: Net Total */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.totalsValCell, { width: "60%" }]}>
                <Text style={styles.totalsValBold}>{formatNumber(totalVal, 2)}</Text>
              </View>
              <View style={[styles.totalsKeyCell, { width: "40%" }]}>
                <Text style={styles.totalsKey}>الصافي</Text>
              </View>
            </View>
          </View>

          {/* Center: Total Quantity Counter */}
          <View style={styles.qtyCounterBox}>
            <Text style={styles.qtyCounterText}>
              {formatNumber(totalQty, 2)}  عدد كميات
            </Text>
          </View>

          {/* Right: ZATCA QR Code */}
          <View style={styles.qrBox}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 6. ARABIC TAFQEET SPELLED WORDS ─── */}
        <View style={styles.tafqeetRow}>
          <Text style={styles.tafqeetText}>{tafqeetText}</Text>
        </View>

        {/* ─── 7. DOTTED SIGNATURE LINES ─── */}
        <View style={styles.signaturesRow}>
          {/* Seller Sig (Left) */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>البائع</Text>
            <Text style={styles.sigDottedLine}>................................................................</Text>
          </View>

          {/* Receiver Sig (Right) */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المستلم</Text>
            <Text style={styles.sigDottedLine}>................................................................</Text>
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
    paddingHorizontal: 22,
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

  // ─── Header ───
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "35%",
    alignItems: "flex-start",
  },
  headerEnTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
  },
  headerEnText: {
    fontSize: 7.5,
    color: "#000000",
    lineHeight: 1.25,
  },

  headerCenterLogo: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 85,
    height: 45,
    objectFit: "contain",
  },
  defaultLogoBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoDiamond: {
    width: 44,
    height: 30,
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },

  headerRightCol: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerArTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  headerArRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 3,
  },
  headerArVal: {
    fontSize: 7.5,
    color: "#000000",
  },
  headerArKey: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Dual Divider ───
  dividerWrap: {
    width: "100%",
    marginBottom: 10,
  },
  dividerBlue: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1D4ED8",
  },
  dividerLime: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#84CC16",
    marginTop: 1,
  },

  // ─── Title ───
  titleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  titleUnderline: {
    width: 100,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    marginTop: 2,
  },

  // ─── Metadata Grid ───
  metaGrid: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#800000",
    minHeight: 18,
    alignItems: "center",
  },
  gridCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center",
  },
  gridCellHeader: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  blueLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },
  blueLabelUnderline: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    textDecoration: "underline",
  },
  valText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  valBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Items Table ───
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#800000",
    minHeight: 22,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#800000",
    minHeight: 20,
    alignItems: "center",
  },
  tdCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdDesc: {
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Bottom Section ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  totalsBox: {
    width: "38%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#800000",
    minHeight: 18,
    alignItems: "center",
  },
  totalsValCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#800000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "center",
  },
  totalsKeyCell: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  totalsKey: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  totalsVal: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  totalsValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },

  qtyCounterBox: {
    width: "25%",
    alignItems: "center",
    paddingTop: 4,
  },
  qtyCounterText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  qrBox: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 82,
    height: 82,
  },

  // ─── Tafqeet ───
  tafqeetRow: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  tafqeetText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  sigBlock: {
    width: 160,
    alignItems: "center",
  },
  sigTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 6,
    textAlign: "center",
  },
  sigDottedLine: {
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
  },
});
