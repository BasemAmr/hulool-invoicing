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

export interface AldailCeramicsTemplateProps {
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

// ─── Optional extension fields (NOT in core DTO — read safely, render "" when absent) ───
// These cover legacy ERP columns seen on the scanned Al-Dail invoice
// (branch, salesman/mandob, bayan, item codes, units, free qty, ...).
// Everything stays optional so the template is fully typesafe with plain InvoiceDto input.

interface AldailInvoiceExtensions {
  branch?: string | number | null;
  paymentMethod?: string | null;
  invoiceTypeLabel?: string | null;
  clientNo?: string | number | null;
  salesman?: string | number | null;
  salesmanName?: string | null;
  bayan?: string | null;
  des?: string | null;
  warehouse?: string | null;
  buildingNo?: string | number | null;
  discountTotal?: string | number | null;
}

interface AldailItemExtensions {
  itemCode?: string | number | null;
  itemNo?: string | number | null;
  barcode?: string | number | null;
  sku?: string | number | null;
  itemName?: string | null;
  itemDes?: string | null;
  descriptionEn?: string | null;
  unitName?: string | null;
  unit?: string | null;
  freeQty?: string | number | null;
  freeQuantity?: string | number | null;
}

interface AldailCustomerExtensions {
  clientNo?: string | number | null;
  customerNumber?: string | number | null;
  code?: string | number | null;
  buildingNo?: string | number | null;
  buildingNumber?: string | number | null;
  nationalId?: string | number | null;
}

function getInvoiceExt(invoice: InvoiceDto): AldailInvoiceExtensions {
  const rec = invoice as InvoiceDto & Partial<AldailInvoiceExtensions>;
  return {
    branch: rec.branch ?? null,
    paymentMethod: rec.paymentMethod ?? null,
    invoiceTypeLabel: rec.invoiceTypeLabel ?? null,
    clientNo: rec.clientNo ?? null,
    salesman: rec.salesman ?? null,
    salesmanName: rec.salesmanName ?? null,
    bayan: rec.bayan ?? null,
    des: rec.des ?? null,
    warehouse: rec.warehouse ?? null,
    buildingNo: rec.buildingNo ?? null,
    discountTotal: rec.discountTotal ?? null,
  };
}

function getItemExt(item: InvoiceItemDto): AldailItemExtensions {
  const rec = item as InvoiceItemDto & Partial<AldailItemExtensions>;
  return {
    itemCode: rec.itemCode ?? null,
    itemNo: rec.itemNo ?? null,
    barcode: rec.barcode ?? null,
    sku: rec.sku ?? null,
    itemName: rec.itemName ?? null,
    itemDes: rec.itemDes ?? null,
    descriptionEn: rec.descriptionEn ?? null,
    unitName: rec.unitName ?? null,
    unit: rec.unit ?? null,
    freeQty: rec.freeQty ?? rec.freeQuantity ?? null,
  };
}

function getCustomerExt(customer: CustomerRecord): AldailCustomerExtensions {
  const rec = customer as CustomerRecord & Partial<AldailCustomerExtensions>;
  return {
    clientNo: rec.clientNo ?? rec.customerNumber ?? rec.code ?? null,
    buildingNo: rec.buildingNo ?? rec.buildingNumber ?? null,
    nationalId: rec.nationalId ?? null,
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
  // Quantities like 2.16 keep up to 2 decimals, integers render without trailing zeros
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function formatDateSlash(iso: string | null | undefined): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts as [string, string, string];
    return `${y}/${m}/${d}`;
  }
  return datePart;
}

// ─── Arabic tafqeet (number → words), typesafe, no `any` ───

const ONES_AR = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS_AR = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
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

function tafqeetAldail(amount: number): string {
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

const DEFAULT_TERMS_AR: string[] = [
  "عند إرجاع أي كمية يتم خصم نسبتها من العميل بمقدار 10% من قيمتها الأساسية.",
  "يجب تحصيل الفاتورة / الأسعار عند الاستلام ولا يقبل أي إرجاع بعد 30 يوم من تاريخ إصدار الفاتورة والمرتجع سوف يكون تحويل بنكي خلال 24 ساعة.",
  "يجب أن تكون البضاعة سليمة وخالية من أي عيوب سوء التخزين وأن تكون بنفس حالتها السليمة.",
  "يتم استلام البضاعة في مستوى مستودعاتنا بينما النقل على حساب العميل.",
  "الشركة تعتبر عن قبول أي شكوى عن البضاعة بعد التوقيع فعلى الفور يرجى التأكد من البضاعة المستلمة قبل التوقيع.",
  "الارتجاع طبيعيه وفي حال إقرار وجود اختلافات بمنتجاتنا وغيرية وتتحمل الاوانه.",
];

export function AldailCeramicsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: AldailCeramicsTemplateProps) {
  const paperSize: "A4" | "LETTER" = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invExt = getInvoiceExt(invoice);
  const custExt = getCustomerExt(customer);

  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateSlash(invoice.issueDate);
  const typeLabel =
    invExt.invoiceTypeLabel ??
    invExt.paymentMethod ??
    (invoice.invoiceType === "simplified" ? "نقدي" : "نقدي");
  const clientNoText = toText(custExt.clientNo ?? invExt.clientNo ?? "");
  const buildingNoText = toText(custExt.buildingNo ?? invExt.buildingNo ?? "");
  const salesmanText = toText(invExt.salesman ?? "");
  const salesmanNameText = toText(invExt.salesmanName ?? "");
  const bayanText = toText(invExt.bayan ?? invExt.des ?? invoice.notes ?? "");
  const currencyText = invoice.currency || "SAR";

  const companyNameAr = company.nameAr || "";
  const companyNameEn = company.nameEn || "";
  const companyPhone = company.phone || "";
  const companyVat = company.vatNumber || "";
  const companyCr = company.crNumber || "";
  const companyEmail = company.email || "";
  const companyWebsite = company.website || "";
  const companyCity = company.addressCity || "";
  const companyStreet = company.addressStreet || "";
  const companyDistrict = company.addressDistrict || "";

  const customerName = customer.nameAr || "";
  const customerVat = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerStreet = customer.addressStreet || "";
  const customerCity = customer.addressCity || "";
  const customerZip = customer.addressPostalCode || "";

  const items = invoice.items ?? [];
  const totalQty = items.reduce((sum, it) => sum + toNumber(it.quantity), 0);
  const subtotalVal = toNumber(invoice.subtotal);
  const discountVal = toNumber(invExt.discountTotal);
  const vatVal = toNumber(invoice.vatAmount);
  const totalVal = toNumber(invoice.total);
  const tafqeetText = tafqeetAldail(totalVal);

  const termsList: string[] =
    invoice.terms && invoice.terms.trim().length > 0
      ? [invoice.terms.trim()]
      : DEFAULT_TERMS_AR;

  return (
    <Document
      title={`فاتورة ضريبية مبسطة ${invoiceNum}`}
      author={companyNameAr}
      subject="Simplified Tax Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? <Image src={backgroundDataUrl} style={styles.backgroundImage} /> : null}

        <View style={styles.outerFrame}>
          {/* ─── 1. HEADER: dynamic company data (EN left / logo center / AR right) ─── */}
          <View style={styles.headerBox}>
            <View style={styles.headerLeft}>
              {companyNameEn ? <Text style={styles.headerEnName}>{companyNameEn}</Text> : null}
              <Text style={styles.headerEnLine}>For Trading, Industry &amp; Contracting</Text>
              {companyCity || companyStreet ? (
                <Text style={styles.headerEnLine}>
                  KSA - {companyCity}
                  {companyStreet ? ` - ${companyStreet}` : ""}
                </Text>
              ) : null}
              {companyDistrict ? <Text style={styles.headerEnLine}>{companyDistrict}</Text> : null}
              {companyPhone ? <Text style={styles.headerEnLine}>Tele No. {companyPhone}</Text> : null}
              {companyVat ? <Text style={styles.headerEnLine}>Tax No : {companyVat}</Text> : null}
              {companyCr ? <Text style={styles.headerEnLine}>C.R : {companyCr}</Text> : null}
            </View>

            <View style={styles.headerCenter}>
              {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImg} /> : null}
              <Text style={styles.simplifiedTitle}>فاتورة ضريبية مبسطة</Text>
            </View>

            <View style={styles.headerRight}>
              {companyNameAr ? <Text style={styles.headerArName}>{companyNameAr}</Text> : null}
              {companyStreet || companyDistrict ? (
                <Text style={styles.headerArLine}>
                  {[companyStreet, companyDistrict ? `حي ${companyDistrict}` : ""]
                    .filter((s) => s.length > 0)
                    .join(" - ")}
                </Text>
              ) : null}
              {companyCity ? <Text style={styles.headerArLine}>جدة - المملكة العربية السعودية</Text> : null}
              {companyCity ? <Text style={styles.headerArLine}>{companyCity}</Text> : null}
              {companyPhone ? <Text style={styles.headerArLine}>هاتف : {companyPhone}</Text> : null}
              {companyVat ? <Text style={styles.headerArLine}>الرقم الضريبي : {companyVat}</Text> : null}
              {companyCr ? <Text style={styles.headerArLine}>س.ت : {companyCr}</Text> : null}
            </View>
          </View>

          {/* ─── 2. CLIENT / META BOX: dynamic client + dynamic inv number ─── */}
          <View style={styles.clientBox}>
            <View style={styles.qrCol}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>QR</Text>
                </View>
              )}
            </View>

            <View style={styles.metaCol}>
              <View style={styles.metaRow}>
                <Text style={styles.metaVal}>
                  {issueDateStr ? `${issueDateStr} : Date / التاريخ` : ""}
                </Text>
                <Text style={styles.metaVal}> </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaVal}>
                  {typeLabel ? `${typeLabel} : Type / النوع` : ""}
                </Text>
                <Text style={styles.metaVal}>
                  {invoiceNum ? `${invoiceNum} : inv No / رقم الفاتورة` : ""}
                </Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>العملة / Curr : {currencyText}</Text>
                <Text style={styles.metaVal}>رقم العميل / Client No : {clientNoText}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>اسم العميل / Client Name : {customerName}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>الرقم الضريبي / Tax No : {customerVat}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>
                  العنوان / Adress : {customerStreet}
                  {customerPhone ? ` - ${customerPhone}` : ""}
                </Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>المدينة / City : {customerCity}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>رقم المبنى / Bulding No : {buildingNoText}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>شارع / Street : {customerStreet}</Text>
              </View>
              <View style={styles.metaSingle}>
                <Text style={styles.metaVal}>الرمز البريدي / Zip Code : {customerZip}</Text>
              </View>
              {/* salesman + bayan: render ONLY when data exists (dynamic-or-empty per annotation) */}
              {salesmanText || salesmanNameText ? (
                <View style={styles.metaSingle}>
                  <Text style={styles.metaVal}>
                    المندوب : {salesmanText}
                    {salesmanNameText ? ` : مندوب ${salesmanNameText}` : ""}
                  </Text>
                </View>
              ) : null}
              {bayanText ? (
                <View style={styles.metaSingle}>
                  <Text style={styles.metaVal}>البيان / Des : {bayanText}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── 3. ITEMS TABLE (11 cols, RTL). itemNo/itemDes render "" when absent ─── */}
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: "4%" }]}>
                <Text style={styles.thAr}>م</Text>
                <Text style={styles.thEn}>S</Text>
              </View>
              <View style={[styles.thCell, { width: "12%" }]}>
                <Text style={styles.thAr}>رقم الصنف</Text>
                <Text style={styles.thEn}>item No</Text>
              </View>
              <View style={[styles.thCell, { width: "22%" }]}>
                <Text style={styles.thAr}>اسم الصنف</Text>
                <Text style={styles.thEn}>item Name</Text>
              </View>
              <View style={[styles.thCell, { width: "16%" }]}>
                <Text style={styles.thAr}>وصف الصنف</Text>
                <Text style={styles.thEn}>item Des</Text>
              </View>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>الوحدة</Text>
                <Text style={styles.thEn}>Unit</Text>
              </View>
              <View style={[styles.thCell, { width: "7%" }]}>
                <Text style={styles.thAr}>الكميه</Text>
                <Text style={styles.thEn}>Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>مجاني</Text>
                <Text style={styles.thEn}>Free Qty</Text>
              </View>
              <View style={[styles.thCell, { width: "7%" }]}>
                <Text style={styles.thAr}>السعر</Text>
                <Text style={styles.thEn}>Price</Text>
              </View>
              <View style={[styles.thCell, { width: "6%" }]}>
                <Text style={styles.thAr}>الخصم</Text>
                <Text style={styles.thEn}>Disc</Text>
              </View>
              <View style={[styles.thCell, { width: "7%" }]}>
                <Text style={styles.thAr}>إجمالي الضريبة</Text>
                <Text style={styles.thEn}>Vat</Text>
              </View>
              <View style={[styles.thCell, { width: "7%", borderLeftWidth: 0 }]}>
                <Text style={styles.thAr}>المجموع</Text>
                <Text style={styles.thEn}>SubTotal</Text>
              </View>
            </View>

            {items.map((item, idx) => {
              const ext = getItemExt(item);
              const itemNo = toText(ext.itemCode ?? ext.itemNo ?? ext.barcode ?? ext.sku ?? "");
              const itemName = toText(ext.itemName ?? item.description ?? "");
              const itemDes = toText(ext.itemDes ?? ext.descriptionEn ?? "");
              const unitName = toText(ext.unitName ?? ext.unit ?? "");
              const freeQty = toText(ext.freeQty ?? "");
              return (
                <View key={item.position ?? idx} style={styles.tableRow}>
                  <Text style={[styles.td, { width: "4%" }]}>{idx + 1}</Text>
                  <Text style={[styles.td, { width: "12%" }]}>{itemNo}</Text>
                  <Text style={[styles.td, { width: "22%" }]}>{itemName}</Text>
                  <Text style={[styles.td, { width: "16%" }]}>{itemDes}</Text>
                  <Text style={[styles.td, { width: "6%" }]}>{unitName}</Text>
                  <Text style={[styles.td, { width: "7%" }]}>{formatQty(item.quantity)}</Text>
                  <Text style={[styles.td, { width: "6%" }]}>{freeQty}</Text>
                  <Text style={[styles.td, { width: "7%" }]}>{formatNumber(item.unitPrice)}</Text>
                  <Text style={[styles.td, { width: "6%" }]}>{formatNumber(item.discountAmount)}</Text>
                  <Text style={[styles.td, { width: "7%" }]}>{formatNumber(item.lineVat)}</Text>
                  <Text style={[styles.td, { width: "7%", borderLeftWidth: 0 }]}>
                    {formatNumber(item.lineSubtotal)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ─── 4. TOTALS ─── */}
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatNumber(subtotalVal)}</Text>
              <Text style={styles.totalsKey}>الإجمالي / Total</Text>
              <Text style={styles.totalsQty}>{formatQty(totalQty)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatNumber(discountVal)}</Text>
              <Text style={styles.totalsKey}>الخصم / Discount</Text>
              <Text style={styles.totalsQty}> </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsVal}>{formatNumber(vatVal)}</Text>
              <Text style={styles.totalsKey}>الضريبة / Vat</Text>
              <Text style={styles.totalsQty}> </Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowGrand]}>
              <Text style={[styles.totalsVal, styles.grandVal]}>{formatNumber(totalVal)}</Text>
              <Text style={[styles.totalsKey, styles.grandVal]}>الإجمالي شامل الضريبة / Total with Vat</Text>
              <Text style={[styles.totalsQty, styles.grandVal]}>{tafqeetText}</Text>
            </View>
          </View>

          {/* ─── 5. TERMS ─── */}
          <View style={styles.termsBox}>
            {termsList.map((line, i) => (
              <Text key={i} style={styles.termsLine}>
                - {line}
              </Text>
            ))}
          </View>

          {/* ─── 6. FOOTER: dynamic-or-empty contacts ─── */}
          <View style={styles.footerRow}>
            {companyPhone ? <Text style={styles.footerText}>Phone:{companyPhone}</Text> : <Text style={styles.footerText}> </Text>}
            {companyWebsite ? (
              <Text style={styles.footerText}>Web:{companyWebsite}</Text>
            ) : (
              <Text style={styles.footerText}> </Text>
            )}
            {companyEmail ? (
              <Text style={styles.footerText}>Email:{companyEmail}</Text>
            ) : (
              <Text style={styles.footerText}> </Text>
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
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    fontSize: 7.5,
    color: "#111111",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },
  outerFrame: {
    borderWidth: 1.25,
    borderColor: "#111111",
    padding: 6,
  },
  // ─── Header ───
  headerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111111",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "34%",
    alignItems: "flex-start",
  },
  headerEnName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
    textAlign: "left",
  },
  headerEnLine: {
    fontSize: 7,
    color: "#111111",
    lineHeight: 1.3,
    textAlign: "left",
  },
  headerCenter: {
    width: "30%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logoImg: {
    width: 70,
    height: 55,
    objectFit: "contain",
    marginBottom: 2,
  },
  simplifiedTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#7A1F1F",
    textAlign: "center",
  },
  headerRight: {
    width: "34%",
    alignItems: "flex-end",
  },
  headerArName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 1,
    textAlign: "right",
  },
  headerArLine: {
    fontSize: 7,
    color: "#111111",
    lineHeight: 1.3,
    textAlign: "right",
  },
  // ─── Client box ───
  clientBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
    minHeight: 120,
  },
  qrCol: {
    width: "22%",
    borderRightWidth: 1,
    borderRightColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  qrImage: {
    width: 90,
    height: 90,
  },
  qrPlaceholder: {
    width: 90,
    height: 90,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: 9,
    color: "#9CA3AF",
  },
  metaCol: {
    width: "78%",
    paddingVertical: 3,
    paddingHorizontal: 6,
    justifyContent: "flex-start",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  metaSingle: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 1,
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "right",
  },
  // ─── Table ───
  table: {
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D9EAF3",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    minHeight: 26,
    alignItems: "stretch",
  },
  thCell: {
    borderLeftWidth: 0.75,
    borderLeftColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thAr: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  thEn: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#6B7280",
    minHeight: 20,
    alignItems: "stretch",
  },
  td: {
    fontSize: 6.5,
    color: "#111111",
    textAlign: "center",
    borderLeftWidth: 0.5,
    borderLeftColor: "#6B7280",
    paddingVertical: 3,
    paddingHorizontal: 1,
  },
  // ─── Totals ───
  totalsBox: {
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 6,
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#6B7280",
    minHeight: 16,
    alignItems: "center",
  },
  totalsRowGrand: {
    borderBottomWidth: 0,
    backgroundColor: "#F9FAFB",
  },
  totalsVal: {
    width: "18%",
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#6B7280",
    paddingVertical: 2,
  },
  totalsKey: {
    width: "32%",
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#6B7280",
    paddingVertical: 2,
  },
  totalsQty: {
    width: "50%",
    fontSize: 7,
    fontWeight: "bold",
    color: "#7A1F1F",
    textAlign: "right",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  grandVal: {
    color: "#7A1F1F",
  },
  // ─── Terms + footer ───
  termsBox: {
    marginBottom: 8,
    paddingHorizontal: 4,
    gap: 1,
  },
  termsLine: {
    fontSize: 6.5,
    color: "#111111",
    textAlign: "right",
    lineHeight: 1.35,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111111",
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
  },
});
