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

// ─── Scan mapping (AL-ASMA simplified tax invoice, B&W minimal) ───
// WHY each scan region is handled this way:
// - Outer thin black rounded rectangle: a wrapping View (borderRadius) holds
//   the whole invoice on the white page.
// - Header (company stacked lines left / QR in bordered box right): company
//   lines render from CompanyRecord (nameEn/nameAr/address/phone/email with
//   "" fallbacks) left-aligned; the QR box renders only when qrDataUrl is
//   provided — no placeholder graphic. A full-width divider sits below.
// - Info grid (Customer Name|Invoice No, Address|Date, VAT Number|blank):
//   values are the invoice's own data; the Gregorian date renders with an
//   Eastern-Arabic-digit second line beneath it (same date, converted digits
//   — not a second data source).
// - Centered underlined bilingual title: static layout labels only.
// - Table (black header, white rows, thin grid): SI is the row position
//   (never a UUID); Description is item.description as-is (single field —
//   no invented EN/AR split); Unit reads an optional extension field and
//   stays "" when absent; Gross is derived qty × unitPrice; VAT/Total come
//   from the DTO. All numbers right-aligned.
// - Footer (Amount in Words left / 4-row summary right): the DTO carries no
//   amount-in-words, so the label renders with a blank value (layout without
//   invented text); the summary sums the rows (Gross/Discount/VAT/Grand).

// WHY: savedProductId is an internal UUID FK (z.string().uuid()), never a
// printable code — SI shows the row position instead.
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

// InvoiceItemDto carries no unit column; read it only when a caller provides
// one via extension fields, otherwise the cell stays empty (never invented).
interface ItemUnitExtensions {
  unit?: string | null;
  unitName?: string | null;
  uom?: string | null;
}

