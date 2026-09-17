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

export interface GenericBranch23TemplateProps {
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

// ─── Annotation mapping (Image 1) ───
// WHY each scan region is handled this way:
// - Top red box (company data + logo): admin identifier — rendered dynamically
//   from CompanyRecord (nameAr/nameEn/address/phone/VAT/CR) + logoDataUrl only.
//   No "to client" company duplication anywhere else.
// - Red strip (LOCATION / RTS / SMAN / Delivery Date / TIME / PAGE): annotated
//   "not needed" — omitted entirely, no invented values.
// - Title (TAX INVOICE # + فاتورة ضريبية): doc number is the invoice's own
//   invoiceNumber; no payment-mode text (InvoiceDto has no such column).
// - Green boxes (client details + branch block): customer fields render when
//   present; Branch/Owner/Shopkeeper/PO/RTV have NO columns in CustomerRecord
//   or InvoiceDto, so their labels are printed with EMPTY values per the
//   yellow note ("write in template BUT LEAVE EMPTY") — labels are layout,
//   not hardcoded data.
// - Items grid: scan has ~10 dense columns (case/per-pc/etax/...) with no
//   backing data — collapsed to the 7 basic columns the DTO actually carries.

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

// Branch/extended rows: label pairs are static layout text; every VALUE is ""
// on purpose — no such columns exist in the DTOs, so nothing is invented.
const EMPTY_BRANCH_ROWS: Array<{ en: string; ar: string }> = [
  { en: "Branch Name", ar: "اسم الفرع" },
  { en: "Owner Name", ar: "اسم المالك" },
  { en: "Shop keeper Name", ar: "اسم البائع" },
  { en: "PO Number", ar: "رقم أمر الشراء" },
  { en: "RTV Number", ar: "رقم المرتجع" },
];

export function GenericBranch23Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
}: GenericBranch23TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values (all dynamic — admin identifier only) ───
  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyAddress = companyAddressLine(company);
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";

  // ─── Document + client values (all dynamic) ───
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const customerName = customer.nameAr || "";
  const customerNameEn = customer.nameEn || "";
  const customerNo = customer.unifiedNumber || "";
  const customerAddress = customerAddressLine(customer);
  const customerVat = customer.vatNumber || "";
  // WHY: CustomerRecord has no separate "other id" column; unifiedNumber is
  // the only id-ish field, so it doubles here and stays "" when absent.
  const customerOtherId = customer.unifiedNumber || "";

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
        {/* ─── Header: company data + logo (admin identifier, dynamic only) ─── */}
        <View style={styles.headerRow}>
          <View style={styles.headerColLeft}>
            {companyNameEn ? (
              <Text style={styles.companyNameEn}>{companyNameEn}</Text>
            ) : null}
            {companyAddress ? (
              <Text style={styles.headerLine}>{companyAddress}</Text>
            ) : null}
            {companyPhone ? (
              <Text style={styles.headerLine}>TEL: {companyPhone}</Text>
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
              <Text style={styles.headerLine}>هاتف: {companyPhone}</Text>
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

        {/* ─── Title band (labels + own doc number only) ─── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleMain}>فاتورة ضريبية TAX INVOICE</Text>
          {docNo ? <Text style={styles.titleDoc}># {docNo}</Text> : null}
          {issueDateStr ? (
            <Text style={styles.titleDoc}>{issueDateStr}</Text>
          ) : null}
        </View>

        {/* ─── Client details block (dynamic values) ─── */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <View style={styles.metaCellWide}>
              <Text style={styles.metaLabel}>اسم العميل Customer Name</Text>
              <Text style={styles.metaVal}>
                {customerName}
                {customerNameEn ? ` / ${customerNameEn}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>رقم العميل Customer No</Text>
              <Text style={styles.metaVal}>{customerNo}</Text>
            </View>
            <View style={[styles.metaCell, { borderLeftWidth: 0 }]}>
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
              <Text style={styles.metaLabel}>الرقم الآخر Other Id</Text>
              <Text style={styles.metaVal}>{customerOtherId}</Text>
            </View>
          </View>
        </View>

        {/* ─── Branch / extended block (labels with EMPTY values — no data exists) ─── */}
        <View style={styles.metaBox}>
          {EMPTY_BRANCH_ROWS.map((row) => (
            <View key={row.en} style={styles.metaRow}>
              <View style={styles.metaCellWide}>
                <Text style={styles.metaLabel}>
                  {row.ar} {row.en}
                </Text>
                <Text style={styles.metaVal}> </Text>
              </View>
            </View>
          ))}
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
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#0B4DA2",
    borderRadius: 4,
    backgroundColor: "#EAF1F9",
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
    fontSize: 12,
    fontWeight: "bold",
    color: "#0B4DA2",
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0B4DA2",
    textAlign: "left",
  },
  headerLine: {
    fontSize: 7.5,
    color: "#33475F",
  },
  titleBand: {
    backgroundColor: "#0B4DA2",
    borderWidth: 1,
    borderColor: "#083A7A",
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
    color: "#CFE1F7",
    textAlign: "center",
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: "#F2F7FD",
    borderWidth: 1,
    borderColor: "#0B4DA2",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9BB6D8",
    minHeight: 19,
    alignItems: "stretch",
  },
  metaCell: {
    width: "50%",
    borderLeftWidth: 0.5,
    borderLeftColor: "#9BB6D8",
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
    color: "#0B4DA2",
    textAlign: "right",
  },
  metaVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#102A43",
    textAlign: "right",
  },
  table: {
    borderWidth: 1.25,
    borderColor: "#0B4DA2",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#0B4DA2",
    borderBottomWidth: 1,
    borderBottomColor: "#083A7A",
    minHeight: 28,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#7FA8D7",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6.5,
    color: "#CFE1F7",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#B9CFE8",
    minHeight: 19,
    alignItems: "stretch",
  },
  totalsRow: {
    backgroundColor: "#DCE9F8",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#0B4DA2",
  },
  tdCell: {
    borderLeftWidth: 0.5,
    borderLeftColor: "#B9CFE8",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tdMain: {
    fontSize: 7.5,
    color: "#102A43",
    textAlign: "center",
  },
  tdBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0B4DA2",
    textAlign: "center",
  },
  footerNote: {
    fontSize: 7.5,
    color: "#33475F",
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
