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

export interface GenericDeliveryNoteTemplateProps {
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

// ─── Optional extension fields (legacy ERP / dot-matrix columns). ───
// WHY: InvoiceDto has no salesman field and CompanyRecord has no fax/toll-free
// fields, so we read them via optional chaining and fall back to "" — never crash,
// never hardcode. InvoiceItemDto carries only savedProductId as a code-ish field,
// so it doubles as the printed product code.
interface DeliveryNoteInvoiceExtensions {
  salesman?: string | null;
  salesmanName?: string | null;
  salesMan?: string | null;
}

interface DeliveryNoteCompanyExtensions {
  fax?: string | null;
  faxNumber?: string | null;
  tollFree?: string | null;
  tollFreeNumber?: string | null;
  poBox?: string | null;
}

function getSalesman(invoice: InvoiceDto): string {
  const rec = invoice as InvoiceDto & Partial<DeliveryNoteInvoiceExtensions>;
  return rec.salesman ?? rec.salesmanName ?? rec.salesMan ?? "";
}

function getCompanyExt(company: CompanyRecord): DeliveryNoteCompanyExtensions {
  const rec = company as CompanyRecord & Partial<DeliveryNoteCompanyExtensions>;
  return {
    fax: rec.fax ?? rec.faxNumber ?? null,
    tollFree: rec.tollFree ?? rec.tollFreeNumber ?? null,
    poBox: rec.poBox ?? null,
  };
}

// WHY: savedProductId is the only code-ish column on InvoiceItemDto; fall back to
// the row position so the code column is never empty on legacy data.
function getProductCode(item: InvoiceItemDto, index: number): string {
  const rec = item as InvoiceItemDto & { productCode?: string | null; code?: string | null };
  const code = rec.productCode ?? rec.code ?? rec.savedProductId ?? null;
  if (code === null || code === undefined || String(code).trim() === "") {
    return String(index + 1);
  }
  return String(code);
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

function companyAddressLine(company: CompanyRecord): string {
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

function customerAddressLine(customer: CustomerRecord): string {
  const parts = [
    customer.addressStreet ?? "",
    customer.addressCity ?? "",
    customer.addressPostalCode ?? "",
  ].filter((p) => p.length > 0);
  return parts.join(" ");
}

export function GenericDeliveryNoteTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
}: GenericDeliveryNoteTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header (all dynamic, "" fallbacks) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddress = companyAddressLine(company);
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyExt = getCompanyExt(company);

  // ─── Meta (all dynamic) ───
  const issueDateStr = formatDateShort(invoice.issueDate);
  const deliveryNoteNo = invoice.invoiceNumber ?? "";
  // WHY: CustomerRecord has no dedicated code column; unifiedNumber doubles as
  // the printed customer code next to the phone.
  const customerCode = customer.unifiedNumber || "";
  const customerPhone = customer.phone || "";
  const customerName = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerAddress = customerAddressLine(customer);
  const customerVat = customer.vatNumber || "";
  const salesman = getSalesman(invoice);

  // ─── Items + totals (all dynamic; empty items render a placeholder row) ───
  const items = invoice.items ?? [];
  // WHY: the scan's "Goods Value" column is the pre-discount extended price, so
  // it is derived as qty × unitPrice (lineSubtotal is already net of discount).
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const goods = qty * toNumber(item.unitPrice);
    const disc = toNumber(item.discountAmount);
    const vat = toNumber(item.lineVat);
    const total = toNumber(item.lineTotal);
    return { key: item.position ?? idx, code: getProductCode(item, idx), desc: item.description || "", qty, goods, disc, vat, total };
  });
  const sumQty = rows.reduce((a, r) => a + r.qty, 0);
  const sumGoods = rows.reduce((a, r) => a + r.goods, 0);
  const sumDisc = rows.reduce((a, r) => a + r.disc, 0);
  const sumVat = rows.reduce((a, r) => a + r.vat, 0);
  const sumTotal = rows.reduce((a, r) => a + r.total, 0);
  const currencyText = invoice.currency || "SAR";
  const printedOn = new Date().toISOString().slice(0, 10);

  return (
    <Document
      title={`بيان تسليم ${deliveryNoteNo}`}
      author={companyNameAr}
      subject="Delivery Note"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* ─── Centered header: logo + bilingual name + address + phones + VAT/CR ─── */}
        <View style={styles.header}>
          {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImg} /> : null}
          {companyNameAr ? <Text style={styles.companyNameAr}>{companyNameAr}</Text> : null}
          {companyNameEn ? <Text style={styles.companyNameEn}>{companyNameEn}</Text> : null}
          {companyAddress ? <Text style={styles.headerLine}>{companyAddress}</Text> : null}
          {companyExt.poBox ? <Text style={styles.headerLine}>P.O. Box {companyExt.poBox} ص.ب</Text> : null}
          <Text style={styles.headerLine}>
            Tel {companyPhone} تليفون{companyExt.fax ? `   Fax ${companyExt.fax} فاكس` : ""}
          </Text>
          {companyExt.tollFree ? (
            <Text style={styles.headerLine}>Toll Free {companyExt.tollFree} الرقم المجاني</Text>
          ) : null}
          {companyVat ? (
            <Text style={styles.headerLine}>الرقم الضريبي VAT No: {companyVat}</Text>
          ) : null}
          {companyCr ? <Text style={styles.headerLine}>سجل تجاري C.R: {companyCr}</Text> : null}
        </View>

        {/* ─── Title band ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleOriginal}>أصلي ORIGINAL</Text>
          <Text style={styles.titleMain}>بيان تسليم بضاعة Delivery Note</Text>
          <Text style={styles.titleSpacer}> </Text>
        </View>

        {/* ─── Meta grid (bilingual labels, dynamic values) ─── */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>التاريخ Date</Text>
              <Text style={styles.metaVal}>{issueDateStr}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>رقم بيان التسليم Delivery Note No</Text>
              <Text style={styles.metaVal}>{deliveryNoteNo}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>اسم العميل Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerName}
                {customerNameEn ? ` / ${customerNameEn}` : ""}
                {customerCode ? ` (${customerCode})` : ""}
                {customerPhone ? ` - ${customerPhone}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>عنوان العميل Address</Text>
              <Text style={styles.metaVal}>{customerAddress}</Text>
            </View>
          </View>
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>الرقم الضريبي للعميل VAT</Text>
              <Text style={styles.metaVal}>{customerVat}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>المندوب Salesman</Text>
              <Text style={styles.metaVal}>{salesman}</Text>
            </View>
          </View>
        </View>

        {/* ─── Items table (monochrome, thin borders, RTL column order) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>كود الصنف</Text>
              <Text style={styles.thEn}>Prd Code</Text>
            </View>
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thAr}>وصف الصنف</Text>
              <Text style={styles.thEn}>Product Description</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>القيمة</Text>
              <Text style={styles.thEn}>Goods Value</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Disc</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "14%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>الإجمالي</Text>
              <Text style={styles.thEn}>Total</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={[styles.tdCell, { width: "100%", borderLeftWidth: 0 }]}>
                <Text style={styles.tdMain}>لا توجد أصناف No items</Text>
              </View>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{row.code}</Text>
                </View>
                <View style={[styles.tdCell, { width: "30%" }]}>
                  <Text style={styles.tdMain}>{row.desc}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatQty(row.qty)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.goods)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.disc)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.vat)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "14%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.total)}</Text>
                </View>
              </View>
            ))
          )}

          {/* ─── Totals row ─── */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>TOTAL</Text>
            </View>
            <View style={[styles.tdCell, { width: "30%" }]}>
              <Text style={styles.tdBold}>الإجمالي</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>{formatQty(sumQty)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumGoods)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumDisc)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumVat)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "14%", borderLeftWidth: 0 }]}>
              <Text style={styles.tdBold}>{formatNumber(sumTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Footer: signatures + currency note + printed-on + QR ─── */}
        <View style={styles.footerRow}>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>توقيع المندوب Salesman Signature</Text>
            <Text style={styles.sigSpace}> </Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>توقيع العميل Customer Signature</Text>
            <Text style={styles.sigSpace}> </Text>
          </View>
          <View style={styles.qrCol}>
            {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrImage} /> : null}
          </View>
        </View>

        <Text style={styles.footerNote}>Amounts are in {toText(currencyText)} المبالغ بالريال</Text>
        <Text style={styles.footerNote}>Printed On طبع بتاريخ: {printedOn}</Text>
        {toText(invoice.notes) ? <Text style={styles.footerNote}>{toText(invoice.notes)}</Text> : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
  },
  // ─── Header (centered, dot-matrix feel) ───
  header: {
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
    marginBottom: 8,
  },
  logoImg: {
    width: 56,
    height: 56,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameAr: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  companyNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
  },
  headerLine: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "center",
  },
  // ─── Title band ───
  titleBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  titleMain: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  titleOriginal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 1,
    paddingHorizontal: 5,
  },
  titleSpacer: {
    fontSize: 7.5,
    minWidth: 52,
  },
  // ─── Meta grid ───
  metaBox: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#666666",
    minHeight: 19,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#666666",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  metaCellWide: {
    width: "100%",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // ─── Items table ───
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#333333",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#666666",
    minHeight: 19,
    alignItems: "stretch",
  },
  totalsRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#000000",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#666666",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
  },
  tdBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  // ─── Footer ───
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  sigBox: {
    width: "38%",
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 52,
  },
  sigLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  sigSpace: {
    fontSize: 7.5,
    minHeight: 28,
  },
  qrCol: {
    width: "20%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  footerNote: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "center",
    marginTop: 2,
  },
});
