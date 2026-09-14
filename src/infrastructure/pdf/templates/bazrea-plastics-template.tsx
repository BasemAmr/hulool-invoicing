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

export interface BazreaPlasticsTemplateProps {
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

interface BazreaInvoiceExtensions {
  refCode?: string | number | null;
  refNo?: string | number | null;
  moreInfo?: string | null;
  notes2?: string | null;
  charges?: string | number | null;
  chargeTotal?: string | number | null;
  discountTotal?: string | number | null;
  taxableAmount?: string | number | null;
  paymentMethod?: string | null;
}

interface BazreaItemExtensions {
  itemCode?: string | number | null;
  itemNo?: string | number | null;
  barcode?: string | number | null;
  sku?: string | number | null;
  itemName?: string | null;
  unitName?: string | null;
  unit?: string | null;
}

interface BazreaCompanyExtensions {
  fax?: string | number | null;
  faxNo?: string | number | null;
  poBox?: string | number | null;
  pbox?: string | number | null;
  branchName?: string | null;
}

interface BazreaCustomerExtensions {
  taxCode?: string | number | null;
  countryCity?: string | null;
  poBoxCode?: string | number | null;
}

function getInvoiceExt(invoice: InvoiceDto): BazreaInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<BazreaInvoiceExtensions>;
  return {
    refCode: rec.refCode ?? rec.refNo ?? null,
    moreInfo: rec.moreInfo ?? rec.notes2 ?? null,
    charges: rec.charges ?? rec.chargeTotal ?? null,
    discountTotal: rec.discountTotal ?? null,
    taxableAmount: rec.taxableAmount ?? null,
    paymentMethod: rec.paymentMethod ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): BazreaItemExtensions {
  const rec = item as InvoiceItemDto & Partial<BazreaItemExtensions>;
  return {
    itemCode: rec.itemCode ?? rec.itemNo ?? rec.barcode ?? rec.sku ?? null,
    itemName: rec.itemName ?? null,
    unitName: rec.unitName ?? rec.unit ?? null,
  };
}

function getCompanyExt(company: CompanyRecord): BazreaCompanyExtensions {
  const rec = company as CompanyRecord & Partial<BazreaCompanyExtensions>;
  return {
    fax: rec.fax ?? rec.faxNo ?? null,
    poBox: rec.poBox ?? rec.pbox ?? null,
    branchName: rec.branchName ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): BazreaCustomerExtensions {
  const rec = customer as CustomerRecord & Partial<BazreaCustomerExtensions>;
  return {
    taxCode: rec.taxCode ?? null,
    countryCity: rec.countryCity ?? null,
    poBoxCode: rec.poBoxCode ?? null,
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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, "/");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${mins}:${secs} ${ampm}`;
}

// ─── Arabic tafqeet ───

const ONES_AR = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS_AR = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const TENS_AR = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS_AR = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertThreeDigits(n: number): string {
  if (n <= 0) return "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0) {
    const label = HUNDREDS_AR[h];
    if (label) parts.push(label);
  }
  if (rem > 0) {
    if (rem < 10) {
      const label = ONES_AR[rem];
      if (label) parts.push(label);
    } else if (rem < 20) {
      const label = TEENS_AR[rem - 10];
      if (label) parts.push(label);
    } else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      const tensLabel = TENS_AR[t];
      if (u > 0) {
        const onesLabel = ONES_AR[u];
        if (onesLabel && tensLabel) parts.push(`${onesLabel} و${tensLabel}`);
        else if (onesLabel) parts.push(onesLabel);
      } else if (tensLabel) {
        parts.push(tensLabel);
      }
    }
  }
  return parts.join(" و");
}

function tafqeetBazrea(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);
  const groups: string[] = [];
  const thousands = Math.floor(riyals / 1000);
  const rest = riyals % 1000;
  if (thousands > 0) {
    if (thousands === 1) groups.push("ألف");
    else if (thousands === 2) groups.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) groups.push(`${convertThreeDigits(thousands)} آلاف`);
    else groups.push(`${convertThreeDigits(thousands)} ألف`);
  }
  if (rest > 0) groups.push(convertThreeDigits(rest));
  let text = groups.length > 0 ? groups.join(" و") : "صفر";
  text += " ريال سعودي";
  if (halalas > 0) text += ` و${convertThreeDigits(halalas)} هللة`;
  return text;
}

export function BazreaPlasticsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: BazreaPlasticsTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const compExt = getCompanyExt(company);
  const custExt = getCustomerExt(customer);

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateTime(invoice.issuedAt ?? invoice.issueDate);
  // Due Date / Ref.Code / More Info: crossed out on the annotated scan → only when data exists
  const dueDateStr = invoice.dueDate ? formatDateTime(invoice.dueDate) : "";
  const refCodeText = toText(invExt.refCode);
  const moreInfoText = toText(invExt.moreInfo);

  const companyNameAr = company.nameAr || "";
  const companyBranch = compExt.branchName || "";
  const companyPhone = company.phone || "";
  const companyFax = toText(compExt.fax);
  const companyPoBox = toText(compExt.poBox);
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyCity = company.addressCity || "";
  const companyStreet = company.addressStreet || "";

  const customerName = customer.nameAr || "";
  const customerTax = toText(custExt.taxCode ?? customer.vatNumber ?? "");
  const customerCountryCity = toText(
    custExt.countryCity ?? [customer.addressCity].filter(Boolean).join(" ") ?? "",
  );
  const customerAddress = toText(customer.addressStreet ?? "");
  const customerPoBox = toText(custExt.poBoxCode ?? customer.addressPostalCode ?? "");
  const customerEmail = customer.email || "";

  const items = invoice.items ?? [];
  const totalQty = items.reduce((sum, it) => sum + toNumber(it.quantity), 0);
  const subtotalVal = toNumber(invoice.subtotal);
  const discountVal = toNumber(invExt.discountTotal);
  const chargesVal = toNumber(invExt.charges);
  const taxableVal = toNumber(invExt.taxableAmount ?? subtotalVal - discountVal + chargesVal);
  const vatVal = toNumber(invoice.vatAmount);
  const totalVal = toNumber(invoice.total);
  const vatRatePct =
    items.length > 0 ? `${Math.round((items[0]?.vatRate ?? 0.15) * 100)}%` : "15%";
  const tafqeetText = tafqeetBazrea(totalVal);
  const currencyText = invoice.currency || "SAR";

  return (
    <Document
      title={`Tax Invoice ${invoiceNum}`}
      author={companyNameAr}
      subject="Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? <Image src={backgroundDataUrl} style={styles.backgroundImage} /> : null}

        {/* ─── Top strip: 1-1 left / company branch right (dynamic) ─── */}
        <View style={styles.topStrip}>
          <Text style={styles.topStripLeft}>1 - 1</Text>
          <View style={styles.topStripRight}>
            {companyNameAr ? <Text style={styles.topBranch}>{companyNameAr}</Text> : null}
            {companyBranch ? <Text style={styles.topBranch}>{companyBranch}</Text> : null}
            {companyStreet || companyCity ? (
              <Text style={styles.topBranchSmall}>
                {[companyStreet, companyCity].filter(Boolean).join(" - ")}
              </Text>
            ) : null}
            {companyPhone ? <Text style={styles.topBranchSmall}>جوال {companyPhone}</Text> : null}
          </View>
        </View>

        {/* ─── Header box: contacts left / title center / vat-crn right (dynamic) ─── */}
        <View style={styles.headerBox}>
          <View style={styles.headerLeft}>
            {companyPhone ? <Text style={styles.hLine}>Tele No. {companyPhone}</Text> : null}
            {companyFax ? <Text style={styles.hLine}>Fax No. {companyFax}</Text> : null}
            {companyPoBox ? <Text style={styles.hLine}>P.O.Box {companyPoBox}</Text> : null}
            {companyVat ? <Text style={styles.hLine}>Tax No. (TIN) : {companyVat}</Text> : null}
            {companyCr ? <Text style={styles.hLine}>CRN : {companyCr}</Text> : null}
          </View>
          <View style={styles.headerCenter}>
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImg} /> : null}
            <Text style={styles.titleAr}>فاتورة ضريبية</Text>
            <Text style={styles.titleEn}>Tax Invoice</Text>
          </View>
          <View style={styles.headerRight}>
            {companyVat ? <Text style={styles.hLineR}>الرقم الضريبي : {companyVat}</Text> : null}
            {companyCr ? <Text style={styles.hLineR}>رقم السجل التجاري : {companyCr}</Text> : null}
            <Text
              style={styles.hLineR}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

        {/* ─── Meta rows: number + date always; due/ref/more only when present (X annotation) ─── */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice Number / رقم الفاتورة</Text>
            <Text style={styles.metaValRed}>{invoiceNum}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice Date / تاريخ الفاتورة</Text>
            <Text style={styles.metaVal}>{issueDateStr}</Text>
          </View>
          {dueDateStr ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due Date / تاريخ الاستحقاق</Text>
              <Text style={styles.metaVal}>{dueDateStr}</Text>
            </View>
          ) : null}
          {refCodeText ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Ref. Code / رقم المرجع</Text>
              <Text style={styles.metaVal}>{refCodeText}</Text>
            </View>
          ) : null}
          {moreInfoText ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>More Info. / معلومات أخرى</Text>
              <Text style={styles.metaVal}>{moreInfoText}</Text>
            </View>
          ) : null}
        </View>

        {/* ─── Customer strip + QR ─── */}
        <View style={styles.customerBox}>
          <View style={styles.customerCol}>
            <View style={styles.custRow}>
              <Text style={styles.custLabel}>Customer / العميل</Text>
              <Text style={styles.custVal}>{customerName}</Text>
            </View>
            <View style={styles.custRow}>
              <Text style={styles.custLabel}>Cus Tax Code / الرقم الضريبي للعميل</Text>
              <Text style={styles.custVal}>{customerTax}</Text>
            </View>
            <View style={styles.custRow}>
              <Text style={styles.custLabel}>Country - City / الدولة - المدينة</Text>
              <Text style={styles.custVal}>{customerCountryCity}</Text>
            </View>
            <View style={styles.custRow}>
              <Text style={styles.custLabel}>Cust Address / عنوان العميل</Text>
              <Text style={styles.custVal}>{customerAddress}</Text>
            </View>
            <View style={styles.custRow}>
              <Text style={styles.custLabel}>P.O.BOX-Code / صندوق البريد</Text>
              <Text style={styles.custVal}>{customerPoBox}</Text>
            </View>
            <View style={[styles.custRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.custLabel}>E-Mail / البريد الإلكتروني</Text>
              <Text style={styles.custVal}>{customerEmail}</Text>
            </View>
          </View>
          <View style={styles.customerQrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Items table (7 cols, RTL) ─── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>البيان</Text>
              <Text style={styles.thEn}>Description</Text>
            </View>
            <View style={[styles.thCell, { width: "30%" }]}>
              <Text style={styles.thAr}>اسم الصنف</Text>
              <Text style={styles.thEn}>Item Name / Description</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الكمية</Text>
              <Text style={styles.thEn}>Quantity</Text>
            </View>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thAr}>القيمة</Text>
              <Text style={styles.thEn}>Amount</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>الخصم</Text>
              <Text style={styles.thEn}>Discount</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thAr}>ضريبة</Text>
              <Text style={styles.thEn}>Tax</Text>
            </View>
            <View style={[styles.thCell, { width: "16%", borderLeftWidth: 0 }]}>
              <Text style={styles.thAr}>الإجمالي</Text>
              <Text style={styles.thEn}>Total Due</Text>
            </View>
          </View>

          {items.map((item, idx) => {
            const ext = getItemExt(item);
            const codeText = toText(ext.itemCode);
            const nameText = toText(ext.itemName ?? item.description ?? "");
            const unitText = toText(ext.unitName);
            return (
              <View key={item.position ?? idx} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{codeText}</Text>
                </View>
                <View style={[styles.tdCell, { width: "30%" }]}>
                  <Text style={styles.tdMain}>{nameText}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatQty(item.quantity)}</Text>
                  {unitText ? <Text style={styles.tdSub}>{unitText}</Text> : null}
                </View>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.discountAmount)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.lineVat)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "16%", borderLeftWidth: 0 }]}>
                  <Text style={styles.tdMain}>{formatNumber(item.lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Totals: qty left / breakdown right ─── */}
        <View style={styles.bottomSection}>
          <View style={styles.qtyBox}>
            <Text style={styles.qtyLabel}>Total QTY / إجمالي الكمية</Text>
            <Text style={styles.qtyVal}>{formatQty(totalQty)}</Text>
          </View>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(subtotalVal)}</Text>
              <Text style={styles.totalKey}>Total Excluding VAT / الإجمالي غير شامل قيمة الضريبة المضافة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(discountVal)}</Text>
              <Text style={styles.totalKey}>Discount / الخصم</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(chargesVal)}</Text>
              <Text style={styles.totalKey}>Charges / الاتعاب</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(taxableVal)}</Text>
              <Text style={styles.totalKey}>Total Taxable Amount / الإجمالي الخاضع للضريبة</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalVal}>{formatNumber(vatVal)}</Text>
              <Text style={styles.totalKey}>{vatRatePct} Tax / الضريبة</Text>
            </View>
            <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.totalVal, styles.grandVal]}>{formatNumber(totalVal)}</Text>
              <Text style={[styles.totalKey, styles.grandVal]}>Total Amt With Tax / الإجمالي شامل الضريبة</Text>
            </View>
          </View>
        </View>

        {/* ─── Grand SAR + tafqeet ─── */}
        <View style={styles.grandStrip}>
          <Text style={styles.grandSar}>
            {currencyText} {formatNumber(totalVal)}
          </Text>
          <Text style={styles.grandWords}>{tafqeetText}</Text>
        </View>

        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ─── Seal / Sign ─── */}
        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <Text style={styles.signLabel}>الختم / The Seal</Text>
            <Text style={styles.signLine}> </Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLabel}>التوقيع / Sign</Text>
            {signatureDataUrl ? (
              <Image src={signatureDataUrl} style={styles.signImage} />
            ) : (
              <Text style={styles.signLine}> </Text>
            )}
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
  topStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#111827",
    borderBottomWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  topStripLeft: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
  },
  topStripRight: {
    alignItems: "flex-end",
  },
  topBranch: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  topBranchSmall: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
  },
  headerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "32%",
    alignItems: "flex-start",
  },
  hLine: {
    fontSize: 7,
    color: "#111827",
    textAlign: "left",
    lineHeight: 1.35,
  },
  headerCenter: {
    width: "34%",
    alignItems: "center",
  },
  logoImg: {
    width: 64,
    height: 44,
    objectFit: "contain",
    marginBottom: 2,
  },
  titleAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  titleEn: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "center",
  },
  headerRight: {
    width: "32%",
    alignItems: "flex-end",
  },
  hLineR: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
    lineHeight: 1.35,
  },
  metaBox: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  metaLabel: {
    fontSize: 7,
    color: "#374151",
    textAlign: "left",
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  metaValRed: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#B91C1C",
    textAlign: "right",
  },
  customerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  customerCol: {
    width: "72%",
  },
  custRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9CA3AF",
    minHeight: 16,
    paddingHorizontal: 6,
  },
  custLabel: {
    fontSize: 6.5,
    color: "#374151",
    textAlign: "left",
    width: "45%",
  },
  custVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    width: "55%",
  },
  customerQrCol: {
    width: "28%",
    borderLeftWidth: 1,
    borderLeftColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  qrImage: {
    width: 95,
    height: 95,
  },
  qrPlaceholder: {
    width: 95,
    height: 95,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 9,
    color: "#9CA3AF",
  },
  table: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
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
    color: "#111827",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6,
    color: "#374151",
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
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  qtyBox: {
    width: "24%",
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    paddingVertical: 6,
  },
  qtyLabel: {
    fontSize: 7,
    color: "#374151",
    textAlign: "center",
  },
  qtyVal: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginTop: 2,
  },
  totalsBox: {
    width: "74%",
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
  totalKey: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
    width: "70%",
  },
  totalVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "left",
    width: "30%",
  },
  grandVal: {
    color: "#B91C1C",
    fontSize: 8,
  },
  grandStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#F9FAFB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  grandSar: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
  },
  grandWords: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "right",
  },
  notesBox: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    padding: 4,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 7,
    color: "#111827",
    textAlign: "right",
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 18,
  },
  signBlock: {
    width: 170,
    alignItems: "center",
  },
  signLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 14,
  },
  signLine: {
    width: 150,
    borderTopWidth: 0.75,
    borderTopColor: "#111827",
  },
  signImage: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
});