function getItemUnit(item: InvoiceItemDto): string {
  const rec = item as InvoiceItemDto & Partial<ItemUnitExtensions>;
  return rec.unit ?? rec.unitName ?? rec.uom ?? "";
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

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

// Same calendar date, Eastern-Arabic glyphs — a presentation variant of the
// Gregorian line above it, matching the scan's two-line date cell.
function toEasternArabicDigits(str: string): string {
  return str.replace(/\d/g, (d) => EASTERN_DIGITS[Number(d)] ?? d);
}

function companyLine2(company: CompanyRecord): string {
  const parts = [company.addressDistrict ?? "", company.addressCity ?? ""]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.join(" ");
}

function companyLine3(company: CompanyRecord): string {
  const parts = [
    company.addressStreet ?? "",
    company.addressCity ?? "",
    company.addressPostalCode ?? "",
  ]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.join(" ");
}

export function GenericSimplified25Template({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
}: GenericSimplified25TemplateProps) {
  const paperSize: "A4" | "LETTER" =
    settings?.paperSize === "Letter" ? "LETTER" : "A4";

  // ─── Header values (all dynamic, "" fallbacks) ───
  const companyTitle = company.nameEn || company.nameAr || "";
  const companySub1 = companyLine2(company);
  const companySub2 = companyLine3(company);
  const companyPhone = company.phone || "";
  const companyEmail = company.email || "";

  // ─── Info-grid values (all dynamic) ───
  const customerName =
    [customer.nameEn, customer.nameAr].filter((p) => (p ?? "").trim().length > 0).join(" / ") || "";
  const customerAddress = [customer.addressStreet ?? "", customer.addressCity ?? ""]
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(" ");
  const customerVat = customer.vatNumber || "";
  const docNo = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateShort(invoice.issueDate);
  const issueDateAr = issueDateStr ? toEasternArabicDigits(issueDateStr) : "";

  // ─── Items + totals ───
  const items = invoice.items ?? [];
  // WHY: Gross is the pre-discount extended price (qty × unitPrice);
  // lineSubtotal is already net of discount so it cannot serve as Gross.
  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unit = toNumber(item.unitPrice);
    const gross = qty * unit;
    const disc = toNumber(item.discountAmount);
    const vat = toNumber(item.lineVat);
    const total = toNumber(item.lineTotal);
    void isUuidLike;
    return {
      key: item.position ?? idx,
      si: String(idx + 1),
      desc: item.description || "",
      unitName: getItemUnit(item),
      qty,
      unit,
      gross,
      vat,
      total,
    };
  });
  const sumGross = rows.reduce((a, r) => a + r.gross, 0);
  const sumDisc = rows.reduce(
    (a, r, i) => a + toNumber(items[i]?.discountAmount),
    0,
  );
  const sumVat = rows.reduce((a, r) => a + r.vat, 0);
  const sumTotal = rows.reduce((a, r) => a + r.total, 0);
  const currencyText = invoice.currency || "SAR";
  void currencyText;

  return (
    <Document
      title={`Simplified Tax Invoice ${docNo}`}
      author={toText(companyTitle)}
      subject="Simplified Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {/* ─── Outer thin black rounded frame ─── */}
        <View style={styles.frame}>
          {/* ─── Header: company lines (left) / QR in bordered box (right) ─── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {companyTitle ? (
                <Text style={styles.companyTitle}>{companyTitle}</Text>
              ) : null}
              {companySub1 ? (
                <Text style={styles.headerSub}>{companySub1}</Text>
              ) : null}
              {companySub2 ? (
                <Text style={styles.headerSub}>{companySub2}</Text>
              ) : null}
              {companyPhone ? (
                <Text style={styles.headerSub}>{companyPhone}</Text>
              ) : null}
              {companyEmail ? (
                <Text style={styles.headerSub}>{companyEmail}</Text>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              {qrDataUrl ? (
                <View style={styles.qrBox}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ─── Info grid: label-value pairs ─── */}
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Customer Name : </Text>
                <Text style={styles.infoVal}>{customerName}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Invoice No : </Text>
                <Text style={styles.infoVal}>{docNo}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Address : </Text>
                <Text style={styles.infoVal}>{customerAddress}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Date : </Text>
                <Text style={styles.infoVal}>{issueDateStr}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>VAT Number : </Text>
                <Text style={styles.infoVal}>{customerVat}</Text>
              </View>
              <View style={styles.infoCell}>
                {issueDateAr ? (
                  <Text style={styles.infoValAr}>{issueDateAr}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ─── Centered underlined bilingual title ─── */}
          <Text style={styles.docTitle}>
            Simplified Tax Invoice - فاتورة ضريبية مبسطة
          </Text>

          {/* ─── Items table (black header, thin grid) ─── */}
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thMain}>SI</Text>
                <Text style={styles.thSub}>رقم</Text>
              </View>
              <View style={[styles.thCell, { width: "32%" }]}>
                <Text style={styles.thMain}>Description</Text>
                <Text style={styles.thSub}>وصف</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thMain}>Qty</Text>
                <Text style={styles.thSub}>الكمية</Text>
              </View>
              <View style={[styles.thCell, { width: "9%" }]}>
                <Text style={styles.thMain}>Unit</Text>
                <Text style={styles.thSub}>وحدة</Text>
              </View>
              <View style={[styles.thCell, { width: "11%" }]}>
                <Text style={styles.thMain}>Unit Price</Text>
                <Text style={styles.thSub}>السعر</Text>
              </View>
              <View style={[styles.thCell, { width: "11%" }]}>
                <Text style={styles.thMain}>Gross</Text>
                <Text style={styles.thSub}>إجمالي</Text>
              </View>
              <View style={[styles.thCell, { width: "11%" }]}>
                <Text style={styles.thMain}>VAT Amount</Text>
                <Text style={styles.thSub}>ضريبة</Text>
              </View>
              <View style={[styles.thCell, { width: "11%", borderRightWidth: 0 }]}>
                <Text style={styles.thMain}>Total</Text>
                <Text style={styles.thSub}>مجموع</Text>
              </View>
            </View>

            {rows.length === 0 ? (
              <View style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "100%", borderRightWidth: 0 }]}>
                  <Text style={styles.tdDesc}>No items / لا توجد أصناف</Text>
                </View>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <View style={[styles.tdCell, { width: "6%" }]}>
                    <Text style={styles.tdNum}>{row.si}</Text>
                  </View>
                  <View style={[styles.tdCell, styles.tdDescCell, { width: "32%" }]}>
                    <Text style={styles.tdDesc}>{row.desc}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "9%" }]}>
                    <Text style={styles.tdNum}>{formatQty(row.qty)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "9%" }]}>
                    <Text style={styles.tdNum}>{row.unitName}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "11%" }]}>
                    <Text style={styles.tdNum}>{formatNumber(row.unit)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "11%" }]}>
                    <Text style={styles.tdNum}>{formatNumber(row.gross)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "11%" }]}>
                    <Text style={styles.tdNum}>{formatNumber(row.vat)}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: "11%", borderRightWidth: 0 }]}>
                    <Text style={styles.tdNum}>{formatNumber(row.total)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ─── Footer: Amount in Words (left) / summary box (right) ─── */}
          <View style={styles.footerRow}>
            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>
                Amount in Words : المبلغ بالكلمات
              </Text>
              {toText(invoice.notes) ? (
                <Text style={styles.wordsVal}>{toText(invoice.notes)}</Text>
              ) : null}
            </View>
            <View style={styles.summaryBox}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Total Gross / مجموع الإجمالي</Text>
                <Text style={styles.sumVal}>{formatNumber(sumGross)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Total Discount / مجموع الخصم</Text>
                <Text style={styles.sumVal}>{formatNumber(sumDisc)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Total VAT / مجموع الضريبة</Text>
                <Text style={styles.sumVal}>{formatNumber(sumVat)}</Text>
              </View>
              <View style={[styles.sumRow, styles.sumGrandRow]}>
                <Text style={styles.sumGrandLabel}>Grand Total / المجموع الكلي</Text>
                <Text style={styles.sumGrandVal}>{formatNumber(sumTotal)}</Text>
              </View>
            </View>
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
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 8,
    color: "#000000",
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
    marginBottom: 6,
  },
  headerLeft: {
    width: "65%",
    alignItems: "flex-start",
  },
  headerRight: {
    width: "35%",
    alignItems: "flex-end",
  },
  companyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  headerSub: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "left",
  },
  qrBox: {
    borderWidth: 0.75,
    borderColor: "#000000",
    padding: 4,
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginBottom: 6,
  },
  // ─── Info grid ───
  infoGrid: {
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    minHeight: 14,
  },
  infoCell: {
    width: "50%",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  infoLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  infoVal: {
    fontSize: 7.5,
    color: "#000000",
  },
  infoValAr: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  // ─── Underlined bilingual title ───
  docTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    textDecorationLine: "underline",
    marginVertical: 6,
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
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thMain: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  thSub: {
    fontSize: 6.5,
    color: "#FFFFFF",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    minHeight: 18,
    alignItems: "stretch",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#999999",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  tdDescCell: {
    alignItems: "flex-start",
  },
  tdNum: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  tdDesc: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  // ─── Footer ───
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  wordsBox: {
    width: "55%",
    paddingVertical: 2,
  },
  wordsLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  wordsVal: {
    fontSize: 7.5,
    color: "#333333",
    textAlign: "left",
    marginTop: 2,
  },
  summaryBox: {
    width: "45%",
    borderWidth: 1,
    borderColor: "#000000",
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  sumGrandRow: {
    borderBottomWidth: 0,
  },
  sumLabel: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "left",
  },
  sumVal: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "right",
  },
  sumGrandLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  sumGrandVal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },
});
