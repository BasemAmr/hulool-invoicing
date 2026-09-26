import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Polygon,
  Rect,
  Defs,
  ClipPath,
  G,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatExactAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const raw = String(value).trim();
  if (Number.isNaN(Number(raw))) return raw;
  const negative = raw.startsWith("-");
  const clean = negative ? raw.slice(1) : raw;
  const [integer = "0", decimals] = clean.split(".");
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = decimals === undefined ? formattedInteger : `${formattedInteger}.${decimals}`;
  return negative ? `-${result}` : result;
}

function formatQty(value: string | number | null | undefined): string {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 1000) / 1000);
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");
  return year && month && day ? `${day}/${month}/${year}` : clean;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" - ");
}

function formatCompanyAddress(company: CompanyRecord): string {
  return joinParts([
    company.addressAdditionalNumber,
    company.addressPostalCode,
    company.addressStreet,
    company.addressBuildingNumber,
    company.addressDistrict,
    company.addressCity,
    "المملكة العربية السعودية",
  ]);
}

function formatCustomerAddress(customer: CustomerRecord): string {
  return joinParts([
    customer.addressAdditionalNumber,
    customer.addressPostalCode,
    customer.addressStreet,
    customer.addressBuildingNumber,
    customer.addressDistrict,
    customer.addressCity,
  ]);
}

function CardGraphics({ width, height }: { width: number; height: number }) {
  const cardLeft = 22;
  const cardTop = 22;
  const cardWidth = width - 44;
  const cardHeight = height - 44;
  const cornerRadius = 30;
  const scale = cardWidth / 536;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <ClipPath id="template15CardClip">
          <Rect
            x={cardLeft}
            y={cardTop}
            width={cardWidth}
            height={cardHeight}
            rx={cornerRadius}
            ry={cornerRadius}
          />
        </ClipPath>
      </Defs>

      <Rect
        x={cardLeft}
        y={cardTop}
        width={cardWidth}
        height={cardHeight}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="#FFFFFF"
      />

      <G clipPath="url(#template15CardClip)">
        <G transform={`translate(${cardLeft} ${cardTop}) scale(${scale})`}>
          <Path d="M0 0 H255 L233 22 H15 L0 34 Z" fill="#FE0000" />
          <Path d="M0 34 L15 22 L15 30 L15 50 L-2 66 H0 Z" fill="#FE0000" />

          <Polygon points="62,0 72,0 52,20 42,20" fill="#F3F4F7" />
          <Polygon points="88,0 98,0 78,20 68,20" fill="#F3F4F7" />
          <Polygon points="114,0 124,0 104,20 94,20" fill="#F3F4F7" />
          <Polygon points="140,0 150,0 130,20 120,20" fill="#F3F4F7" />
          <Polygon points="166,0 176,0 156,20 146,20" fill="#F3F4F7" />

          <Path d="M258 0 H536 V78 L510 54 H265 L237 28 L258 0 Z" fill="#070810" />
          <Polygon points="345,0 494,0 482,18 357,18" fill="#FE0000" />
        </G>

        <Rect x={cardLeft} y={cardTop + cardHeight - 14} width={cardWidth} height={14} fill="#FE0000" />
      </G>
    </Svg>
  );
}

function ContentFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.content}>
      {children}
    </View>
  );
}

