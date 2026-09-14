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

export interface SaAlkoufiTemplateProps {
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

// ─── Optional extension fields (legacy ERP columns). All optional → "" when absent. ───
// NOTE: Invoice date / System date / Reference rows were crossed out on the annotated
// scan, so they are deliberately NOT rendered (no fields, no fallback text).

interface SaAlkoufiInvoiceExtensions {
  discountTotal?: string | number | null;
  paymentMethod?: string | null;
  invoiceTypeLabel?: string | null;
}

interface SaAlkoufiItemExtensions {
  unitName?: string | null;
  unit?: string | null;
}

function getInvoiceExt(invoice: InvoiceDto): SaAlkoufiInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<SaAlkoufiInvoiceExtensions>;
  return {
    discountTotal: rec.discountTotal ?? null,
    paymentMethod: rec.paymentMethod ?? null,
    invoiceTypeLabel: rec.invoiceTypeLabel ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): SaAlkoufiItemExtensions {
  const rec = item as InvoiceItemDto & Partial<SaAlkoufiItemExtensions>;
  return {
    unitName: rec.unitName ?? rec.unit ?? null,
  };
}

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(val: string | number | null | undefined, decimals = 2): string {
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

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatVatPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "";
  return `%${(rate * 100).toFixed(0)}`;
}

function companyNationalAddress(company: CompanyRecord): string {
  const parts = [
    company.addressBuildingNumber ? `مبنى ${company.addressBuildingNumber}` : "",
    company.addressStreet ?? "",
    company.addressDistrict ? `حي ${company.addressDistrict}` : "",
    company.addressCity ?? "",
    company.addressPostalCode ?? "",
    company.addressAdditionalNumber ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(" ");
}

function customerNationalAddress(customer: CustomerRecord): string {
  const parts = [
    customer.addressStreet ?? "",
    customer.addressCity ?? "",
    customer.addressPostalCode ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(" ");
}

export function SaAlkoufiTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: SaAlkoufiTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);

  // ─── Dynamic header (name & logo per annotation) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";

  // ─── Supplier (company) / Customer boxes — all dynamic ───
  const supplierVat = company.vatNumber || "";
  const supplierAddress = companyNationalAddress(company);
  const supplierPhone = company.phone || "";
  const supplierCr = company.crNumber || "";

  const customerName = customer.nameAr || "";
  const customerVat = customer.vatNumber || "";
  const customerAddress = customerNationalAddress(customer);
  const customerPhone = customer.phone || "";
  const customerCr = customer.unifiedNumber || "";

  // ─── Meta — type / number / issue date / notes only ───
  const typeLabel =
    invExt.invoiceTypeLabel ??
    invExt.paymentMethod ??
    (invoice.invoiceType === "simplified" ? "فاتورة مبيعات نقدا" : "فاتورة مبيعات نقدا");
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const notesText = toText(invoice.notes);

  // ─── Items + totals — all dynamic ───
  const items = invoice.items ?? [];
  const subtotalVal = toNumber(invoice.subtotal);
  const discountVal = toNumber(invExt.discountTotal);
  const vatVal = toNumber(invoice.vatAmount);
  const totalVal = toNumber(invoice.total);
  const currencyText = invoice.currency || "SAR";

  // ─── Footer policy note comes from the company record, never hardcoded ───
  const footerNote = toText(company.footerText ?? invoice.terms ?? "");

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? <Image src={backgroundDataUrl} style={styles.backgroundImage} /> : null}

