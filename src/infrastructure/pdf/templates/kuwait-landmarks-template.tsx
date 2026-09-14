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

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لاغير";
}

function formatNumber(val: string | number, decimals?: number): string {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  if (decimals !== undefined) {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return num % 1 === 0
    ? num.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatTime(issuedAt?: string | null): string {
  if (issuedAt) {
    try {
      const d = new Date(issuedAt);
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      const ampm = h >= 12 ? "م" : "ص";
      const h12 = String(h % 12 || 12).padStart(2, "0");
      return `${h12}:${m}:${s} ${ampm}`;
    } catch {
      return "";
    }
  }
  return "";
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
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice?.invoiceNumber || "";
  const issueDateStr = formatDate(invoice?.issueDate);
  const timeStr = formatTime(invoice?.issuedAt);

  const companyNameAr = company?.nameAr || "";
  const companyNameEn = company?.nameEn || "";
  const companyAddressLine = [
    company?.addressAdditionalNumber ? `${company.addressAdditionalNumber} .` : "",
    company?.addressBuildingNumber,
    company?.addressCity ? `فرع ${company.addressCity}` : "",
    company?.addressPostalCode,
    company?.addressStreet,
    company?.addressDistrict ? `حي ${company.addressDistrict}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddressLine = [
    customer?.addressCity,
    (customer as any)?.addressDistrict ? `حي ${(customer as any).addressDistrict}` : "",
    customer?.addressPostalCode,
    customer?.addressStreet ? `-${customer.addressStreet}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerName = customer?.nameAr || customer?.nameEn || "";
  const customerVat = customer?.vatNumber || "";
  const customerPhone = customer?.phone || "";
  const employeeName = company?.clientEmployee || "";
  const companyCr = company?.crNumber || "";
  const companyVat = company?.vatNumber || "";

  // 1D Barcode Simulation
  const barcodePattern = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4];

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

        {/* ─── 1. TOP HEADER (ENGLISH ON LEFT, ARABIC ON RIGHT, LOGO OPTIONAL) ─── */}
        <View style={styles.headerTop}>
          {/* Left: English Company Name or Logo */}
          <View style={styles.headerLeft}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : null}
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
          </View>

          {/* Right: Arabic Company Details */}
          <View style={styles.headerRight}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            {companyAddressLine ? (
              <Text style={styles.companyAddressLine}>{companyAddressLine}</Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.companyIdLine}>{companyCr}       س.ت</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.companyIdLine}>{companyVat}  الرقم الضريبي</Text>
            ) : null}
          </View>
        </View>

        {/* Header Separator Line */}
        <View style={styles.headerDivider} />

        {/* ─── 2. TITLE BADGE, INVOICE BOX & QR CODE ─── */}
        <View style={styles.metaRowSection}>
          {/* Left: Barcode + Invoice Box */}
          <View style={styles.metaLeftBoxCol}>
            {/* Title Box Centered Above the Box */}
            <View style={styles.titleBadgeWrap}>
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>فاتورة ضريبية</Text>
              </View>
            </View>

            {/* 1D Barcode */}
            <View style={styles.barcodeWrap}>
              {barcodePattern.map((w, idx) => (
                <View
                  key={idx}
                  style={{
                    width: w * 1.5,
                    backgroundColor: idx % 2 === 0 ? "#000000" : "#FFFFFF",
                    height: 22,
                  }}
                />
              ))}
            </View>

            {/* 2-Row Box: Invoice Number & Date/Time */}
            <View style={styles.invoiceNumberBox}>
              {/* Row 1: Invoice Number */}
              <View style={styles.invBoxRow1}>
                <Text style={styles.invBoxLabelEn}>Invoice Number</Text>
                <Text style={styles.invBoxVal}>{invoiceNum}</Text>
                <Text style={styles.invBoxLabelAr}>رقم الفاتورة</Text>
              </View>

              {/* Row 2: Time & Date */}
              <View style={styles.invBoxRow2}>
                <Text style={styles.invBoxSubKey}>Time</Text>
                <Text style={styles.invBoxSubVal}>{timeStr}</Text>
                <Text style={styles.invBoxSubKey}>الوقت</Text>
                <Text style={styles.invBoxSubKey}>Date</Text>
                <Text style={styles.invBoxSubVal}>{issueDateStr}</Text>
                <Text style={styles.invBoxSubKey}>التاريخ</Text>
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
          {/* Left Column (4 rows) */}
          <View style={styles.clientCardLeft}>
            {/* Row 1: Pay Method */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Pay Method</Text>
              <Text style={styles.cardValCenter}></Text>
              <Text style={styles.cardKeyAr}>طريقة الدفع</Text>
            </View>

            {/* Row 2: SalesMan */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>SalesMan</Text>
              <Text style={styles.cardValCenter}></Text>
              <Text style={styles.cardKeyAr}>المندوب</Text>
            </View>

            {/* Row 3: Employee */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Employee</Text>
              <Text style={styles.cardValCenter}>{employeeName}</Text>
              <Text style={styles.cardKeyAr}>الموظف</Text>
            </View>

            {/* Row 4: Tax No. */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Tax No.</Text>
              <Text style={styles.cardValCenter}>{customerVat}</Text>
              <Text style={styles.cardKeyAr}>الرقم الضريبي</Text>
            </View>
          </View>

          {/* Right Column (4 rows) */}
          <View style={styles.clientCardRight}>
            {/* Row 1: Branch */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Branch</Text>
              <Text style={styles.cardValCenter}></Text>
              <Text style={styles.cardKeyAr}>الفرع</Text>
            </View>

            {/* Row 2: Client */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Client</Text>
              <Text style={styles.cardValCenter}>{customerName}</Text>
              <Text style={styles.cardKeyAr}>العميل</Text>
            </View>

            {/* Row 3: Mobile */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Mobile</Text>
              <Text style={styles.cardValCenter}>{customerPhone}</Text>
              <Text style={styles.cardKeyAr}>جوال</Text>
            </View>

            {/* Row 4: Address */}
            <View style={styles.cardRow}>
              <Text style={styles.cardKeyEn}>Address</Text>
              <Text style={styles.cardValCenter}>{customerAddressLine}</Text>
              <Text style={styles.cardKeyAr}>عنوان</Text>
            </View>
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
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thText}>الباركود</Text>
              <Text style={styles.thTextEn}>Barcode</Text>
            </View>

            {/* 3. الصنف / Item */}
            <View style={[styles.thCell, { width: "23%" }]}>
              <Text style={styles.thText}>الصنف</Text>
              <Text style={styles.thTextEn}>Item</Text>
            </View>

            {/* 4. الوحدة / Unit */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>الوحدة</Text>
              <Text style={styles.thTextEn}>Unit</Text>
            </View>

            {/* 5. الكمية / Quan */}
            <View style={[styles.thCell, { width: "7%" }]}>
              <Text style={styles.thText}>الكمية</Text>
              <Text style={styles.thTextEn}>Quan</Text>
            </View>

            {/* 6. السعر / Price */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>السعر</Text>
              <Text style={styles.thTextEn}>Price</Text>
            </View>

            {/* 7. الإجمالي / Total */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>الإجمالي</Text>
              <Text style={styles.thTextEn}>Total</Text>
            </View>

            {/* 8. الخصم / Disc */}
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thText}>الخصم</Text>
              <Text style={styles.thTextEn}>Disc</Text>
            </View>

            {/* 9. الإجمالي بعد الخصم */}
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thText}>الإجمالي بعد</Text>
              <Text style={styles.thText}>الخصم</Text>
            </View>

            {/* 10. ض.قيمة مضافة VAT% */}
            <View style={[styles.thCell, { width: "5%" }]}>
              <Text style={styles.thText}>ض.قيمة</Text>
              <Text style={styles.thText}>مضافة</Text>
              <Text style={styles.thTextEn}>VAT%</Text>
            </View>

            {/* 11. ض. القيمة المضافة / VAT */}
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thText}>ض. القيمة المضافة</Text>
              <Text style={styles.thTextEn}>VAT</Text>
            </View>

            {/* 12. الصافي / Net (Left-most) */}
            <View style={[styles.thCell, { width: "10%", borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>الصافي</Text>
              <Text style={styles.thTextEn}>Net</Text>
            </View>
          </View>

          {/* Body Rows */}
          {(invoice?.items || []).map((item, index) => {
            const rawSubtotal = Number(item.unitPrice) * Number(item.quantity);
            const discVal = Number(item.discountAmount || 0);
            const afterDisc = rawSubtotal - discVal;
            const vatPct = Math.round(Number(item.vatRate || 0.15) * 100);

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === invoice.items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. م */}
                <View style={[styles.tdCell, { width: "3%" }]}>
                  <Text style={styles.tdCenter}>{index + 1}</Text>
                </View>

                {/* 2. Barcode */}
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdCenter}></Text>
                </View>

                {/* 3. Item */}
                <View style={[styles.tdCell, { width: "23%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdRight}>{item.description}</Text>
                </View>

                {/* 4. Unit */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>حبة</Text>
                </View>

                {/* 5. Quan */}
                <View style={[styles.tdCell, { width: "7%" }]}>
                  <Text style={styles.tdCenter}>{item.quantity}</Text>
                </View>

                {/* 6. Price */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 7. Total */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(rawSubtotal)}</Text>
                </View>

                {/* 8. Disc */}
                <View style={[styles.tdCell, { width: "6%" }]}>
                  <Text style={styles.tdCenter}>{discVal ? formatNumber(discVal) : "0"}</Text>
                </View>

                {/* 9. After Disc */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(afterDisc)}</Text>
                </View>

                {/* 10. VAT% */}
                <View style={[styles.tdCell, { width: "5%" }]}>
                  <Text style={styles.tdCenter}>{vatPct}</Text>
                </View>

                {/* 11. VAT */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.lineVat)}</Text>
                </View>

                {/* 12. Net */}
                <View style={[styles.tdCell, { width: "10%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdCenter}>{formatNumber(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. TOTALS SECTION WITH STACKED BOXES AND TAFQEET ─── */}
        {(() => {
          const discountTotal = (invoice?.items || []).reduce(
            (acc, it) => acc + Number(it.discountAmount || 0),
            0
          );
          const subtotalNum = Number(invoice?.subtotal || 0);
          const afterDiscount = Math.max(0, subtotalNum - discountTotal);

          return (
            <View style={styles.totalsSection}>
              {/* Left Column: Stacked Boxed Numbers with Labels */}
              <View style={styles.totalsStack}>
                {/* Row 1: Total Excluding VAT */}
                <View style={styles.totalBoxRow}>
                  <View style={styles.numberBox}>
                    <Text style={styles.numberBoxText}>{formatNumber(invoice?.subtotal || 0)}</Text>
                  </View>
                  <View style={styles.labelGroup}>
                    <Text style={styles.labelAr}>الإجمالي غير شامل القيمة المضافة</Text>
                    <Text style={styles.labelEn}>Total (Excluding VAT)</Text>
                  </View>
                </View>

                {/* Row 2: Discount */}
                <View style={styles.totalBoxRow}>
                  <View style={styles.numberBox}>
                    <Text style={styles.numberBoxText}>{formatNumber(discountTotal)}</Text>
                  </View>
                  <View style={styles.labelGroup}>
                    <Text style={styles.labelAr}>الخصم</Text>
                    <Text style={styles.labelEn}>Discount</Text>
                  </View>
                </View>

                {/* Row 3: Total After Discount */}
                <View style={styles.totalBoxRow}>
                  <View style={styles.numberBox}>
                    <Text style={styles.numberBoxText}>{formatNumber(afterDiscount)}</Text>
                  </View>
                  <View style={styles.labelGroup}>
                    <Text style={styles.labelAr}>الإجمالي بعد الخصم</Text>
                    <Text style={styles.labelEn}>Total after discount</Text>
                  </View>
                </View>

                {/* Row 4: Total VAT (15%) */}
                <View style={styles.totalBoxRow}>
                  <View style={styles.numberBox}>
                    <Text style={styles.numberBoxText}>{formatNumber(invoice?.vatAmount || 0)}</Text>
                  </View>
                  <View style={styles.labelGroup}>
                    <Text style={styles.labelAr}>إجمالي القيمة المضافة (15%)</Text>
                    <Text style={styles.labelEn}>Total VAT (15%)</Text>
                  </View>
                </View>

                {/* Row 5: Total Amount Due (Including VAT) */}
                <View style={styles.totalBoxRow}>
                  <View style={styles.numberBox}>
                    <Text style={styles.numberBoxText}>{formatNumber(invoice?.total || 0)}</Text>
                  </View>
                  <View style={styles.labelGroup}>
                    <Text style={styles.labelAr}>الصافي شامل القيمة المضافة</Text>
                    <Text style={styles.labelEn}>Total Amount Due (Including VAT)</Text>
                  </View>
                </View>
              </View>

              {/* Right Column: Spelled-Out Arabic Words (Tafqeet) & Notes */}
              <View style={styles.tafqeetColumn}>
                {/* Tafqeet 1 (After discount) */}
                <View style={{ height: 42, justifyContent: "center" }}>
                  <Text style={styles.tafqeetText}>{tafqeet(afterDiscount)}</Text>
                </View>

                {/* Tafqeet 2 (Final Net) */}
                <View style={{ height: 42, justifyContent: "center" }}>
                  <Text style={styles.tafqeetText}>{tafqeet(invoice?.total || 0)}</Text>
                </View>

                {/* Notes Section */}
                <View style={styles.notesWrap}>
                  <Text style={styles.notesTitle}>ملاحظات</Text>
                  {invoice?.notes ? (
                    <Text style={styles.notesBody}>{invoice.notes}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })()}
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
    width: "40%",
    paddingTop: 4,
  },
  logoImage: {
    width: 90,
    height: 45,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameEn: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "left",
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
  companySubLine: {
    fontSize: 8,
    textAlign: "right",
    marginBottom: 1.5,
  },
  companyAddressLine: {
    fontSize: 7.5,
    textAlign: "right",
    marginBottom: 1.5,
  },
  phonesRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 1.5,
  },
  phoneText: {
    fontSize: 7.5,
  },
  companyIdLine: {
    fontSize: 7.5,
    textAlign: "right",
    marginBottom: 1,
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
  barcodeWrap: {
    flexDirection: "row",
    height: 22,
    alignItems: "stretch",
    marginBottom: 4,
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
    paddingVertical: 2,
  },
  invBoxLabelEn: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  invBoxVal: {
    fontSize: 8.5,
    fontWeight: "bold",
  },
  invBoxLabelAr: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  invBoxRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  invBoxSubKey: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  invBoxSubVal: {
    fontSize: 7.5,
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
  },
  cardKeyEn: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "left",
    width: "28%",
  },
  cardValCenter: {
    fontSize: 7,
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
  cardKeyAr: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
    width: "28%",
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
    minHeight: 22,
  },
  tdCell: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdCenter: {
    fontSize: 7,
    textAlign: "center",
  },
  tdRight: {
    fontSize: 7,
    textAlign: "right",
  },

  // ─── 5. Totals & Tafqeet ───
  totalsSection: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  totalsStack: {
    width: "48%",
    flexDirection: "column",
    gap: 2,
  },
  totalBoxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numberBox: {
    width: 85,
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 2.5,
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
    width: "48%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  tafqeetText: {
    fontSize: 7,
    color: "#1E3A8A",
    textAlign: "right",
  },
  notesWrap: {
    marginTop: 10,
    alignItems: "flex-end",
  },
  notesTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 7.5,
    textAlign: "right",
  },
});
