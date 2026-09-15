import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { ReceiptVoucherRecord } from "@/application/ports/receipt-voucher-repository";
import type { InvoiceDto } from "@/application/dto";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { DocumentTemplateConfig } from "@/domain/contracts";
import type { TemplateDefinition } from "./registry";

export interface DesignWorkReceiptTemplateProps {
  voucher: ReceiptVoucherRecord;
  company: CompanyRecord;
  customer: CustomerRecord;
  invoice?: InvoiceDto | null;
  settings?: CompanySettingsRecord | null;
  template?: DocumentTemplateConfig | TemplateDefinition | null;
  templateId?: string | null;
  logoDataUrl?: string | null;
  backgroundDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";

  function convertGroup(n: number): string {
    let res = "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h > 0) res += HUNDREDS[h];
    if (rem > 0) {
      if (res) res += " و ";
      if (rem <= 10) res += ONES[rem];
      else if (rem < 20) res += TEENS[rem - 10];
      else {
        const u = rem % 10;
        const t = Math.floor(rem / 10);
        if (u > 0) res += ONES[u] + " و " + TENS[t];
        else res += TENS[t];
      }
    }
    return res;
  }

  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  let out = "";

  if (thousands > 0) {
    if (thousands === 1) out += "ألف";
    else if (thousands === 2) out += "ألفان";
    else if (thousands >= 3 && thousands <= 10) out += convertGroup(thousands) + " آلاف";
    else out += convertGroup(thousands) + " ألف";
  }

  if (remainder > 0) {
    if (out) out += " و ";
    out += convertGroup(remainder);
  }

  return out;
}

function tafqeetReceipt(amount: number): string {
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  let text = numberToArabicWords(riyals);
  // Arabic-only currency wording: Latin "Saudi Riyal" inside an RTL Arabic
  // sentence breaks bidi shaping and renders as truncated "Saudi Riya".
  text += " ريال سعودي فقط لا غير";
  if (halalas > 0) {
    text += ` و ${numberToArabicWords(halalas)} هللة`;
  }
  return text;
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
    return iso;
  }
}