        {/* ─── Header: dynamic name (both sides) + dynamic logo (center) ─── */}
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            {companyNameAr ? <Text style={styles.headerName}>{companyNameAr}</Text> : null}
            {companyNameEn ? <Text style={styles.headerNameEn}>{companyNameEn}</Text> : null}
          </View>
          <View style={styles.headerLogoWrap}>
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImg} /> : null}
          </View>
          <View style={styles.headerSide}>
            {companyNameAr ? <Text style={styles.headerName}>{companyNameAr}</Text> : null}
            {companyNameEn ? <Text style={styles.headerNameEn}>{companyNameEn}</Text> : null}
          </View>
        </View>

        {/* ─── Supplier / Customer box ─── */}
        <View style={styles.partiesBox}>
          <View style={styles.partiesHeaderRow}>
            <Text style={styles.partiesHeaderCell}>العميل</Text>
            <Text style={styles.partiesHeaderCell}>المورد</Text>
          </View>
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الاسم</Text>
              <Text style={styles.partyVal}>{customerName}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الاسم</Text>
              <Text style={styles.partyVal}>{companyNameAr}</Text>
            </View>
          </View>
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الرقم الضريبي</Text>
              <Text style={styles.partyVal}>{customerVat}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>الرقم الضريبي</Text>
              <Text style={styles.partyVal}>{supplierVat}</Text>
            </View>
          </View>
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>العنوان الوطني</Text>
              <Text style={styles.partyVal}>{customerAddress}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>العنوان الوطني</Text>
              <Text style={styles.partyVal}>{supplierAddress}</Text>
            </View>
          </View>
          <View style={styles.partyRow}>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>رقم الجوال</Text>
              <Text style={styles.partyVal}>{customerPhone}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>رقم الجوال</Text>
              <Text style={styles.partyVal}>{supplierPhone}</Text>
            </View>
          </View>
          <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.partyCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.partyLabel}>سجل تجاري</Text>
              <Text style={styles.partyVal}>{customerCr}</Text>
            </View>
            <View style={styles.partyCell}>
              <Text style={styles.partyLabel}>سجل تجاري</Text>
              <Text style={styles.partyVal}>{supplierCr}</Text>
            </View>
          </View>
        </View>

        {/* ─── Invoice title + meta (type / number / date / notes kept) ─── */}
        <Text style={styles.invoiceTitle}>فاتورة ضريبية</Text>
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice type / نوع الفاتورة :</Text>
            <Text style={styles.metaVal}>{typeLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice Number / رقم الفاتورة :</Text>
            <Text style={styles.metaVal}>{invoiceNum}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>تاريخ الفاتورة :</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
          </View>
          {notesText ? (
            <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaLabel}>الملاحظات :</Text>
              <Text style={styles.metaVal}>{notesText}</Text>
            </View>
          ) : (
            <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaLabel}>الملاحظات :</Text>
              <Text style={styles.metaVal}> </Text>
            </View>
          )}
        </View>

        {/* ─── Items table (7 cols, RTL) — product names dynamic ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "26%" }]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>سعر الوحدة</Text>
              <Text style={styles.thEn}>Unit price</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>الضرائب</Text>
              <Text style={styles.thEn}>Taxes</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>المبلغ</Text>
              <Text style={styles.thEn}>Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "13%" }]}>
              <Text style={styles.thAr}>قيمة الضريبة</Text>
              <Text style={styles.thEn}>VAT Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "15%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>السعر الاجمالي</Text>
              <Text style={styles.thEn}>Total Price</Text>
            </View>
          </View>

          {items.map((item, idx) => {
            const ext = getItemExt(item);
            const unitText = toText(ext.unitName);
            return (
              <View key={item.position ?? idx} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "26%" }]}>
                  <Text style={styles.tdMain}>{item.description || ""}</Text>
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatQty(item.quantity)}</Text>
                  {unitText ? <Text style={styles.tdSub}>{unitText}</Text> : null}
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdMain}>{formatVatPct(item.vatRate)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.lineSubtotal)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "13%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.lineVat)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "15%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Totals + QR ─── */}
        <View style={styles.bottomSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(subtotalVal)}</Text>
              <Text style={styles.totalKey}>Subtotal / الإجمالي الفرعي</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(discountVal)}</Text>
              <Text style={styles.totalKey}>Discount / الخصم</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(vatVal)}</Text>
              <Text style={styles.totalKey}>VAT / (%15) القيمة المضافة</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowGrand]}>
              <Text style={[styles.totalVal, styles.grandVal]}>{formatNumber(totalVal)}</Text>
              <Text style={[styles.totalKey, styles.grandVal]}>Total / المجموع</Text>
            </View>
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.totalVal}>
                {formatNumber(totalVal)} :نقدا
              </Text>
              <Text style={styles.totalKey}>{currencyText}</Text>
            </View>
          </View>
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Footer policy note — company field, never hardcoded ─── */}
        {footerNote ? (
          <View style={styles.footerNoteBox}>
            <Text style={styles.footerNoteText}>{footerNote}</Text>
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
    fontSize: 7.5,
    color: "#111827",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerSide: {
    width: "36%",
    alignItems: "center",
  },
  headerName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
  },
  headerNameEn: {
    fontSize: 7,
    color: "#6B7280",
    textAlign: "center",
  },
  headerLogoWrap: {
    width: "26%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 64,
    height: 64,
    objectFit: "contain",
  },
  // ─── Parties box ───
  partiesBox: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 8,
  },
  partiesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  partiesHeaderCell: {
    width: "50%",
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    paddingVertical: 3,
  },
  partyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 17,
    alignItems: "stretch",
  },
  partyCell: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 0.5,
    borderLeftColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  partyLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  partyVal: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
  },
  // ─── Title + meta ───
  invoiceTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
    marginBottom: 4,
  },
  metaBox: {
    alignItems: "flex-end",
    marginBottom: 8,
    paddingRight: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    paddingVertical: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: "#374151",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6,
    color: "#4C1D95",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 20,
    alignItems: "stretch",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7,
    color: "#111827",
    textAlign: "center",
  },
  tdSub: {
    fontSize: 6,
    color: "#6B7280",
    textAlign: "center",
  },
  // ─── Totals + QR ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  totalsBox: {
    width: "58%",
    borderWidth: 1,
    borderColor: "#111827",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  totalRowGrand: {
    backgroundColor: "#EDE9FE",
  },
  totalKey: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#4C1D95",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
  },
  grandVal: {
    fontSize: 8.5,
  },
  qrCol: {
    width: "38%",
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 130,
    height: 130,
  },
  qrPlaceholder: {
    width: 130,
    height: 130,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  // ─── Footer note (company field) ───
  footerNoteBox: {
    borderWidth: 1,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  footerNoteText: {
    fontSize: 7.5,
    color: "#111827",
    textAlign: "center",
    lineHeight: 1.5,
  },
});
