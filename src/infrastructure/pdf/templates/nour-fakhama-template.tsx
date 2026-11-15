import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto, InvoiceItemDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface NourFakhamaTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template?: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

// ─── Official Saudi Riyal Currency Emblem (Vector SVG) ────────────────────────

function SaudiRiyalSymbol({
  size = 7.5,
  color = "#111827",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 24 26"
      style={{ marginRight: 2 }}
    >
      {/* Left vertical stem */}
      <Path
        d="M8.5 2V20.5L5.5 22.5V3.5L8.5 2Z"
        fill={color}
      />
      {/* Right vertical stem */}
      <Path
        d="M14.5 1V19.5L11.5 21.5V2.5L14.5 1Z"
        fill={color}
      />
      {/* Upper diagonal cross-bar */}
      <Path
        d="M2 12.2L21.5 8.2L22 10.7L2.5 14.7L2 12.2Z"
        fill={color}
      />
      {/* Lower diagonal cross-bar */}
      <Path
        d="M2 16.8L21.5 12.8L22 15.3L2.5 19.3L2 16.8Z"
        fill={color}
      />
      {/* Bottom-right tail */}
      <Path
        d="M15.5 21.2L22 19.8L22.4 22.2L15.9 23.6L15.5 21.2Z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Number & Date Formatting Helpers ──────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  let str: string;
  if (typeof val === "number") {
    str = Number.isFinite(val) ? String(Number(val.toFixed(10))) : "0.00";
  } else {
    str = String(val).trim();
  }
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1];
  if (decPart === undefined) {
    decPart = "00";
  } else if (decPart.length === 1) {
    decPart = `${decPart}0`;
  }
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = `${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

function formatQtyOneDecimal(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return "0.0";
  if (Number.isInteger(num)) return num.toFixed(1);
  return String(num);
}

function formatDateISO(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatTimeFull(timeStr?: string | null): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1]}:00`;
  }
  return trimmed;
}

function normalizeVatRatePercent(rawVat: number): number {
  if (!Number.isFinite(rawVat) || rawVat < 0) return 15;
  return rawVat <= 1 && rawVat > 0 ? Math.round(rawVat * 10000) / 100 : rawVat;
}