export interface Template15RedaModernProps {
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

export function Template15RedaModern({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: Template15RedaModernProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;
  const invoiceNumber = invoice.invoiceNumber || "";
  const logoSource = logoDataUrl || company.logoUrl;
  const items: InvoiceItemDto[] = invoice.items || [];

  let computedVat = 0;
  const rows = items.map((item, index) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = quantity * unitPrice;
    const discount = toNumber(item.discountAmount);
    const subtotal = Math.max(0, gross - discount);
    const vatRate = item.vatRate === null || item.vatRate === undefined ? 15 : toNumber(item.vatRate);
    const vat = item.lineVat === null || item.lineVat === undefined ? subtotal * (vatRate / 100) : toNumber(item.lineVat);
    const total = item.lineTotal === null || item.lineTotal === undefined ? subtotal + vat : toNumber(item.lineTotal);
    computedVat += vat;
    return {
      key: item.position ?? index,
      index: index + 1,
      description: item.description || "",
      quantity,
      unitPrice,
      gross,
      discount,
      subtotal,
      vatRate,
      vat,
      total,
    };
  });

  const subtotal = invoice.subtotal !== null && invoice.subtotal !== undefined && invoice.subtotal !== ""
    ? toNumber(invoice.subtotal)
    : rows.reduce((sum, row) => sum + row.subtotal, 0);
  const vatTotal = invoice.vatAmount !== null && invoice.vatAmount !== undefined && invoice.vatAmount !== ""
    ? toNumber(invoice.vatAmount)
    : computedVat;
  const grandTotal = invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
    ? toNumber(invoice.total)
    : subtotal + vatTotal;

  const itemExtraHeight = Math.max(0, rows.length - 5) * 22;
  const notesHeight = invoice.notes ? 20 + Math.min(invoice.notes.split("\n").length, 5) * 8 : 0;
  const termsHeight = invoice.terms ? 20 + Math.min(invoice.terms.split("\n").length, 5) * 8 : 0;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + itemExtraHeight + notesHeight + termsHeight) + 52;
  const pageSize = [basePageWidth, dynamicHeight] as [number, number];
  const companyAddress = formatCompanyAddress(company);
  const customerAddress = formatCustomerAddress(customer);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={company.nameAr || ""}
      subject="فاتورة ضريبية"
      creator="Hulool Invoicing"
    >
      <Page size={pageSize} orientation="portrait" style={styles.page}>
        <View fixed style={styles.pageGraphicLayer}>
          <CardGraphics width={basePageWidth} height={dynamicHeight} />
        </View>
        {backgroundDataUrl ? <Image src={backgroundDataUrl} style={styles.backgroundImage} /> : null}

        <ContentFrame>

        <View style={styles.header} wrap={false}>
          <View style={styles.brandBlock}>
            {logoSource ? <Image src={logoSource} style={styles.logo} /> : null}
            {company.nameEn ? <Text style={styles.companyNameEn}>{company.nameEn}</Text> : null}
            {company.website ? <Text style={styles.smallEnglish}>{company.website}</Text> : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.invoiceTitle}>فاتورة ضريبية</Text>
            <Text style={styles.companyNameAr}>{company.nameAr || ""}</Text>
          </View>
        </View>

        <View style={styles.metaArea} wrap={false}>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>رقم الفاتورة</Text>
            <Text style={styles.metaValue}>{invoiceNumber}</Text>
            <Text style={styles.metaLabel}>تاريخ الفاتورة</Text>
            <Text style={styles.metaValue}>{formatDateOnly(invoice.issueDate)}</Text>
          </View>
          <View style={styles.customerColumn}>
            <Text style={styles.sectionLabel}>فاتورة إلى</Text>
            <Text style={styles.customerName}>{customer.nameAr || customer.nameEn || ""}</Text>
            {customerAddress ? <Text style={styles.detailText}>العنوان: {customerAddress}</Text> : null}
            {customer.phone ? <Text style={styles.detailText}>الهاتف: {customer.phone}</Text> : null}
            {customer.email ? <Text style={styles.detailText}>البريد الإلكتروني: {customer.email}</Text> : null}
          </View>
        </View>

        <View style={styles.detailStrip} wrap={false}>
          <View style={styles.detailGroup}>
            <Text style={styles.detailHeading}>معلومات الدفع</Text>
            {company.nameEn ? <Text style={styles.detailText}>{company.nameEn}</Text> : null}
            {company.phone ? <Text style={styles.detailText}>{company.phone}</Text> : null}
            {company.email ? <Text style={styles.detailText}>{company.email}</Text> : null}
          </View>
          <View style={styles.detailGroupRight}>
            <Text style={styles.detailHeading}>بيانات الشركة</Text>
            {company.vatNumber ? <Text style={styles.detailText}>الرقم الضريبي: {company.vatNumber}</Text> : null}
            {company.crNumber ? <Text style={styles.detailText}>السجل التجاري: {company.crNumber}</Text> : null}
            {companyAddress ? <Text style={styles.detailText}>{companyAddress}</Text> : null}
          </View>
        </View>

