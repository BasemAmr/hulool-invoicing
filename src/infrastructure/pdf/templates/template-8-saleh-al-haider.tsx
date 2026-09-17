import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Circle,
  Ellipse,
  Line,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface Template8SalehAlHaiderProps {
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

// ─── Optional Extension Interfaces (non-breaking fallbacks) ───

interface Template8InvoiceExtensions {
  paymentMethod?: string | null;
  paymentMethodAr?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  clientTaxNumber?: string | null;
  clientNumber?: string | null;
  notes?: string | null;
}

interface Template8CustomerExtensions {
  customerNumber?: string | number | null;
  code?: string | number | null;
  clientNo?: string | number | null;
}

interface Template8ItemExtensions {
  itemCode?: string | number | null;
  itemNo?: string | number | null;
  productCode?: string | number | null;
  code?: string | number | null;
  unit?: string | null;
  unitName?: string | null;
  uom?: string | null;
}

function getInvoiceExt(invoice: InvoiceDto): Template8InvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<Template8InvoiceExtensions>;
  return {
    paymentMethod: rec.paymentMethod ?? null,
    paymentMethodAr: rec.paymentMethodAr ?? null,
    branchName: rec.branchName ?? null,
    branchCode: rec.branchCode ?? null,
    clientTaxNumber: rec.clientTaxNumber ?? null,
    clientNumber: rec.clientNumber ?? null,
    notes: rec.notes ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): Template8CustomerExtensions {
  const rec = customer as CustomerRecord & Partial<Template8CustomerExtensions>;
  return {
    customerNumber: rec.customerNumber ?? null,
    code: rec.code ?? null,
    clientNo: rec.clientNo ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): Template8ItemExtensions {
  const rec = item as InvoiceItemDto & Partial<Template8ItemExtensions>;
  return {
    itemCode: rec.itemCode ?? null,
    itemNo: rec.itemNo ?? null,
    productCode: rec.productCode ?? null,
    code: rec.code ?? null,
    unit: rec.unit ?? null,
    unitName: rec.unitName ?? null,
    uom: rec.uom ?? null,
  };
}

// ─── Helpers ───

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
  const ext = getItemExt(item);
  const candidates = [ext.itemCode, ext.itemNo, ext.productCode, ext.code, item.savedProductId];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const text = String(c).trim();
    if (text === "" || isUuidLike(text)) continue;
    return text;
  }
  return String(index + 1);
}

