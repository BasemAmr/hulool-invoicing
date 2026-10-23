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

export interface KenanCompanyTemplateProps {
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

interface KenanCompanyExtensions {
  unifiedNumber?: string | null;
}

interface KenanCustomerExtensions {
  crNumber?: string | null;
}

interface KenanItemExtensions {
  productDescription?: string | null;
}

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

/**
 * Format numbers preserving the exact full decimal tail without any rounding
 * or truncation, while adding thousands separators to the integer portion.
 */
function formatExact(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const str = String(val).trim();
  const parts = str.split(".");
  const intPart = parts[0] || "0";
  const intNum = parseInt(intPart, 10);
  const formattedInt = !isNaN(intNum) ? intNum.toLocaleString("en-US") : intPart;
  if (parts.length > 1) {
    return `${formattedInt}.${parts[1]}`;
  }
  return `${formattedInt}.00`;
}

function parseNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : 0;
}

// ─── Arabic Tafqeet (Number to Words) ─────────────────────────────────────────

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

function tafqeetKenan(amount: number): string {
  if (amount <= 0) return "صفر ريال سعودي";
  const intPart = Math.floor(amount);
  const fracPart = Math.round((amount - intPart) * 100);

  const billions = Math.floor(intPart / 1_000_000_000);
  const millions = Math.floor((intPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1_000);
  const units = intPart % 1_000;

  const parts: string[] = [];
  if (billions > 0) {
    parts.push(billions === 1 ? "مليار" : `${convertThreeDigits(billions)} مليار`);
  }
  if (millions > 0) {
    parts.push(millions === 1 ? "مليون" : `${convertThreeDigits(millions)} مليون`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "ألف" : `${convertThreeDigits(thousands)} ألف`);
  }
  if (units > 0) {
    parts.push(convertThreeDigits(units));
  }

  let text = parts.join(" و");
  text = text ? `${text} ريال سعودي` : "";

  if (fracPart > 0) {
    const halalaText = convertThreeDigits(fracPart);
    text = text ? `${text} و${halalaText} هللة` : `${halalaText} هللة`;
  }

  return `فقط ${text} لا غير`;
}

// ─── Kenan Company Template Component ────────────────────────────────────────

export function KenanCompanyTemplate({
  invoice,
  company,
  customer,
  template,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: KenanCompanyTemplateProps) {
  const primary = template.primaryColor || "#064343";
  const accent = template.accentColor || "#0B3C3C";
  const styles = buildKenanStyles(primary, accent);

  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";
  const paperOrientation =
    settings?.paperOrientation === "landscape" ? "landscape" : "portrait";

  const compExt = company as CompanyRecord & KenanCompanyExtensions;
  const custExt = customer as CustomerRecord & KenanCustomerExtensions;

  const totalAmountNumber = parseNumber(invoice.total);
  const spelledTotal = tafqeetKenan(totalAmountNumber);

  const footerText =
    company.footerText?.trim() || "شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا بموجب الشروط";

  return (
    <Document
      title={`فاتورة ${invoice.invoiceNumber || ""}`}
      author={company.nameAr || company.nameEn || undefined}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page
        size={paperSize as any}
        orientation={paperOrientation as any}
        style={styles.page}
      >
        {/* Background Watermark if present */}
        {backgroundDataUrl && (
          <Image src={backgroundDataUrl} style={styles.watermarkImage} />
        )}

        {/* ─── 1. Header Box: Arabic Info (Right), Logo (Center), English Info (Left) ─── */}
        <View style={styles.headerContainer}>
          {/* Left: English Company Info (LTR) */}
          <View style={styles.companyEnBlock}>
            <Text style={styles.companyEnTitle}>
              {company.nameEn || company.nameAr || ""}
            </Text>
            {company.addressStreet && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>Address</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>{company.addressStreet}</Text>
              </View>
            )}
            {company.addressBuildingNumber && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>Building No</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>{company.addressBuildingNumber}</Text>
              </View>
            )}
            {company.addressDistrict && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>Neighborhood</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>{company.addressDistrict}</Text>
              </View>
            )}
            {company.addressPostalCode && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>Postal Code</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>{company.addressPostalCode}</Text>
              </View>
            )}
            {company.vatNumber && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>Tax No</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>{company.vatNumber}</Text>
              </View>
            )}
            {(company.crNumber || compExt.unifiedNumber) && (
              <View style={styles.enRow}>
                <Text style={styles.enLabel}>CR / Unified</Text>
                <Text style={styles.enColon}>:</Text>
                <Text style={styles.enValue}>
                  {company.crNumber || compExt.unifiedNumber}
                </Text>
              </View>
            )}
          </View>

          {/* Center: Company Logo in Pill Badge */}
          <View style={styles.logoCenterBlock}>
            {logoDataUrl ? (
              <View style={styles.logoPill}>
                <Image src={logoDataUrl} style={styles.logoImage} />
              </View>
            ) : null}
          </View>

          {/* Right: Arabic Company Info (RTL) */}
          <View style={styles.companyArBlock}>
            <Text style={styles.companyArTitle}>
              {company.nameAr || company.nameEn || ""}
            </Text>
            {company.addressStreet && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>العنوان</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.addressStreet}</Text>
              </View>
            )}
            {company.addressBuildingNumber && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>رقم المبنى</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.addressBuildingNumber}</Text>
              </View>
            )}
            {company.addressDistrict && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>الحي</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.addressDistrict}</Text>
              </View>
            )}
            {company.addressPostalCode && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>الرمز البريدي</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.addressPostalCode}</Text>
              </View>
            )}
            {company.addressAdditionalNumber && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>الرقم الإضافي</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.addressAdditionalNumber}</Text>
              </View>
            )}
            {company.vatNumber && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>الرقم الضريبي</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>{company.vatNumber}</Text>
              </View>
            )}
            {(company.crNumber || compExt.unifiedNumber) && (
              <View style={styles.arRow}>
                <Text style={styles.arLabel}>السجل / الموحد</Text>
                <Text style={styles.arColon}>:</Text>
                <Text style={styles.arValue}>
                  {company.crNumber || compExt.unifiedNumber}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── 2. Deep Petrol Teal Title Banner ─── */}
        <View style={styles.bannerBar}>
          <Text style={styles.bannerText}>فاتورة ضريبية - Tax Invoice</Text>
        </View>

        {/* ─── 3. Sub-header: Customer Details (Left), ZATCA QR (Center), Invoice Meta (Right) ─── */}
        <View style={styles.subHeaderRow}>
          {/* Left: Customer Card */}
          <View style={styles.customerCard}>
            <View style={styles.metaFieldRow}>
              <Text style={styles.customerLabel}>العميل</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={[styles.customerValue, styles.bold]}>{customer.nameAr}</Text>
            </View>
            {customer.vatNumber && (
              <View style={styles.metaFieldRow}>
                <Text style={styles.customerLabel}>الرقم الضريبي للعميل</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.customerValue}>{customer.vatNumber}</Text>
              </View>
            )}
            {(customer.unifiedNumber || custExt.crNumber) && (
              <View style={styles.metaFieldRow}>
                <Text style={styles.customerLabel}>الرقم الموحد / السجل</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.customerValue}>
                  {customer.unifiedNumber || custExt.crNumber}
                </Text>
              </View>
            )}
            {customer.phone && (
              <View style={styles.metaFieldRow}>
                <Text style={styles.customerLabel}>الموبايل</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.customerValue}>{customer.phone}</Text>
              </View>
            )}
            {(customer.addressStreet || customer.addressCity) && (
              <View style={styles.metaFieldRow}>
                <Text style={styles.customerLabel}>العنوان</Text>
                <Text style={styles.metaColon}>:</Text>
                <Text style={styles.customerValue}>
                  {[customer.addressStreet, customer.addressCity].filter(Boolean).join("، ")}
                </Text>
              </View>
            )}
          </View>

          {/* Center: ZATCA QR Code */}
          <View style={styles.qrContainer}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>مسودة غير معتمدة</Text>
              </View>
            )}
          </View>

          {/* Right: Invoice Metadata */}
          <View style={styles.invoiceMetaCard}>
            <View style={styles.metaFieldRow}>
              <Text style={styles.metaLabel}>رقم الفاتورة</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={[styles.metaValue, styles.bold]}>
                {invoice.invoiceNumber || "DRAFT"}
              </Text>
            </View>
            <View style={styles.metaFieldRow}>
              <Text style={styles.metaLabel}>التاريخ</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{formatDateDisplay(invoice.issueDate)}</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. Items Table (RTL) ─── */}
        <View style={styles.table}>
          {/* Table Header: Total (left) | Unit Price | Qty | Product (right) */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colTotal]}>المجموع</Text>
            <Text style={[styles.th, styles.colPrice]}>سعر الوحدة</Text>
            <Text style={[styles.th, styles.colQty]}>الكمية</Text>
            <Text style={[styles.th, styles.colProduct, styles.noLeftBorder]}>المنتج</Text>
          </View>

          {/* Table Rows */}
          {invoice.items.map((item, idx) => {
            const hasDiscount =
              item.discountAmount &&
              parseNumber(item.discountAmount) > 0;
            const unitPriceNum = parseNumber(item.unitPrice);
            const qtyNum = parseNumber(item.quantity);
            const lineBeforeDisc = unitPriceNum * qtyNum;

            return (
              <View
                key={item.position ?? idx}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowAlt : undefined,
                ]}
                wrap={false}
              >
                {/* Total Column */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={[styles.tdText, styles.bold]}>
                    {formatExact(item.lineTotal)}
                  </Text>
                </View>

                {/* Unit Price Column */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdText}>{formatExact(item.unitPrice)}</Text>
                </View>

                {/* Quantity Column */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdText}>
                    {Number.isInteger(qtyNum) ? String(qtyNum) : formatExact(qtyNum)}
                  </Text>
                </View>

                {/* Product Column */}
                <View style={[styles.tdCell, styles.colProduct, styles.noLeftBorder]}>
                  <Text style={[styles.tdText, styles.productTitle]}>
                    {item.description}
                  </Text>
                  {(item as any).productDescription && (
                    <Text style={styles.productSubDesc}>
                      {(item as any).productDescription}
                    </Text>
                  )}
                  {hasDiscount && (
                    <Text style={styles.discountBadge}>
                      قبل الخصم: {formatExact(lineBeforeDisc)} | الخصم:{" "}
                      {formatExact(item.discountAmount)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 5. Bottom Summary Section (Payments on Left, Totals on Right) ─── */}
        <View style={styles.bottomSection} wrap={false}>
          {/* Left Side: Payment Details Box */}
          <View style={styles.paymentBox}>
            {/* Row 1: Issue Date & Total Amount */}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentDateCell}>
                {formatDateDisplay(invoice.issueDate)}
              </Text>
              <View style={styles.paymentValueCell}>
                <Text style={styles.paymentCurrency}>ريال</Text>
                <Text style={[styles.paymentNumber, styles.bold]}>
                  {formatExact(invoice.total)}
                </Text>
              </View>
            </View>

            {/* Row 2: Paid Total Badge Cell & Value */}
            <View style={styles.paymentRow}>
              <View style={styles.paidHeaderCell}>
                <Text style={styles.paidHeaderText}>إجمالي المدفوع</Text>
              </View>
              <View style={styles.paymentValueCell}>
                <Text style={styles.paymentCurrency}>ريال</Text>
                <Text style={[styles.paymentNumber, styles.bold]}>
                  {formatExact(invoice.total)}
                </Text>
              </View>
            </View>

            {/* Row 3: Remaining / Balance Due = 0.00 */}
            <View style={[styles.paymentRow, styles.paymentRowLast]}>
              <View style={styles.balanceHeaderCell}>
                <Text style={styles.balanceHeaderText}>الرصيد المتبقي</Text>
              </View>
              <View style={styles.paymentValueCell}>
                <Text style={styles.paymentCurrency}>ريال</Text>
                <Text style={styles.paymentNumber}>0.00</Text>
              </View>
            </View>
          </View>

          {/* Right Side: Totals Table */}
          <View style={styles.totalsTable}>
            {/* Row 1: Subtotal Excl. VAT */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabelText}>المجموع:</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsCurrency}>ريال</Text>
                <Text style={[styles.totalsNumber, styles.bold]}>
                  {formatExact(invoice.subtotal)}
                </Text>
              </View>
            </View>

            {/* Row 2: VAT Amount (15%) */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabelText}>الضريبة (ضريبة القيمة المضافة):</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsCurrency}>(+) ريال</Text>
                <Text style={[styles.totalsNumber, styles.bold]}>
                  {formatExact(invoice.vatAmount)}
                </Text>
              </View>
            </View>

            {/* Row 2.5: Invoice Discount */}
            {invoice.discountAmount && parseFloat(invoice.discountAmount) > 0 ? (
              <View style={styles.totalsRow}>
                <View style={styles.totalsLabelCell}>
                  <Text style={styles.totalsLabelText}>خصم الفاتورة:</Text>
                </View>
                <View style={styles.totalsValueCell}>
                  <Text style={styles.totalsCurrency}>(-) ريال</Text>
                  <Text style={[styles.totalsNumber, styles.bold]}>
                    {formatExact(invoice.discountAmount)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Row 3: Grand Total Incl. VAT */}
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabelText}>الاجمالي:</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsCurrency}>ريال</Text>
                <Text style={[styles.totalsNumber, styles.grandTotalNumber]}>
                  {formatExact(invoice.total)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 6. Arabic Tafqeet Row ─── */}
        <View style={styles.tafqeetRow} wrap={false}>
          <Text style={styles.tafqeetText}>{spelledTotal}</Text>
        </View>

        {/* ─── 7. Notes & Terms (if provided) ─── */}
        {(invoice.notes || invoice.terms) && (
          <View style={styles.notesContainer} wrap={false}>
            {invoice.notes && (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>ملاحظات</Text>
                <Text style={styles.noteColon}>:</Text>
                <Text style={styles.noteContent}>{invoice.notes}</Text>
              </View>
            )}
            {invoice.terms && (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>الشروط والأحكام</Text>
                <Text style={styles.noteColon}>:</Text>
                <Text style={styles.noteContent}>{invoice.terms}</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── 8. Custom Footer ─── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Stylesheet Factory ──────────────────────────────────────────────────────

function buildKenanStyles(primary: string, accent: string) {
  return StyleSheet.create({
    page: {
      paddingHorizontal: 25,
      paddingTop: 18,
      paddingBottom: 22,
      fontFamily: "Amiri",
      backgroundColor: "#ffffff",
      fontSize: 8,
      color: "#1e293b",
    },
    watermarkImage: {
      position: "absolute",
      top: "22%",
      left: "15%",
      width: "70%",
      height: "55%",
      opacity: 0.04,
      objectFit: "contain",
    },

    // ─── Header Box ───
    headerContainer: {
      borderWidth: 1.5,
      borderColor: primary,
      borderRadius: 6,
      padding: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 85,
    },
    companyEnBlock: {
      width: "36%",
      alignItems: "flex-start",
    },
    companyEnTitle: {
      fontSize: 10.5,
      fontWeight: "bold",
      color: primary,
      marginBottom: 3,
      textAlign: "left",
    },
    enRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 1,
    },
    enLabel: {
      fontSize: 6.5,
      color: "#475569",
      width: 58,
      textAlign: "left",
    },
    enColon: {
      fontSize: 6.5,
      color: "#475569",
      marginHorizontal: 2,
    },
    enValue: {
      fontSize: 6.5,
      color: "#0f172a",
      textAlign: "left",
    },

    // Center Logo Pill
    logoCenterBlock: {
      width: "24%",
      alignItems: "center",
      justifyContent: "center",
    },
    logoPill: {
      backgroundColor: "#F5F2EB",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#E6E0D4",
      padding: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: 78,
      height: 48,
      objectFit: "contain",
    },

    // Arabic Company Details (Right)
    companyArBlock: {
      width: "38%",
      alignItems: "flex-end",
    },
    companyArTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: primary,
      marginBottom: 3,
      textAlign: "right",
    },
    arRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginTop: 1,
    },
    arLabel: {
      fontSize: 6.8,
      color: "#475569",
      width: 54,
      textAlign: "right",
    },
    arColon: {
      fontSize: 6.8,
      color: "#475569",
      marginHorizontal: 2,
    },
    arValue: {
      fontSize: 6.8,
      color: "#0f172a",
      textAlign: "right",
    },

    // ─── Banner ───
    bannerBar: {
      backgroundColor: primary,
      height: 26,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 6,
    },
    bannerText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },

    // ─── Sub-header ───
    subHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    customerCard: {
      width: "40%",
      alignItems: "flex-start",
    },
    customerLabel: {
      fontSize: 7.5,
      color: "#334155",
      textAlign: "right",
    },
    customerValue: {
      fontSize: 7.5,
      color: "#0f172a",
      textAlign: "right",
    },
    qrContainer: {
      width: "20%",
      alignItems: "center",
      justifyContent: "center",
    },
    qrImage: {
      width: 70,
      height: 70,
    },
    qrPlaceholder: {
      width: 65,
      height: 65,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    qrPlaceholderText: {
      fontSize: 6.5,
      color: "#94a3b8",
      textAlign: "center",
    },
    invoiceMetaCard: {
      width: "36%",
      alignItems: "flex-end",
    },
    metaFieldRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginVertical: 1,
    },
    metaLabel: {
      fontSize: 8.5,
      fontWeight: "bold",
      color: "#0f172a",
      textAlign: "right",
    },
    metaColon: {
      fontSize: 8,
      color: "#475569",
      marginHorizontal: 3,
    },
    metaValue: {
      fontSize: 8.5,
      color: "#0f172a",
      textAlign: "right",
    },

    // ─── Table ───
    table: {
      borderWidth: 1,
      borderColor: primary,
      marginBottom: 8,
    },
    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: primary,
      minHeight: 20,
      alignItems: "center",
    },
    th: {
      color: "#ffffff",
      fontSize: 8,
      fontWeight: "bold",
      textAlign: "center",
      paddingVertical: 3,
      paddingHorizontal: 4,
      borderLeftWidth: 1,
      borderLeftColor: "#ffffff",
    },
    tableRow: {
      flexDirection: "row",
      minHeight: 18,
      borderBottomWidth: 1,
      borderBottomColor: "#cbd5e1",
      alignItems: "center",
    },
    tableRowAlt: {
      backgroundColor: "#f8fafc",
    },
    tdCell: {
      paddingVertical: 3,
      paddingHorizontal: 4,
      borderLeftWidth: 1,
      borderLeftColor: "#cbd5e1",
      justifyContent: "center",
    },
    tdText: {
      fontSize: 7.5,
      color: "#0f172a",
      textAlign: "center",
    },
    productTitle: {
      textAlign: "right",
      fontWeight: "bold",
    },
    productSubDesc: {
      fontSize: 6,
      color: "#64748b",
      textAlign: "right",
      marginTop: 1,
    },
    discountBadge: {
      fontSize: 6,
      color: "#b91c1c",
      textAlign: "right",
      marginTop: 1,
    },
    colProduct: {
      width: "40%",
    },
    colQty: {
      width: "16%",
    },
    colPrice: {
      width: "22%",
    },
    colTotal: {
      width: "22%",
    },
    noLeftBorder: {
      borderLeftWidth: 0,
    },

    // ─── Bottom Section ───
    bottomSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderTopWidth: 1.5,
      borderTopColor: primary,
      paddingTop: 8,
      marginBottom: 6,
    },

    // Left Payments Box
    paymentBox: {
      width: "48%",
      borderWidth: 1,
      borderColor: "#cbd5e1",
    },
    paymentRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#cbd5e1",
      minHeight: 20,
      alignItems: "center",
    },
    paymentRowLast: {
      borderBottomWidth: 0,
    },
    paymentDateCell: {
      width: "45%",
      fontSize: 7.5,
      color: "#0f172a",
      textAlign: "center",
      borderRightWidth: 1,
      borderRightColor: "#cbd5e1",
      paddingVertical: 3,
    },
    paidHeaderCell: {
      width: "45%",
      backgroundColor: primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 3.5,
      borderRightWidth: 1,
      borderRightColor: "#cbd5e1",
    },
    paidHeaderText: {
      color: "#ffffff",
      fontSize: 7.5,
      fontWeight: "bold",
      textAlign: "center",
    },
    balanceHeaderCell: {
      width: "45%",
      backgroundColor: "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 3.5,
      borderRightWidth: 1,
      borderRightColor: "#cbd5e1",
    },
    balanceHeaderText: {
      color: "#475569",
      fontSize: 7,
      fontWeight: "bold",
      textAlign: "center",
    },
    paymentValueCell: {
      width: "55%",
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      gap: 3,
      paddingVertical: 3,
    },
    paymentNumber: {
      fontSize: 8,
      color: "#0f172a",
    },
    paymentCurrency: {
      fontSize: 7,
      color: "#475569",
    },

    // Right Totals Table
    totalsTable: {
      width: "48%",
      borderWidth: 1,
      borderColor: "#cbd5e1",
    },
    totalsRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#cbd5e1",
      minHeight: 20,
      alignItems: "center",
    },
    totalsRowGrand: {
      borderBottomWidth: 0,
    },
    totalsLabelCell: {
      width: "52%",
      backgroundColor: primary,
      paddingVertical: 3.5,
      paddingHorizontal: 4,
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: "#cbd5e1",
    },
    totalsLabelText: {
      color: "#ffffff",
      fontSize: 7.5,
      fontWeight: "bold",
      textAlign: "center",
    },
    totalsValueCell: {
      width: "48%",
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 4,
    },
    totalsNumber: {
      fontSize: 8,
      color: "#0f172a",
    },
    grandTotalNumber: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f172a",
    },
    totalsCurrency: {
      fontSize: 7,
      color: "#475569",
    },

    // ─── Tafqeet ───
    tafqeetRow: {
      borderWidth: 1,
      borderColor: "#e2e8f0",
      backgroundColor: "#f8fafc",
      padding: 4,
      marginBottom: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    tafqeetText: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: primary,
      textAlign: "center",
    },

    // ─── Notes & Terms ───
    notesContainer: {
      borderWidth: 1,
      borderColor: "#e2e8f0",
      padding: 5,
      marginBottom: 6,
      gap: 3,
      backgroundColor: "#ffffff",
    },
    noteBlock: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
    },
    noteTitle: {
      fontSize: 7,
      fontWeight: "bold",
      color: "#334155",
      textAlign: "right",
    },
    noteColon: {
      fontSize: 7,
      color: "#475569",
      marginHorizontal: 3,
    },
    noteContent: {
      fontSize: 7,
      color: "#1e293b",
      textAlign: "right",
      flex: 1,
    },

    // ─── Footer ───
    footer: {
      position: "absolute",
      bottom: 10,
      left: 25,
      right: 25,
      borderTopWidth: 0.5,
      borderTopColor: "#cbd5e1",
      paddingTop: 3,
      alignItems: "center",
    },
    footerText: {
      fontSize: 6.5,
      color: "#64748b",
      textAlign: "center",
    },

    // Common Utilities
    bold: {
      fontWeight: "bold",
    },
  });
}
