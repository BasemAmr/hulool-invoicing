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

// ─── Utility Helpers ───
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

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

function formatQty(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const clean = iso.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return clean;
}

function formatCompanyAddress(company: CompanyRecord): string {
  const parts = [
    "المملكة العربية السعودية",
    company.addressCity ? `${company.addressCity}` : "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressStreet ? `شارع ${company.addressStreet}` : "",
    company.addressBuildingNumber ? `رقم المبنى ${company.addressBuildingNumber}` : "",
    company.addressAdditionalNumber ? `الرقم الفرعي ${company.addressAdditionalNumber}` : "",
    company.addressPostalCode ? `الرمز البريدي ${company.addressPostalCode}` : "",
  ].filter((p): p is string => Boolean(p && p.trim().length > 0));
  return parts.join(" - ");
}

export interface Template13QasserLauraProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl: string | null;
  signatureDataUrl?: string | null;
}

export function Template13QasserLaura({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template13QasserLauraProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const invoiceNum = invoice.invoiceNumber ?? "3940";
  const issueDateStr = formatDateOnly(invoice.issueDate);
  const logoSource = logoDataUrl || company.logoUrl;

  const customerAddress = [
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" - ");

  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;
  let totalQty = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal = Math.max(0, gross - lineDiscount);

    const vatRate =
      item.vatRate !== undefined && item.vatRate !== null ? toNumber(item.vatRate) : 15;
    const lineVat =
      item.lineVat !== undefined && item.lineVat !== null
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatRate / 100);
    const lineTotal =
      item.lineTotal !== undefined && item.lineTotal !== null
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;
    totalQty += qty;

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      qty,
      unitPrice,
      gross,
      lineDiscount,
      taxableSubtotal,
      vatRate,
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

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : taxableAmount + totalVat;

  const totalDiscount = computedDiscount;

  // Single-page height dynamic calculation
  const itemsCount = rows.length;
  const extraItemsCount = Math.max(0, itemsCount - 5);
  let extraContentHeight = extraItemsCount * 22;
  if (invoice.notes) {
    extraContentHeight += 16 + Math.min(invoice.notes.split("\n").length, 4) * 8;
  }
  if (invoice.terms) {
    extraContentHeight += 16 + Math.min(invoice.terms.split("\n").length, 4) * 8;
  }
  if (company.footerText) {
    extraContentHeight += 14;
  }

  // Generous buffer to prevent ever spilling onto a 2nd blank page
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraContentHeight) + 80;
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  const defaultTerms = [
    "١- يتم إرجاع واستبدال البضاعة خلال شهر من تاريخ الفاتورة.",
    "٢- يجب على العميل فحص البضاعة والتأكد من سلامتها والشركة غير مسؤولة عن النقص والكسر بعد تسليم البضاعة للعميل.",
    "٣- تنتهي مسؤولية الشركة بتوصيل البضاعة إلى شركة الشحن وشركة الشحن هي المسؤولة عن البضاعة لحين وصولها للعميل.",
  ];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr}
      subject="فاتورة ضريبية / Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* Inner Printable Document Area */}
        <View style={styles.documentBody}>
          {/* ─── 1. TOP HEADER ─── */}
          <View style={styles.headerRow} wrap={false}>
            {/* Start / Right: Arabic Company Name in Red */}
            <View style={styles.headerRightCol}>
              <Text style={styles.companyNameArRed}>{company.nameAr}</Text>
            </View>

            {/* Second / Left: English Company Name in Red */}
            <View style={styles.headerLeftCol}>
              {company.nameEn ? (
                <Text style={styles.companyNameEnRed}>{company.nameEn}</Text>
              ) : null}
            </View>
          </View>

          {/* ─── 2. SUBHEADER METADATA ROW ─── */}
          <View style={styles.subHeaderGrid} wrap={false}>
            {/* QR Code Box on Left */}
            <View style={styles.qrCodeBox}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : null}
            </View>

            {/* Middle: Logo & Title فاتورة ضريبية (compacted lower in place of notes) */}
            <View style={styles.centerTitleBox}>
              {logoSource ? (
                <Image src={logoSource} style={styles.companyLogo} />
              ) : null}
              <View style={styles.taxCapsuleBadge}>
                <Text style={styles.taxCapsuleText}>فاتورة ضريبية</Text>
              </View>
            </View>

            {/* Right: Invoice Metadata Box (Type, No, Date, Representative) */}
            <View style={styles.metaTableBox}>
              {/* Row 1: Invoice Type */}
              <View style={styles.metaTableRow}>
                <View style={styles.metaValCell}>
                  <Text style={styles.metaValText}>مبيعات</Text>
                </View>
                <View style={styles.metaLabelCell}>
                  <Text style={styles.metaLabelText}>نوع الفاتورة</Text>
                </View>
              </View>

              {/* Row 2: Invoice No */}
              <View style={styles.metaTableRow}>
                <View style={styles.metaValCell}>
                  <Text style={styles.metaValTextBold}>{invoiceNum}</Text>
                </View>
                <View style={styles.metaLabelCell}>
                  <Text style={styles.metaLabelText}>رقم الفاتورة</Text>
                </View>
              </View>

              {/* Row 3: Issue Date */}
              <View style={styles.metaTableRow}>
                <View style={styles.metaValCell}>
                  <Text style={styles.metaValText}>{issueDateStr}</Text>
                </View>
                <View style={styles.metaLabelCell}>
                  <Text style={styles.metaLabelText}>تاريخ الفاتورة</Text>
                </View>
              </View>

              {/* Row 4: Salesman / Representative (Left empty as required) */}
              <View style={[styles.metaTableRow, { borderBottomWidth: 0 }]}>
                <View style={styles.metaValCell}>
                  <Text style={styles.metaValText}></Text>
                </View>
                <View style={styles.metaLabelCell}>
                  <Text style={styles.metaLabelText}>المندوب</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── 3. SUPPLIER & CUSTOMER INFORMATION CARDS ─── */}
          <View style={styles.partiesContainer} wrap={false}>
            {/* Customer Box (Left in RTL layout) */}
            <View style={styles.partyBox}>
              <View style={styles.partyHeader}>
                <Text style={styles.partyHeaderText}>بيانات العميل</Text>
              </View>
              {/* Customer Name */}
              <View style={styles.partyRow}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyValBold}>{customer.nameAr || customer.nameEn || "-"}</Text>
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>الاسم</Text>
                </View>
              </View>
              {/* Customer VAT Number */}
              <View style={styles.partyRow}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyValNumber}>{customer.vatNumber || "-"}</Text>
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>الرقم الضريبي</Text>
                </View>
              </View>
              {/* Customer Address */}
              <View style={[styles.partyRow, { borderBottomWidth: 0, minHeight: 38 }]}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyAddressText}>
                    {customerAddress || "-"}
                  </Text>
                  {customer.phone ? (
                    <Text style={styles.partyAddressSub}>{customer.phone}</Text>
                  ) : null}
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>العنوان</Text>
                </View>
              </View>
            </View>

            {/* Supplier Box (Right in RTL layout) */}
            <View style={styles.partyBox}>
              <View style={styles.partyHeader}>
                <Text style={styles.partyHeaderText}>بيانات المورد</Text>
              </View>
              {/* Supplier Name */}
              <View style={styles.partyRow}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyValBold}>{company.nameAr || ""}</Text>
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>الاسم</Text>
                </View>
              </View>
              {/* Supplier VAT Number */}
              <View style={styles.partyRow}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyValNumber}>{company.vatNumber || ""}</Text>
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>الرقم الضريبي</Text>
                </View>
              </View>
              {/* Supplier Address */}
              <View style={[styles.partyRow, { borderBottomWidth: 0, minHeight: 38 }]}>
                <View style={styles.partyValCell}>
                  <Text style={styles.partyAddressText}>{formatCompanyAddress(company)}</Text>
                </View>
                <View style={styles.partyLabelCell}>
                  <Text style={styles.partyLabelText}>العنوان</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── 3.5 CONDITIONAL COMPACT NOTES ─── */}
          {invoice.notes && invoice.notes.trim() ? (
            <View style={styles.compactNotesBox} wrap={false}>
              <Text style={styles.compactNotesLabel}>ملاحظات:</Text>
              <Text style={styles.compactNotesText}>{invoice.notes.trim()}</Text>
            </View>
          ) : null}

          {/* ─── 4. ITEMS TABLE (RTL 9-COLUMN GRID) ─── */}
          <View style={styles.tableContainer} wrap={false}>
            {/* Header Row */}
            <View style={styles.tableHeaderRow}>
              {/* رقم المادة */}
              <View style={[styles.thCell, styles.colCode]}>
                <Text style={styles.thText}>رقم المادة</Text>
              </View>
              {/* اسم المادة */}
              <View style={[styles.thCell, styles.colDesc]}>
                <Text style={styles.thText}>اسم المادة</Text>
              </View>
              {/* الوحدة */}
              <View style={[styles.thCell, styles.colUnit]}>
                <Text style={styles.thText}>الوحدة</Text>
              </View>
              {/* الكمية */}
              <View style={[styles.thCell, styles.colQty]}>
                <Text style={styles.thText}>الكمية</Text>
              </View>
              {/* سعر الوحدة قبل الضريبة */}
              <View style={[styles.thCell, styles.colPrice]}>
                <Text style={styles.thText}>سعرالوحدة قبل الضريبة</Text>
              </View>
              {/* الإجمالي قبل الضريبة */}
              <View style={[styles.thCell, styles.colSubtotal]}>
                <Text style={styles.thText}>الإجمالي قبل الضريبة</Text>
              </View>
              {/* قيمة الخصومات */}
              <View style={[styles.thCell, styles.colDiscount]}>
                <Text style={styles.thText}>قيمة الخصومات</Text>
              </View>
              {/* نسبة الضريبة */}
              <View style={[styles.thCell, styles.colVatRate]}>
                <Text style={styles.thText}>نسبة الضريبة</Text>
              </View>
              {/* قيمة الضريبة */}
              <View style={[styles.thCell, styles.colVatAmount]}>
                <Text style={styles.thText}>قيمة الضريبة</Text>
              </View>
              {/* الإجمالي شامل الضريبة */}
              <View style={[styles.thCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                <Text style={styles.thText}>الإجمالي شامل الضريبة</Text>
              </View>
            </View>

            {/* Data Rows */}
            {rows.map((row, idx) => (
              <View key={row.key} style={styles.tableDataRow}>
                {/* رقم المادة */}
                <View style={[styles.tdCell, styles.colCode]}>
                  <Text style={styles.tdTextCenter}>{row.index}</Text>
                </View>
                {/* اسم المادة */}
                <View style={[styles.tdCell, styles.colDesc]}>
                  <Text style={styles.tdTextRight}>{row.desc}</Text>
                </View>
                {/* الوحدة */}
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.tdTextCenter}>قطعة</Text>
                </View>
                {/* الكمية */}
                <View style={[styles.tdCell, styles.colQty]}>
                  <Text style={styles.tdTextCenter}>{formatQty(row.qty)}</Text>
                </View>
                {/* سعر الوحدة قبل الضريبة */}
                <View style={[styles.tdCell, styles.colPrice]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(row.unitPrice)}</Text>
                </View>
                {/* الإجمالي قبل الضريبة */}
                <View style={[styles.tdCell, styles.colSubtotal]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(row.taxableSubtotal)}</Text>
                </View>
                {/* قيمة الخصومات */}
                <View style={[styles.tdCell, styles.colDiscount]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(row.lineDiscount)}</Text>
                </View>
                {/* نسبة الضريبة */}
                <View style={[styles.tdCell, styles.colVatRate]}>
                  <Text style={styles.tdTextCenter}>%{row.vatRate}</Text>
                </View>
                {/* قيمة الضريبة */}
                <View style={[styles.tdCell, styles.colVatAmount]}>
                  <Text style={styles.tdTextCenter}>{formatExactAmount(row.lineVat)}</Text>
                </View>
                {/* الإجمالي شامل الضريبة */}
                <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenterBold}>{formatExactAmount(row.lineTotal)}</Text>
                </View>
              </View>
            ))}

            {/* Minimum table rows filler */}
            {rows.length < 5 ? (
              <View style={[styles.emptyFillerRow, { height: (5 - rows.length) * 26 }]}>
                <View style={[styles.tdCell, styles.colCode]} />
                <View style={[styles.tdCell, styles.colDesc]} />
                <View style={[styles.tdCell, styles.colUnit]} />
                <View style={[styles.tdCell, styles.colQty]} />
                <View style={[styles.tdCell, styles.colPrice]} />
                <View style={[styles.tdCell, styles.colSubtotal]} />
                <View style={[styles.tdCell, styles.colDiscount]} />
                <View style={[styles.tdCell, styles.colVatRate]} />
                <View style={[styles.tdCell, styles.colVatAmount]} />
                <View style={[styles.tdCell, styles.colTotal, { borderLeftWidth: 0 }]} />
              </View>
            ) : null}

            {/* Bottom Summary / Totals Row */}
            <View style={styles.tableFooterRow}>
              {/* الإجمالي label on the right side */}
              <View style={[styles.tfCell, styles.colFooterLabel]}>
                <Text style={styles.footerLabelRed}>الإجمالـــــــــــــــي</Text>
              </View>
              {/* Total Qty */}
              <View style={[styles.tfCell, styles.colQty]}>
                <Text style={styles.tdTextCenterBold}>{formatQty(totalQty)}</Text>
              </View>
              {/* Blank under unit price */}
              <View style={[styles.tfCell, styles.colPrice, styles.solidBlueCell]} />
              {/* Total Taxable Subtotal */}
              <View style={[styles.tfCell, styles.colSubtotal]}>
                <Text style={styles.tdTextCenterBold}>{formatExactAmount(taxableAmount)}</Text>
              </View>
              {/* Total Discount */}
              <View style={[styles.tfCell, styles.colDiscount]}>
                <Text style={styles.tdTextCenterBold}>{formatExactAmount(totalDiscount)}</Text>
              </View>
              {/* Blank under vat rate */}
              <View style={[styles.tfCell, styles.colVatRate, styles.solidBlueCell]} />
              {/* Total VAT */}
              <View style={[styles.tfCell, styles.colVatAmount]}>
                <Text style={styles.tdTextCenterBold}>{formatExactAmount(totalVat)}</Text>
              </View>
              {/* Total Net Amount */}
              <View style={[styles.tfCell, styles.colTotal, { borderLeftWidth: 0 }]}>
                <Text style={styles.tdTextCenterBold}>{formatExactAmount(grandTotal)}</Text>
              </View>
            </View>
          </View>

          {/* ─── 5. TERMS AND CONDITIONS SIDEBAR & SECTION ─── */}
          <View style={styles.termsSection} wrap={false}>
            {/* Main Terms & Conditions List */}
            <View style={styles.termsBody}>
              {(invoice.terms ? invoice.terms.split("\n").filter(Boolean) : defaultTerms).map((term, i) => (
                <Text key={i} style={styles.termLine}>{term}</Text>
              ))}
              {/* Signature Lines at Bottom */}
              <View style={styles.signaturesRow}>
                <Text style={styles.sigField}>التوقيع : ..................................</Text>
                <Text style={styles.sigField}>الاسم : ....................................</Text>
              </View>
            </View>

            {/* Vertical Sidebar Header: الشروط والأحكام */}
            <View style={styles.verticalTermsHeader}>
              <Text style={styles.verticalTermsText}>الشروط والأحكام</Text>
            </View>
          </View>

          {/* Optional Footer Text */}
          {company.footerText ? (
            <View style={styles.footerWrap} wrap={false}>
              <Text style={styles.footerText}>{company.footerText}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

const BLUE_BORDER = "#2B5F8C";
const LIGHT_BLUE_BG = "#D9E5F0";
const SOLID_BLUE = "#36648B";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    padding: 14,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8,
    flexDirection: "column",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
    objectFit: "contain",
  },

  // Document body
  documentBody: {
    flex: 1,
    flexDirection: "column",
  },

  // 1. Header
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerRightCol: {
    width: "48%",
    alignItems: "flex-end",
  },
  companyNameArRed: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#C53030",
    textAlign: "right",
  },
  headerLeftCol: {
    width: "48%",
    alignItems: "flex-start",
  },
  companyNameEnRed: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#C53030",
    fontFamily: "Helvetica",
    textAlign: "left",
  },

  // 2. Subheader Grid (QR, Notes, Meta)
  subHeaderGrid: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 6,
    minHeight: 115,
  },
  metaTableBox: {
    width: "28%",
    borderWidth: 1,
    borderColor: BLUE_BORDER,
  },
  metaTableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: BLUE_BORDER,
    height: 19,
  },
  metaLabelCell: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    paddingHorizontal: 2,
  },
  metaLabelText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  metaValCell: {
    width: "52%",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  metaValText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  metaValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  centerTitleBox: {
    width: "43%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  companyLogo: {
    maxWidth: 120,
    maxHeight: 52,
    objectFit: "contain",
    marginBottom: 6,
  },
  taxCapsuleBadge: {
    backgroundColor: SOLID_BLUE,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 16,
  },
  taxCapsuleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },

  qrCodeBox: {
    width: "25%",
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    justifyContent: "center",
    alignItems: "center",
    padding: 3,
  },
  qrImage: {
    width: 109,
    height: 109,
  },
  qrPlaceholder: {
    width: 109,
    height: 109,
  },

  // 3. Parties Container (Supplier & Customer)
  partiesContainer: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  partyBox: {
    width: "49%",
    borderWidth: 1,
    borderColor: BLUE_BORDER,
  },
  partyHeader: {
    backgroundColor: LIGHT_BLUE_BG,
    borderBottomWidth: 1,
    borderBottomColor: BLUE_BORDER,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  partyHeaderText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
  },
  partyRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: BLUE_BORDER,
    minHeight: 18,
  },
  partyLabelCell: {
    width: "24%",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    paddingHorizontal: 2,
  },
  partyLabelText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  partyValCell: {
    width: "76%",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  partyValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  partyValNumber: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  partyAddressText: {
    fontSize: 6.8,
    color: "#000000",
    textAlign: "right",
    lineHeight: 1.2,
  },
  partyAddressSub: {
    fontSize: 6.8,
    color: "#333333",
    textAlign: "right",
    marginTop: 1,
  },

  // 3.5 Compact Notes
  compactNotesBox: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  compactNotesLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 4,
  },
  compactNotesText: {
    fontSize: 7.5,
    color: "#333333",
    flex: 1,
    textAlign: "right",
  },

  // 4. Items Table
  tableContainer: {
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: LIGHT_BLUE_BG,
    borderBottomWidth: 1,
    borderBottomColor: BLUE_BORDER,
    minHeight: 22,
    alignItems: "center",
  },
  thCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 2,
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    height: "100%",
  },
  thText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  tableDataRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: BLUE_BORDER,
    minHeight: 18,
    alignItems: "center",
  },
  emptyFillerRow: {
    flexDirection: "row-reverse",
  },
  tdCell: {
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    height: "100%",
  },
  tdTextCenter: {
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
  tdTextCenterBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  tdTextRight: {
    fontSize: 7,
    color: "#000000",
    textAlign: "right",
  },

  // Column Widths (matching the image)
  colCode: { width: "8%" },
  colDesc: { width: "30%" },
  colUnit: { width: "6%" },
  colQty: { width: "6%" },
  colPrice: { width: "10%" },
  colSubtotal: { width: "10%" },
  colDiscount: { width: "8%" },
  colVatRate: { width: "6%" },
  colVatAmount: { width: "7%" },
  colTotal: { width: "9%" },

  tableFooterRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: BLUE_BORDER,
    minHeight: 18,
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  tfCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 2,
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    height: "100%",
  },
  colFooterLabel: {
    width: "44%", // colCode (8%) + colDesc (30%) + colUnit (6%)
  },
  footerLabelRed: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#C53030",
    textAlign: "center",
  },
  solidBlueCell: {
    backgroundColor: SOLID_BLUE,
  },

  // 5. Terms and Conditions
  termsSection: {
    flexDirection: "row-reverse",
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    minHeight: 55,
  },
  verticalTermsHeader: {
    width: "6%",
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: BLUE_BORDER,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  verticalTermsText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1.3,
  },
  termsBody: {
    width: "94%",
    padding: 6,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  termLine: {
    fontSize: 6.8,
    color: "#222222",
    textAlign: "right",
    marginBottom: 2,
  },
  signaturesRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 4,
  },
  sigField: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#C53030",
  },

  footerWrap: {
    marginTop: 4,
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#666666",
    textAlign: "center",
  },
});