function getInvoiceStatusAr(status?: string | null): string {
  if (status === "cancelled") return "ملغاة";
  if (status === "draft") return "مسودة";
  return "موافق عليه";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NourFakhamaTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: NourFakhamaTemplateProps) {
  const isLetter = settings?.paperSize === "Letter";
  const basePageWidth = isLetter ? 612 : 595.28;
  const basePageHeight = isLetter ? 792 : 841.89;

  const logoSource = logoDataUrl || company.logoUrl;

  // Company / Seller info (strictly dynamic, no hardcoded strings)
  const sellerName = company.nameAr || company.nameEn || "";
  const sellerAddressLine = [
    company.addressStreet,
    company.addressBuildingNumber,
    company.addressCity,
    company.addressDistrict,
    company.addressPostalCode,
    company.addressCity || company.addressStreet ? "السعودية" : null,
  ]
    .filter((v): v is string => Boolean(v && v.trim().length > 0))
    .join(", ");

  // Customer / Recipient info ("الجهة")
  const customerName = customer.nameAr || customer.nameEn || "";
  const customerAddressLine = [
    customer.addressDistrict,
    customer.addressBuildingNumber,
    customer.addressCity,
    customer.addressStreet,
    customer.addressPostalCode,
    customer.addressCity || customer.addressStreet || customer.addressDistrict
      ? "السعودية"
      : null,
  ]
    .filter((v): v is string => Boolean(v && v.trim().length > 0))
    .join(", ");
  const customerCrNumber =
    customer.unifiedNumber || (customer as { crNumber?: string }).crNumber || "";

  // Invoice Metadata
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDateISO(invoice.issueDate);
  const issueTimeStr = formatTimeFull(invoice.issueTime);
  const statusAr = getInvoiceStatusAr(invoice.status);

  // Line Items & Totals Calculations
  const items: InvoiceItemDto[] = invoice.items || [];
  let computedGross = 0;
  let computedDiscount = 0;
  let computedVat = 0;
  let computedTotal = 0;

  const rows = items.map((item, idx) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const gross = qty * unitPrice;
    const lineDiscount = toNumber(item.discountAmount);
    const taxableSubtotal =
      item.lineSubtotal !== undefined &&
      item.lineSubtotal !== null &&
      item.lineSubtotal !== ""
        ? toNumber(item.lineSubtotal)
        : Math.max(0, gross - lineDiscount);

    const vatPct =
      item.vatRate !== undefined && item.vatRate !== null
        ? normalizeVatRatePercent(toNumber(item.vatRate))
        : 15;

    const lineVat =
      item.lineVat !== undefined &&
      item.lineVat !== null &&
      item.lineVat !== ""
        ? toNumber(item.lineVat)
        : taxableSubtotal * (vatPct / 100);

    const lineTotal =
      item.lineTotal !== undefined &&
      item.lineTotal !== null &&
      item.lineTotal !== ""
        ? toNumber(item.lineTotal)
        : taxableSubtotal + lineVat;

    computedGross += gross;
    computedDiscount += lineDiscount;
    computedVat += lineVat;
    computedTotal += lineTotal;

    const discountPct = gross > 0 ? (lineDiscount / gross) * 100 : 0;
    const unit = (item as { unit?: string }).unit || "وحدة";
    const subDescription =
      (item as { productDescription?: string }).productDescription ||
      (item as { category?: string }).category ||
      "";

    return {
      key: item.position ?? idx,
      index: idx + 1,
      desc: item.description || "",
      subDesc: subDescription,
      qty,
      unit,
      unitPrice,
      discountPct,
      lineDiscount,
      taxableSubtotal,
      lineVat,
      lineTotal,
    };
  });

  const sumTaxable = rows.reduce((a, r) => a + r.taxableSubtotal, 0);
  const taxableAmount =
    invoice.subtotal !== null &&
    invoice.subtotal !== undefined &&
    invoice.subtotal !== ""
      ? toNumber(invoice.subtotal)
      : sumTaxable;

  const totalVat =
    invoice.vatAmount !== null &&
    invoice.vatAmount !== undefined &&
    invoice.vatAmount !== ""
      ? toNumber(invoice.vatAmount)
      : computedVat;

  const invoiceDiscount = toNumber(invoice.discountAmount);

  const grandTotal =
    invoice.total !== null && invoice.total !== undefined && invoice.total !== ""
      ? toNumber(invoice.total)
      : Math.max(0, taxableAmount + totalVat - invoiceDiscount);

  // Single-page dynamic height calculation
  const extraItemsCount = Math.max(0, rows.length - 6);
  let extraHeight = extraItemsCount * 32;
  if (invoice.notes) extraHeight += 24;
  if (invoice.terms) extraHeight += 24;
  const dynamicHeight = Math.max(basePageHeight, basePageHeight + extraHeight);
  const dynamicPageSize = [basePageWidth, dynamicHeight] as [number, number];

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNumber}`}
      author={sellerName || "Invoicing"}
      subject="Tax Invoice - Nour Al-Fakhama"
      creator="Hulool Invoicing"
    >
      <Page size={dynamicPageSize} style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER: LOGO (LEFT) + TITLE & SELLER DETAILS (RIGHT) ─── */}
        <View style={styles.topHeaderRow}>
          {/* Left: Company Logo (conditional — no placeholder when absent) */}
          <View style={styles.logoCol}>
            {logoSource ? (
              <Image src={logoSource} style={styles.logoImage} />
            ) : null}
          </View>

          {/* Right: Main Title & Seller Info */}
          <View style={styles.sellerCol}>
            <Text style={styles.mainTitleAr}>فاتورة ضريبية</Text>

            {sellerName ? (
              <Text style={styles.sellerNameText}>{sellerName}</Text>
            ) : null}

            {sellerAddressLine ? (
              <Text style={styles.sellerInfoText}>{sellerAddressLine}</Text>
            ) : null}

            {company.phone ? (
              <View style={styles.sellerMetaRow}>
                <Text style={styles.sellerInfoText}>هاتف</Text>
                <Text style={styles.sellerColon}> : </Text>
                <Text style={styles.sellerInfoText}>{company.phone}</Text>
              </View>
            ) : null}

            {company.vatNumber ? (
              <View style={styles.sellerMetaRow}>
                <Text style={styles.sellerInfoText}>الرقم الضريبي</Text>
                <Text style={styles.sellerColon}> : </Text>
                <Text style={styles.sellerInfoText}>{company.vatNumber}</Text>
              </View>
            ) : null}

            {company.crNumber ? (
              <View style={styles.sellerMetaRow}>
                <Text style={styles.sellerInfoText}>رقم السجل التجاري</Text>
                <Text style={styles.sellerColon}> : </Text>
                <Text style={styles.sellerInfoText}>{company.crNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Horizontal Divider Rule */}
        <View style={styles.headerDivider} />

        {/* ─── 2. META & CUSTOMER SECTION ─── */}
        <View style={styles.metaAndCustomerRow}>
          {/* Left Column: Invoice Status, Number, Date, Time, Due Amount Box */}
          <View style={styles.invoiceMetaCol}>
            {/* Status */}
            <View style={styles.metaLineRow}>
              <View style={styles.metaValCell}>
                <Text style={styles.metaValText}>{statusAr}</Text>
              </View>
              <View style={styles.metaLabelCell}>
                <Text style={styles.metaLabelBold}>الحالة:</Text>
              </View>
            </View>

            {/* Invoice Number */}
            <View style={styles.metaLineRow}>
              <View style={styles.metaValCell}>
                <Text style={styles.metaValText}>{invoiceNumber}</Text>
              </View>
              <View style={styles.metaLabelCell}>
                <Text style={styles.metaLabelBold}>رقم الفاتورة:</Text>
              </View>
            </View>

            {/* Invoice Date */}
            <View style={styles.metaLineRow}>
              <View style={styles.metaValCell}>
                <Text style={styles.metaValText}>{issueDateStr}</Text>
              </View>
              <View style={styles.metaLabelCell}>
                <Text style={styles.metaLabelBold}>تاريخ الفاتورة:</Text>
              </View>
            </View>

            {/* Invoice Time (if available) */}
            {issueTimeStr ? (
              <View style={styles.metaLineRow}>
                <View style={styles.metaValCell}>
                  <Text style={styles.metaValText}>{issueTimeStr}</Text>
                </View>
                <View style={styles.metaLabelCell}>
                  <Text style={styles.metaLabelBold}>وقت الفاتورة</Text>
                </View>
              </View>
            ) : null}

            {/* Amount Due Shaded Box */}
            <View style={styles.dueAmountBoxRow}>
              <View style={styles.dueAmountValBox}>
                <SaudiRiyalSymbol size={7} color="#111827" />
                <Text style={styles.dueAmountValText}>
                  {formatExactAmount(grandTotal)}
                </Text>
              </View>
              <View style={styles.dueAmountLabelBox}>
                <Text style={styles.dueAmountLabelText}>المبلغ المستحق:</Text>
              </View>
            </View>
          </View>

          {/* Right Column: Customer ("الجهة") Details in Muted Slate Gray */}
          <View style={styles.customerCol}>
            <Text style={styles.customerSectionHeader}>الجهة</Text>

            {customerName ? (
              <Text style={styles.customerPrimaryText}>{customerName}</Text>
            ) : null}

            {customerAddressLine ? (
              <Text style={[styles.customerPrimaryText, { marginTop: 7 }]}>
                {customerAddressLine}
              </Text>
            ) : null}

            {customer.vatNumber ? (
              <View style={[styles.customerInlineRow, { marginTop: 7 }]}>
                <Text style={styles.customerPrimaryText}>الرقم الضريبي</Text>
                <Text style={styles.customerPrimaryText}> </Text>
                <Text style={styles.customerPrimaryText}>{customer.vatNumber}</Text>
              </View>
            ) : null}

            {customerCrNumber ? (
              <View style={[styles.customerInlineRow, { marginTop: 7 }]}>
                <Text style={styles.customerPrimaryText}>رقم السجل التجاري:</Text>
                <Text style={styles.customerPrimaryText}> </Text>
                <Text style={styles.customerPrimaryText}>{customerCrNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. BORDERLESS LINE ITEMS TABLE (RTL) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, styles.colIndex]}>
              <Text style={styles.thText}>#</Text>
            </View>
            <View style={[styles.thCell, styles.colProduct, { alignItems: "flex-end" }]}>
              <Text style={styles.thTextRight}>المنتج</Text>
            </View>
            <View style={[styles.thCell, styles.colQty]}>
              <Text style={styles.thText}>الكمية</Text>
            </View>
            <View style={[styles.thCell, styles.colPrice]}>
              <Text style={styles.thText}>سعر الوحدة</Text>
            </View>
            <View style={[styles.thCell, styles.colDiscount]}>
              <Text style={styles.thText}>الخصم</Text>
            </View>
            <View style={[styles.thCell, styles.colSubtotal]}>
              <Text style={styles.thText}>الاجمالي</Text>
              <Text style={styles.thText}>قبل</Text>
              <Text style={styles.thText}>الضريبة</Text>
            </View>
            <View style={[styles.thCell, styles.colVat]}>
              <Text style={styles.thText}>الضريبة</Text>
            </View>
            <View style={[styles.thCell, styles.colTotal, { alignItems: "flex-start" }]}>
              <Text style={styles.thTextLeft}>الاجمالي</Text>
            </View>
          </View>

          {/* Data Rows */}
          {rows.map((row) => (
            <View key={row.key} style={styles.tableDataRow} wrap={false}>
              {/* # */}
              <View style={[styles.tdCell, styles.colIndex]}>
                <Text style={styles.tdIndexText}>{row.index}</Text>
              </View>

              {/* Product Name & Optional Sub-Description */}
              <View style={[styles.tdCell, styles.colProduct, { alignItems: "flex-end" }]}>
                <Text style={styles.tdProductTitle}>{row.desc}</Text>
                {row.subDesc ? (
                  <Text style={styles.tdProductSub}>{row.subDesc}</Text>
                ) : null}
              </View>

              {/* Quantity & Generic Unit */}
              <View style={[styles.tdCell, styles.colQty]}>
                <Text style={styles.tdCenterText}>{formatQtyOneDecimal(row.qty)}</Text>
                <Text style={styles.tdSubUnitText}>{row.unit}</Text>
              </View>

              {/* Unit Price */}
              <View style={[styles.tdCell, styles.colPrice]}>
                <Text style={styles.tdCenterText}>
                  {formatExactAmount(row.unitPrice)}
                </Text>
              </View>

              {/* Discount (% and SAR amount) */}
              <View style={[styles.tdCell, styles.colDiscount]}>
                <Text style={styles.tdCenterText}>
                  {row.discountPct.toFixed(1)}%
                </Text>
                <View style={styles.currencyInlineRow}>
                  <SaudiRiyalSymbol size={6.5} color="#111827" />
                  <Text style={styles.tdSubAmountText}>
                    {formatExactAmount(row.lineDiscount)}
                  </Text>
                </View>
              </View>

              {/* Subtotal Before VAT */}
              <View style={[styles.tdCell, styles.colSubtotal]}>
                <View style={styles.currencyInlineRow}>
                  <SaudiRiyalSymbol size={7} color="#111827" />
                  <Text style={styles.tdCenterText}>
                    {formatExactAmount(row.taxableSubtotal)}
                  </Text>
                </View>
              </View>

              {/* VAT Amount */}
              <View style={[styles.tdCell, styles.colVat]}>
                <View style={styles.currencyInlineRow}>
                  <SaudiRiyalSymbol size={7} color="#111827" />
                  <Text style={styles.tdCenterText}>
                    {formatExactAmount(row.lineVat)}
                  </Text>
                </View>
              </View>

              {/* Total Including VAT */}
              <View style={[styles.tdCell, styles.colTotal, { alignItems: "flex-start" }]}>
                <View style={styles.currencyInlineRowLeft}>
                  <SaudiRiyalSymbol size={7} color="#111827" />
                  <Text style={styles.tdCenterText}>
                    {formatExactAmount(row.lineTotal)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 4. BOTTOM SUMMARY (LEFT) & ZATCA QR CODE (RIGHT) ─── */}
        <View style={styles.bottomSectionRow} wrap={false}>
          {/* Left: Financial Totals */}
          <View style={styles.totalsCol}>
            {/* Subtotal Before VAT */}
            <View style={styles.totalLineRow}>
              <View style={styles.totalAmountGroup}>
                <SaudiRiyalSymbol size={7.5} color="#111827" />
                <Text style={styles.totalValBold}>
                  {formatExactAmount(taxableAmount)}
                </Text>
              </View>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelBold}>الاجمالي قبل الضريبة :</Text>
              </View>
            </View>

            {/* Total VAT */}
            <View style={styles.totalLineRow}>
              <View style={styles.totalAmountGroup}>
                <SaudiRiyalSymbol size={7.5} color="#111827" />
                <Text style={styles.totalValBold}>
                  {formatExactAmount(totalVat)}
                </Text>
              </View>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelBold}>اجمالي الضريبة :</Text>
              </View>
            </View>

            {/* Optional Invoice Discount */}
            {invoiceDiscount > 0 ? (
              <View style={styles.totalLineRow}>
                <View style={styles.totalAmountGroup}>
                  <SaudiRiyalSymbol size={7.5} color="#111827" />
                  <Text style={styles.totalValBold}>
                    -{formatExactAmount(invoiceDiscount)}
                  </Text>
                </View>
                <View style={styles.totalLabelGroup}>
                  <Text style={styles.totalLabelBold}>خصم الفاتورة :</Text>
                </View>
              </View>
            ) : null}

            {/* Grand Total */}
            <View style={styles.totalLineRow}>
              <View style={styles.totalAmountGroup}>
                <SaudiRiyalSymbol size={7.5} color="#111827" />
                <Text style={styles.totalValBold}>
                  {formatExactAmount(grandTotal)}
                </Text>
              </View>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelBold}>المجموع :</Text>
              </View>
            </View>

            {/* Split Horizontal Divider Above Due Amount */}
            <View style={styles.splitDividerRow}>
              <View style={styles.splitDividerLeft} />
              <View style={styles.splitDividerRight} />
            </View>

            {/* Amount Due */}
            <View style={[styles.totalLineRow, { marginVertical: 4 }]}>
              <View style={styles.totalAmountGroup}>
                <SaudiRiyalSymbol size={7.5} color="#111827" />
                <Text style={styles.totalValBold}>
                  {formatExactAmount(grandTotal)}
                </Text>
              </View>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelBold}>المبلغ المستحق :</Text>
              </View>
            </View>

            {/* Split Horizontal Divider Below Due Amount */}
            <View style={styles.splitDividerRow}>
              <View style={styles.splitDividerLeft} />
              <View style={styles.splitDividerRight} />
            </View>
          </View>

          {/* Right: ZATCA QR Code */}
          <View style={styles.qrCol}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.draftText}>DRAFT</Text>
              </View>
            )}
          </View>
        </View>

        {/* Optional Notes & Terms */}
        {(invoice.notes || invoice.terms) ? (
          <View style={styles.notesSection} wrap={false}>
            {invoice.notes ? (
              <View style={styles.noteRow}>
                <Text style={styles.noteLabel}>ملاحظات</Text>
                <Text style={styles.noteColon}> : </Text>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={styles.noteRow}>
                <Text style={styles.noteLabel}>الشروط والأحكام</Text>
                <Text style={styles.noteColon}> : </Text>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── 5. FOOTER: RECEIVER SIGNATURE ─── */}
        <View style={styles.footerSection} wrap={false}>
          {signatureDataUrl ? (
            <Image src={signatureDataUrl} style={styles.signatureImage} />
          ) : null}
          <Text style={styles.receiverSignText}>- توقيع المستلم</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── STYLES (PIXEL-PERFECT TAJAWAL TYPOGRAPHY) ────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 32,
    flexDirection: "column",
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // 1. Top Header
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logoCol: {
    width: "32%",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  logoImage: {
    width: 112,
    height: 76,
    objectFit: "contain",
  },
  sellerCol: {
    width: "66%",
    alignItems: "flex-end",
    textAlign: "right",
  },
  mainTitleAr: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 20,
    color: "#111827",
    marginBottom: 3,
    textAlign: "right",
  },
  sellerNameText: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#1F2937",
    marginBottom: 1.5,
    textAlign: "right",
  },
  sellerInfoText: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#1F2937",
    marginBottom: 1.5,
    textAlign: "right",
  },
  sellerMetaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 1.5,
  },
  sellerColon: {
    fontFamily: "Tajawal",
    fontSize: 8.5,
    color: "#1F2937",
  },
  headerDivider: {
    width: "100%",
    height: 0.8,
    backgroundColor: "#D1D5DB",
    marginBottom: 14,
  },

  // 2. Meta & Customer ("الجهة") Section
  metaAndCustomerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  invoiceMetaCol: {
    width: "34%",
    flexDirection: "column",
  },
  metaLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
    paddingHorizontal: 4,
  },
  metaValCell: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
  },
  metaValText: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#1F2937",
    textAlign: "center",
  },
  metaLabelCell: {
    width: "52%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metaLabelBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "right",
  },

  // Shaded Amount Due Box with White Vertical Separator
  dueAmountBoxRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 2,
  },
  dueAmountValBox: {
    width: "47%",
    backgroundColor: "#D9D9D9",
    paddingVertical: 5,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 1.5,
  },
  dueAmountValText: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#111827",
  },
  dueAmountLabelBox: {
    width: "52%",
    backgroundColor: "#D9D9D9",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  dueAmountLabelText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.2,
    color: "#111827",
    textAlign: "right",
  },

  // Customer Column ("الجهة")
  customerCol: {
    width: "62%",
    alignItems: "flex-end",
    textAlign: "right",
  },
  customerSectionHeader: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#7E8A8F",
    textAlign: "right",
    marginBottom: 1,
  },
  customerPrimaryText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 10.5,
    color: "#7E8A8F",
    textAlign: "right",
  },
  customerInlineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  // 3. Borderless Line Items Table (RTL)
  table: {
    width: "100%",
    marginBottom: 22,
  },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableDataRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  thCell: {
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tdCell: {
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  thText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "center",
  },
  thTextRight: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "right",
  },
  thTextLeft: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "left",
  },
  tdIndexText: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#111827",
    textAlign: "center",
  },
  tdProductTitle: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#111827",
    textAlign: "right",
  },
  tdProductSub: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#374151",
    textAlign: "right",
    marginTop: 2,
  },
  tdCenterText: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#111827",
    textAlign: "center",
  },
  tdSubUnitText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#374151",
    textAlign: "center",
    marginTop: 2,
  },
  tdSubAmountText: {
    fontFamily: "Tajawal",
    fontSize: 7.5,
    color: "#111827",
  },
  currencyInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  currencyInlineRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 1,
  },

  // Column Widths (Sum = 100%)
  colIndex: { width: "4%" },
  colProduct: { width: "42%" },
  colQty: { width: "9%" },
  colPrice: { width: "9%" },
  colDiscount: { width: "9%" },
  colSubtotal: { width: "10%" },
  colVat: { width: "8%" },
  colTotal: { width: "9%" },

  // 4. Bottom Summary & QR Row
  bottomSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 16,
  },
  totalsCol: {
    width: "36%",
    flexDirection: "column",
  },
  totalLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  totalAmountGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  totalValBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
  },
  totalLabelGroup: {
    alignItems: "flex-end",
  },
  totalLabelBold: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8.5,
    color: "#111827",
    textAlign: "right",
  },
  splitDividerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2,
  },
  splitDividerLeft: {
    width: "34%",
    height: 0.8,
    backgroundColor: "#BDBDBD",
  },
  splitDividerRight: {
    width: "64%",
    height: 0.8,
    backgroundColor: "#BDBDBD",
  },

  qrCol: {
    width: "30%",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  qrImage: {
    width: 112,
    height: 112,
  },
  qrPlaceholder: {
    width: 112,
    height: 112,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: {
    fontSize: 8,
    color: "#9CA3AF",
  },

  // Optional Notes Section
  notesSection: {
    marginBottom: 12,
    paddingTop: 4,
  },
  noteRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  noteLabel: {
    fontFamily: "Tajawal",
    fontWeight: "bold",
    fontSize: 8,
    color: "#374151",
  },
  noteColon: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#374151",
  },
  noteBody: {
    fontFamily: "Tajawal",
    fontSize: 8,
    color: "#1F2937",
    flex: 1,
    textAlign: "right",
  },

  // 5. Footer Signature
  footerSection: {
    marginTop: "auto",
    alignItems: "flex-end",
    paddingTop: 12,
  },
  signatureImage: {
    width: 72,
    height: 36,
    objectFit: "contain",
    marginBottom: 4,
  },
  receiverSignText: {
    fontFamily: "Tajawal",
    fontSize: 10,
    color: "#1F2937",
    textAlign: "right",
  },
});