function formatAmount(val: number): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DesignWorkReceiptTemplate({
  voucher,
  company,
  customer,
  invoice,
  settings,
  logoDataUrl,
  backgroundDataUrl,
  signatureDataUrl,
}: DesignWorkReceiptTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const voucherNum = voucher?.voucherNumber ? `#${voucher.voucherNumber.replace(/^#/, "")}` : "";
  const dateStr = formatDate(voucher?.voucherDate);
  const amountNumber = Number(voucher?.amount || 0) / 100;
  const amountStr = formatAmount(amountNumber);
  const amountSpelled = amountNumber > 0 ? tafqeetReceipt(amountNumber) : "";

  const companyNameAr = company?.nameAr || "";
  const companyCity = company?.addressCity ? company.addressCity.toUpperCase() : "";
  const companyDistrict = company?.addressDistrict ? company.addressDistrict.toUpperCase() : "";
  const customerName = customer?.nameAr || customer?.nameEn || "";

  const pm = String(voucher?.paymentMethod || "");
  const isCash = pm === "cash";
  const isCheck = pm === "check" || pm === "cheque";
  const isTransfer = pm === "bank_transfer" || pm === "transfer";

  const forPurpose =
    voucher?.notes ||
    (invoice?.invoiceNumber ? `دفعة من الحساب قبض رقم ${invoice.invoiceNumber}` : "");

  const bankOrCustodian = voucher?.reference
    ? `No ${voucher.reference} على خزينة / بنك`
    : "";

  return (
    <Document
      title={`Received Voucher ${voucherNum}`}
      author={companyNameAr}
      subject="RECEIVED VOUCHER"
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="landscape" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── OUTER DOUBLE FRAME ─── */}
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            {/* ─── 1. TOP HEADER ROW ─── */}
            <View style={styles.topHeaderRow}>
              {/* Left: Logo (Uploaded Logo or empty) */}
              <View style={styles.logoWrap}>
                {logoDataUrl ? (
                  <Image src={logoDataUrl} style={styles.logoImage} />
                ) : null}
              </View>

              {/* Center: Voucher Number in Bordered Box */}
              <View style={styles.voucherNumBox}>
                <Text style={styles.voucherNumText}>{voucherNum}</Text>
              </View>

              {/* Right: Company Arabic Title & Location */}
              <View style={styles.companyHeaderWrap}>
                {companyNameAr ? (
                  <Text style={styles.companyNameAr}>{companyNameAr}</Text>
                ) : null}
                {companyCity ? (
                  <Text style={styles.companyLocationText}>{companyCity}</Text>
                ) : null}
                {companyDistrict && companyCity ? (
                  <Text style={styles.companyLocationText}>
                    {`${companyDistrict} ${companyCity}`}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Double Horizontal Rule Separator */}
            <View style={styles.doubleRuleWrap}>
              <View style={styles.ruleLineTop} />
              <View style={styles.ruleLineBottom} />
            </View>

            {/* ─── 2. VOUCHER TITLE, DATE & AMOUNT BADGE ─── */}
            <View style={styles.titleSectionRow}>
              {/* Left: Date */}
              <View style={styles.dateWrap}>
                {dateStr ? (
                  <Text style={styles.dateLabel}>{dateStr} :التاريخ</Text>
                ) : null}
              </View>

              {/* Center: Received Voucher Heading with Underline */}
              <View style={styles.centerHeadingWrap}>
                {/* Normal Arabic wording without tatweel/letterSpacing:
                    stretched kashida + letterSpacing breaks Arabic joining
                    in react-pdf/Amiri and renders as mid-character cuts. */}
                <Text style={styles.titleAr}>سند قبض</Text>
                <View style={styles.titleEnWrap}>
                  <Text style={styles.titleEn}>Received Voucher</Text>
                  <View style={styles.titleEnDoubleUnderline}>
                    <View style={styles.underlineTop} />
                    <View style={styles.underlineBottom} />
                  </View>
                </View>
              </View>

              {/* Right: Amount in Bordered Box */}
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>﷼ {amountStr}</Text>
              </View>
            </View>

            {/* ─── 3. VOUCHER BODY ROWS ─── */}
            <View style={styles.bodyContainer}>
              {/* Row 1: Received From Mr. | Customer Name | استلمنا من */}
              <View style={styles.voucherRow}>
                <Text style={styles.rowLabelEn}>Recevied From Mr.</Text>
                <Text style={styles.rowValueCustomer}>{customerName}</Text>
                <Text style={styles.rowLabelAr}>استلمنا من</Text>
              </View>

              {/* Row 2: The Sum Of | Spelled out Arabic + Saudi Riyal | مبلغاً وقدره */}
              <View style={styles.voucherRow}>
                <Text style={styles.rowLabelEn}>The Sum Of</Text>
                <Text style={styles.rowValueSpelled}>{amountSpelled}</Text>
                <Text style={styles.rowLabelAr}>مبلغاً وقدره</Text>
              </View>

              {/* Row 3: Payment Method Checkboxes & Bank/Account Line */}
              <View style={styles.voucherRow}>
                {/* Left: Custodian / Bank Account Note */}
                <View style={styles.bankAccountCol}>
                  {bankOrCustodian ? (
                    <Text style={styles.bankAccountText}>
                      {bankOrCustodian}{dateStr ? ` بتاريخ ${dateStr}` : ""}
                    </Text>
                  ) : null}
                </View>

                {/* Right: Payment Method Checkboxes */}
                <View style={styles.paymentMethodsCol}>
                  <View style={styles.checkItem}>
                    <Text style={styles.checkLabel}>Cash</Text>
                    <View style={styles.checkboxBox}>
                      {isCash ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>نقداً</Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Text style={styles.checkLabel}>Cheque</Text>
                    <View style={styles.checkboxBox}>
                      {isCheck ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>شيك</Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Text style={styles.checkLabel}>Transfer</Text>
                    <View style={styles.checkboxBox}>
                      {isTransfer ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>تحويل</Text>
                  </View>

                  <Text style={styles.checkLabel}>رقم</Text>
                </View>
              </View>

              {/* Row 4: For | Purpose | وذلك مقابل */}
              <View style={styles.voucherRow}>
                <Text style={styles.rowLabelEn}>For</Text>
                <Text style={styles.rowValuePurpose}>{forPurpose}</Text>
                <Text style={styles.rowLabelAr}>وذلك مقابل</Text>
              </View>
            </View>

            {/* ─── 4. SIGNATURES SECTION ─── */}
            <View style={styles.signaturesContainer}>
              {/* Manager Signature (Left) */}
              <View style={styles.sigCol}>
                <Text style={styles.sigTitleAr}>توقيع المدير</Text>
                <Text style={styles.sigTitleEn}>Manager Sig.</Text>
                <View style={styles.sigLine} />
              </View>

              {/* Cashier Signature (Center) */}
              <View style={styles.sigCol}>
                <Text style={styles.sigTitleAr}>أمين الصندوق</Text>
                <Text style={styles.sigTitleEn}>Cashier Sig.</Text>
                <View style={styles.sigLine} />
              </View>

              {/* Receiver Signature (Right) */}
              <View style={styles.sigCol}>
                <Text style={styles.sigTitleAr}>توقيع المستلم</Text>
                <Text style={styles.sigTitleEn}>Received Sig.</Text>
                <View style={styles.sigLine}>
                  {signatureDataUrl ? (
                    <Image src={signatureDataUrl} style={styles.signatureImage} />
                  ) : null}
                </View>
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
    padding: 16,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 9,
  },
  backgroundImage: {
    position: "absolute",
    top: "25%",
    left: "25%",
    width: "50%",
    opacity: 0.04,
  },

  // ─── Double Frame ───
  outerFrame: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#000000",
    padding: 4,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: "#000000",
    paddingTop: 14,
    paddingBottom: 20,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },

  // ─── Top Header ───
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoWrap: {
    width: 140,
    alignItems: "flex-start",
  },
  logoImage: {
    width: 110,
    height: 55,
    objectFit: "contain",
  },

  voucherNumBox: {
    borderWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherNumText: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: "#B91C1C",
    letterSpacing: 0.5,
  },

  companyHeaderWrap: {
    width: 220,
    alignItems: "flex-end",
  },
  companyNameAr: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
    marginBottom: 2,
  },
  companyLocationText: {
    fontSize: 8.5,
    color: "#000000",
    textAlign: "right",
    lineHeight: 1.2,
  },

  // ─── Double Rule Separator ───
  doubleRuleWrap: {
    width: "100%",
    marginBottom: 14,
  },
  ruleLineTop: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginBottom: 2,
  },
  ruleLineBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },

  // ─── Title Section (Date | Received Voucher | Amount) ───
  titleSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  dateWrap: {
    width: 140,
    alignItems: "flex-start",
    paddingTop: 8,
  },
  dateLabel: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
  },

  centerHeadingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  titleAr: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    // No letterSpacing on Arabic: any value > 0 disconnects joined letters.
    marginBottom: 2,
  },
  titleEnWrap: {
    alignItems: "center",
  },
  titleEn: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  titleEnDoubleUnderline: {
    width: "100%",
    marginTop: 2,
  },
  underlineTop: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    marginBottom: 1.5,
  },
  underlineBottom: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
  },

  amountBox: {
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 16,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  amountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
  },

  // ─── Body Rows ───
  bodyContainer: {
    width: "100%",
    marginBottom: 24,
  },
  voucherRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    minHeight: 26,
  },
  rowLabelEn: {
    width: 130,
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "left",
  },
  rowLabelAr: {
    width: 90,
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "right",
  },

  rowValueCustomer: {
    flex: 1,
    fontSize: 9.5,
    color: "#000000",
    textAlign: "center",
  },
  rowValueSpelled: {
    flex: 1,
    fontSize: 9,
    color: "#000000",
    textAlign: "center",
  },
  rowValuePurpose: {
    flex: 1,
    fontSize: 9,
    color: "#000000",
    textAlign: "center",
  },

  // Payment Row specific
  bankAccountCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  bankAccountText: {
    fontSize: 8.5,
    color: "#000000",
  },

  paymentMethodsCol: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkLabel: {
    fontSize: 9,
    color: "#000000",
  },
  checkboxBox: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCheck: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    marginTop: -2,
  },

  // ─── Signatures ───
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  sigCol: {
    width: 120,
    alignItems: "center",
  },
  sigTitleAr: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginBottom: 2,
  },
  sigTitleEn: {
    fontSize: 8.5,
    color: "#000000",
    textAlign: "center",
    marginBottom: 24,
  },
  sigLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    position: "relative",
  },
  signatureImage: {
    position: "absolute",
    bottom: 2,
    width: 70,
    height: 35,
    objectFit: "contain",
  },
});
