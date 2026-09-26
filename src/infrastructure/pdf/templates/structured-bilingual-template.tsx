import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { TemplateDefinition } from "./registry";

export interface StructuredBilingualTemplateProps {
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

/**
 * Formats ISO date to strictly DD/MM/YYYY without hours or time.
 */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * Format monetary amount with full decimal precision — NEVER floor, ceiling, or round.
 * Preserves the exact decimal tail (e.g. 23.4646916641601264) and formats the integer part with commas.
 */
function formatExactAmount(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const str = String(val).trim();
  if (isNaN(Number(str))) return str;
  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;
  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

/**
 * Top header bilingual metadata row with strict BiDi row-reverse & independent colon:
 * [Arabic label on RIGHT] + [independent colon ':'] + [value in CENTER] + [English label on LEFT]
 */
function HeaderMetaRow({
  labelEn,
  labelAr,
  value,
}: {
  labelEn: string;
  labelAr: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaKeyAr}>{labelAr}</Text>
      <Text style={styles.metaColon}>:</Text>
      <Text style={styles.metaVal}>{value}</Text>
      <Text style={styles.metaKeyEn}>{labelEn}</Text>
    </View>
  );
}

/**
 * Structured Dual Party cell with strict BiDi row-reverse & independent middle colon:
 * [Arabic label on RIGHT] + [independent colon ':'] + [value in CENTER] + [English label on LEFT]
 */
function PartyCell({
  labelEn,
  labelAr,
  value,
  hasLeftBorder = false,
}: {
  labelEn: string;
  labelAr: string;
  value: string;
  hasLeftBorder?: boolean;
}) {
  return (
    <View
      style={[
        styles.partyCellHalf,
        hasLeftBorder ? { borderLeftWidth: 1, borderLeftColor: "#000000" } : {},
      ]}
    >
      <Text style={styles.partyKeyAr}>{labelAr}</Text>
      <Text style={styles.partyValCenter}>{value}</Text>
      <Text style={styles.partyKeyEn}>{labelEn}</Text>
    </View>
  );
}

export function StructuredBilingualTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: StructuredBilingualTemplateProps) {
  const invoiceNum = invoice.invoiceNumber ?? "";
  const issueDateStr = formatDate(invoice.issueDate);

  // Seller Details
  const sellerName = company.nameEn
    ? `${company.nameAr || ""} / ${company.nameEn}`
    : company.nameAr || "";
  const sellerBuilding = company.addressBuildingNumber || "";
  const sellerStreet = company.addressStreet || "";
  const sellerDistrict = company.addressDistrict || "";
  const sellerCity = company.addressCity || "";
  const sellerState = "";
  const sellerCountry = "المملكة العربية السعودية";
  const sellerPostalCode = company.addressPostalCode || "";
  const sellerAdditionalNo = company.addressAdditionalNumber || "";
  const sellerVat = company.vatNumber || "";
  const sellerCr = company.crNumber || "";
  const sellerPhone = company.phone || "";
  const sellerEmail = company.email || "";
  const sellerWebsite = company.website || "";

  // Buyer Details
  const buyerName = customer.nameEn
    ? `${customer.nameAr || ""} / ${customer.nameEn}`
    : customer.nameAr || "";
  const buyerBuilding = customer.addressBuildingNumber || "";
  const buyerStreet = customer.addressStreet || "";
  const buyerDistrict = customer.addressDistrict || "";
  const buyerCity = customer.addressCity || "";
  const buyerState = "";
  const buyerCountry = "المملكة العربية السعودية";
  const buyerPostalCode = customer.addressPostalCode || "";
  const buyerAdditionalNo = customer.addressAdditionalNumber || "";
  const buyerVat = customer.vatNumber || "";
  const buyerUnifiedOrCr = customer.unifiedNumber || "";
  const buyerPhone = customer.phone || "";
  const buyerEmail = customer.email || "";

  const items = invoice.items || [];
  const hasAnyDiscount = items.some(
    (it) => Number(it.discountAmount || 0) > 0
  );

  const hasOptionalPhone = Boolean(sellerPhone || buyerPhone);
  const hasOptionalEmail = Boolean(sellerEmail || buyerEmail);
  const hasOptionalWebsite = Boolean(sellerWebsite);

  // Dynamic single-page height calculation so the invoice NEVER spills onto a second page
  const baseA4Height = 842;
  let extraHeight = Math.max(0, items.length - 4) * 32;
  if (hasAnyDiscount) extraHeight += items.length * 10;
  if (hasOptionalPhone) extraHeight += 14;
  if (hasOptionalEmail) extraHeight += 14;
  if (hasOptionalWebsite) extraHeight += 14;
  if (invoice.notes) extraHeight += 35 + invoice.notes.split("\n").length * 12;
  if (invoice.terms) extraHeight += 35 + invoice.terms.split("\n").length * 12;
  if (company.footerText) extraHeight += 25;
  const dynamicPageHeight = Math.max(baseA4Height, baseA4Height + extraHeight);

  return (
    <Document
      title={`فاتورة ضريبية ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="TAX INVOICE"
      creator="Hulool Invoicing"
    >
      <Page
        size={[595.28, dynamicPageHeight]}
        orientation="portrait"
        style={styles.page}
      >
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP HEADER ─── */}
        <View style={styles.headerRow}>
          {/* Left: Invoice Metadata */}
          <View style={styles.headerLeftMeta}>
            {/* Row 1: Invoice Number */}
            <HeaderMetaRow
              labelEn="Invoice Number"
              labelAr="رقم الفاتورة"
              value={invoiceNum}
            />

            {/* Row 2: Invoice Issue Date */}
            <HeaderMetaRow
              labelEn="Invoice Issue Date"
              labelAr="تاريخ إصدار الفاتورة"
              value={issueDateStr}
            />
          </View>

          {/* Center: Main Title and optional Logo */}
          <View style={styles.headerCenterTitle}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.headerLogo} />
            ) : null}
            <Text style={styles.titleAr}>فاتورة ضريبية</Text>
            <Text style={styles.titleEn}>Tax Invoice</Text>
          </View>

          {/* Right: Frameless ZATCA QR Code */}
          <View style={styles.headerRightQr}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrImage} />
            ) : null}
          </View>
        </View>

        {/* ─── 2. DUAL PARTY CARDS: SELLER & BUYER ─── */}
        <View style={styles.partiesTable}>
          {/* Header Row: Seller | Buyer */}
          <View style={styles.partiesHeaderRow}>
            {/* Left: Seller Header */}
            <View style={styles.partyHeaderHalf}>
              <Text style={styles.partyHeaderEn}>Seller</Text>
              <Text style={styles.partyHeaderAr}>تاجر</Text>
            </View>

            {/* Right: Buyer Header */}
            <View
              style={[
                styles.partyHeaderHalf,
                { borderLeftWidth: 1, borderLeftColor: "#000000" },
              ]}
            >
              <Text style={styles.partyHeaderEn}>Buyer</Text>
              <Text style={styles.partyHeaderAr}>العميل</Text>
            </View>
          </View>

          {/* Body: Structured Rows */}
          <View style={styles.partiesBody}>
            {/* Row 1: Name */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Name"
                labelAr="الاسم"
                value={sellerName}
              />
              <PartyCell
                labelEn="Name"
                labelAr="الاسم"
                value={buyerName}
                hasLeftBorder
              />
            </View>

            {/* Row 2: Building No. */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Building No."
                labelAr="رقم المبنى"
                value={sellerBuilding}
              />
              <PartyCell
                labelEn="Building No."
                labelAr="رقم المبنى"
                value={buyerBuilding}
                hasLeftBorder
              />
            </View>

            {/* Row 3: Street Name */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Street Name"
                labelAr="اسم الشارع"
                value={sellerStreet}
              />
              <PartyCell
                labelEn="Street Name"
                labelAr="اسم الشارع"
                value={buyerStreet}
                hasLeftBorder
              />
            </View>

            {/* Row 4: District */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="District"
                labelAr="الحي"
                value={sellerDistrict}
              />
              <PartyCell
                labelEn="District"
                labelAr="الحي"
                value={buyerDistrict}
                hasLeftBorder
              />
            </View>

            {/* Row 5: City */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="City"
                labelAr="المدينة"
                value={sellerCity}
              />
              <PartyCell
                labelEn="City"
                labelAr="المدينة"
                value={buyerCity}
                hasLeftBorder
              />
            </View>

            {/* Row 6: Province/State */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Province/State"
                labelAr="المنطقة"
                value={sellerState}
              />
              <PartyCell
                labelEn="Province/State"
                labelAr="المنطقة"
                value={buyerState}
                hasLeftBorder
              />
            </View>

            {/* Row 7: Country */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Country"
                labelAr="الدولة"
                value={sellerCountry}
              />
              <PartyCell
                labelEn="Country"
                labelAr="الدولة"
                value={buyerCountry}
                hasLeftBorder
              />
            </View>

            {/* Row 8: Postal Code */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Postal Code"
                labelAr="الرمز البريدي"
                value={sellerPostalCode}
              />
              <PartyCell
                labelEn="Postal Code"
                labelAr="الرمز البريدي"
                value={buyerPostalCode}
                hasLeftBorder
              />
            </View>

            {/* Row 9: Additional No. */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="Additional No."
                labelAr="الرقم الإضافي"
                value={sellerAdditionalNo}
              />
              <PartyCell
                labelEn="Additional No."
                labelAr="الرقم الإضافي"
                value={buyerAdditionalNo}
                hasLeftBorder
              />
            </View>

            {/* Row 10: VAT Number */}
            <View style={styles.partyRow}>
              <PartyCell
                labelEn="VAT Number"
                labelAr="الرقم الضريبي"
                value={sellerVat}
              />
              <PartyCell
                labelEn="VAT Number"
                labelAr="الرقم الضريبي"
                value={buyerVat}
                hasLeftBorder
              />
            </View>

            {/* Row 11: CR / Unified Number */}
            <View
              style={[
                styles.partyRow,
                !hasOptionalPhone && !hasOptionalEmail && !hasOptionalWebsite
                  ? { borderBottomWidth: 0 }
                  : {},
              ]}
            >
              <PartyCell
                labelEn="CR Number"
                labelAr="السجل التجاري"
                value={sellerCr}
              />
              <PartyCell
                labelEn="Unified Number"
                labelAr="الرقم الموحد"
                value={buyerUnifiedOrCr}
                hasLeftBorder
              />
            </View>

            {/* Optional Row 12: Phone */}
            {hasOptionalPhone ? (
              <View
                style={[
                  styles.partyRow,
                  !hasOptionalEmail && !hasOptionalWebsite
                    ? { borderBottomWidth: 0 }
                    : {},
                ]}
              >
                <PartyCell
                  labelEn="Phone"
                  labelAr="الهاتف"
                  value={sellerPhone}
                />
                <PartyCell
                  labelEn="Phone"
                  labelAr="الهاتف"
                  value={buyerPhone}
                  hasLeftBorder
                />
              </View>
            ) : null}

            {/* Optional Row 13: Email */}
            {hasOptionalEmail ? (
              <View
                style={[
                  styles.partyRow,
                  !hasOptionalWebsite ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <PartyCell
                  labelEn="Email"
                  labelAr="البريد الإلكتروني"
                  value={sellerEmail}
                />
                <PartyCell
                  labelEn="Email"
                  labelAr="البريد الإلكتروني"
                  value={buyerEmail}
                  hasLeftBorder
                />
              </View>
            ) : null}

            {/* Optional Row 14: Website */}
            {hasOptionalWebsite ? (
              <View style={[styles.partyRow, { borderBottomWidth: 0 }]}>
                <PartyCell
                  labelEn="Website"
                  labelAr="الموقع الإلكتروني"
                  value={sellerWebsite}
                />
                <PartyCell
                  labelEn=""
                  labelAr=""
                  value=""
                  hasLeftBorder
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE (GREY HEADER) ─── */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            {/* 1. Goods or Services */}
            <View
              style={[
                styles.thCell,
                { width: hasAnyDiscount ? "22%" : "24%" },
              ]}
            >
              <Text style={styles.thEn}>Goods or Services</Text>
              <Text style={styles.thAr}>السلع أو الخدمات</Text>
            </View>

            {/* 2. Qty */}
            <View
              style={[
                styles.thCell,
                { width: hasAnyDiscount ? "6%" : "7%" },
              ]}
            >
              <Text style={styles.thEn}>Qty</Text>
              <Text style={styles.thAr}>الكمية</Text>
            </View>

            {/* 3. Unit Price */}
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thEn}>Unit Price</Text>
              <Text style={styles.thAr}>سعر الوحدة</Text>
            </View>

            {/* 4. Optional: Discount Column if any discount exists */}
            {hasAnyDiscount ? (
              <View style={[styles.thCell, { width: "10%" }]}>
                <Text style={styles.thEn}>Discount</Text>
                <Text style={styles.thAr}>الخصم</Text>
              </View>
            ) : null}

            {/* 5. Taxable Amount */}
            <View
              style={[
                styles.thCell,
                { width: hasAnyDiscount ? "14%" : "16%" },
              ]}
            >
              <Text style={styles.thEn}>Taxable Amount</Text>
              <Text style={styles.thAr}>المبلغ الخاضع للضريبة</Text>
            </View>

            {/* 6. Tax Rate */}
            <View
              style={[
                styles.thCell,
                { width: hasAnyDiscount ? "10%" : "11%" },
              ]}
            >
              <Text style={styles.thEn}>Tax Rate</Text>
              <Text style={styles.thAr}>نسبة الضريبة</Text>
            </View>

            {/* 7. Tax Amount */}
            <View
              style={[
                styles.thCell,
                { width: hasAnyDiscount ? "11%" : "12%" },
              ]}
            >
              <Text style={styles.thEn}>Tax Amount</Text>
              <Text style={styles.thAr}>مبلغ الضريبة</Text>
            </View>

            {/* 8. Subtotal (Including VAT) */}
            <View
              style={[
                styles.thCell,
                {
                  width: hasAnyDiscount ? "17%" : "20%",
                  borderRightWidth: 0,
                },
              ]}
            >
              <Text style={styles.thEnBold}>Subtotal</Text>
              <Text style={styles.thEnSmall}>(Including VAT)</Text>
              <Text style={styles.thArBold}>المجموع الجزئي</Text>
              <Text style={styles.thArSmall}>
                (بما في ذلك ضريبة القيمة المضافة)
              </Text>
            </View>
          </View>

          {/* Body Rows */}
          {items.map((item, index) => {
            const vatPct = Math.round(Number(item.vatRate || 0.15) * 100);
            const hasItemDiscount = Number(item.discountAmount || 0) > 0;
            const originalBeforeDiscount =
              Number(item.quantity) * Number(item.unitPrice);

            return (
              <View
                key={item.position ?? index}
                style={[
                  styles.tableBodyRow,
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                {/* 1. Goods or Services */}
                <View
                  style={[
                    styles.tdCell,
                    { width: hasAnyDiscount ? "22%" : "24%" },
                  ]}
                >
                  <Text style={styles.tdTextRight}>{item.description}</Text>
                </View>

                {/* 2. Qty */}
                <View
                  style={[
                    styles.tdCell,
                    { width: hasAnyDiscount ? "6%" : "7%" },
                  ]}
                >
                  <Text style={styles.tdTextCenter}>
                    {formatExactAmount(item.quantity)}
                  </Text>
                </View>

                {/* 3. Unit Price */}
                <View style={[styles.tdCell, { width: "10%" }]}>
                  <Text style={styles.tdTextCenter}>
                    {formatExactAmount(item.unitPrice)}
                  </Text>
                </View>

                {/* 4. Optional: Discount Column */}
                {hasAnyDiscount ? (
                  <View style={[styles.tdCell, { width: "10%" }]}>
                    <Text style={styles.tdTextCenter}>
                      {hasItemDiscount
                        ? formatExactAmount(item.discountAmount)
                        : "0"}
                    </Text>
                  </View>
                ) : null}

                {/* 5. Taxable Amount */}
                <View
                  style={[
                    styles.tdCell,
                    { width: hasAnyDiscount ? "14%" : "16%" },
                  ]}
                >
                  <Text style={styles.tdTextCenter}>
                    {formatExactAmount(item.lineSubtotal)}
                  </Text>
                  {hasItemDiscount ? (
                    <Text style={styles.tdSubtextCenter}>
                      قبل: {formatExactAmount(originalBeforeDiscount)}
                    </Text>
                  ) : null}
                </View>

                {/* 6. Tax Rate */}
                <View
                  style={[
                    styles.tdCell,
                    { width: hasAnyDiscount ? "10%" : "11%" },
                  ]}
                >
                  <Text style={styles.tdTextCenter}>{vatPct}%</Text>
                </View>

                {/* 7. Tax Amount */}
                <View
                  style={[
                    styles.tdCell,
                    { width: hasAnyDiscount ? "11%" : "12%" },
                  ]}
                >
                  <Text style={styles.tdTextCenter}>
                    {formatExactAmount(item.lineVat)}
                  </Text>
                </View>

                {/* 8. Subtotal (Including VAT) */}
                <View
                  style={[
                    styles.tdCell,
                    {
                      width: hasAnyDiscount ? "17%" : "20%",
                      borderRightWidth: 0,
                    },
                  ]}
                >
                  <Text style={styles.tdTextCenter}>
                    {formatExactAmount(item.lineTotal)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── 4. BOTTOM AREA: NOTES, TERMS & TOTALS ─── */}
        <View style={styles.bottomSection}>
          {/* Left: Notes & Terms */}
          <View style={styles.bottomLeftCol}>
            {/* Notes if present */}
            {invoice.notes ? (
              <View style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteTitleEn}>Notes</Text>
                  <Text style={styles.noteTitleAr}>ملاحظات</Text>
                </View>
                <Text style={styles.noteBody}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Terms if present */}
            {invoice.terms ? (
              <View style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteTitleEn}>Terms and Conditions</Text>
                  <Text style={styles.noteTitleAr}>الشروط والأحكام</Text>
                </View>
                <Text style={styles.noteBody}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>

          {/* Right: Totals Breakdown */}
          <View style={styles.totalsCol}>
            {/* Row 1: Total (Excluding VAT) */}
            <View style={styles.totalRow}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Total (Excluding VAT)</Text>
                <Text style={styles.totalLabelAr}>
                  الإجمالي (غير شامل ضريبة القيمة المضافة)
                </Text>
              </View>
              <Text style={styles.totalVal}>
                {formatExactAmount(invoice.subtotal)} SAR
              </Text>
            </View>

            {/* Row 2: Total VAT */}
            <View
              style={[
                styles.totalRow,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: "#000000",
                  paddingBottom: 4,
                },
              ]}
            >
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Total VAT</Text>
                <Text style={styles.totalLabelAr}>مجموع ضريبة القيمة المضافة</Text>
              </View>
              <Text style={styles.totalVal}>
                {formatExactAmount(invoice.vatAmount)} SAR
              </Text>
            </View>

            {/* Row 3: Total (Including VAT) */}
            <View
              style={[
                styles.totalRow,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: "#000000",
                  paddingVertical: 4,
                },
              ]}
            >
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEnBold}>
                  Total (Including VAT)
                </Text>
                <Text style={styles.totalLabelArBold}>
                  الإجمالي (بما في ذلك ضريبة القيمة المضافة)
                </Text>
              </View>
              <Text style={styles.totalValBold}>
                {formatExactAmount(invoice.total)} SAR
              </Text>
            </View>

            {/* Row 4: Invoice Paid */}
            <View
              style={[
                styles.totalRow,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: "#000000",
                  paddingVertical: 4,
                },
              ]}
            >
              <View style={styles.totalLabelGroup}>
                <Text style={styles.totalLabelEn}>Invoice Paid</Text>
                <Text style={styles.totalLabelAr}>الفاتورة مدفوعة</Text>
              </View>
              <Text style={styles.totalVal}>
                {formatExactAmount(invoice.total)} SAR
              </Text>
            </View>

            {/* Row 5: Balance Due (Grey Shaded Box) */}
            <View style={styles.balanceDueBox}>
              <View style={styles.totalLabelGroup}>
                <Text style={styles.balanceDueEn}>Balance Due</Text>
                <Text style={styles.balanceDueAr}>إجمالي المبلغ المستحق</Text>
              </View>
              <Text style={styles.balanceDueVal}>0 SAR</Text>
            </View>
          </View>
        </View>

        {/* ─── 5. FOOTER TEXT ─── */}
        {company.footerText ? (
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>{company.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 30,
    paddingRight: 30,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 8.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "28%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── 1. Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeftMeta: {
    width: "40%",
    flexDirection: "column",
    gap: 3,
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaKeyAr: {
    fontSize: 7.5,
    textAlign: "right",
    width: "36%",
  },
  metaColon: {
    fontSize: 7.5,
    textAlign: "center",
    marginHorizontal: 2,
    width: 6,
  },
  metaVal: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
  },
  metaKeyEn: {
    fontSize: 7.5,
    textAlign: "left",
    width: "36%",
  },

  headerCenterTitle: {
    width: "35%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  headerLogo: {
    maxWidth: 90,
    maxHeight: 46,
    objectFit: "contain",
    marginBottom: 3,
  },
  titleAr: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 1,
  },
  titleEn: {
    fontSize: 12,
    textAlign: "center",
  },

  headerRightQr: {
    width: "25%",
    alignItems: "flex-end",
  },
  qrImage: {
    width: 131,
    height: 131,
  },
  qrPlaceholder: {
    width: 131,
    height: 131,
  },

  // ─── 2. Dual Party Table ───
  partiesTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 12,
  },
  partiesHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D1D5DB",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 18,
  },
  partyHeaderHalf: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  partyHeaderEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "left",
  },
  partyHeaderAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },

  partiesBody: {
    flexDirection: "column",
  },
  partyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 13,
  },
  partyCellHalf: {
    width: "50%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  partyKeyAr: {
    fontSize: 7,
    textAlign: "right",
    width: "32%",
  },

  partyValCenter: {
    fontSize: 7,
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
  partyKeyEn: {
    fontSize: 7,
    textAlign: "left",
    width: "30%",
  },

  // ─── 3. Items Table ───
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#D1D5DB",
    minHeight: 32,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thEn: {
    fontSize: 7,
    textAlign: "center",
    marginBottom: 1,
  },
  thAr: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEnBold: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  thEnSmall: {
    fontSize: 5.5,
    textAlign: "center",
  },
  thArBold: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  thArSmall: {
    fontSize: 5.5,
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 22,
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  tdTextRight: {
    fontSize: 7,
    textAlign: "right",
  },
  tdTextCenter: {
    fontSize: 7,
    textAlign: "center",
  },
  tdSubtextCenter: {
    fontSize: 5.5,
    textAlign: "center",
    color: "#4B5563",
    marginTop: 1,
  },

  // ─── 4. Bottom Area ───
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bottomLeftCol: {
    width: "48%",
    flexDirection: "column",
    gap: 8,
  },


  noteCard: {
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    padding: 5,
    borderRadius: 2,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
    paddingBottom: 2,
    marginBottom: 3,
  },
  noteTitleEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "left",
  },
  noteTitleAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  noteBody: {
    fontSize: 7,
    textAlign: "right",
    lineHeight: 1.3,
  },



  totalsCol: {
    width: "48%",
    flexDirection: "column",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalLabelGroup: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  totalLabelEn: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelAr: {
    fontSize: 7.5,
    textAlign: "right",
  },
  totalLabelEnBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalLabelArBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalVal: {
    fontSize: 8,
    textAlign: "right",
  },
  totalValBold: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },

  balanceDueBox: {
    backgroundColor: "#D1D5DB",
    borderWidth: 1,
    borderColor: "#000000",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 3,
  },
  balanceDueEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  balanceDueAr: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  balanceDueVal: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "right",
  },

  // ─── 5. Footer Text ───
  footerSection: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#9CA3AF",
  },
  footerText: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#4B5563",
  },
});
