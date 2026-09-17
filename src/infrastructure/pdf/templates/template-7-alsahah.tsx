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

export interface Template7AlsahahProps {
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

// ─── Scan mapping (Al-Sahah International Trading Co. Ltd - Template 7) ───
// WHY each scan region is handled this way:
// - Top Header:
//   * Left: Logo area (logoDataUrl or stylized Al-Sahah diamond branding with bilingual text).
//   * Center-Right: Company Title in bold Arabic ("شركة الصحاح العالمية للتجارة المحدودة"),
//     English ("AL SAHAH INTERNATIONAL TRADING CO. LTD"), and business description / subtitle.
// - Horizontal Banner Strips:
//   * Top Strip: Left box shows "VAT NO. [Company VAT] الرقم الضريبي", Center box shows "فاتورة ضريبية / Tax Invoice",
//     Right box shows "مبيعات فرع الموسى" / "مركز البيع" (Point of sale).
// - Customer & Metadata Section:
//   * Left Box: QR Code (square, clean, black/white) + Customer Data Table with rows:
//     Customer / العميل, Customer VAT NO. / الرقم الضريبي للعميل, Address / العنوان, Notes / الملاحظات.
//   * Right Box: Grid with bilingual stacked header/value cells:
//     - جهة التسليم / Delivery Destination
//     - رقم العميل / Customer Code
//     - جوال العميل / Customer Mobile
//     - نوع الفاتورة / Invoice Type
//     - تاريخ الفاتورة / Invoice Date
//     - رقم الفاتورة / Invoice No.
// - Product Table (9 columns, bordered, bilingual header cells):
//   1. م / S.NO.
//   2. رقم الصنف / Item NO.
//   3. البيان / Description
//   4. الشد / Pck
//   5. الكمية / Quantity (sub-columns الطرد / الفرط or single net quantity)
//   6. السعر / Price
//   7. الإجمالي / Total
//   8. الضريبة %15 / VAT %15
//   9. الإجمالي مع الضريبة / Total with VAT
// - Table Totals Row (showing total quantity).
// - Bottom Summary & Banking Section:
//   * Left Block:
//     - اسم البائع / Salesperson Name
//     - تاريخ ووقت الطباعة / Print Date & Time
//     - اسم وتوقيع المستلم / Receiver Name & Signature
//   * Middle Block:
//     - حساباتنا البنكية / Banking details (account numbers / IBANs).
//   * Right Block (Stacked Totals):
//     - الإجمالي غير شامل الضريبة / Total excluding VAT
//     - الخصم / Discount
//     - الإجمالي الخاضع للضريبة / Taxable Amount
//     - ضريبة القيمة المضافة 15% / VAT Amount 15%
//     - صافي المبلغ المستحق / Net Amount Due
// - Bottom Brand Footer:
//   * Pagination and brand icons / logos strip.
//   * Side vertical watermark / disclaimer note as seen in scan: "الشركة غير مسؤولة عن النقص وتبديل المكسور خلال يومين من استلام البضاعة".

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(
  val: string | number | null | undefined,
  decimals = 2,
): string {
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

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso: string | null | undefined, timeStr?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return `${iso} ${timeStr || ""}`.trim();
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const hoursFormatted = String(hours).padStart(2, "0");
    return `${year}-${month}-${day} ${hoursFormatted}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return `${iso} ${timeStr || ""}`.trim();
  }
}

function getItemCode(item: InvoiceItemDto, index: number): string {
  const rec = item as InvoiceItemDto & {
    productCode?: string | null;
    code?: string | null;
  };
  const codeCandidate = rec.productCode ?? rec.code;
  if (codeCandidate && String(codeCandidate).trim().length > 0) {
    return String(codeCandidate).trim();
  }
  return String(index + 1);
}

function getItemPackage(item: InvoiceItemDto): string {
  const rec = item as InvoiceItemDto & {
    pack?: string | number | null;
    pck?: string | number | null;
    packageSize?: string | number | null;
    unit?: string | null;
  };
  const val = rec.pack ?? rec.pck ?? rec.packageSize ?? rec.unit;
  return val !== null && val !== undefined ? String(val) : "";
}

export function Template7Alsahah({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: Template7AlsahahProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // Dynamic Company Info
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyVat = company.vatNumber || "";
  const companySub = company.footerText || "";

  // Dynamic Customer Info
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerAddress = [customer.addressCity, customer.addressStreet]
    .filter(Boolean)
    .join(" - ");
  const customerCode =
    (customer as any).customerCode ??
    (customer as any).code ??
    "";
  const customerMobile = customer.phone || "";

  // Dynamic Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const invoiceDate = formatDateOnly(invoice.issueDate);
  const invAny = invoice as any;
  const invoiceTypeAr =
    invAny.paymentMethod === "cash" || !invAny.paymentMethod
      ? "نقدا"
      : invAny.paymentMethod === "credit"
      ? "آجل"
      : invAny.paymentMethod === "bank_transfer"
      ? "تحويل بنكي"
      : "نقدا";
  const invoiceNotes = invoice.notes || "";
  const deliveryDest =
    (invoice as unknown as { deliveryDestination?: string; branchName?: string })
      .deliveryDestination ?? "";
  const branchPos =
    (invoice as unknown as { branchName?: string; posName?: string }).branchName ?? "";

  const printDateTime = formatDateTime(invoice.issueDate, invoice.issueTime);
  const sellerName = invAny.sellerName || invAny.salesman || "";

  // Items processing
  const items = invoice.items ?? [];
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const totalWithoutVat = toNumber(item.lineSubtotal) || qty * unitPrice;
    const vatRate = toNumber(item.vatRate) || 15;
    const vatAmount = toNumber(item.lineVat) || (totalWithoutVat * vatRate) / 100;
    const totalWithVat = toNumber(item.lineTotal) || totalWithoutVat + vatAmount;

    return {
      sNo: idx + 1,
      itemNo: getItemCode(item, idx),
      description: item.description || "",
      pck: getItemPackage(item) || "—",
      qtyFraction: "0",
      qtyPackage: formatQty(qty),
      price: formatNumber(unitPrice),
      total: formatNumber(totalWithoutVat),
      vatPercent: `${vatRate}%`,
      totalWithVat: formatNumber(totalWithVat),
      rawQty: qty,
    };
  });

  const totalQuantitySum = rows.reduce((sum, r) => sum + r.rawQty, 0);

  // Totals calculations
  const subtotal = toNumber(invoice.subtotal);
  const discountTotal = toNumber(invAny.discountTotal ?? 0);
  const taxableAmount = toNumber(invAny.taxableAmount) || subtotal - discountTotal;
  const vatTotal = toNumber(invAny.vatTotal ?? invoice.vatAmount);
  const grandTotal = toNumber(invAny.grandTotal ?? invoice.total) || taxableAmount + vatTotal;

  return (
    <Document
      title={`Tax Invoice - ${invoiceNumber}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER SECTION ─── */}
        <View style={styles.headerContainer}>
          {/* Company Textual Branding (Right side in RTL, left-to-right container) */}
          <View style={styles.headerCompanyInfo}>
            <Text style={styles.companyNameArText}>{companyNameAr}</Text>
            {companyNameEn ? <Text style={styles.companyNameEnText}>{companyNameEn}</Text> : null}
            {companySub ? <Text style={styles.companySubText}>{companySub}</Text> : null}
          </View>

