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

export interface GenericFoodstuffs24TemplateProps {
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

// ─── Scan mapping (Bin Munsir-style foodstuffs invoice) ───
// WHY each scan region is handled this way:
// - Boxed header (EN block left / logo center / AR block right): rendered
//   dynamically from CompanyRecord + logoDataUrl only. No store names, no
//   phones, no C.R./VAT numbers are written literally — every value falls
//   back to "" when absent.
// - Meta strip (invoice no / date / VAT numbers): doc number is the invoice's
//   own invoiceNumber, date is issueDate (+issueTime), VATs are company and
//   customer vatNumber fields. Nothing invented.
// - Items grid: scan has dense per-column data (case/qty/rate/...) with no
//   backing DTO columns — collapsed to the 7 basic columns the DTO carries
//   (Code/Description/Qty/Price/Disc/VAT/Total).
// - Footer Arabic terms block: scan shows static shop terms; those are that
//   shop's own text, so only invoice.notes (when present) + currency +
//   printed-on + QR render here.

// WHY: savedProductId is an internal UUID FK (z.string().uuid()), never a
// printable code — the Code cell shows the row number instead.
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

export function GenericFoodstuffs24Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
}: GenericFoodstuffs24TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values (all dynamic) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddress = companyAddressLine(company);
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";

  // ─── Document + client values (all dynamic) ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const issueTimeStr = invoice.issueTime || "";
  const customerName = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerNo = customer.unifiedNumber || "";
  const customerPhone = customer.phone || "";
  const customerAddress = customerAddressLine(customer);
  const customerVat = customer.vatNumber || "";

  // ─── Items + totals (empty items render a placeholder row) ───
  const items = invoice.items ?? [];
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
      title={`TAX INVOICE ${docNo}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* ─── Boxed header: EN (left) / logo (center) / AR (right) ─── */}
        <View style={styles.headerBox}>
          <View style={styles.headerColLeft}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLine}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <Text style={styles.headerLine}>Mobile: {companyPhone}</Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.headerLine}>C.R: {companyCr}</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.headerLine}>VAT No: {companyVat}</Text>
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
              <Text style={styles.headerLine}>جوال: {companyPhone}</Text>
            ) : null}
            {companyCr ? (
              <Text style={styles.headerLine}>سجل تجاري: {companyCr}</Text>
            ) : null}
            {companyVat ? (
              <Text style={styles.headerLine}>
                الرقم الضريبي: {companyVat}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── Title band ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleMain}>فاتورة ضريبية TAX INVOICE</Text>
          {docNo ? <Text style={styles.titleDoc}># {docNo}</Text> : null}
          {issueDateStr ? (
            <Text style={styles.titleDoc}>
              {issueDateStr}
              {issueTimeStr ? ` ${issueTimeStr}` : ""}
            </Text>
          ) : null}
        </View>

        {/* ─── Client details block (dynamic values only) ─── */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>اسم العميل Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerName}
                {customerNameEn ? ` / ${customerNameEn}` : ""}
                {customerNo ? ` (${customerNo})` : ""}
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

        {/* ─── Items table (basic DTO columns only) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>كود الصنف</Text>
              <Text style={styles.thEn}>Code</Text>
            </View>
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thAr}>الوصف</Text>
              <Text style={styles.thEn}>Description</Text>
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
              <Text style={styles.thAr}>الإجمالي شامل الضريبة</Text>
              <Text style={styles.thEn}>Amount Incl VAT</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View
                style={[styles.tdCell, { width: "100%", borderLeftWidth: 0 }]}
              >
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

        {/* ─── Footer: notes + currency + QR only ─── */}
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
    backgroundColor: "#FFFEF7",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#2E2300",
  },
  // ─── Boxed header (scan's double-gold rounded frame, cream fill) ───
  headerBox: {
    flexDirection: "row",
    backgroundColor: "#FDF6DC",
    borderWidth: 1.5,
    borderColor: "#B8860B",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
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
    fontSize: 12,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6B4E00",
    textAlign: "left",
  },
  headerLine: {
    fontSize: 7.5,
    color: "#5C4A1A",
  },
  titleBand: {
    backgroundColor: "#A67C00",
    borderWidth: 1,
    borderColor: "#7A5C00",
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  titleMain: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleDoc: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#F7ECC8",
    textAlign: "center",
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: "#FFFDF0",
    borderWidth: 1,
    borderColor: "#B8860B",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9C47A",
    minHeight: 19,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#D9C47A",
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
    color: "#7A5C00",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#2E2300",
    textAlign: "right",
  },
  table: {
    borderWidth: 1.25,
    borderColor: "#B8860B",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F0DFA8",
    borderBottomWidth: 1,
    borderBottomColor: "#B8860B",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#B8860B",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#7A5C00",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9C47A",
    minHeight: 19,
    alignItems: "stretch",
  },
  totalsRow: {
    backgroundColor: "#E8D48B",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#B8860B",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#D9C47A",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7.5,
    color: "#2E2300",
    textAlign: "center",
  },
  tdBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4A3600",
    textAlign: "center",
  },
  footerNote: {
    fontSize: 7.5,
    color: "#5C4A1A",
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
