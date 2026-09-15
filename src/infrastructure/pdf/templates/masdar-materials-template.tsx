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

export interface MasdarBuildingMaterialsTemplateProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  template: TemplateDefinition;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
  withTerms?: boolean;
}

function formatNumber(val: string | number | undefined | null, decimals: number = 2): string {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0)) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return iso || "";
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return "";
  }
}

export function MasdarBuildingMaterialsTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  withTerms = true,
}: MasdarBuildingMaterialsTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const invoiceNum = invoice.invoiceNumber || "";
  const txDate = formatDate(invoice.issueDate);
  const txTime = formatTime(invoice.issuedAt || invoice.issueDate);
  const printDate = formatDate(invoice.issueDate);
  const printTime = txTime;

  // Address lines for company
  const addressParts = [
    company.addressStreet,
    company.addressDistrict,
    company.addressCity,
    company.addressPostalCode,
  ].filter(Boolean);
  const companyAddressStr = addressParts.join(" - ");

  // Calculations
  const subtotal = Number(invoice.subtotal || 0);
  const discountTotal = Number((invoice as any).discountTotal || 0);
  const netAfterDiscount = subtotal - discountTotal;
  const vatTotal = Number(invoice.vatAmount || 0);
  const grandTotal = Number(invoice.total || 0);
  const totalItemsCount = (invoice.items || []).length;

  return (
    <Document
      title={`فاتورة ضريبية مبسطة ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Simplified Tax Invoice"
      creator="Hulool Invoicing"
    >
      {/* ─── PAGE 1: INVOICE MAIN ─── */}
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── TOP HEADER ─── */}
        <View style={styles.topHeaderWrap}>
          {/* Left: Logo & Company Identification */}
          <View style={styles.headerLeft}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.companyLogo} />
            ) : null}
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}

            {/* CR & VAT row */}
            {(company.crNumber || company.vatNumber) ? (
              <View style={styles.crVatBox}>
                <Text style={styles.crVatText}>
                  {company.crNumber ? `س.ت C.R. ${company.crNumber}` : ""}
                  {company.crNumber && company.vatNumber ? " | " : ""}
                  {company.vatNumber ? `الرقم الضريبي VAT NUMBER ${company.vatNumber}` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Middle: Title & Address */}
          <View style={styles.headerCenter}>
            {companyAddressStr ? (
              <Text style={styles.branchAddressText}>{companyAddressStr}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.branchPhoneText}>{company.phone}</Text>
            ) : null}

            <View style={styles.titleBox}>
              <Text style={styles.titleEn}>Simplified Tax invoice</Text>
              <Text style={styles.titleAr}>فاتورة ضريبية مبسطة</Text>
              <Text style={styles.titleSub}>Duplicate</Text>
            </View>
          </View>

          {/* Right: Big ZATCA QR Code */}
          <View style={styles.headerRight}>
            {qrDataUrl ? (
              <Image src={qrDataUrl} style={styles.qrCodeImage} />
            ) : null}
          </View>
        </View>

        {/* ─── METADATA GRID BOX ─── */}
        <View style={styles.metaGrid}>
          {/* Row 1: Transaction Date, Print Date, Serial Number */}
          <View style={styles.gridRow}>
            {/* Col 1: Transaction Date */}
            <View style={[styles.gridCell, { width: "32%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderEn}>TRANSACTION DATE</Text>
                <Text style={styles.cellHeaderAr}>تاريخ العملية</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValText}>{txDate}</Text>
                <Text style={styles.cellValText}>{txTime}</Text>
              </View>
            </View>

            {/* Col 2: Print Date */}
            <View style={[styles.gridCell, { width: "32%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderEn}>PRINT DATE</Text>
                <Text style={styles.cellHeaderAr}>تاريخ الطباعة</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValText}>{printDate}</Text>
                <Text style={styles.cellValText}>{printTime}</Text>
              </View>
            </View>

            {/* Col 3: Serial Number / UUID */}
            <View style={[styles.gridCell, { width: "36%", borderRightWidth: 0 }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderEn}>Serial Number</Text>
                <Text style={styles.cellHeaderAr}>الرقم التسلسلي</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValBold}>{invoiceNum}</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Customer / Ship / Salesperson */}
          <View style={styles.gridRow}>
            {/* Customer Box */}
            <View style={[styles.gridCell, { width: "50%" }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderEn}>CUSTOMER</Text>
                <Text style={styles.cellHeaderAr}>زبـــــون</Text>
              </View>
              <View style={styles.customerInnerBox}>
                {customer.nameAr ? (
                  <Text style={styles.customerNameText}>{customer.nameAr}</Text>
                ) : null}
                {customer.nameEn ? (
                  <Text style={styles.customerNameText}>{customer.nameEn}</Text>
                ) : null}
                {customer.phone ? (
                  <Text style={styles.customerMetaText}>Mob: {customer.phone}</Text>
                ) : null}
                {customer.vatNumber ? (
                  <Text style={styles.customerMetaText}>Vat No.: {customer.vatNumber}</Text>
                ) : null}
              </View>
            </View>

            {/* Salesperson & Supply Details */}
            <View style={[styles.gridCell, { width: "50%", borderRightWidth: 0 }]}>
              <View style={styles.cellHeaderRow}>
                <Text style={styles.cellHeaderEn}>SalesPerson</Text>
                <Text style={styles.cellHeaderAr}>البـــائــــع</Text>
              </View>
              <View style={styles.cellValRow}>
                {/* Admin-only clientEmployee removed — salesperson cell intentionally blank. */}
                <Text style={styles.cellValText}></Text>
              </View>

              {/* Delivery Date & Place of Supply */}
              <View style={[styles.cellHeaderRow, { borderTopWidth: 0.5, borderTopColor: "#000000", marginTop: 4, paddingTop: 2 }]}>
                <Text style={styles.cellHeaderEn}>Place Of Supply</Text>
                <Text style={styles.cellHeaderAr}>مكان التوريد</Text>
              </View>
              <View style={styles.cellValRow}>
                <Text style={styles.cellValText}>{company.addressCity || ""}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── ITEMS TABLE ─── */}
        <View style={styles.tableWrap}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.thCell, { width: "12%" }]}>
              <Text style={styles.thTextEn}>Item</Text>
              <Text style={styles.thTextAr}>الصنف</Text>
            </View>
            <View style={[styles.thCell, { width: "38%" }]}>
              <Text style={styles.thTextEn}>Description</Text>
              <Text style={styles.thTextAr}>البيــــان</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextEn}>Qty & UOM</Text>
              <Text style={styles.thTextAr}>الكمية</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextEn}>Unit Price</Text>
              <Text style={styles.thTextAr}>سعر الوحدة</Text>
            </View>
            <View style={[styles.thCell, { width: "10%" }]}>
              <Text style={styles.thTextEn}>Taxable Amt</Text>
              <Text style={styles.thTextAr}>المبلغ الخاضع للضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thTextEn}>Rate</Text>
              <Text style={styles.thTextAr}>نسبة</Text>
            </View>
            <View style={[styles.thCell, { width: "6%" }]}>
              <Text style={styles.thTextEn}>Tax</Text>
              <Text style={styles.thTextAr}>الضريبة</Text>
            </View>
            <View style={[styles.thCell, { width: "8%", borderRightWidth: 0 }]}>
              <Text style={styles.thTextEn}>Total</Text>
              <Text style={styles.thTextAr}>إجمالي المبلغ</Text>
            </View>
          </View>

          {/* Table Rows */}
          {(invoice.items || []).map((item, idx) => {
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || 0);
            const lineSubtotal = Number(item.lineSubtotal ?? (unitPrice * qty));
            const vatRate = Number(item.vatRate ?? 0.15);
            const ratePercent = Math.round(vatRate > 1 ? vatRate : vatRate * 100);
            const lineVat = Number(item.lineVat ?? (lineSubtotal * (ratePercent / 100)));
            const lineTotal = Number(item.lineTotal ?? (lineSubtotal + lineVat));
            const itemCode = (item as any).itemCode || (item as any).code || "";

            return (
              <View key={item.position ?? idx} style={styles.tableRow}>
                <View style={[styles.tdCell, { width: "12%" }]}>
                  <Text style={styles.tdCode}>{itemCode}</Text>
                </View>
                <View style={[styles.tdCell, { width: "38%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdDescAr}>{item.description}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%", alignItems: "center" }]}>
                  <Text style={styles.tdCenter}>{qty} PCE</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatNumber(unitPrice)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "10%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatNumber(lineSubtotal)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "6%", alignItems: "center" }]}>
                  <Text style={styles.tdCenter}>{ratePercent}.00</Text>
                </View>
                <View style={[styles.tdCell, { width: "6%", alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatNumber(lineVat)}</Text>
                </View>
                <View style={[styles.tdCell, { width: "8%", borderRightWidth: 0, alignItems: "flex-end" }]}>
                  <Text style={styles.tdNum}>{formatNumber(lineTotal)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── SUMMARY & SIGNATURES BLOCK ─── */}
        <View style={styles.summaryContainer}>
          {/* Left Block: Signatures */}
          <View style={styles.signaturesBlock}>
            <View style={styles.sigRow}>
              <Text style={styles.sigLabelEn}>Prepared By</Text>
              <Text style={styles.sigLabelAr}>أعدها</Text>
              {/* Admin-only clientEmployee removed — prepared-by intentionally blank. */}
              <Text style={styles.sigVal}></Text>
            </View>
            <View style={styles.sigRow}>
              <Text style={styles.sigLabelEn}>Approved By</Text>
              <Text style={styles.sigLabelAr}>اعتمدها</Text>
              <Text style={styles.sigVal}></Text>
            </View>
            <View style={[styles.sigRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.sigLabelEn}>Received By</Text>
              <Text style={styles.sigLabelAr}>المستلم</Text>
              <Text style={styles.sigVal}></Text>
            </View>
          </View>

          {/* Middle: Remarks */}
          <View style={styles.remarksBlock}>
            <View style={styles.remarksHeader}>
              <Text style={styles.remarksHeaderEn}>Remarks</Text>
              <Text style={styles.remarksHeaderAr}>ملاحظات</Text>
            </View>
            <Text style={styles.remarksContent}>{invoice.notes || ""}</Text>
          </View>

          {/* Right: Totals Table */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total before VAT الإجمالي قبل الضريبة</Text>
              <Text style={styles.totalValue}>{formatNumber(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount الخصم</Text>
              <Text style={styles.totalValue}>{formatNumber(discountTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net after discount الصافي بعد الخصم</Text>
              <Text style={styles.totalValue}>{formatNumber(netAfterDiscount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT 15% ضريبة القيمة المضافة</Text>
              <Text style={styles.totalValue}>{formatNumber(vatTotal)}</Text>
            </View>
            <View style={[styles.totalRow, { borderBottomWidth: 0, backgroundColor: "#F8FAFC" }]}>
              <Text style={[styles.totalLabel, { fontWeight: "bold" }]}>Total Due الإجمالي المستحق</Text>
              <Text style={[styles.totalValue, { fontWeight: "bold" }]}>{formatNumber(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Footer Notes & Page indicator */}
        <View style={styles.footerNoteRow}>
          <Text style={styles.footerItemCount}>Total Number of Items: {totalItemsCount}</Text>
          <Text style={styles.footerEoE}>E & OE الخطأ والسهو مستثناه</Text>
        </View>
        <Text style={styles.pageEndMarker}>
          {withTerms ? "---------------PAGE 1/2 END---------------" : "---------------PAGE 1/1 END---------------"}
        </Text>
      </Page>

      {/* ─── PAGE 2: TERMS & CONDITIONS (OPTIONAL) ─── */}
      {withTerms ? (
        <Page size={paperSize as any} orientation="portrait" style={styles.page}>
          <View style={styles.termsHeader}>
            <Text style={styles.termsCompanyEn}>{company.nameEn || company.nameAr || ""}</Text>
            <Text style={styles.termsTitleEn}>Return and Exchange policy - Terms & Conditions</Text>
          </View>

          <View style={styles.termsEnList}>
            <Text style={styles.termsItem}>1. Customer must present the original invoice.</Text>
            <Text style={styles.termsItem}>2. Merchandise must be in its original packing, and in a saleable condition.</Text>
            <Text style={styles.termsItem}>3. Customer may return merchandise for a full cash refund within 7 days of purchase date.</Text>
            <Text style={styles.termsItem}>4. Customer may return Merchandise for exchange at a maximum period of 14 days of purchase date.</Text>
            <Text style={styles.termsItem}>5. Any materials fabricated, cut or sliced in special length, width, or using Special specifications (non-standard) for special use for the customer, will not be accepted.</Text>
            <Text style={styles.termsItem}>6. The customer shall bear the costs of transportation from his location to the company / showroom / warehouse.</Text>
            <Text style={styles.termsItem}>7. Merchandise used or damaged after purchase will not be accepted.</Text>
            <Text style={styles.termsItem}>8. The company reserves all the rights to accept or not to accept any merchandise in other conditions or circumstances not mentioned above.</Text>
          </View>

          <View style={styles.termsHeaderArWrap}>
            <Text style={styles.termsCompanyAr}>{company.nameAr || ""}</Text>
            <Text style={styles.termsTitleAr}>سياسة الاسترجاع والاستبدال - شروط وأحكام</Text>
          </View>

          <View style={styles.termsArList}>
            <Text style={styles.termsItemAr}>١. يجب على العميل تقديم الفاتورة الأصلية.</Text>
            <Text style={styles.termsItemAr}>٢. يجب أن تكون البضائع في عبوتها الأصلية وفي حالة قابلة للبيع.</Text>
            <Text style={styles.termsItemAr}>٣. يجوز للعميل إرجاع البضاعة واسترداد قيمتها النقدية كاملة خلال ٧ أيام من تاريخ الشراء.</Text>
            <Text style={styles.termsItemAr}>٤. يجوز للعميل إرجاع البضاعة للتبديل في مدة أقصاها ١٤ يوماً من تاريخ الشراء.</Text>
            <Text style={styles.termsItemAr}>٥. لن يتم قبول أي مواد تم تصنيعها أو قصها أو تقطيعها بطول أو عرض خاص أو استخدام مواصفات خاصة (غير قياسية) للاستخدام الخاص للعميل.</Text>
            <Text style={styles.termsItemAr}>٦. يتحمل العميل تكاليف النقل من موقعه لمعرض أو مستودع الشركة.</Text>
            <Text style={styles.termsItemAr}>٧. لن يتم قبول البضائع المستخدمة أو التالفة بعد الشراء.</Text>
            <Text style={styles.termsItemAr}>٨. تحتفظ الشركة بكافة الحقوق في قبول أو عدم قبول أي سلع في حالات أو ظروف أخرى غير مذكورة أعلاه.</Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 7.5,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Header ───
  topHeaderWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    width: "42%",
  },
  companyLogo: {
    width: 140,
    height: 48,
    objectFit: "contain",
    marginBottom: 4,
  },
  companyNameAr: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "right",
  },
  companyNameEn: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1E3A8A",
    textAlign: "left",
    marginBottom: 2,
  },
  crVatBox: {
    marginTop: 2,
  },
  crVatText: {
    fontSize: 6.5,
    color: "#334155",
  },
  headerCenter: {
    width: "36%",
    alignItems: "center",
    paddingTop: 4,
  },
  branchAddressText: {
    fontSize: 6.5,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 1,
  },
  branchPhoneText: {
    fontSize: 6.5,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 4,
  },
  titleBox: {
    alignItems: "center",
    marginTop: 4,
  },
  titleEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
  },
  titleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
  },
  titleSub: {
    fontSize: 7.5,
    color: "#475569",
  },
  headerRight: {
    width: "20%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  qrCodeImage: {
    width: 85,
    height: 85,
    objectFit: "contain",
  },

  // ─── Metadata Grid ───
  metaGrid: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 3,
  },
  cellHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  cellHeaderEn: {
    fontSize: 6.5,
    fontWeight: "bold",
  },
  cellHeaderAr: {
    fontSize: 6.5,
    fontWeight: "bold",
  },
  cellValRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cellValText: {
    fontSize: 6.5,
    color: "#000000",
  },
  cellValBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#000000",
  },
  customerInnerBox: {
    marginTop: 1,
  },
  customerNameText: {
    fontSize: 7.5,
    fontWeight: "bold",
    textAlign: "right",
  },
  customerMetaText: {
    fontSize: 6.5,
    color: "#1E293B",
  },

  // ─── Table ───
  tableWrap: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  thTextEn: {
    fontSize: 6,
    fontWeight: "bold",
    textAlign: "center",
  },
  thTextAr: {
    fontSize: 6,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    minHeight: 18,
  },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 2.5,
    justifyContent: "center",
  },
  tdCode: {
    fontSize: 6.5,
  },
  tdDescAr: {
    fontSize: 6.5,
    textAlign: "right",
  },
  tdCenter: {
    fontSize: 6.5,
    textAlign: "center",
  },
  tdNum: {
    fontSize: 6.5,
    textAlign: "right",
  },

  // ─── Summary Section ───
  summaryContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 6,
  },
  signaturesBlock: {
    width: "28%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    padding: 3,
    minHeight: 20,
  },
  sigLabelEn: {
    fontSize: 6,
    fontWeight: "bold",
  },
  sigLabelAr: {
    fontSize: 6,
    fontWeight: "bold",
  },
  sigVal: {
    fontSize: 6,
  },
  remarksBlock: {
    width: "36%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    padding: 3,
  },
  remarksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 2,
    marginBottom: 2,
  },
  remarksHeaderEn: {
    fontSize: 6,
    fontWeight: "bold",
  },
  remarksHeaderAr: {
    fontSize: 6,
    fontWeight: "bold",
  },
  remarksContent: {
    fontSize: 6.5,
  },
  totalsBlock: {
    width: "36%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontSize: 6,
    color: "#000000",
  },
  totalValue: {
    fontSize: 6.5,
    color: "#000000",
  },

  // ─── Footer Notes ───
  footerNoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: "#000000",
    padding: 3,
  },
  footerItemCount: {
    fontSize: 6.5,
  },
  footerEoE: {
    fontSize: 6.5,
  },
  pageEndMarker: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#64748B",
    marginTop: 2,
  },

  // ─── Terms & Conditions (Page 2) ───
  termsHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  termsCompanyEn: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 3,
  },
  termsTitleEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  termsEnList: {
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  termsItem: {
    fontSize: 7.5,
    lineHeight: 1.4,
    marginBottom: 4,
    color: "#1E293B",
  },
  termsHeaderArWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  termsCompanyAr: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 3,
  },
  termsTitleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  termsArList: {
    paddingHorizontal: 10,
  },
  termsItemAr: {
    fontSize: 7.5,
    lineHeight: 1.5,
    marginBottom: 4,
    color: "#1E293B",
    textAlign: "right",
  },
});