        <View style={styles.itemsTable} wrap={false}>
          <View style={styles.tableHeader}>
            <View style={[styles.tableHeaderCell, styles.colDescription, styles.redHeader]}><Text style={styles.headerText}>اسم المنتج / الخدمة</Text></View>
            <View style={[styles.tableHeaderCell, styles.colQty, styles.blackHeader]}><Text style={styles.headerText}>الكمية</Text></View>
            <View style={[styles.tableHeaderCell, styles.colPrice, styles.blackHeader]}><Text style={styles.headerText}>السعر</Text></View>
            <View style={[styles.tableHeaderCell, styles.colVatRate, styles.blackHeader]}><Text style={styles.headerText}>الضريبة</Text></View>
            <View style={[styles.tableHeaderCell, styles.colVat, styles.blackHeader]}><Text style={styles.headerText}>قيمة الضريبة</Text></View>
            <View style={[styles.tableHeaderCell, styles.colTotal, styles.blackHeader, styles.lastCell]}><Text style={styles.headerText}>الإجمالي</Text></View>
          </View>
          {rows.map((row) => (
            <View key={row.key} style={styles.tableRow}>
              <View style={[styles.tableCell, styles.colDescription, styles.descriptionCell]}>
                <Text style={styles.descriptionText}>{row.description}</Text>
                {row.discount > 0 ? <Text style={styles.discountText}>قبل الخصم: {formatExactAmount(row.gross)} | الخصم: {formatExactAmount(row.discount)}</Text> : null}
              </View>
              <View style={[styles.tableCell, styles.colQty]}><Text style={styles.cellText}>{formatQty(row.quantity)}</Text></View>
              <View style={[styles.tableCell, styles.colPrice]}><Text style={styles.cellText}>{formatExactAmount(row.unitPrice)}</Text></View>
              <View style={[styles.tableCell, styles.colVatRate]}><Text style={styles.cellText}>{formatExactAmount(row.vatRate)}%</Text></View>
              <View style={[styles.tableCell, styles.colVat]}><Text style={styles.cellText}>{formatExactAmount(row.vat)}</Text></View>
              <View style={[styles.tableCell, styles.colTotal, styles.lastCell]}>
                {row.discount > 0 ? <Text style={styles.discountText}>بعد الخصم</Text> : null}
                <Text style={styles.totalCellText}>{formatExactAmount(row.total)}</Text>
              </View>
            </View>
          ))}
          {rows.length < 5 ? <View style={[styles.emptyRows, { height: (5 - rows.length) * 24 }]} /> : null}
        </View>

        <View style={styles.summaryArea} wrap={false}>
          <View style={styles.summaryTable}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>المجموع الفرعي</Text><Text style={styles.summaryValue}>{formatExactAmount(subtotal)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>الضريبة (%)</Text><Text style={styles.summaryValue}>{formatExactAmount(vatTotal)}</Text></View>
            <View style={[styles.summaryRow, styles.grandRow]}><Text style={styles.grandLabel}>المجموع الكلي</Text><Text style={styles.grandValue}>{formatExactAmount(grandTotal)}</Text></View>
          </View>
          {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrCode} /> : null}
        </View>

        {(invoice.notes || invoice.terms) ? (
          <View style={styles.notesTerms} wrap={false}>
            {invoice.notes ? <View style={styles.noteBlock}><Text style={styles.noteHeading}>ملاحظات</Text><Text style={styles.noteText}>{invoice.notes}</Text></View> : null}
            {invoice.terms ? <View style={styles.noteBlock}><Text style={styles.noteHeading}>الشروط والأحكام</Text><Text style={styles.noteText}>{invoice.terms}</Text></View> : null}
          </View>
        ) : null}

        <View style={styles.footer} wrap={false}>
          <View style={styles.footerContact}>
            <Text style={styles.thanksText}>شكراً لتعاملكم معنا</Text>
            <Text style={styles.footerEnglish}>Thank you for your business</Text>
            <Text style={styles.footerContactText}>{joinParts([company.phone, company.email, company.website])}</Text>
            <Text style={styles.footerContactText}>{company.footerText || companyAddress}</Text>
          </View>
        </View>
        </ContentFrame>
      </Page>
    </Document>
  );
}

