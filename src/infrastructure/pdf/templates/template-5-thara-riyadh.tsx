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

export interface Template5TharaRiyadhProps {
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

// ─── Optional extension interfaces (typesafe, falls back safely to empty) ───

interface Template5InvoiceExtensions {
  paymentMethod?: string | null;
  paymentMethodAr?: string | null;
  paymentMethodEn?: string | null;
  branch?: string | null;
  warehouse?: string | null;
  user?: string | null;
  recipient?: string | null;
  printedBy?: string | null;
}

interface Template5ItemExtensions {
  barcode?: string | number | null;
  barCode?: string | number | null;
  itemCode?: string | number | null;
  code?: string | number | null;
  shelf?: string | null;
  rack?: string | null;
  sf?: string | null;
  category?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  unit?: string | null;
  pack?: string | null;
  unitName?: string | null;
  pkQty?: string | number | null;
  packQty?: string | number | null;
}

interface Template5CustomerExtensions {
  customerCode?: string | number | null;
  clientNo?: string | number | null;
  code?: string | number | null;
}

function getInvoiceExt(invoice: InvoiceDto): Template5InvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<Template5InvoiceExtensions>;
  return {
    paymentMethod: rec.paymentMethod ?? null,
    paymentMethodAr: rec.paymentMethodAr ?? null,
    paymentMethodEn: rec.paymentMethodEn ?? null,
    branch: rec.branch ?? null,
    warehouse: rec.warehouse ?? null,
    user: rec.user ?? rec.printedBy ?? null,
    recipient: rec.recipient ?? null,
    printedBy: rec.printedBy ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): Template5ItemExtensions {
  const rec = item as InvoiceItemDto & Partial<Template5ItemExtensions>;
  return {
    barcode: rec.barcode ?? rec.barCode ?? rec.itemCode ?? rec.code ?? null,
    shelf: rec.shelf ?? rec.rack ?? rec.sf ?? rec.category ?? null,
    descriptionAr: rec.descriptionAr ?? null,
    descriptionEn: rec.descriptionEn ?? null,
    unit: rec.unit ?? rec.pack ?? rec.unitName ?? null,
    pkQty: rec.pkQty ?? rec.packQty ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): Template5CustomerExtensions {
  const rec = customer as CustomerRecord & Partial<Template5CustomerExtensions>;
  return {
    customerCode: rec.customerCode ?? rec.clientNo ?? rec.code ?? null,
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

function formatDateSlash(iso: string | null | undefined): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts as [string, string, string];
    return `${y}-${m}-${d}`;
  }
  return datePart;
}

// ─── Arabic tafqeet (number to Arabic words) ───

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
  if (!Number.isFinite(amount) || amount <= 0) return "صفر ريال";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  const groups: string[] = [];
  if (riyals >= 1000000) {
    const millions = Math.floor(riyals / 1000000);
    if (millions === 1) groups.push("مليون");
    else if (millions === 2) groups.push("مليونان");
    else if (millions >= 3 && millions <= 10) groups.push(`${convertThreeDigits(millions)} ملايين`);
    else groups.push(`${convertThreeDigits(millions)} مليون`);
  }
  const rem1 = riyals % 1000000;
  const thousands = Math.floor(rem1 / 1000);
  const rest = rem1 % 1000;
  if (thousands > 0) {
    if (thousands === 1) groups.push("ألف");
    else if (thousands === 2) groups.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) groups.push(`${convertThreeDigits(thousands)} آلاف`);
    else groups.push(`${convertThreeDigits(thousands)} ألف`);
  }
  if (rest > 0) {
    groups.push(convertThreeDigits(rest));
  }

  let text = groups.length > 0 ? groups.join(" و ") : "صفر";
  text += " ريال";
  if (halalas > 0) {
    text += ` و ${convertThreeDigits(halalas)} هللة`;
  }
  return text;
}

const DEFAULT_TERMS: string[] = [
  "1- يجب احضار الفاتورة الأصل .",
  "2- الاسترجاع والاستبدال خلال 7 ايام من تاريخ البيع .",
  "3- التأكد من سلامة البضاعة وصلاحيتها قبل التحميل .",
];

