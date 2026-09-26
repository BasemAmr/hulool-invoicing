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

export interface CyanSalesTemplateProps {
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

// ─── Tafqeet (Arabic Number to Words) ───
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
    if (rem < 10) res += ONES[rem];
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
  const riyals = Math.floor(Math.abs(num));
  const halalas = Math.round((Math.abs(num) - riyals) * 100);

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  text += " لا غير";
  return text;
}

/**
 * Format monetary amount with exact decimal representation — NEVER floor, ceiling, or round.
 * Preserves the exact raw decimal tail and formats integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : `${formattedInt}.00`;
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

export function CyanSalesTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: CyanSalesTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const issueDateStr = formatDate(invoice.issueDate);

  // ─── Company Details ───
  const companyNameAr = company.nameAr || "";
  const companyPhone1 = company.phone || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";
  const companyVatNo = company.vatNumber || "";
  const companyCrn = company.crNumber || "";
  const companyAddressParts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
  ].filter(Boolean);
  const companyAddressHeader = companyAddressParts.join(" - ");

  // ─── Customer Details ───
  const customerNameAr = customer.nameAr || customer.nameEn || "عميل عام";
  const customerPhone = customer.phone || "";
  const customerAddress = [
    customer.addressAdditionalNumber ? `الرقم الإضافي: ${customer.addressAdditionalNumber}` : "",
    customer.addressPostalCode ? `الرمز البريدي: ${customer.addressPostalCode}` : "",
    customer.addressStreet || "",
    customer.addressBuildingNumber ? `مبنى: ${customer.addressBuildingNumber}` : "",
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : "",
    customer.addressCity || "",
  ]
    .filter(Boolean)
    .join(" - ");
  const customerVatNo = customer.vatNumber || "";
  const customerCrn = customer.unifiedNumber || "";

  // ─── Items & Calculations ───
  const items = invoice.items || [];
  const discountVal =
    (invoice as any).discountTotal ??
    items.reduce((s, it) => s + Number(it.discountAmount || 0), 0);

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

  const tafqeetText = Number(totalVal) > 0 ? tafqeet(totalVal) : "";

  // ─── Dynamic Single-Page Height Calculation ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 842;
  const itemRowHeight = 22;
  const extraItemsCount = Math.max(0, items.length - 6);
  let extraHeight = extraItemsCount * itemRowHeight;
  if (invoice.notes) extraHeight += 20 + Math.min(invoice.notes.split("\n").length, 4) * 10;
  if (invoice.terms) extraHeight += 20 + Math.min(invoice.terms.split("\n").length, 4) * 10;
  if (company.footerText) extraHeight += 18;

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="فاتورة ضريبية - Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={[pageWidth, dynamicHeight]} orientation="portrait" style={styles.page}>
        {/* Background Watermark */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP CYAN HEADER BANNER ─── */}
        <View style={styles.topCyanBanner}>
          {/* Top Sub-row: Contacts on Left | Clean Logo & Identifiers on Right */}
          <View style={styles.bannerTopSubRow}>
            {/* Contacts */}
            <View style={styles.bannerContactsWrap}>
              {companyPhone1 ? (
                <View style={styles.contactItemRow}>
                  <Text style={styles.contactIconText}>☎</Text>
                  <Text style={styles.contactValBoldText}>{companyPhone1}</Text>
                </View>
              ) : null}

              {companyEmail || companyWebsite ? (
                <View style={styles.contactItemRow}>
                  <Text style={styles.contactIconText}>✉</Text>
                  <View style={styles.contactStack}>
                    {companyEmail ? (
                      <Text style={styles.contactValBoldText}>{companyEmail}</Text>
                    ) : null}
                    {companyWebsite ? (
                      <Text style={styles.contactValBoldText}>{companyWebsite}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {companyAddressHeader ? (
                <View style={styles.contactItemRow}>
                  <Text style={styles.contactIconText}>⌂</Text>
                  <Text style={styles.contactValBoldText}>{companyAddressHeader}</Text>
                </View>
              ) : null}
            </View>

            {/* Logo directly without white box + Company Tax IDs */}
            <View style={styles.bannerLogoCol}>
              {logoDataUrl ? (
                <Image src={logoDataUrl} style={styles.logoImageDirect} />
              ) : (
                <Text style={styles.companyNameBannerBold}>{companyNameAr}</Text>
              )}

              {companyVatNo ? (
                <View style={styles.bannerMetaRow}>
                  <Text style={styles.bannerMetaLabel}>الرقم الضريبي</Text>
                  <Text style={styles.bannerMetaColon}>:</Text>
                  <Text style={styles.bannerMetaVal}>{companyVatNo}</Text>
                </View>
              ) : null}

              {companyCrn ? (
                <View style={styles.bannerMetaRow}>
                  <Text style={styles.bannerMetaLabel}>السجل التجاري</Text>
                  <Text style={styles.bannerMetaColon}>:</Text>
                  <Text style={styles.bannerMetaVal}>{companyCrn}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Main Content: Two Balanced Columns (Left: Invoice Title & Meta | Right: Customer Info) */}
          <View style={styles.bannerMainRow}>
            {/* Left Column: Title & Dates */}
            <View style={styles.bannerInvoiceInfoCol}>
              <Text style={styles.invoiceTitleText}>فاتورة ضريبية</Text>

              <View style={styles.bannerMetaRow}>
                <Text style={styles.bannerMetaLabel}>التاريخ</Text>
                <Text style={styles.bannerMetaColon}>:</Text>
                <Text style={styles.bannerMetaVal}>{issueDateStr}</Text>
              </View>

              <View style={styles.bannerMetaRow}>
                <Text style={styles.bannerMetaLabel}>رقم الفاتورة</Text>
                <Text style={styles.bannerMetaColon}>:</Text>
                <Text style={styles.bannerMetaVal}>{invoiceNum}</Text>
              </View>
            </View>

            {/* Right Column: Customer Information */}
            <View style={styles.bannerCustomerCol}>
              <Text style={styles.customerSubheaderText}>فاتورة للعميل</Text>
              <Text style={styles.customerNameBoldText}>{customerNameAr}</Text>

              {customerPhone ? (
                <Text style={styles.customerDetailBoldText}>{customerPhone}</Text>
              ) : null}

              {customerAddress ? (
                <Text style={styles.customerDetailBoldText}>{customerAddress}</Text>
              ) : (
                <Text style={styles.customerDetailBoldText}>المملكة العربية السعودية</Text>
              )}

              {customerVatNo ? (
                <View style={styles.bannerMetaRow}>
                  <Text style={styles.bannerMetaLabel}>الرقم الضريبي</Text>
                  <Text style={styles.bannerMetaColon}>:</Text>
                  <Text style={styles.bannerMetaVal}>{customerVatNo}</Text>
                </View>
              ) : null}

              {customerCrn ? (
                <View style={styles.bannerMetaRow}>
                  <Text style={styles.bannerMetaLabel}>السجل / الموحد</Text>
                  <Text style={styles.bannerMetaColon}>:</Text>
                  <Text style={styles.bannerMetaVal}>{customerCrn}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── 2. ITEMS TABLE (HIGH CONTRAST BLACK HEADER) ─── */}
        <View style={styles.tableContainer}>
          {/* Solid Black Header Bar */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "5%" }]}>
              <Text style={styles.thTextBold}>م</Text>
            </View>
            <View style={[styles.thCell, { width: "37%" }]}>
              <Text style={styles.thTextBold}>صنف / البيان</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextBold}>الكمية</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thTextBold}>السعر</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextBold}>الخصم</Text>
            </View>
            <View style={[styles.thCell, { width: "8%" }]}>
              <Text style={styles.thTextBold}>الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thTextBold}>مبلغ الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "10%", borderRightWidth: 0 }]}>
              <Text style={styles.thTextBold}>الإجمالي</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          {items.map((item: InvoiceItemDto, idx: number) => {
            const qty = item.quantity;
            const price = item.unitPrice;
            const lineDisc = item.discountAmount || (item as any).discount || 0;
            const rawLineTotal = Number(price || 0) * Number(qty || 0);
            const discountedLineTotal =
              Number(lineDisc) > 0
                ? Math.max(0, rawLineTotal - Number(lineDisc))
                : item.lineSubtotal ?? rawLineTotal;
            const lineVat = item.lineVat || 0;
            const lineTotal = item.lineTotal || 0;
            const vatRateStr =
              item.vatRate !== undefined && item.vatRate !== null
                ? `${Number(item.vatRate)}%`
                : "15%";

            return (
              <View
                key={item.position ?? idx}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowEven : {},
                  idx === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* Index */}
                <View style={[styles.tdCell, { width: "5%" }]}>
                  <Text style={styles.tdCenterBold}>{idx + 1}</Text>
                </View>

                {/* Description */}
                <View style={[styles.tdCell, { width: "37%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdRightBold}>{item.description}</Text>
                </View>

                {/* Quantity */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenterBold}>{formatExactAmount(qty)}</Text>
                </View>

                {/* Price */}
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdCenterBold}>{formatExactAmount(price)}</Text>
                  {Number(lineDisc) > 0 ? (
                    <View style={styles.beforeAfterBlock}>
                      <Text style={styles.beforeAfterText}>
                        قبل: {formatExactAmount(rawLineTotal)}
                      </Text>
                      <Text style={styles.beforeAfterText}>
                        بعد: {formatExactAmount(discountedLineTotal)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Discount */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdCenterBold}>
                    {Number(lineDisc) > 0 ? formatExactAmount(lineDisc) : ".00"}
                  </Text>
                </View>

                {/* VAT Rate */}
                <View style={[styles.tdCell, { width: "8%" }]}>
                  <Text style={styles.tdCenterBold}>{vatRateStr}</Text>
                </View>

                {/* VAT Amount */}
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdCenterBold}>{formatExactAmount(lineVat)}</Text>
                </View>

                {/* Total Line Amount */}
                <View style={[styles.tdCell, { width: "10%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdRightHeavyBold}>{formatExactAmount(lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 3. TOTALS & SETTLEMENT (NO CASHIER) ─── */}
        <View style={styles.bottomSectionContainer}>
          {/* Left Column: Totals Breakdown & Cyan Box */}
          <View style={styles.leftTotalsCol}>
            {/* Subtotal */}
            <View style={styles.summaryItemRow}>
              <Text style={styles.summaryValBold}>{formatExactAmount(grossSubtotal)}</Text>
              <Text style={styles.summaryLabelBold}>الإجمالي :</Text>
            </View>

            {/* Discount */}
            <View style={styles.summaryItemRow}>
              <Text style={styles.summaryValBold}>{formatExactAmount(discountVal)}</Text>
              <Text style={styles.summaryLabelBold}>الالخصم :</Text>
            </View>

            {/* VAT */}
            <View style={styles.summaryItemRow}>
              <Text style={styles.summaryValBold}>{formatExactAmount(vatVal)}</Text>
              <Text style={styles.summaryLabelBold}>الضريبة :</Text>
            </View>

            {/* Cyan Required Total Box */}
            <View style={styles.cyanRequiredBox}>
              <Text style={styles.cyanRequiredVal}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.cyanRequiredLabel}>المطلوب :</Text>
            </View>

            {/* Return Policy Notice & Notes */}
            <View style={styles.policyNoticeWrap}>
              <Text style={styles.policyNoticeText}>
                البضاعة المباعة تسترد خلال 14 يوم من تاريخ الشراء إذا كانت في حالتها الأصلية.
              </Text>
              {invoice.notes ? (
                <Text style={styles.customNotesText}>ملاحظات: {invoice.notes}</Text>
              ) : null}
              {invoice.terms ? (
                <Text style={styles.customNotesText}>الشروط: {invoice.terms}</Text>
              ) : null}
            </View>
          </View>

          {/* Center Column: ZATCA Compliant QR Code */}
          <View style={styles.centerQrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrCodeImage} />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
            <Text style={styles.qrCaptionBold}>رمز التحقق الضريبي ZATCA</Text>
          </View>

          {/* Right Column: Settlement Summary (Paid & Due, No Cashier) */}
          <View style={styles.rightSettlementCol}>
            <Text style={styles.settlementHeaderTitle}>تفاصيل الدفع</Text>

            {/* Paid Amount */}
            <View style={styles.settlementDataRow}>
              <Text style={styles.settlementValBold}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.settlementCurrencyText}>ريال سعودي</Text>
              <Text style={styles.settlementLabelBold}>المبلغ المدفوع :</Text>
            </View>

            {/* Dark Line Divider */}
            <View style={styles.settlementDividerLine} />

            {/* Total Amount Due */}
            <View style={styles.settlementDataRow}>
              <Text style={styles.settlementValHeavyBold}>{formatExactAmount(totalVal)}</Text>
              <Text style={styles.settlementCurrencyText}>ريال سعودي</Text>
              <Text style={styles.settlementLabelBold}>الإجمالي المستحق :</Text>
            </View>

            {/* Balance Due (0.00) */}
            <View style={styles.settlementDataRow}>
              <Text style={styles.settlementValBold}>.00</Text>
              <Text style={styles.settlementCurrencyText}>ريال سعودي</Text>
              <Text style={styles.settlementLabelBold}>الباقي :</Text>
            </View>

            {/* Spelled-Out Tafqeet in Arabic Words */}
            {tafqeetText ? (
              <Text style={styles.tafqeetInlineBold}>{tafqeetText}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── 4. BOTTOM FOOTER STRIP ─── */}
        <View style={styles.footerContainer}>
          <View style={styles.footerCyanBar} />
          <View style={styles.footerInfoRow}>
            <Text style={styles.footerBrandBold}>
              {company.footerText || companyWebsite || companyNameAr}
            </Text>
            <Text
              style={styles.pageNumberBold}
              render={({ pageNumber, totalPages }) => `صفحة ${pageNumber} من ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "32%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── 1. Top Cyan Header ───
  topCyanBanner: {
    backgroundColor: "#24A7CC",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 16,
    width: "100%",
  },
  bannerTopSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  bannerContactsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contactIconText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  contactStack: {
    flexDirection: "column",
  },
  contactValBoldText: {
    fontSize: 7.5,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  bannerLogoCol: {
    alignItems: "flex-end",
  },
  logoImageDirect: {
    maxHeight: 38,
    maxWidth: 120,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameBannerBold: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 2,
  },

  // BiDi Middle-Colon Meta Rows
  bannerMetaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 2,
  },
  bannerMetaLabel: {
    fontSize: 8,
    color: "#E0F2FE",
    fontWeight: "bold",
  },
  bannerMetaColon: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginHorizontal: 2,
  },
  bannerMetaVal: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  // Main Banner (2 Columns)
  bannerMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bannerInvoiceInfoCol: {
    width: "48%",
    alignItems: "flex-start",
  },
  invoiceTitleText: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "left",
  },
  bannerCustomerCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  customerSubheaderText: {
    fontSize: 8,
    color: "#E0F2FE",
    fontWeight: "bold",
    marginBottom: 2,
  },
  customerNameBoldText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 2,
  },
  customerDetailBoldText: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 1,
  },

  // ─── 2. Table Section ───
  tableContainer: {
    paddingHorizontal: 22,
    marginTop: 8,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#000000",
    minHeight: 24,
    alignItems: "center",
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#334155",
    paddingVertical: 3.5,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextBold: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    minHeight: 22,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#F8FAFC",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#E2E8F0",
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdCenterBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  tdRightBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  tdRightHeavyBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  beforeAfterBlock: {
    marginTop: 1,
  },
  beforeAfterText: {
    fontSize: 5.8,
    color: "#64748B",
    fontWeight: "bold",
    textAlign: "center",
  },

  // ─── 3. Totals & Settlement ───
  bottomSectionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 22,
    marginTop: 8,
    gap: 12,
  },
  leftTotalsCol: {
    width: "36%",
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  summaryLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "right",
  },
  summaryValBold: {
    fontSize: 8.2,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "left",
  },
  cyanRequiredBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#24A7CC",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 5,
    marginBottom: 8,
  },
  cyanRequiredLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  cyanRequiredVal: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  policyNoticeWrap: {
    marginTop: 4,
  },
  policyNoticeText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "right",
    lineHeight: 1.35,
  },
  customNotesText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "right",
    marginTop: 2,
  },

  // Center QR
  centerQrCol: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  qrCodeImage: {
    width: 125,
    height: 125,
  },
  qrCodePlaceholder: {
    width: 125,
    height: 125,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  qrCaptionBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },

  // Right Settlement
  rightSettlementCol: {
    width: "35%",
    alignItems: "flex-end",
  },
  settlementHeaderTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 6,
    textAlign: "right",
  },
  settlementDataRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 2,
    width: "100%",
    justifyContent: "flex-start",
  },
  settlementLabelBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },
  settlementCurrencyText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#64748B",
    marginHorizontal: 3,
  },
  settlementValBold: {
    fontSize: 8.2,
    fontWeight: "bold",
    color: "#0F172A",
  },
  settlementValHeavyBold: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
  },
  settlementDividerLine: {
    width: "100%",
    height: 1.5,
    backgroundColor: "#000000",
    marginVertical: 4,
  },
  tafqeetInlineBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 5,
    textAlign: "right",
    lineHeight: 1.4,
  },

  // ─── 4. Bottom Footer ───
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
  footerCyanBar: {
    height: 4,
    backgroundColor: "#24A7CC",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    width: "100%",
  },
  footerInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 4,
  },
  footerBrandBold: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#64748B",
  },
  pageNumberBold: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#64748B",
  },
});