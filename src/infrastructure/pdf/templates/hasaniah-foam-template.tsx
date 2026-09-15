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

export interface HasaniahFoamTemplateProps {
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

function formatNumber(val: string | number | undefined, decimals = 2): string {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function tafqeetHasaniah(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  function convertGroup(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const o = rem % 10;

    const parts: string[] = [];
    if (h > 0 && hundreds[h]) parts.push(hundreds[h] as string);
    if (rem >= 10 && rem <= 19 && teens[rem - 10]) {
      parts.push(teens[rem - 10] as string);
    } else {
      if (o > 0 && ones[o]) parts.push(ones[o] as string);
      if (t > 0 && tens[t]) parts.push(tens[t] as string);
    }
    return parts.join(" و ");
  }

  let result = "";
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    result += convertGroup(millions) + (millions === 1 ? " مليون" : millions === 2 ? " مليونان" : " ملايين");
  }
  const rem1 = integerPart % 1000000;
  if (rem1 >= 1000) {
    const thousands = Math.floor(rem1 / 1000);
    const thText = convertGroup(thousands) + (thousands === 1 ? " ألف" : thousands === 2 ? " ألفان" : " آلاف");
    result += (result ? " و " : "") + thText;
  }
  const rem2 = rem1 % 1000;
  if (rem2 > 0) {
    result += (result ? " و " : "") + convertGroup(rem2);
  }

  result += " ريال سعودي";

  if (decimalPart > 0) {
    result += ` و ${convertGroup(decimalPart)} هللة`;
  }

  return `${result} فقط لا غير`;
}

export function HasaniahFoamTemplate({
  invoice,
  company,
  customer,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
}: HasaniahFoamTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "Letter" : "A4";
  const invoiceNum = invoice.invoiceNumber || "";
  const issueDate = invoice.issueDate ? invoice.issueDate.slice(0, 10).replace(/-/g, "/") : "";

  const subtotalVal = parseFloat(String(invoice.subtotal || 0));
  const discountVal = parseFloat(String((invoice as any).discountTotal || (invoice as any).discount || 0));
  const taxVal = parseFloat(String(invoice.vatAmount || 0));
  const totalVal = parseFloat(String(invoice.total || 0));

  const items = invoice.items || [];

  // Calculate total size quantity
  const totalSizeQty = items.reduce((acc, it) => {
    const s = parseFloat(String((it as any).sizeQty || (it as any).size || 0));
    return acc + (isNaN(s) ? 0 : s);
  }, 0);
  const totalSizeDisplay = totalSizeQty > 0 ? formatNumber(totalSizeQty, 2) : "";

  const tafqeetText = tafqeetHasaniah(totalVal);

  const customerTaxId = customer.vatNumber || "";
  const customerPhone = customer.phone || "";
  const customerNo = (customer as any).customerNumber || (customer as any).code || "";
  const customerAddress = [
    customer.addressCity,
    customer.addressStreet,
  ].filter(Boolean).join(" - ");

  const companyAddressAr = [
    company.addressCity,
    company.addressDistrict,
    company.addressStreet,
  ].filter(Boolean).join(" - ");

  // NOTE: company.clientEmployee ("تابع للعميل") is admin-only and must never
  // appear on invoice/receipt PDFs — signature fallbacks use per-invoice
  // driver/cashier/salesman names only (blank when absent).

  return (
    <Document
      title={`فاتورة مبيعات ${invoiceNum}`}
      author={company.nameAr || ""}
      subject="Sales Invoice"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="portrait" style={styles.page}>
        {/* Background Watermark Image if present */}
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── 1. TOP DUAL HEADER WITH LOGO IN CENTER ─── */}
        <View style={styles.headerRow}>
          {/* Left Column (English) */}
          <View style={styles.headerLeft}>
            {company.nameEn ? (
              <Text style={styles.companyNameEn}>{company.nameEn}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerContactEn}>Telfax: {company.phone}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerVatEn}>
                Supplier VAT No.: {company.vatNumber}
              </Text>
            ) : null}
          </View>

          {/* Center Column: Logo & Badge */}
          <View style={styles.headerCenter}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : null}

            {/* "فاتورة مبيعات" Rounded Badge */}
            <View style={styles.invoiceTitleBadge}>
              <Text style={styles.invoiceTitleText}>فاتورة مبيعات</Text>
            </View>
          </View>

          {/* Right Column (Arabic) */}
          <View style={styles.headerRight}>
            {company.nameAr ? (
              <Text style={styles.companyNameAr}>{company.nameAr}</Text>
            ) : null}
            {companyAddressAr ? (
              <Text style={styles.headerSubAr}>{companyAddressAr}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.headerContactAr}>تليفاكس: {company.phone}</Text>
            ) : null}
            {company.vatNumber ? (
              <Text style={styles.headerVatAr}>
                الرقم الضريبي: {company.vatNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ─── 2. METADATA PILLS SECTION (Two Columns: Left Dates, Right Customer) ─── */}
        <View style={styles.metaSection}>
          {/* Left Metadata Column */}
          <View style={styles.metaColLeft}>
            {/* Row 1: Issue Date */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Issue Date</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{issueDate}</Text>
              </View>
              <Text style={styles.pillLblAr}>تاريخ الإصدار</Text>
            </View>

            {/* Row 2: Supply Date */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Supply Date</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{invoice.dueDate || ""}</Text>
              </View>
              <Text style={styles.pillLblAr}>تاريخ التوريد</Text>
            </View>

            {/* Row 3: Address */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Address</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>{customerAddress}</Text>
              </View>
              <Text style={styles.pillLblAr}>العنوان</Text>
            </View>

            {/* Row 4: Checking No. */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Checking No.</Text>
              <View style={styles.pillBox}>
                <Text style={styles.pillValText}>
                  {(invoice as any).checkingNo || (invoice as any).referenceNumber || ""}
                </Text>
              </View>
              <Text style={styles.pillLblAr}>رقم المرجع</Text>
            </View>
          </View>

          {/* Right Metadata Column */}
          <View style={styles.metaColRight}>
            {/* Row 1: Invoice No. */}
            <View style={styles.pillRow}>
              <Text style={styles.pillLblEn}>Invoice No.</Text>
              <View style={[styles.pillBox, { flex: 1 }]}>
                <Text style={styles.pillValTextBold}>{invoiceNum}</Text>
              </View>
              <Text style={styles.pillLblAr}>رقم الفاتورة</Text>
            </View>

            {/* Row 2: Invoice Type & Customer Name */}
            <View style={styles.dualPillRow}>
              <View style={styles.subPillLeft}>
                <View style={[styles.pillBox, { width: 44 }]}>
                  <Text style={styles.pillValText}>
                    {(invoice as any).paymentMethod === "cash"
                      ? "نقد"
                      : (invoice as any).paymentMethod === "credit"
                      ? "آجل"
                      : (invoice as any).paymentMethod === "transfer"
                      ? "تحويل"
                      : (invoice as any).paymentMethod || "نقد"}
                  </Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>نوع الفاتورة</Text>
                  <Text style={styles.subPillLblEn}>Invoice Type</Text>
                </View>
              </View>

              <View style={styles.subPillRight}>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValTextBold}>{customer.nameAr || ""}</Text>
                </View>
                <Text style={styles.pillLblAr}>اسم العميل</Text>
              </View>
            </View>

            {/* Row 3: Customer No. & Customer VAT */}
            <View style={styles.dualPillRow}>
              <View style={styles.subPillLeft}>
                <View style={[styles.pillBox, { width: 48 }]}>
                  <Text style={styles.pillValText}>{customerNo}</Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>رقم العميل</Text>
                  <Text style={styles.subPillLblEn}>Customer No.</Text>
                </View>
              </View>

              <View style={styles.subPillRight}>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValText}>{customerTaxId}</Text>
                </View>
                <View style={styles.subPillLabelBlock}>
                  <Text style={styles.subPillLblAr}>الرقم الضريبي</Text>
                  <Text style={styles.subPillSubAr}>(للعميل إن وجد)</Text>
                </View>
              </View>
            </View>

            {/* Row 4: Serial / Invoice Number & Telephone */}
            <View style={styles.dualPillRow}>
              <View style={styles.redSerialWrap}>
                <Text style={styles.redSerialText}>{invoiceNum}</Text>
              </View>

              <View style={styles.subPillRight}>
                <Text style={styles.pillLblEn}>Tel.</Text>
                <View style={[styles.pillBox, { flex: 1 }]}>
                  <Text style={styles.pillValText}>{customerPhone}</Text>
                </View>
                <Text style={styles.pillLblAr}>هاتف</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. ITEMS TABLE WITH BLUE BORDERS & PEACH ACCENT ─── */}
        <View style={styles.tableContainer}>
          {/* Table Header Row (Peach Background) */}
          <View style={styles.tableHeaderRow}>
            {/* Col 1: Total Value */}
            <View style={[styles.thCellWrap, styles.colTotal]}>
              <Text style={styles.thArText}>إجمالي القيمة</Text>
              <Text style={styles.thEnText}>Total Value</Text>
            </View>

            {/* Col 2: Unit Price */}
            <View style={[styles.thCellWrap, styles.colPrice]}>
              <Text style={styles.thArText}>سعر الوحدة</Text>
              <Text style={styles.thEnText}>Unit Price</Text>
            </View>

            {/* Col 3: Quantity */}
            <View style={[styles.thCellWrap, styles.colQty]}>
              <Text style={styles.thArText}>الكمية</Text>
              <Text style={styles.thEnText}>Quantity</Text>
            </View>

            {/* Col 4: Item Name */}
            <View style={[styles.thCellWrap, styles.colName]}>
              <Text style={styles.thArText}>اسم الصنف</Text>
              <Text style={styles.thEnText}>Item Name</Text>
            </View>

            {/* Col 5: Code No. */}
            <View style={[styles.thCellWrap, styles.colCode]}>
              <Text style={styles.thArText}>رقم الصنف</Text>
              <Text style={styles.thEnText}>Code No.</Text>
            </View>

            {/* Col 6: Size Qty / 3m */}
            <View style={[styles.thCellWrap, styles.colSize, { borderRightWidth: 0 }]}>
              <Text style={styles.thArText}>حجم الكمية /م٣</Text>
              <Text style={styles.thEnText}>Size Qty./3m</Text>
            </View>
          </View>

          {/* Table Data Rows */}
          <View style={styles.tableBody}>
            {items.map((item, idx) => {
              const qty = parseFloat(String(item.quantity || 1));
              const price = parseFloat(String(item.unitPrice || 0));
              const lineTotal = parseFloat(String(item.lineTotal || (item as any).total || qty * price));
              const code = (item as any).barcode || (item as any).itemCode || (item as any).code || "";
              const size = (item as any).sizeQty || (item as any).size || "";

              return (
                <View key={idx} style={styles.tableDataRow}>
                  {/* Col 1: Total Value (Tinted Peach column) */}
                  <View style={[styles.tdCellWrap, styles.colTotal, styles.peachColumn]}>
                    <Text style={styles.tdValBold}>{formatNumber(lineTotal, 2)}</Text>
                  </View>

                  {/* Col 2: Unit Price */}
                  <View style={[styles.tdCellWrap, styles.colPrice]}>
                    <Text style={styles.tdValText}>{formatNumber(price, 2)}</Text>
                  </View>

                  {/* Col 3: Quantity */}
                  <View style={[styles.tdCellWrap, styles.colQty]}>
                    <Text style={styles.tdValText}>{qty}</Text>
                  </View>

                  {/* Col 4: Item Name */}
                  <View style={[styles.tdCellWrap, styles.colName]}>
                    <Text style={styles.tdValTextBold}>{item.description || ""}</Text>
                  </View>

                  {/* Col 5: Code No. */}
                  <View style={[styles.tdCellWrap, styles.colCode]}>
                    <Text style={styles.tdValText}>{code}</Text>
                  </View>

                  {/* Col 6: Size Qty */}
                  <View style={[styles.tdCellWrap, styles.colSize, { borderRightWidth: 0 }]}>
                    <Text style={styles.tdValText}>{size}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── 4. SUMMARY & QR CODE BAR (Size Box Left, QR Center, Totals Right) ─── */}
        <View style={styles.summaryContainer}>
          {/* Far Left: Total Size Qty Peach Box */}
          <View style={styles.sizeTotalBox}>
            <Text style={styles.sizeTotalText}>{totalSizeDisplay}</Text>
          </View>

          {/* Center-Left: QR Code */}
          <View style={styles.qrBox}>
            {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrImg} /> : null}
          </View>

          {/* Right: 4-Row Totals Table */}
          <View style={styles.totalsTable}>
            {/* Row 1: Subtotal */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalsValCell, styles.peachBox]}>
                <Text style={styles.totalsValText}>{formatNumber(subtotalVal, 2)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  Total Befor VAT الإجمالي قبل ضريبة القيمة المضافة
                </Text>
              </View>
            </View>

            {/* Row 2: Discount */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsValCell}>
                <Text style={styles.totalsValText}>
                  {discountVal > 0 ? formatNumber(discountVal, 2) : ""}
                </Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>Discount الخصم</Text>
              </View>
            </View>

            {/* Row 3: VAT */}
            <View style={styles.totalsRow}>
              <View style={styles.totalsValCell}>
                <Text style={styles.totalsValText}>{formatNumber(taxVal, 2)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblText}>
                  VAT(15%) ضريبة القيمة المضافة (١٥ ٪)
                </Text>
              </View>
            </View>

            {/* Row 4: Total After VAT */}
            <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.totalsValCell, styles.peachBox]}>
                <Text style={styles.totalsValTextBold}>{formatNumber(totalVal, 2)}</Text>
              </View>
              <View style={styles.totalsLblCell}>
                <Text style={styles.totalsLblTextBold}>
                  Total After VAT الإجمالي بعد ضريبة القيمة المضافة
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 5. TAFQEET & RECEIPT CLAUSE ─── */}
        <View style={styles.tafqeetRow}>
          <Text style={styles.tafqeetText}>{tafqeetText}</Text>
        </View>

        <View style={styles.conditionRow}>
          <Text style={styles.conditionText}>
            إستلمت البضاعة أعلاه كاملة وسليمة
          </Text>
        </View>

        {/* ─── 6. FOUR SIGNATURE BLOCKS ─── */}
        <View style={styles.signaturesRow}>
          {/* Signature 1: Receiver */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المستلم</Text>
            <Text style={styles.sigLine}>الاسم : ........................</Text>
            <Text style={styles.sigLine}>التوقيع : ........................</Text>
          </View>

          {/* Signature 2: Driver */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>السائق</Text>
            <Text style={styles.sigLine}>
              الاسم : {(invoice as any).driverName || ""}
            </Text>
            <Text style={styles.sigLine}>التوقيع : ........................</Text>
          </View>

          {/* Signature 3: Cashier */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>أمين الصندوق</Text>
            <Text style={styles.sigNameSingle}>
              {(invoice as any).cashierName || ""}
            </Text>
          </View>

          {/* Signature 4: Sales / Prepared By */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>المبيعات</Text>
            <Text style={styles.sigSubTitle}>أعدت بواسطة</Text>
            <Text style={styles.sigNameSingle}>
              {(invoice as any).salesmanName || ""}
            </Text>
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
    paddingHorizontal: 22,
    fontSize: 8,
    color: "#154273", // Primary deep blue
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.05,
  },

  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    width: "36%",
    alignItems: "flex-start",
  },
  companyNameEn: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
  },
  headerContactEn: {
    fontSize: 7.5,
    color: "#154273",
    marginTop: 2,
  },
  headerVatEn: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginTop: 1,
  },

  headerCenter: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 55,
    height: 55,
    objectFit: "contain",
  },

  invoiceTitleBadge: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#154273",
    borderRadius: 8,
    backgroundColor: "#EBF5FF",
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  invoiceTitleText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#154273",
  },

  headerRight: {
    width: "36%",
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
    textAlign: "right",
  },
  headerSubAr: {
    fontSize: 7.5,
    color: "#154273",
    lineHeight: 1.25,
    textAlign: "right",
  },
  headerContactAr: {
    fontSize: 7.5,
    color: "#154273",
    marginTop: 2,
    textAlign: "right",
  },
  headerVatAr: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    marginTop: 1,
    textAlign: "right",
  },

  // ─── Meta Section (Pills) ───
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  metaColLeft: {
    width: "42%",
  },
  metaColRight: {
    width: "56%",
  },

  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3.5,
  },
  pillLblEn: {
    fontSize: 7.5,
    color: "#154273",
    width: 60,
    textAlign: "left",
  },
  pillBox: {
    borderWidth: 1.25,
    borderColor: "#154273",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 16,
    flex: 1,
    marginHorizontal: 3,
    backgroundColor: "#FFFFFF",
  },
  pillValText: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
  },
  pillValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  pillLblAr: {
    fontSize: 7.5,
    color: "#154273",
    width: 62,
    textAlign: "right",
  },

  dualPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3.5,
  },
  subPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    width: "42%",
  },
  subPillLabelBlock: {
    marginLeft: 3,
    alignItems: "flex-start",
  },
  subPillLblAr: {
    fontSize: 7,
    color: "#154273",
  },
  subPillLblEn: {
    fontSize: 6.5,
    color: "#154273",
  },
  subPillRight: {
    flexDirection: "row",
    alignItems: "center",
    width: "56%",
    justifyContent: "flex-end",
  },
  subPillSubAr: {
    fontSize: 6,
    color: "#154273",
  },

  redSerialWrap: {
    width: "35%",
    alignItems: "center",
    justifyContent: "center",
  },
  redSerialText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#D9381E", // Prominent Red
    letterSpacing: 0.5,
  },

  // ─── Table ───
  tableContainer: {
    borderWidth: 1.25,
    borderColor: "#154273",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    position: "relative",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FCEADE", // Soft Peach / Apricot
    borderBottomWidth: 1.25,
    borderBottomColor: "#154273",
    minHeight: 24,
  },
  thCellWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  thArText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },
  thEnText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },

  tableBody: {
    minHeight: 180,
  },
  tableDataRow: {
    flexDirection: "row",
    minHeight: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  tdCellWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  peachColumn: {
    backgroundColor: "#FFF4ED", // Subtle Peach tint
  },
  tdValText: {
    fontSize: 7.5,
    color: "#111111",
    textAlign: "center",
  },
  tdValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111111",
    textAlign: "center",
  },
  tdValBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },

  // Column Widths (Right-to-Left order in table)
  colTotal: { width: "16%" },
  colPrice: { width: "14%" },
  colQty: { width: "12%" },
  colName: { width: "26%" },
  colCode: { width: "20%" },
  colSize: { width: "12%" },

  // ─── Summary & QR Section ───
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    borderWidth: 1.25,
    borderTopWidth: 0,
    borderColor: "#154273",
  },
  sizeTotalBox: {
    width: "12%",
    backgroundColor: "#FCEADE", // Peach
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
    paddingVertical: 6,
  },
  sizeTotalText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#154273",
  },
  qrBox: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
  },
  qrImg: {
    width: 65,
    height: 65,
  },

  totalsTable: {
    width: "64%",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#154273",
    minHeight: 16,
  },
  totalsValCell: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.25,
    borderRightColor: "#154273",
    paddingVertical: 2,
  },
  peachBox: {
    backgroundColor: "#FCEADE",
  },
  totalsValText: {
    fontSize: 7.5,
    color: "#111111",
  },
  totalsValTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
  },
  totalsLblCell: {
    width: "75%",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 6,
    paddingVertical: 2,
  },
  totalsLblText: {
    fontSize: 7,
    color: "#154273",
    textAlign: "right",
  },
  totalsLblTextBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "right",
  },

  // ─── Tafqeet & Condition ───
  tafqeetRow: {
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tafqeetText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "center",
  },
  conditionRow: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
    textAlign: "left",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#A0A0A0",
  },
  sigBlock: {
    width: "24%",
    alignItems: "center",
  },
  sigTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#154273",
    marginBottom: 2,
  },
  sigSubTitle: {
    fontSize: 7,
    color: "#154273",
    marginBottom: 2,
  },
  sigLine: {
    fontSize: 7,
    color: "#333333",
    marginBottom: 2,
  },
  sigNameSingle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111111",
    marginTop: 4,
  },
});