function getItemUnitName(item: InvoiceItemDto): string {
  const ext = getItemExt(item);
  return ext.unit ?? ext.unitName ?? ext.uom ?? "وحدة";
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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Globe Logo Vector Component ───
// Centerpiece world map globe as seen in the scanned document
function GlobeVectorIcon({ width = 110, height = 65 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 90">
      {/* Outer oval boundary of the globe */}
      <Ellipse cx={80} cy={45} rx={74} ry={40} fill="none" stroke="#222222" strokeWidth={1.2} />
      
      {/* Horizontal latitude grid lines */}
      <Line x1={8} y1={25} x2={152} y2={25} stroke="#555555" strokeWidth={0.6} />
      <Line x1={6} y1={45} x2={154} y2={45} stroke="#333333" strokeWidth={0.8} />
      <Line x1={8} y1={65} x2={152} y2={65} stroke="#555555" strokeWidth={0.6} />

      {/* Vertical longitude elliptic curves */}
      <Ellipse cx={80} cy={45} rx={22} ry={40} fill="none" stroke="#555555" strokeWidth={0.6} />
      <Ellipse cx={80} cy={45} rx={48} ry={40} fill="none" stroke="#555555" strokeWidth={0.6} />
      <Line x1={80} y1={5} x2={80} y2={85} stroke="#555555" strokeWidth={0.7} />

      {/* Shaded/outlined continents inside the globe */}
      {/* Europe & Africa landmass center */}
      <Ellipse cx={78} cy={46} rx={16} ry={24} fill="#555555" opacity={0.35} />
      {/* Asia landmass right */}
      <Ellipse cx={110} cy={34} rx={24} ry={16} fill="#555555" opacity={0.35} />
      {/* Americas landmass left */}
      <Ellipse cx={44} cy={32} rx={14} ry={15} fill="#555555" opacity={0.3} />
      <Ellipse cx={50} cy={56} rx={12} ry={18} fill="#555555" opacity={0.3} />
    </Svg>
  );
}

// ─── Blue Checkmark Vector Component ───
// Hand-drawn blue manual audit checkmark overlaid on the unit/quantity area
function BlueCheckmark() {
  return (
    <Svg width={22} height={10} viewBox="0 0 28 12">
      <Line x1={2} y1={8} x2={9} y2={11} stroke="#1D4ED8" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={9} y1={11} x2={26} y2={2} stroke="#1D4ED8" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function Template8SalehAlHaider({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template8SalehAlHaiderProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const custExt = getCustomerExt(customer);

  // Dynamic Company Information
  // WHY nameEn fallback: CompanyRecord has only nameAr/nameEn (no `name`);
  // prefer Arabic, fall back to English, never crash on missing branding.
  const companyNameAr = company.nameAr || company.nameEn || "";
  const companySubtitleAr =
    company.footerText ||
    (company as unknown as { activityDescription?: string })?.activityDescription ||
    "";
  const companyVatNumber = company.vatNumber || "";

  // Dynamic Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const issueTimeStr = invoice.issueTime ? `${invoice.issueTime}:00`.slice(0, 8) : "12:00:00";

  // Payment Method
  const paymentMethodRaw =
    invExt.paymentMethodAr ??
    invExt.paymentMethod ??
    (invoice as unknown as { paymentMethod?: string })?.paymentMethod ??
    (invoice.invoiceType === "simplified" ? "نقدي" : "أجل");
  
  const paymentMethodDisplay =
    paymentMethodRaw === "credit" || paymentMethodRaw === "اجل" || paymentMethodRaw === "أجل"
      ? "أجل"
      : paymentMethodRaw === "cash" || paymentMethodRaw === "نقدي" || paymentMethodRaw === "نقدا"
      ? "نقدي"
      : paymentMethodRaw === "bank_transfer"
      ? "تحويل بنكي"
      : paymentMethodRaw || "أجل";

  // Customer Data
  const customerName = customer.nameAr || "";
  const customerTaxNumber =
    invExt.clientTaxNumber || customer.vatNumber || "";
  const customerCode =
    invExt.clientNumber ||
    toText(custExt.clientNo ?? custExt.customerNumber ?? custExt.code ?? "");

  const items = invoice.items || [];

  return (
    <Document
      title={`Tax Invoice - ${invoiceNumber}`}
      author={companyNameAr}
      subject="TAX INVOICE - فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ROW: QR CODE (LEFT), GLOBE LOGO (CENTER), COMPANY INFO (RIGHT) ─── */}
        <View style={styles.headerRow}>
          {/* Top-Left: QR Code */}
          <View style={styles.headerQrWrap}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR CODE</Text>
              </View>
            )}
          </View>

          {/* Top-Center: Globe/World-Map Logo Centerpiece */}
          <View style={styles.headerCenterLogo}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.customLogoImg} />
            ) : (
              <View style={styles.globeContainer}>
                <Text style={styles.globeTopArcText}>{companyNameAr}</Text>
                <GlobeVectorIcon width={120} height={68} />
              </View>
            )}
          </View>

          {/* Top-Right: Company Name & VAT Number */}
          <View style={styles.headerCompanyRight}>
            <Text style={styles.companyNameText}>{companyNameAr}</Text>
            {companySubtitleAr ? (
              <Text style={styles.companySubtitleText}>{companySubtitleAr}</Text>
            ) : null}
            {companyVatNumber ? (
              <Text style={styles.companyVatText}>{companyVatNumber}</Text>
            ) : null}
          </View>
        </View>

        {/* Horizontal Divider Line */}
        <View style={styles.headerDivider} />

        {/* ─── 2. INFO / METADATA STRIP (SINGLE ROW WITH THIN VERTICAL RULES) ─── */}
        <View style={styles.metaStripContainer}>
          {/* 1. Left Cell: TAX INVOICE & فاتورة ضريبية + رقم الفاتورة */}
          <View style={[styles.metaCell, styles.metaCellInvoice]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.metaTitleEn}>TAX INVOICE</Text>
              <Text style={styles.metaTitleAr}>فاتورة ضريبية</Text>
            </View>
            <View style={styles.metaRowInlineBottom}>
              <Text style={styles.metaValueStrong}>{invoiceNumber}</Text>
              <Text style={styles.metaLabelText}>رقم الفاتورة</Text>
            </View>
          </View>

          {/* 2. Center-Left Cell: Payment Method, Time & Date */}
          <View style={[styles.metaCell, styles.metaCellPayment]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.metaValueHighlight}>{paymentMethodDisplay}</Text>
              <Text style={styles.metaLabelText}>طريقة الدفع</Text>
            </View>
            <View style={styles.metaRowInlineBottom}>
              <Text style={styles.metaTimeDateText}>{issueDateStr}</Text>
              <Text style={styles.metaTimeDateText}>{issueTimeStr}</Text>
            </View>
          </View>

          {/* 3. Right Cell: Client Information (Tax Number, Name, Code) */}
          <View style={[styles.metaCell, styles.metaCellClient, { borderLeftWidth: 0 }]}>
            <View style={styles.metaRowInline}>
              <Text style={styles.metaValueText}>{customerTaxNumber}</Text>
              <Text style={styles.metaLabelText}>الرقم الضريبي للعميل</Text>
            </View>
            <View style={styles.metaRowInlineBottom}>
              <Text style={styles.metaValueText}>{customerCode}</Text>
              <Text style={styles.customerNameValue}>{customerName}</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. MAIN PRODUCT TABLE (PLAIN BLACK/WHITE, HIGH-DENSITY GRID) ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* Total / الاجمالي (Far-Left in RTL view) */}
            <View style={[styles.thCell, styles.colTotal]}>
              <Text style={styles.thText}>الاجمالي</Text>
            </View>
            {/* Unit Price / سعر الوحدة */}
            <View style={[styles.thCell, styles.colUnitPrice]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>
            {/* Quantity / الكمية */}
            <View style={[styles.thCell, styles.colQuantity]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            {/* Unit / الوحدة */}
            <View style={[styles.thCell, styles.colUnit]}>
              <Text style={styles.thText}>الوحدة</Text>
            </View>
            {/* Item Name / اسم الصنف */}
            <View style={[styles.thCell, styles.colItemName]}>
              <Text style={styles.thText}>اسم الصنف</Text>
            </View>
            {/* Item No / م الصنف (Far-Right in RTL view) */}
            <View style={[styles.thCell, styles.colItemNo, { borderLeftWidth: 0 }]}>
              <Text style={styles.thText}>م الصنف</Text>
            </View>
          </View>

          {/* Table Body Rows */}
          {items.map((item, index) => {
            const itemCode = getItemCode(item, index);
            const unitName = getItemUnitName(item);
            const lineTotal = toNumber(item.lineTotal) || toNumber(item.quantity) * toNumber(item.unitPrice);

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === items.length - 1 ? styles.tableLastRow : {},
                ]}
              >
                {/* 1. الاجمالي */}
                <View style={[styles.tdCell, styles.colTotal]}>
                  <Text style={styles.tdNumText}>{formatNumber(lineTotal)}</Text>
                </View>

                {/* 2. سعر الوحدة */}
                <View style={[styles.tdCell, styles.colUnitPrice]}>
                  <Text style={styles.tdNumText}>{formatNumber(item.unitPrice)}</Text>
                </View>

                {/* 3. الكمية with Blue Checkmark overlay */}
                <View style={[styles.tdCell, styles.colQuantity, styles.cellWithCheckmark]}>
                  <Text style={styles.tdNumTextBold}>{formatQty(item.quantity)}</Text>
                  <View style={styles.checkmarkOverlay}>
                    <BlueCheckmark />
                  </View>
                </View>

                {/* 4. الوحدة */}
                <View style={[styles.tdCell, styles.colUnit]}>
                  <Text style={styles.tdTextCenter}>{unitName}</Text>
                </View>

                {/* 5. اسم الصنف */}
                <View style={[styles.tdCell, styles.colItemName]}>
                  <Text style={styles.tdItemDescription}>{item.description}</Text>
                </View>

                {/* 6. م الصنف */}
                <View style={[styles.tdCell, styles.colItemNo, { borderLeftWidth: 0 }]}>
                  <Text style={styles.tdTextCenter}>{itemCode}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Optional Notes or Terms if provided */}
        {toText(invoice.notes) || toText(invoice.terms) ? (
          <View style={styles.notesSection}>
            {toText(invoice.notes) ? (
              <Text style={styles.notesText}>{toText(invoice.notes)}</Text>
            ) : null}
            {toText(invoice.terms) ? (
              <Text style={styles.notesText}>{toText(invoice.terms)}</Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 16,
    fontSize: 8,
    color: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header: 3-column Layout (QR Code Left, Globe Logo Center, Company Info Right) ───
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  headerQrWrap: {
    width: "22%",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  qrImage: {
    width: 68,
    height: 68,
  },
  qrPlaceholder: {
    width: 68,
    height: 68,
    borderWidth: 1,
    borderColor: "#000000",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 7,
    color: "#444444",
  },
  headerCenterLogo: {
    width: "36%",
    alignItems: "center",
    justifyContent: "center",
  },
  globeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  globeTopArcText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    marginBottom: 2,
  },
  customLogoImg: {
    width: 90,
    height: 65,
    objectFit: "contain",
  },
  headerCompanyRight: {
    width: "42%",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  companyNameText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companySubtitleText: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
    marginBottom: 4,
  },
  companyVatText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    letterSpacing: 0.5,
  },

  // ─── Divider Line ───
  headerDivider: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
    marginBottom: 6,
    width: "100%",
  },

  // ─── Metadata Strip (3 Cells Separated by Thin Vertical Rules) ───
  metaStripContainer: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#000000",
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    minHeight: 38,
  },
  metaCell: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    justifyContent: "space-between",
    borderLeftWidth: 0.8,
    borderLeftColor: "#000000",
  },
  metaCellInvoice: {
    width: "28%",
  },
  metaCellPayment: {
    width: "28%",
  },
  metaCellClient: {
    width: "44%",
  },
  metaRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  metaRowInlineBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaTitleEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  metaTitleAr: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  metaLabelText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  metaValueText: {
    fontSize: 7.5,
    color: "#000000",
  },
  metaValueStrong: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  metaValueHighlight: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
  },
  metaTimeDateText: {
    fontSize: 7.5,
    color: "#000000",
  },
  customerNameValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  // ─── Main Product Table (Plain Black/White High-Density Grid) ───
  tableContainer: {
    borderWidth: 0.8,
    borderColor: "#000000",
    width: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#000000",
    backgroundColor: "#FFFFFF",
    minHeight: 18,
    alignItems: "center",
  },
  thCell: {
    borderLeftWidth: 0.6,
    borderLeftColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  thText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  // Column Widths (matching original scan proportions)
  colTotal: {
    width: "12%",
  },
  colUnitPrice: {
    width: "11%",
  },
  colQuantity: {
    width: "11%",
  },
  colUnit: {
    width: "10%",
  },
  colItemName: {
    width: "42%",
  },
  colItemNo: {
    width: "14%",
  },

  // Table Body Rows
  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 16,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  tableLastRow: {
    borderBottomWidth: 0,
  },
  tdCell: {
    borderLeftWidth: 0.6,
    borderLeftColor: "#000000",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  tdNumText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  tdNumTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  tdTextCenter: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
    width: "100%",
  },
  tdItemDescription: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
    width: "100%",
  },
  cellWithCheckmark: {
    position: "relative",
  },
  checkmarkOverlay: {
    position: "absolute",
    left: 2,
    top: 2,
  },

  // Optional Notes Section
  notesSection: {
    marginTop: 8,
    padding: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#444444",
  },
  notesText: {
    fontSize: 7,
    color: "#222222",
    textAlign: "right",
  },
});
