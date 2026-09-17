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

export interface GenericDotmatrix22TemplateProps {
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

// ─── No hardcoded business data ───
// WHY: the attached scan shows a specific company's header (EN left / logo
// center / AR right) plus customer/VAT blocks. This template reproduces only
// the LAYOUT: every printed value comes from CompanyRecord / CustomerRecord /
// InvoiceDto with "" fallbacks. Logo/QR render only when data URLs are
// provided — no fallback images, no invented names, numbers, or footers.
// InvoiceDto has no salesman/channel/credit-note columns, so those scan rows
// are intentionally omitted rather than fabricated.

// WHY: savedProductId is an internal UUID FK (z.string().uuid()), never a
// printable code — the Prd Code cell shows the row number instead.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  const text = value.trim();
  if (UUID_RE.test(text)) return true;
  // Lenient: long hex-and-dashes strings (wrapped/truncated UUIDs) are also
  // internal ids, never real product codes (real codes are short).
  if (
    text.length >= 20 &&
    (text.match(/-/g) || []).length >= 2 &&
    /^[0-9a-f-]+$/i.test(text)
  ) {
    return true;
  }
  return false;
}

function getProductCode(item: InvoiceItemDto, index: number): string {
  const rec = item as InvoiceItemDto & {
    productCode?: string | null;
    code?: string | null;
  };
  const candidates = [rec.productCode, rec.code, rec.savedProductId];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (text === "" || isUuidLike(text)) continue;
    return text;
  }
  return String(index + 1);
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

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function companyAddressLine(company: CompanyRecord): string {
  const parts = [
    company.addressBuildingNumber
      ? `مبنى ${company.addressBuildingNumber}`
      : "",
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

export function GenericDotmatrix22Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
}: GenericDotmatrix22TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values (all dynamic) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddress = companyAddressLine(company);
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";

  // ─── Meta values (all dynamic) ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const issueTimeStr = invoice.issueTime || "";
  const customerName = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerCode = customer.unifiedNumber || "";
  const customerPhone = customer.phone || "";
  const customerAddress = customerAddressLine(customer);
  const customerVat = customer.vatNumber || "";

  // ─── Items + totals (empty items render a placeholder row) ───
  const items = invoice.items ?? [];
  // WHY: unitPrice × qty is the pre-discount extended price; lineSubtotal is
  // already net of discount, so goods value is derived here.
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unit = toNumber(item.unitPrice);
    const goods = qty * unit;
    const disc = toNumber(item.discountAmount);
    const vat = toNumber(item.lineVat);
    const total = toNumber(item.lineTotal);
    return {
      key: item.position ?? idx,
      code: getProductCode(item, idx),
      desc: item.description || "",
      qty,
      unit,
      goods,
      disc,
      vat,
      total,
    };
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
      title={`Tax Invoice ${docNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* ─── Header: EN block (left) / logo (center) / AR block (right) ─── */}
        <View style={styles.headerRow}>
          <View style={styles.headerColLeft}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLine}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <Text style={styles.headerLine}>Tel: {companyPhone}</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.headerLine}>VAT No: {companyVat}</Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.headerLine}>C.R: {companyCr}</Text>
            ) : null}
          </View>
          <View style={styles.headerColCenter}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : null}
          </View>
          <View style={styles.headerColRight}>
            {companyNameAr ? (
              <Text style={styles.companyNameAr}>{companyNameAr}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLine}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <Text style={styles.headerLine}>تليفون: {companyPhone}</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.headerLine}>
                الرقم الضريبي: {companyVat}
              </Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.headerLine}>سجل تجاري: {companyCr}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── Title band (labels only — values are the invoice's own data) ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleMain}>فاتورة ضريبية TAX INVOICE</Text>
          {docNo ? <Text style={styles.titleDoc}>{docNo}</Text> : null}
        </View>

        {/* ─── Meta grid (bilingual labels, dynamic values) ─── */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>رقم المستند Document No</Text>
              <Text style={styles.metaVal}>{docNo}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.metaLabel}>التاريخ Date</Text>
              <Text style={styles.metaVal}>
                {issueDateStr}
                {issueTimeStr ? ` ${issueTimeStr}` : ""}
              </Text>
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
              <Text style={styles.metaLabel}>العملة Currency</Text>
              <Text style={styles.metaVal}>{currencyText}</Text>
            </View>
          </View>
        </View>

        {/* ─── Items table (monochrome dot-matrix feel, RTL column order) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>كود الصنف</Text>
              <Text style={styles.thEn}>Code</Text>
            </View>
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thAr}>اسم الصنف</Text>
              <Text style={styles.thEn}>Item Name</Text>
            </View>
            <View style={[styles.thCell, { width: "9%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Qty</Text>
            </View>
            <View style={[styles.thCell, { width: "11%" }]}>
              <Text style={styles.thAr}>السعر</Text>
              <Text style={styles.thEn}>Price</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Disc</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>الضريبة</Text>
              <Text style={styles.thEn}>VAT</Text>
            </View>
            <View style={[styles.thCell, { width: "18%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>المبلغ شامل الضريبة</Text>
              <Text style={styles.thEn}>Amount Incl VAT</Text>
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
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{row.code}</Text>
                </View>
                <View style={[styles.tdCell, { width: "30%" }]}>
                  <Text style={styles.tdMain}>{row.desc}</Text>
                </View>
                <View style={[styles.tdCell, { width: "9%" }]}>
                  <Text style={styles.tdMain}>{formatQty(row.qty)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "11%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.unit)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.disc)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(row.vat)}</Text>
                </View>
                <View
                  style={[styles.tdCell, { width: "18%", borderLeftWidth: 0 }]}
                >
                  <Text style={styles.tdMain}>{formatNumber(row.total)}</Text>
                </View>
              </View>
            ))
          )}

          {/* ─── Totals row ─── */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>TOTAL</Text>
            </View>
            <View style={[styles.tdCell, { width: "30%" }]}>
              <Text style={styles.tdBold}>الإجمالي</Text>
            </View>
            <View style={[styles.tdCell, { width: "9%" }]}>
              <Text style={styles.tdBold}>{formatQty(sumQty)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "11%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumGoods)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "10%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumDisc)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "12%" }]}>
              <Text style={styles.tdBold}>{formatNumber(sumVat)}</Text>
            </View>
            <View style={[styles.tdCell, { width: "18%", borderLeftWidth: 0 }]}>
              <Text style={styles.tdBold}>{formatNumber(sumTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Footer: notes + QR only (no invented signatures/stamps) ─── */}
        {toText(invoice.notes) ? (
          <Text style={styles.footerNote}>{toText(invoice.notes)}</Text>
        ) : null}
        <Text style={styles.footerNote}>
          Amounts are in {toText(currencyText)}
        </Text>
        <Text style={styles.footerNote}>Printed On طبع بتاريخ: {printedOn}</Text>
        {qrDataUrl ? (
          <View style={styles.qrRow}>
            <Image src={qrDataUrl} style={styles.qrImage} />
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
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
  },
  // ─── Header: 3-column scan layout (EN / logo / AR), NADA green theme ───
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1E6B3A",
    backgroundColor: "#F2F8F3",
    paddingVertical: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  headerColLeft: {
    width: "40%",
    alignItems: "flex-start",
  },
  headerColCenter: {
    width: "20%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerColRight: {
    width: "40%",
    alignItems: "flex-end",
  },
  logoImg: {
    width: 56,
    height: 56,
    objectFit: "contain",
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1E6B3A",
    textAlign: "left",
  },
  headerLine: {
    fontSize: 7.5,
    color: "#3A5A44",
  },
  // ─── Title band (solid NADA green like the scan's stamped header) ───
  titleBand: {
    backgroundColor: "#1E6B3A",
    borderWidth: 1,
    borderColor: "#14532D",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  titleMain: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleDoc: {
    fontSize: 8,
    color: "#D9EBDE",
    textAlign: "center",
    marginTop: 2,
  },
  // ─── Meta grid (green-ruled dot-matrix boxes) ───
  metaBox: {
    borderWidth: 1,
    borderColor: "#1E6B3A",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9DBEA9",
    minHeight: 19,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#9DBEA9",
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
    color: "#1E6B3A",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
  // ─── Items table (green-ruled, tinted header like the scan's grid) ───
  table: {
    borderWidth: 1,
    borderColor: "#1E6B3A",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EAF4EC",
    borderBottomWidth: 1,
    borderBottomColor: "#1E6B3A",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#1E6B3A",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#14532D",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#3A6B4A",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#B9D2C0",
    minHeight: 19,
    alignItems: "stretch",
  },
  totalsRow: {
    backgroundColor: "#EAF4EC",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#1E6B3A",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#B9D2C0",
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
    color: "#14532D",
    textAlign: "center",
  },
  // ─── Footer ───
  footerNote: {
    fontSize: 7.5,
    color: "#3A5A44",
    textAlign: "center",
    marginTop: 2,
  },
  qrRow: {
    alignItems: "center",
    marginTop: 8,
  },
  qrImage: {
    width: 72,
    height: 72,
  },
});