          {/* Logo Unit (Left side with Diamond mark & Text) */}
          <View style={styles.logoUnit}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.fallbackLogoBox}>
                <View style={styles.diamondOuter}>
                  <View style={styles.diamondInner}>
                    <Text style={styles.diamondChar}>S</Text>
                  </View>
                </View>
                <Text style={styles.fallbackLogoAr}>{companyNameAr || "الصحاح"}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── 2. HORIZONTAL STRIPS (VAT / TAX INVOICE / POS) ─── */}
        <View style={styles.bannerRow}>
          {/* Left: VAT NO Box */}
          <View style={styles.vatBox}>
            <Text style={styles.vatText}>
              VAT NO.  {companyVat}  الرقم الضريبي
            </Text>
          </View>

          {/* Center: Tax Invoice Box */}
          <View style={styles.invoiceTitleBox}>
            <Text style={styles.invoiceTitleAr}>فاتورة ضريبية</Text>
            <Text style={styles.invoiceTitleEn}>Tax Invoice</Text>
          </View>

          {/* Right: Point of Sale Box */}
          <View style={styles.posBox}>
            {branchPos ? <Text style={styles.posValue}>{branchPos}</Text> : <Text style={styles.posValue}> </Text>}
            <Text style={styles.posLabel}>مركز البيع</Text>
          </View>
        </View>

        {/* ─── 3. CUSTOMER & METADATA SECTION ─── */}
        <View style={styles.custMetaContainer}>
          {/* Left Block: QR Code + Customer Information Table */}
          <View style={styles.customerBlock}>
            {qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image src={qrDataUrl} style={styles.qrImage} />
              </View>
            ) : (
              <View style={styles.qrPlaceholder} />
            )}

            <View style={styles.customerTable}>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>Customer</Text>
                <Text style={styles.custValue}>{customerName}</Text>
                <Text style={styles.custLabelAr}>العميل</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>Customer VAT NO .</Text>
                <Text style={styles.custValue}>{customerVat}</Text>
                <Text style={styles.custLabelAr}>الرقم الضريبي للعميل</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabelEn}>Address</Text>
                <Text style={styles.custValue}>{customerAddress}</Text>
                <Text style={styles.custLabelAr}>العنوان</Text>
              </View>
              <View style={[styles.custRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.custLabelEn}>Notes</Text>
                <Text style={styles.custValue}>{invoiceNotes}</Text>
                <Text style={styles.custLabelAr}>الملاحظات</Text>
              </View>
            </View>
          </View>

          {/* Right Block: 6-Cell Metadata Grid */}
          <View style={styles.metaGridBlock}>
            {/* Top Row: Delivery Destination / Customer Code / Customer Mobile */}
            <View style={styles.metaGridRow}>
              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>جهة التسليم</Text>
                  <Text style={styles.metaHeaderEn}>Delivery Destination</Text>
                </View>
                <Text style={styles.metaValueText}>{deliveryDest}</Text>
              </View>

              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>رقم العميل</Text>
                  <Text style={styles.metaHeaderEn}>Customer Code</Text>
                </View>
                <Text style={styles.metaValueText}>{customerCode}</Text>
              </View>

              <View style={[styles.metaCell, { borderRightWidth: 0 }]}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>جوال العميل</Text>
                  <Text style={styles.metaHeaderEn}>Customer Mobile</Text>
                </View>
                <Text style={styles.metaValueText}>{customerMobile}</Text>
              </View>
            </View>

            {/* Bottom Row: Invoice Type / Invoice Date / Invoice No */}
            <View style={[styles.metaGridRow, { borderBottomWidth: 0 }]}>
              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>نوع الفاتورة</Text>
                  <Text style={styles.metaHeaderEn}>Invoice Type</Text>
                </View>
                <Text style={styles.metaValueText}>{invoiceTypeAr}</Text>
              </View>

              <View style={styles.metaCell}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>تاريخ الفاتورة</Text>
                  <Text style={styles.metaHeaderEn}>Invoice Date</Text>
                </View>
                <Text style={styles.metaValueText}>{invoiceDate}</Text>
              </View>

              <View style={[styles.metaCell, { borderRightWidth: 0 }]}>
                <View style={styles.metaHeaderWrap}>
                  <Text style={styles.metaHeaderAr}>رقم الفاتورة</Text>
                  <Text style={styles.metaHeaderEn}>Invoice No.</Text>
                </View>
                <Text style={styles.metaValueTextBold}>{invoiceNumber}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 4. PRODUCTS DATA TABLE ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "4%" }]}>
              <Text style={styles.thAr}>م</Text>
              <Text style={styles.thEn}>S.NO.</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>رقم الصنف</Text>
              <Text style={styles.thEn}>Item NO.</Text>
            </View>
            <View style={[styles.thCell, { width: "31%" }]}>
              <Text style={styles.thAr}>البيان</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "5%" }]}>
              <Text style={styles.thAr}>الشد</Text>
              <Text style={styles.thEn}>Pck</Text>
            </View>
            <View style={[styles.thCell, { width: "9%", paddingHorizontal: 0 }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
              <View style={styles.qtySubHeaderRow}>
                <Text style={[styles.qtySubHeaderText, { borderRightWidth: 0.5, borderRightColor: "#000000" }]}>
                  الفرط
                </Text>
                <Text style={styles.qtySubHeaderText}>الطرد</Text>
              </View>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thAr}>السعر</Text>
              <Text style={styles.thEn}>Price</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الإجمالي</Text>
              <Text style={styles.thEn}>Total</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>% 15 VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "14%", borderRightWidth: 0 }]}>
              <Text style={styles.thAr}>الإجمالي مع الضريبة</Text>
              <Text style={styles.thEn}>Total with VAT</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0, justifyContent: "center" }]}>
                <Text style={[styles.tdText, { textAlign: "center", color: "#666666" }]}>
                  لا توجد عناصر مسجلة بالفاتورة
                </Text>
              </View>
            </View>
          ) : (
            rows.map((r, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "4%" }]}>
                  <Text style={styles.tdTextCenter}>{r.sNo}</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdTextCenter}>{r.itemNo}</Text>
                </View>
                <View style={[styles.tdCell, { width: "31%", alignItems: "flex-end", paddingRight: 4 }]}>
                  <Text style={styles.tdTextRight}>{r.description}</Text>
                </View>
                <View style={[styles.tdCell, { width: "5%" }]}>
                  <Text style={styles.tdTextCenter}>{r.pck}</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%", flexDirection: "row", paddingHorizontal: 0 }]}>
                  <Text style={[styles.tdTextCenter, { width: "50%", borderRightWidth: 0.5, borderRightColor: "#000000" }]}>
                    {r.qtyFraction}
                  </Text>
                  <Text style={[styles.tdTextCenter, { width: "50%" }]}>
                    {r.qtyPackage}
                  </Text>
                </View>
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdTextCenter}>{r.price}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{r.total}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>{r.vatPercent}</Text>
                </View>
                <View style={[styles.tdCell, { width: "14%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdTextCenterBold}>{r.totalWithVat}</Text>
                </View>
              </View>
            ))
          )}

          {/* Table Summary Line for Qty */}
          <View style={styles.tableSummaryRow}>
            <View style={[styles.tdCell, { width: "44%", borderRightWidth: 0 }]}>
              <Text style={styles.tdText}></Text>
            </View>
            <View style={[styles.tdCell, { width: "5%" }]}>
              <Text style={styles.tdText}></Text>
            </View>
            <View style={[styles.tdCell, { width: "9%", flexDirection: "row", paddingHorizontal: 0 }]}>
              <Text style={[styles.tdTextCenterBold, { width: "50%", borderRightWidth: 0.5, borderRightColor: "#000000" }]}>
                0
              </Text>
              <Text style={[styles.tdTextCenterBold, { width: "50%" }]}>
                {formatQty(totalQuantitySum)}
              </Text>
            </View>
            <View style={[styles.tdCell, { width: "42%", borderRightWidth: 0 }]} />
          </View>
        </View>

        {/* ─── 5. SUMMARY SECTION ─── */}
        <View style={styles.bottomSection}>
          {/* Left Block: Seller, Print Date/Time, Signatures */}
          <View style={styles.leftInfoBlock}>
            <View style={styles.sellerRow}>
              <Text style={styles.bottomLabel}>اسم البائع</Text>
              <Text style={styles.sellerNameVal}>{sellerName}</Text>
            </View>

            <View style={styles.printTimeRow}>
              <Text style={styles.bottomLabel}>تاريخ ووقت الطباعة</Text>
              <Text style={styles.printTimeVal}>{printDateTime}</Text>
            </View>

            <View style={styles.receiverSignRow}>
              <Text style={styles.bottomLabel}>اسم وتوقيع المستلم</Text>
              {signatureDataUrl ? (
                <Image src={signatureDataUrl} style={styles.signatureImg} />
              ) : (
                <View style={styles.signatureEmptyArea} />
              )}
            </View>
          </View>

          {/* Right Block: Stacked Totals Box */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(subtotal)}</Text>
              <Text style={styles.totalLbl}>الإجمالي غير شامل الضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(discountTotal)}</Text>
              <Text style={styles.totalLbl}>الخصم</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(taxableAmount)}</Text>
              <Text style={styles.totalLbl}>الإجمالي الخاضع للضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(vatTotal)}</Text>
              <Text style={styles.totalLbl}>ضريبة القيمة المضافة 15%</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalVal}>{formatNumber(grandTotal)}</Text>
              <Text style={styles.grandTotalLbl}>صافي المبلغ المستحق</Text>
            </View>
          </View>
        </View>

        {/* ─── 6. FOOTER ─── */}
        <View style={styles.footerContainer}>
          <View style={styles.pageNumberRow}>
            <Text style={styles.pageNumberText}>1 / 1</Text>
          </View>
        </View>

        {/* Right Edge Disclaimer */}
        <View style={styles.sideDisclaimerWrap}>
          <Text style={styles.sideDisclaimerText}>
            الشركة غير مسؤولة عن النقص وتبديل المكسور خلال يومين من استلام البضاعة
          </Text>
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
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    fontSize: 7.5,
    color: "#000000",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
  },

  // 1. Header
  headerContainer: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  headerCompanyInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 10,
  },
  companyNameArText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    marginBottom: 2,
  },
  companyNameEnText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  companySubText: {
    fontSize: 7.5,
    color: "#111827",
    textAlign: "right",
  },
  logoUnit: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 85,
    height: 55,
    objectFit: "contain",
  },
  fallbackLogoBox: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E3A8A",
    borderRadius: 4,
    padding: 4,
    width: 80,
  },
  diamondOuter: {
    width: 22,
    height: 22,
    backgroundColor: "#1E3A8A",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  diamondInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  diamondChar: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  fallbackLogoAr: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  fallbackLogoEn: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1E3A8A",
  },

  // 2. Banner Row
  bannerRow: {
    flexDirection: "row",
    height: 22,
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  vatBox: {
    width: "42%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 4,
  },
  vatText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  invoiceTitleBox: {
    width: "26%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    backgroundColor: "#F3F4F6",
  },
  invoiceTitleAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  invoiceTitleEn: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  posBox: {
    width: "32%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 8,
  },
  posValue: {
    fontSize: 8,
    color: "#000000",
  },
  posLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },

  // 3. Customer & Metadata Container
  custMetaContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
    minHeight: 70,
  },
  customerBlock: {
    width: "55%",
    flexDirection: "row",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  qrWrapper: {
    width: 65,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  qrImage: {
    width: 58,
    height: 58,
  },
  qrPlaceholder: {
    width: 65,
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  customerTable: {
    flex: 1,
  },
  custRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    alignItems: "center",
    height: 17.5,
    paddingHorizontal: 4,
  },
  custLabelEn: {
    width: "35%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  custValue: {
    width: "40%",
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  custLabelAr: {
    width: "25%",
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // Metadata Grid Block
  metaGridBlock: {
    width: "45%",
  },
  metaGridRow: {
    flexDirection: "row",
    height: 35,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
  },
  metaCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    padding: 1,
  },
  metaCellHeaderAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  metaCellHeaderEn: {
    fontSize: 5.5,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 2,
  },
  metaCellValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  // Aliases used by the metadata grid JSX above (kept separate for readability:
  // header wrapper + stacked bilingual header + value). Values mirror
  // metaCellHeaderAr/En + metaCellValue so the grid stays consistent.
  metaHeaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  metaHeaderAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  metaHeaderEn: {
    fontSize: 5.5,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 2,
  },
  metaValueText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  metaValueTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // 4. Main Table
  tableContainer: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 22,
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5.5,
    color: "#374151",
    textAlign: "center",
  },
  subThRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    marginTop: 1,
  },
  subThText: {
    width: "50%",
    fontSize: 5,
    textAlign: "center",
  },
  // Aliases used by the Quantity sub-header JSX (الطرد / الفرط). Mirror
  // subThRow/subThText so the split header renders identically.
  qtySubHeaderRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    marginTop: 1,
  },
  qtySubHeaderText: {
    width: "50%",
    fontSize: 5,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 16,
    alignItems: "center",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    justifyContent: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    height: "100%",
  },
  tdText: {
    fontSize: 7,
    color: "#000000",
  },
  tdTextCenter: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdTextCenterBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tdTextRight: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },
  tableSummaryRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    height: 16,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },

  // 5. Summary & Banking Section
  bottomSection: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 4,
    height: 80,
  },
  leftInfoBlock: {
    width: "28%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 4,
    justifyContent: "space-between",
  },
  sellerRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingBottom: 2,
  },
  sellerNameVal: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 1,
  },
  printTimeRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingBottom: 2,
  },
  printTimeVal: {
    fontSize: 6,
    textAlign: "center",
    marginTop: 1,
  },
  receiverSignRow: {
    paddingTop: 1,
  },
  bottomLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111827",
  },
  signatureImg: {
    height: 20,
    width: 60,
    alignSelf: "center",
  },
  signatureEmptyArea: {
    height: 18,
  },

  // Bank block
  bankBlock: {
    width: "37%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  bankHeader: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    backgroundColor: "#F9FAFB",
    paddingVertical: 2,
    alignItems: "center",
  },
  bankHeaderText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  bankHeaderSub: {
    fontSize: 6,
    color: "#374151",
  },
  bankList: {
    flex: 1,
  },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  bankIban: {
    fontSize: 5.5,
    fontFamily: "Helvetica",
    color: "#000000",
  },
  bankName: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
  },

  // Totals block
  totalsBlock: {
    width: "35%",
    justifyContent: "space-around",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    height: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
  },
  totalLbl: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },
  totalVal: {
    fontSize: 7.5,
    color: "#000000",
    fontFamily: "Helvetica",
  },
  grandTotalRow: {
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 0,
  },
  grandTotalLbl: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
  },
  grandTotalVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    fontFamily: "Helvetica",
  },

  // 6. Footer & Brands
  footerContainer: {
    alignItems: "center",
    marginTop: 2,
  },
  pageNumberRow: {
    marginBottom: 4,
  },
  pageNumberText: {
    fontSize: 7.5,
    color: "#374151",
    fontWeight: "bold",
  },
  brandsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  brandPill: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    borderRadius: 2,
    backgroundColor: "#F9FAFB",
  },
  brandPillText: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#374151",
  },
  brandPillRed: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
    backgroundColor: "#7F1D1D",
  },
  brandPillRedText: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  brandPillBlue: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
    backgroundColor: "#2563EB",
  },
  brandPillBlueText: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  brandPillNavy: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
    backgroundColor: "#1E3A8A",
  },
  brandPillNavyText: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  // Side disclaimer
  sideDisclaimerWrap: {
    position: "absolute",
    right: 4,
    top: "35%",
  },
  sideDisclaimerText: {
    fontSize: 5,
    color: "#6B7280",
  },
});