const RED = "#F10B12";
const BLACK = "#090A0C";
const LIGHT_RULE = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: "#F3F4F7",
    color: BLACK,
    fontSize: 8,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
    objectFit: "contain",
  },
  pageGraphicLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  content: {
    paddingHorizontal: 60,
    paddingTop: 110,
    paddingBottom: 46,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    minHeight: 104,
    paddingTop: 8,
    marginTop: 6,
  },
  brandBlock: { width: "32%", alignItems: "flex-start" },
  logo: { width: 82, height: 54, objectFit: "contain", marginBottom: 3 },
  companyNameEn: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold", color: RED },
  smallEnglish: { fontSize: 6, fontFamily: "Helvetica", color: "#444444", marginTop: 2 },
  titleBlock: { width: "64%", alignItems: "flex-end" },
  companyNameAr: { fontSize: 11, fontWeight: "bold", color: RED, textAlign: "right" },
  invoiceTitle: { fontSize: 46, fontWeight: "bold", color: BLACK, textAlign: "right" },
  metaArea: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_RULE,
    paddingBottom: 8,
    marginBottom: 8,
  },
  metaColumn: { width: "28%", alignItems: "flex-end" },
  customerColumn: { width: "58%", alignItems: "flex-end" },
  metaLabel: { fontSize: 7, color: "#555555", marginTop: 1 },
  metaValue: { fontSize: 8, fontWeight: "bold", marginBottom: 3 },
  sectionLabel: { fontSize: 8, color: "#555555" },
  customerName: { fontSize: 12, fontWeight: "bold", color: RED, marginBottom: 2 },
  detailStrip: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    minHeight: 58,
    marginBottom: 10,
  },
  detailGroup: { width: "43%", alignItems: "flex-start", paddingLeft: 10 },
  detailGroupRight: { width: "53%", alignItems: "flex-end", paddingRight: 4 },
  detailHeading: { fontSize: 9, fontWeight: "bold", color: BLACK, marginBottom: 2 },
  detailText: { fontSize: 7, color: BLACK, lineHeight: 1.2 },
  itemsTable: { borderTopWidth: 1, borderTopColor: BLACK, marginBottom: 10 },
  tableHeader: { flexDirection: "row-reverse", minHeight: 25 },
  tableHeaderCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  redHeader: { backgroundColor: RED },
  blackHeader: { backgroundColor: BLACK },
  headerText: { color: "#FFFFFF", fontSize: 7, fontWeight: "bold", textAlign: "center" },
  tableRow: { flexDirection: "row-reverse", minHeight: 24, borderBottomWidth: 1, borderBottomColor: LIGHT_RULE, alignItems: "center" },
  tableCell: { justifyContent: "center", alignItems: "center", minHeight: 24, paddingHorizontal: 2, borderRightWidth: 1, borderRightColor: LIGHT_RULE },
  descriptionCell: { alignItems: "flex-end", paddingHorizontal: 5 },
  descriptionText: { fontSize: 7.5, textAlign: "right" },
  discountText: { fontSize: 5.5, color: RED, textAlign: "right" },
  cellText: { fontSize: 7, textAlign: "center" },
  totalCellText: { fontSize: 7.5, fontWeight: "bold", textAlign: "center" },
  emptyRows: { borderBottomWidth: 1, borderBottomColor: LIGHT_RULE },
  colDescription: { width: "35%" },
  colQty: { width: "11%" },
  colPrice: { width: "15%" },
  colVatRate: { width: "11%" },
  colVat: { width: "14%" },
  colTotal: { width: "14%" },
  lastCell: { borderRightWidth: 0 },
  summaryArea: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", minHeight: 104, marginBottom: 8 },
  summaryTable: { width: "58%", borderTopWidth: 1, borderTopColor: BLACK },
  summaryRow: { flexDirection: "row-reverse", minHeight: 20, borderBottomWidth: 1, borderBottomColor: LIGHT_RULE, alignItems: "center" },
  summaryLabel: { width: "64%", fontSize: 7.5, textAlign: "right", paddingRight: 5 },
  summaryValue: { width: "36%", fontSize: 8, fontWeight: "bold", textAlign: "center" },
  grandRow: { backgroundColor: BLACK, borderBottomWidth: 0, minHeight: 25 },
  grandLabel: { width: "64%", backgroundColor: RED, color: "#FFFFFF", fontSize: 9, fontWeight: "bold", textAlign: "right", paddingRight: 5 },
  grandValue: { width: "36%", color: "#FFFFFF", fontSize: 10, fontWeight: "bold", textAlign: "center" },
  qrCode: { width: 125, height: 125, marginRight: 20 },
  notesTerms: { flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LIGHT_RULE, paddingTop: 6, marginBottom: 9 },
  noteBlock: { width: "48%", minHeight: 30, alignItems: "flex-end" },
  noteHeading: { fontSize: 8, fontWeight: "bold", color: BLACK, marginBottom: 2 },
  noteText: { fontSize: 6.5, color: "#444444", textAlign: "right", lineHeight: 1.25 },
  footer: { marginTop: 8, paddingBottom: 6 },
  footerContact: { alignItems: "center", paddingBottom: 5 },
  thanksText: { fontSize: 17, fontWeight: "bold", color: BLACK },
  footerEnglish: { fontSize: 6, fontFamily: "Helvetica", color: "#555555", marginBottom: 3 },
  footerContactText: { fontSize: 6.5, color: "#333333", textAlign: "center" },
});
