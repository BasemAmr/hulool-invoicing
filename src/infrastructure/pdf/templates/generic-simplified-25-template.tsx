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

export interface GenericSimplified25TemplateProps {
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

// ─── Helpers ───

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/**
 * Strict date formatting: DD/MM/YYYY only — NO hours/time/HHMMSS.
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

/**
 * Monetary formatting without rounding or truncation:
 * Preserves raw exact decimal tails while adding thousands commas to integer part.
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
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

// ─── Arabic Words (Tafqeet) ───
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

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

  let text = "فقط " + numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " لا غير";
}

export function GenericSimplified25Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: GenericSimplified25TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Company & Supplier Values ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyLogo = logoDataUrl || company.logoUrl;

  const companyAddressParts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : null,
    company.addressStreet,
    company.addressDistrict ? `حي ${company.addressDistrict}` : null,
    company.addressCity,
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : null,
    company.addressAdditionalNumber ? `الرقم الإضافي ${company.addressAdditionalNumber}` : null,
    "المملكة العربية السعودية",
  ].filter(Boolean);
  const companyAddress = companyAddressParts.join(" - ");

  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || (company as any).unifiedNumber || "";

  // ─── Document Values ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate || invoice.issuedAt);
  const currencyText = invoice.currency || "SAR";

  // ─── Customer Values ───
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerNameEn = customer.nameEn || "";
  const customerVat = customer.vatNumber || "";
  const customerCrOrUnified = customer.unifiedNumber || (customer as any).crNumber || "";

  const customerAddressParts = [
    customer.addressAdditionalNumber ? `الرقم الإضافي ${customer.addressAdditionalNumber}` : null,
    customer.addressPostalCode ? `الرمز البريدي ${customer.addressPostalCode}` : null,
    customer.addressStreet,
    customer.addressBuildingNumber ? `مبنى ${customer.addressBuildingNumber}` : null,
    customer.addressDistrict ? `حي ${customer.addressDistrict}` : null,
    customer.addressCity,
  ].filter(Boolean);
  const customerAddress = customerAddressParts.join(" - ");

  const customerPhone = customer.phone || "";
  const customerEmail = customer.email || "";
  const customerContacts = [
    customerPhone ? `هاتف: ${customerPhone}` : null,
    customerEmail ? `بريد: ${customerEmail}` : null,
  ].filter(Boolean).join(" | ");

  // ─── Items & Calculations ───
  const items = invoice.items ?? [];
  let sumQty = 0;
  let grossTotalCalc = 0;
  let discountTotalCalc = 0;
  let taxableTotalCalc = 0;
  let vatTotalCalc = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const rawLineGross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, rawLineGross - lineDiscount);
    const vatRate = toNumber(item.vatRate ?? 15);
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    sumQty += qty;
    grossTotalCalc += rawLineGross;
    discountTotalCalc += lineDiscount;
    taxableTotalCalc += taxableSubtotal;
    vatTotalCalc += lineVat;

    return {
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      rawLineGross,
      lineDiscount,
      taxableSubtotal,
      vatRate,
      lineVat,
      lineTotal,
    };
  });

  const invoiceSubtotal = toNumber(invoice.subtotal);
  const invoiceVat = toNumber(invoice.vatAmount);
  const invoiceTotal = toNumber(invoice.total);

  const finalGross = grossTotalCalc > 0 ? grossTotalCalc : invoiceSubtotal;
  const finalDiscount = discountTotalCalc;
  const finalTaxable = taxableTotalCalc > 0 ? taxableTotalCalc : invoiceSubtotal;
  const finalVat = vatTotalCalc > 0 ? vatTotalCalc : invoiceVat;
  const finalTotal =
    invoiceTotal > 0 ? invoiceTotal : finalTaxable + finalVat;

  const tafqeetText = tafqeet(finalTotal);

  // ─── Extra Notes & Terms ───
  const footerNote = toText(company.footerText ?? "");
  const invoiceNotes = toText(invoice.notes ?? "");
  const invoiceTerms = toText(invoice.terms ?? "");

  // ─── Dynamic Height Guarantee (Strict Single-Page Rule) ───
  const basePageHeight = paperSize === "LETTER" ? 792 : 841.89;
  const pageWidth = paperSize === "LETTER" ? 612 : 595.28;
  const extraItemsCount = Math.max(0, items.length - 4);
  let extraContentHeight = extraItemsCount * 24;

  if (invoiceNotes) {
    extraContentHeight += 20 + Math.min(invoiceNotes.split("\n").length, 4) * 8;
  }
  if (invoiceTerms) {
    extraContentHeight += 20 + Math.min(invoiceTerms.split("\n").length, 4) * 8;
  }
  if (footerNote) {
    extraContentHeight += 20;
  }
  if (finalDiscount > 0) {
    extraContentHeight += 16;
  }

  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight);
  const dynamicPageSize = [pageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${docNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Outer thin black rounded frame ─── */}
        <View style={styles.frame}>
          {/* ─── Header: QR Code (Left) / Center Logo / Company Info (Right) ─── */}
          <View style={styles.headerRow}>
            {/* Left: ZATCA 2D QR Code */}
            <View style={styles.headerLeft}>
              {qrDataUrl ? (
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </View>
              ) : null}
            </View>

            {/* Center: Conditional Logo (NO dummy box/placeholder) */}
            <View style={styles.headerCenter}>
              {companyLogo ? (
                <Image src={companyLogo} style={styles.logoImg} />
              ) : null}
            </View>

            {/* Right: Company Info */}
            <View style={styles.headerRight}>
              {companyNameAr ? (
                <Text style={styles.companyTitle}>{companyNameAr}</Text>
              ) : null}
              {companyNameEn ? (
                <Text style={styles.companyTitleEn}>{companyNameEn}</Text>
              ) : null}
              {companyAddress ? (
                <Text style={styles.headerSub}>{companyAddress}</Text>
              ) : null}
              {companyVat ? (
                <View style={styles.bidiHeaderRow}>
                  <Text style={styles.bidiHeaderLbl}>الرقم الضريبي VAT No</Text>
                  <Text style={styles.bidiHeaderColon}>:</Text>
                  <Text style={styles.bidiHeaderVal}>{companyVat}</Text>
                </View>
              ) : null}
              {companyCr ? (
                <View style={styles.bidiHeaderRow}>
                  <Text style={styles.bidiHeaderLbl}>السجل التجاري / الرقم الموحد CR</Text>
                  <Text style={styles.bidiHeaderColon}>:</Text>
                  <Text style={styles.bidiHeaderVal}>{companyCr}</Text>
                </View>
              ) : null}
              {companyPhone ? (
                <View style={styles.bidiHeaderRow}>
                  <Text style={styles.bidiHeaderLbl}>الهاتف Phone</Text>
                  <Text style={styles.bidiHeaderColon}>:</Text>
                  <Text style={styles.bidiHeaderVal}>{companyPhone}</Text>
                </View>
              ) : null}
              {companyEmail ? (
                <View style={styles.bidiHeaderRow}>
                  <Text style={styles.bidiHeaderLbl}>البريد Email</Text>
                  <Text style={styles.bidiHeaderColon}>:</Text>
                  <Text style={styles.bidiHeaderVal}>{companyEmail}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ─── Centered underlined bilingual title: Clear Tax Invoice Title ─── */}
          <View style={styles.titleWrap}>
            <Text style={styles.docTitle}>
              فاتورة ضريبية / TAX INVOICE
            </Text>
          </View>

          {/* ─── Info grid: Customer & Invoice Metadata ─── */}
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>اسم العميل Customer Name</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoVal}>
                    {customerName}
                    {customerNameEn && customerNameEn !== customerName ? ` / ${customerNameEn}` : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>رقم الفاتورة Invoice No</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={[styles.infoVal, { fontWeight: "bold" }]}>{docNo}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>الرقم الضريبي للعميل VAT No</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoVal}>{customerVat || "—"}</Text>
                </View>
              </View>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>تاريخ الإصدار Date</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoVal}>{issueDateStr}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>السجل / الرقم الموحد CR / Unified</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoVal}>{customerCrOrUnified || "—"}</Text>
                </View>
              </View>
              <View style={styles.infoCell}>
                <View style={styles.bidiRow}>
                  <Text style={styles.infoLabel}>العنوان الوطني Address</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoVal}>{customerAddress || "—"}</Text>
                </View>
              </View>
            </View>

            {customerContacts ? (
              <View style={styles.infoRow}>
                <View style={[styles.infoCell, { width: "100%" }]}>
                  <View style={styles.bidiRow}>
                    <Text style={styles.infoLabel}>بيانات التواصل Phone & Email</Text>
                    <Text style={styles.infoColon}>:</Text>
                    <Text style={styles.infoVal}>{customerContacts}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {/* ─── Items Table (Black header, thin grid, NO Unit column) ─── */}
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thMain}>م</Text>
                <Text style={styles.thSub}>#</Text>
              </View>
              <View style={[styles.thCell, { width: "38%" }]}>
                <Text style={styles.thMain}>الوصف</Text>
                <Text style={styles.thSub}>Description</Text>
              </View>
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thMain}>الكمية</Text>
                <Text style={styles.thSub}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "14%" }]}>
                <Text style={styles.thMain}>سعر الوحدة</Text>
                <Text style={styles.thSub}>Unit Price</Text>
              </View>
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thMain}>الخصم</Text>
                <Text style={styles.thSub}>Discount</Text>
              </View>
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thMain}>الضريبة</Text>
                <Text style={styles.thSub}>VAT</Text>
              </View>
              <View style={[styles.thCell, { width: "12%", borderRightWidth: 0 }]}>
                <Text style={styles.thMain}>المجموع</Text>
                <Text style={styles.thSub}>Total</Text>
              </View>
            </View>

            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdDesc}>لا توجد أصناف / No items</Text>
                </View>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.index} style={styles.tableRow}>
                  <View style={[styles.tdCell, { width: "6%" }]}>
                    <Text style={styles.tdNum}>{row.index}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.tdDescCell, { width: "38%" }]}>
                    <Text style={styles.tdDesc}>{row.desc}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    <Text style={styles.tdNum}>{formatQty(row.qty)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "14%" }]}>
                    <Text style={styles.tdNum}>{formatExactAmount(row.unitPrice)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    {row.lineDiscount > 0 ? (
                      <View style={{ alignItems: "center" }}>
                        <Text style={styles.tdNum}>{formatExactAmount(row.lineDiscount)}</Text>
                        <View style={styles.discBadge}>
                          <Text style={styles.discBadgeText}>خصم</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.tdNum}>0.00</Text>
                    )}
                  </View>
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    <Text style={styles.tdNum}>{formatExactAmount(row.lineVat)}</Text>
                    <Text style={styles.tdSubRate}>({row.vatRate}%)</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "12%", borderRightWidth: 0 }]}>
                    <Text style={[styles.tdNum, { fontWeight: "bold" }]}>
                      {formatExactAmount(row.lineTotal)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ─── Footer: Tafqeet Amount in Words (Left) / 7-Row Summary (Right) ─── */}
          <View style={styles.footerRow}>
            {/* Left: Arabic Spelled-out Words (Tafqeet) */}
            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>
                المبلغ المستحق كتابة Amount in Words :
              </Text>
              <Text style={styles.wordsVal}>{tafqeetText}</Text>
            </View>

            {/* Right: Comprehensive Summary */}
            <View style={styles.summaryBox}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>إجمالي المبلغ قبل الخصم Gross Total</Text>
                <Text style={styles.sumVal}>{formatExactAmount(finalGross)} {currencyText}</Text>
              </View>

              {finalDiscount > 0 ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>مجموع الخصومات Total Discount</Text>
                  <Text style={[styles.sumVal, { color: "#991B1B" }]}>
                    -{formatExactAmount(finalDiscount)} {currencyText}
                  </Text>
                </View>
              ) : null}

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>الإجمالي الخاضع للضريبة Taxable Amount</Text>
                <Text style={styles.sumVal}>{formatExactAmount(finalTaxable)} {currencyText}</Text>
              </View>

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>ضريبة القيمة المضافة VAT (15%)</Text>
                <Text style={styles.sumVal}>{formatExactAmount(finalVat)} {currencyText}</Text>
              </View>

              <View style={[styles.sumRow, styles.sumGrandRow]}>
                <Text style={styles.sumGrandLabel}>المجموع الكلي شامل الضريبة Total Incl. VAT</Text>
                <Text style={styles.sumGrandVal}>{formatExactAmount(finalTotal)} {currencyText}</Text>
              </View>

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>المبلغ المدفوع Paid Amount</Text>
                <Text style={styles.sumVal}>{formatExactAmount(finalTotal)} {currencyText}</Text>
              </View>

              <View style={[styles.sumRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.sumLabel}>المبلغ المتبقي Balance Due</Text>
                <Text style={styles.sumVal}>0.00 {currencyText}</Text>
              </View>
            </View>
          </View>

          {/* ─── Notes & Terms Section ─── */}
          {invoiceNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>ملاحظات الفاتورة / Notes :</Text>
              <Text style={styles.notesText}>{invoiceNotes}</Text>
            </View>
          ) : null}

          {invoiceTerms ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>الشروط والأحكام / Terms & Conditions :</Text>
              <Text style={styles.notesText}>{invoiceTerms}</Text>
            </View>
          ) : null}

          {/* ─── Company Footer Text ─── */}
          {footerNote ? (
            <Text style={styles.footerNote}>{footerNote}</Text>
          ) : null}
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
    paddingHorizontal: 18,
    fontSize: 7.5,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },
  // ─── Outer thin black rounded frame ───
  frame: {
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerLeft: {
    width: "25%",
    alignItems: "flex-start",
  },
  headerCenter: {
    width: "20%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    maxHeight: 50,
    maxWidth: 90,
    objectFit: "contain",
  },
  headerRight: {
    width: "55%",
    alignItems: "flex-end",
  },
  companyTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  companyTitleEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
    width: "100%",
    marginBottom: 1,
  },
  headerSub: {
    fontSize: 7,
    color: "#333333",
    textAlign: "right",
    width: "100%",
    lineHeight: 1.2,
    marginBottom: 1,
  },
  bidiHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1,
  },
  bidiHeaderLbl: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111111",
  },
  bidiHeaderColon: {
    fontSize: 6.5,
    marginHorizontal: 2,
    color: "#111111",
  },
  bidiHeaderVal: {
    fontSize: 6.5,
    color: "#222222",
  },
  qrBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    padding: 3,
  },
  qrImage: {
    width: 102,
    height: 102,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginVertical: 4,
  },
  // ─── Centered Title ───
  titleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  // ─── Info grid ───
  infoGrid: {
    borderWidth: 0.75,
    borderColor: "#000000",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 6,
    backgroundColor: "#FAFAFA",
  },
  infoRow: {
    flexDirection: "row",
    minHeight: 14,
    alignItems: "center",
  },
  infoCell: {
    width: "50%",
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  bidiRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
  },
  infoColon: {
    fontSize: 6.5,
    marginHorizontal: 2,
    color: "#000000",
  },
  infoVal: {
    fontSize: 7,
    color: "#111111",
  },
  // ─── Items table (black header, thin gray grid) ───
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#000000",
    minHeight: 22,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 1,
  },
  thMain: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  thSub: {
    fontSize: 5.5,
    color: "#D1D5DB",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    minHeight: 16,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#999999",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 2,
  },
  tdDescCell: {
    alignItems: "flex-start",
  },
  tdNum: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },
  tdSubRate: {
    fontSize: 5,
    color: "#4B5563",
  },
  tdDesc: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "left",
  },
  discBadge: {
    backgroundColor: "#F3E8FF",
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    marginTop: 0.5,
  },
  discBadgeText: {
    fontSize: 5,
    fontWeight: "bold",
    color: "#7E22CE",
  },
  // ─── Footer ───
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  wordsBox: {
    width: "48%",
    borderWidth: 0.75,
    borderColor: "#000000",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#F9FAFB",
  },
  wordsLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
    marginBottom: 2,
  },
  wordsVal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
  },
  summaryBox: {
    width: "52%",
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 3,
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignItems: "center",
  },
  sumGrandRow: {
    backgroundColor: "#F3F4F6",
    borderTopWidth: 0.75,
    borderTopColor: "#000000",
  },
  sumLabel: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "left",
  },
  sumVal: {
    fontSize: 6.5,
    color: "#000000",
    textAlign: "right",
  },
  sumGrandLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  sumGrandVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // ─── Extra Elements ───
  notesBox: {
    borderWidth: 0.5,
    borderColor: "#999999",
    borderRadius: 2,
    backgroundColor: "#F9FAFB",
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginTop: 4,
  },
  notesTitle: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 6,
    color: "#374151",
  },
  footerNote: {
    fontSize: 6,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 4,
  },
});