export function Template5TharaRiyadh({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template5TharaRiyadhProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const custExt = getCustomerExt(customer);

  // Dynamic Company Data
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddressAr = [
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressStreet || "",
    company.addressCity || "",
  ].filter(Boolean).join(" - ");

  const companyAddressEn = [
    company.addressDistrict || "",
    company.addressStreet || "",
    company.addressCity || "",
  ].filter(Boolean).join(" - ");

  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";

  // Dynamic Invoice Data
  const invoiceNum = invoice.invoiceNumber ?? "";
  const invoiceDate = formatDateSlash(invoice.issueDate);
  const paymentMethodText =
    invExt.paymentMethodAr ??
    invExt.paymentMethod ??
    (invoice.invoiceType === "simplified" ? "نقدي" : "تحويل بنكي");

  // Dynamic Customer Data
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCode = toText(custExt.customerCode ?? customer.unifiedNumber ?? "");

  // Totals
  const totalAmount = toNumber(invoice.total);
  const totalInWords = tafqeetArabic(totalAmount);

  // Print timestamp
  const now = new Date();
  const printDate = formatDateSlash(now.toISOString());
  const hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = String(hours % 12 || 12).padStart(2, "0");
  const printTimestamp = `${printDate} ${hours12}:${mins}:${secs} ${ampm}`;

  const userName = toText(invExt.user ?? "");
  const recipientName = toText(invExt.recipient ?? "");

  const items = invoice.items ?? [];

  return (
    <Document
      title={`Tax Invoice - ${invoiceNum}`}
      author={companyNameAr || "Company"}
      subject="Tax Invoice"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        <View style={styles.container}>
          {/* ══════════════════════ 1. HEADER (Mirrored Bilingual Header with Central Monogram Logo) ══════════════════════ */}
          <View style={styles.header}>
            {/* Left English Block */}
            <View style={styles.headerLeftCol}>
              <Text style={styles.headerEnTitle}>{companyNameEn}</Text>
              {companyAddressEn ? (
                <Text style={styles.headerEnSub}>{companyAddressEn}</Text>
              ) : null}
              <View style={styles.headerContactRow}>
                <Text style={styles.headerContactLabel}>TeleFax :</Text>
                <Text style={styles.headerContactValue}>{companyPhone}</Text>
              </View>
              <View style={styles.headerContactRow}>
                <Text style={styles.headerContactLabel}>Mobile :</Text>
                <Text style={styles.headerContactValue}>{companyPhone}</Text>
              </View>
              <View style={styles.headerContactRow}>
                <Text style={styles.headerContactLabel}>VAT Reg :</Text>
                <Text style={styles.headerContactValue}>{companyVat}</Text>
              </View>
            </View>

            {/* Center Logo Block */}
            <View style={styles.headerCenterCol}>
              {logoDataUrl ? (
                <Image src={logoDataUrl} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholderCircle}>
                  <Text style={styles.logoPlaceholderText}>TH</Text>
                </View>
              )}
            </View>

            {/* Right Arabic Block */}
            <View style={styles.headerRightCol}>
              <Text style={styles.headerArTitle}>{companyNameAr}</Text>
              {companyAddressAr ? (
                <Text style={styles.headerArSub}>{companyAddressAr}</Text>
              ) : null}
              <View style={styles.headerContactRowAr}>
                <Text style={styles.headerContactLabelAr}>تلفاكس :</Text>
                <Text style={styles.headerContactValueAr}>{companyPhone}</Text>
              </View>
              <View style={styles.headerContactRowAr}>
                <Text style={styles.headerContactLabelAr}>جوال :</Text>
                <Text style={styles.headerContactValueAr}>{companyPhone}</Text>
              </View>
              <View style={styles.headerContactRowAr}>
                <Text style={styles.headerContactLabelAr}>الرقم الضريبي :</Text>
                <Text style={styles.headerContactValueAr}>{companyVat}</Text>
              </View>
            </View>
          </View>

          {/* Top Divider */}
          <View style={styles.headerBottomDivider} />

          {/* ══════════════════════ 2. INFO STRIP (Tax Invoice Title + Metadata) ══════════════════════ */}
          <View style={styles.infoStrip}>
            {/* Left side: Invoice No, Date, Payment Method */}
            <View style={styles.infoLeftBlock}>
              <View style={styles.infoMetaRow}>
                <Text style={styles.infoMetaLabel}>رقم الفاتورة</Text>
                <Text style={styles.infoMetaVal}>{invoiceNum}</Text>
              </View>
              <View style={styles.infoMetaRow}>
                <Text style={styles.infoMetaLabel}>التاريخ</Text>
                <Text style={styles.infoMetaVal}>{invoiceDate}</Text>
              </View>
              <View style={styles.infoMetaRow}>
                <Text style={styles.infoMetaLabel}>طريقة الدفع</Text>
                <Text style={styles.infoMetaVal}>{paymentMethodText}</Text>
              </View>
            </View>

            {/* Center: Bold Title "فاتورة ضريبية" */}
            <View style={styles.infoCenterBlock}>
              <Text style={styles.invoiceTitleText}>فاتورة ضريبية</Text>
            </View>

            {/* Right side: Customer Number, Customer VAT, Customer Name */}
            <View style={styles.infoRightBlock}>
              <View style={styles.infoMetaRowRight}>
                <Text style={styles.infoMetaValRight}>{customerCode}</Text>
                <Text style={styles.infoMetaLabelRight}>العميل</Text>
              </View>
              <View style={styles.infoMetaRowRight}>
                <Text style={styles.infoMetaValRight}>{customerVat}</Text>
                <Text style={styles.infoMetaLabelRight}>الرقم الضريبي للعميل :</Text>
              </View>
              <View style={styles.infoMetaRowRight}>
                <Text style={styles.infoMetaValRight}>{customerName}</Text>
                <Text style={styles.infoMetaLabelRight}>العميل</Text>
              </View>
            </View>
          </View>

          {/* ══════════════════════ 3. PRODUCT TABLE ══════════════════════ */}
          <View style={styles.table}>
            {/* Table Header */}
            {/* RTL order: Amount (left) -> Vat -> Price -> PkQty -> Pack -> Qty -> Description -> sf -> Barcode (right) */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "11%" }]}>
                <Text style={styles.thAr}>الاجمالي</Text>
                <Text style={styles.thEn}>Amount</Text>
              </View>
              <View style={[styles.thCell, { width: "8%" }]}>
                <Text style={styles.thAr}>الضريبة</Text>
                <Text style={styles.thEn}>Vat</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thAr}>السعر</Text>
                <Text style={styles.thEn}>Price</Text>
              </View>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>شد</Text>
                <Text style={styles.thEn}>PkQty</Text>
              </View>
              <View style={[styles.thCell, { width: "7%" }]}>
                <Text style={styles.thAr}>وحدة</Text>
                <Text style={styles.thEn}>Pack</Text>
              </View>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>كمية</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "34%" }]}>
                <Text style={styles.thAr}>البيان</Text>
                <Text style={styles.thEn}>Description</Text>
              </View>
              <View style={[styles.thCell, { width: "5%" }]}>
                <Text style={styles.thAr}>رف</Text>
                <Text style={styles.thEn}>slf</Text>
              </View>
              {/* Highlighted Orange/Peach Barcode Column Header */}
              <View style={[styles.thCell, styles.barcodeCellHeader, { width: "14%", borderRightWidth: 0 }]}>
                <Text style={styles.thAr}>الباركود</Text>
                <Text style={styles.thEn}>Barcode</Text>
              </View>
            </View>

            {/* Table Rows */}
            {items.map((item, idx) => {
              const ext = getItemExt(item);
              const barcode = toText(ext.barcode ?? "");
              const shelf = toText(ext.shelf ?? "");
              const descAr = toText(ext.descriptionAr ?? item.description ?? "");
              const descEn = toText(ext.descriptionEn ?? "");
              const qtyStr = formatQty(item.quantity);
              const packStr = toText(ext.unit ?? "كرتون");
              const pkQtyStr = toText(ext.pkQty ?? "");
              const priceStr = formatNumber(item.unitPrice);
              const vatStr = formatNumber(item.lineVat);
              const amountStr = formatNumber(item.lineTotal);

              return (
                <View key={item.position ?? idx} style={styles.tableRow}>
                  <Text style={[styles.td, { width: "11%" }]}>{amountStr}</Text>
                  <Text style={[styles.td, { width: "8%" }]}>{vatStr}</Text>
                  <Text style={[styles.td, { width: "9%" }]}>{priceStr}</Text>
                  <Text style={[styles.td, { width: "6%" }]}>{pkQtyStr}</Text>
                  <Text style={[styles.td, { width: "7%" }]}>{packStr}</Text>
                  <Text style={[styles.td, { width: "6%", fontWeight: "bold" }]}>{qtyStr}</Text>

                  {/* Dual-language Description */}
                  <View style={[styles.tdDescCell, { width: "34%" }]}>
                    <Text style={styles.tdDescAr}>{descAr}</Text>
                    {descEn ? <Text style={styles.tdDescEn}>{descEn}</Text> : null}
                  </View>

                  <Text style={[styles.td, { width: "5%" }]}>{shelf}</Text>

                  {/* Highlighted Orange/Peach Barcode Data Cell */}
                  <View style={[styles.tdBarcodeCell, { width: "14%", borderRightWidth: 0 }]}>
                    <Text style={styles.barcodeText}>{barcode}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ══════════════════════ 4. TOTALS & TAFQEET BOX ══════════════════════ */}
          <View style={styles.totalsTable}>
            {/* Top Row: Grand Total Number, Total Label, Arabic Tafqeet in Words */}
            <View style={styles.grandTotalRow}>
              <View style={styles.grandTotalValCell}>
                <Text style={styles.grandTotalValText}>{formatNumber(totalAmount)}</Text>
              </View>
              <View style={styles.grandTotalLabelCell}>
                <Text style={styles.grandTotalLabelText}>Total</Text>
                <Text style={styles.grandTotalLabelText}>الاجمالي</Text>
              </View>
              <View style={styles.grandTotalWordsCell}>
                <Text style={styles.grandTotalWordsText}>{totalInWords}</Text>
              </View>
            </View>

            {/* Empty grid rows for receipt acknowledgment / signatures (as seen on scan) */}
            <View style={styles.totalsBlankRow}>
              <View style={styles.totalsBlankColLeft} />
              <View style={styles.totalsBlankColRight} />
            </View>
            <View style={styles.totalsBlankRow}>
              <View style={styles.totalsBlankColLeft} />
              <View style={styles.totalsBlankColRight} />
            </View>
            <View style={[styles.totalsBlankRow, styles.totalsBlankRowBottom]}>
              <View style={styles.totalsBlankColLeft} />
              <View style={styles.totalsBlankColRight} />
            </View>
          </View>

          {/* ══════════════════════ 5. FOOTER SECTION ══════════════════════ */}
          <View style={styles.footerSection}>
            {/* Left: Print Time & User/Recipient Signatures */}
            <View style={styles.footerLeftCol}>
              <View style={styles.printTimeBox}>
                <Text style={styles.printTimeLabel}>وقت الطباعة</Text>
                <Text style={styles.printTimeValue}>{printTimestamp}</Text>
              </View>

              <View style={styles.signaturesRow}>
                {/* User */}
                <View style={styles.signCell}>
                  <Text style={styles.signLabel}>المستخدم</Text>
                  <Text style={styles.signValue}>{userName || " "}</Text>
                </View>
                {/* Recipient */}
                <View style={styles.signCell}>
                  <Text style={styles.signLabel}>المستلم</Text>
                  <Text style={styles.signValue}>{recipientName || " "}</Text>
                  <Text style={styles.signDottedLine}>....................</Text>
                </View>
              </View>
            </View>

            {/* Center: QR Code */}
            <View style={styles.footerCenterCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>QR Code</Text>
                </View>
              )}
            </View>

            {/* Right: Return & Exchange Policy Notes */}
            <View style={styles.footerRightCol}>
              <Text style={styles.policyTitle}>سياسة الاسترجاع والاستبدال :</Text>
              {DEFAULT_TERMS.map((term, i) => (
                <Text key={i} style={styles.policyLine}>
                  {term}
                </Text>
              ))}
            </View>
          </View>

          {/* ══════════════════════ 6. BOTTOM PAGE INDICATOR ══════════════════════ */}
          <View style={styles.pageNumberRow}>
            <Text
              style={styles.pageNumberText}
              render={({ pageNumber, totalPages }) =>
                `الصفحة ${totalPages} من ${pageNumber}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    fontSize: 7.5,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "30%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },
  container: {
    flexDirection: "column",
  },

  // ─── Header ───
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  headerLeftCol: {
    width: "38%",
    alignItems: "flex-start",
  },
  headerEnTitle: {
    fontSize: 10,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "left",
  },
  headerEnSub: {
    fontSize: 7.5,
    color: "#000000",
    marginBottom: 3,
    textAlign: "left",
  },
  headerContactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  headerContactLabel: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    width: 48,
    textAlign: "left",
  },
  headerContactValue: {
    fontSize: 7,
    textAlign: "left",
  },

  // Logo
  headerCenterCol: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 80,
    height: 50,
    objectFit: "contain",
  },
  logoPlaceholderCircle: {
    width: 65,
    height: 45,
    borderRadius: 30,
    borderWidth: 1.25,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: {
    fontSize: 16,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },

  headerRightCol: {
    width: "38%",
    alignItems: "flex-end",
  },
  headerArTitle: {
    fontSize: 10,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  headerArSub: {
    fontSize: 7.5,
    color: "#000000",
    marginBottom: 3,
    textAlign: "right",
  },
  headerContactRowAr: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1,
  },
  headerContactLabelAr: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    width: 58,
    textAlign: "right",
  },
  headerContactValueAr: {
    fontSize: 7,
    textAlign: "right",
  },

  headerBottomDivider: {
    height: 1,
    backgroundColor: "#000000",
    marginBottom: 4,
  },

  // ─── Info Strip ───
  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingVertical: 2,
  },
  infoLeftBlock: {
    width: "33%",
    flexDirection: "column",
  },
  infoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  infoMetaLabel: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginRight: 6,
    width: 55,
    textAlign: "left",
  },
  infoMetaVal: {
    fontSize: 7.5,
    color: "#000000",
  },

  infoCenterBlock: {
    width: "33%",
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceTitleText: {
    fontSize: 12,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
  },

  infoRightBlock: {
    width: "33%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  infoMetaRowRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  infoMetaLabelRight: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginLeft: 6,
    textAlign: "right",
  },
  infoMetaValRight: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },

  // ─── Table ───
  table: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EFEFEF",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    minHeight: 22,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  barcodeCellHeader: {
    backgroundColor: "#FCE7DB", // Soft orange / peach highlight tint
  },
  thAr: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 5.5,
    color: "#000000",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  td: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  tdDescCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    paddingVertical: 1,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdDescAr: {
    fontSize: 6.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  tdDescEn: {
    fontSize: 5.5,
    color: "#333333",
    textAlign: "left",
  },
  tdBarcodeCell: {
    backgroundColor: "#FCE7DB", // Soft peach/orange tint
    borderRightWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  barcodeText: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "center",
  },

  // ─── Totals Table & Tafqeet ───
  totalsTable: {
    borderWidth: 0.75,
    borderColor: "#000000",
    marginBottom: 6,
  },
  grandTotalRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  grandTotalValCell: {
    width: "15%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.75,
    borderRightColor: "#000000",
    paddingVertical: 2,
  },
  grandTotalValText: {
    fontSize: 8,
    fontFamily: "Amiri",
    fontWeight: "bold",
  },
  grandTotalLabelCell: {
    width: "18%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRightWidth: 0.75,
    borderRightColor: "#000000",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  grandTotalLabelText: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
  },
  grandTotalWordsCell: {
    width: "67%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  grandTotalWordsText: {
    fontSize: 7.5,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "center",
  },
  totalsBlankRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 14,
  },
  totalsBlankRowBottom: {
    borderBottomWidth: 0,
    backgroundColor: "#EDEDED",
  },
  totalsBlankColLeft: {
    width: "33%",
    borderRightWidth: 0.75,
    borderRightColor: "#000000",
  },
  totalsBlankColRight: {
    width: "67%",
  },

  // ─── Footer ───
  footerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  footerLeftCol: {
    width: "35%",
    flexDirection: "column",
  },
  printTimeBox: {
    marginBottom: 8,
  },
  printTimeLabel: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    textAlign: "left",
  },
  printTimeValue: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "left",
  },
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  signCell: {
    width: "48%",
    alignItems: "center",
  },
  signLabel: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginBottom: 2,
  },
  signValue: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginBottom: 1,
  },
  signDottedLine: {
    fontSize: 6.5,
    letterSpacing: 1,
    color: "#666666",
  },

  footerCenterCol: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 65,
    height: 65,
  },
  qrPlaceholder: {
    width: 65,
    height: 65,
    borderWidth: 0.5,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 7,
    color: "#666666",
  },

  footerRightCol: {
    width: "40%",
    alignItems: "flex-end",
  },
  policyTitle: {
    fontSize: 7,
    fontFamily: "Amiri",
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "right",
  },
  policyLine: {
    fontSize: 6,
    color: "#000000",
    marginBottom: 1.5,
    textAlign: "right",
  },

  // Page Indicator
  pageNumberRow: {
    alignItems: "flex-start",
    marginTop: 4,
    paddingLeft: 4,
  },
  pageNumberText: {
    fontSize: 7,
    fontFamily: "Amiri",
    color: "#000000",
  },
});
