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

export interface JoyVoucherTemplateProps {
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
  mode?: "payment" | "receipt";
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

function tafqeetJoy(amount: number): string {
  const riyals = Math.floor(amount);
  const halalas = Math.round((amount - riyals) * 100);

  let text = numberToArabicWords(riyals) + " ريال سعودي";
  if (halalas > 0) {
    text += " و " + numberToArabicWords(halalas) + " هللة";
  }
  return text + " فقط لا غير";
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return iso;
  }
}

export function JoyPaymentVoucherTemplate({
  voucher,
  company,
  customer,
  settings,
  logoDataUrl,
  backgroundDataUrl,
  mode = "payment",
}: JoyVoucherTemplateProps) {
  const paperSize = settings?.paperSize === "Letter" ? "LETTER" : "A4";

  const isPayment = mode === "payment";
  const voucherTitleAr = isPayment ? "سند صرف" : "سند قبض";
  const voucherTitleEn = isPayment ? "PAYMENT VOUCHER" : "RECEIPT VOUCHER";
  const partyLabelAr = isPayment ? "أصرفوا للسيد / السادة" : "استلمنا من السيد / السادة";
  const partyLabelEn = isPayment ? "Pay To Mrs" : "Received From";

  const voucherNum = voucher?.voucherNumber ? String(voucher.voucherNumber) : "";
  const dateTimeStr = formatDateTime(voucher?.voucherDate);

  const amountNumber = Number(voucher?.amount || 0) / 100;
  const riyals = Math.floor(amountNumber);
  const halalas = Math.round((amountNumber - riyals) * 100);
  const amountSpelled = amountNumber > 0 ? tafqeetJoy(amountNumber) : "";

  const companyNameAr = company?.nameAr || "";
  const companyNameEn = company?.nameEn || "";
  const companyAddress = [company?.addressStreet, company?.addressCity].filter(Boolean).join(" - ");

  const payeeName = customer?.nameAr || customer?.nameEn || "";
  const pm = String(voucher?.paymentMethod || "");
  const methodText =
    pm === "bank_transfer" || pm === "transfer"
      ? "- تحويل"
      : pm === "card"
      ? "- شبكة / مدى"
      : pm === "cash"
      ? "- نقداً"
      : pm === "check" || pm === "cheque"
      ? "- شيك"
      : "";

  const purpose = voucher?.notes || (voucher?.reference ? `دفعة حساب بموجب مرجع ${voucher.reference}` : "");

  return (
    <Document
      title={`${voucherTitleEn} ${voucherNum}`}
      author={companyNameAr}
      subject={voucherTitleEn}
      creator="Hulool Invoicing"
    >
      <Page size={paperSize as any} orientation="landscape" style={styles.page}>
        {backgroundDataUrl ? (
          <Image src={backgroundDataUrl} style={styles.backgroundImage} />
        ) : null}

        {/* ─── Top Header: Bilingual Company Name & Optional Logo ─── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderSide}>
            {companyNameEn ? <Text style={styles.companyEn}>{companyNameEn}</Text> : null}
          </View>
          {logoDataUrl ? (
            <Image src={logoDataUrl} style={styles.logoImage} />
          ) : null}
          <View style={styles.topHeaderSide}>
            {companyNameAr ? <Text style={styles.companyAr}>{companyNameAr}</Text> : null}
          </View>
        </View>

        {/* ─── Main Bordered Card ─── */}
        <View style={styles.mainBox}>
          {/* Top of Card: Title (Center) & Amount Box (Right) */}
          <View style={styles.cardTopRow}>
            {/* Empty Left Placeholder to balance right amount box */}
            <View style={{ width: 140 }} />

            {/* Center: Voucher Title & Red Number */}
            <View style={styles.titleCenter}>
              <Text style={styles.titleAr}>{voucherTitleAr}</Text>
              <Text style={styles.titleEn}>{voucherTitleEn}</Text>
              {voucherNum ? (
                <Text style={styles.voucherNumberRed}>{voucherNum}</Text>
              ) : null}
            </View>

            {/* Right: SR / Halalas Table Box */}
            <View style={styles.srHalaBox}>
              <View style={styles.srHalaHeaderRow}>
                <View style={[styles.srHalaCell, { width: "70%" }]}>
                  <Text style={styles.srHalaLabel}>SR / ريال</Text>
                </View>
                <View style={[styles.srHalaCell, { width: "30%", borderRightWidth: 0 }]}>
                  <Text style={styles.srHalaLabel}>هـ/H</Text>
                </View>
              </View>
              <View style={styles.srHalaValRow}>
                <View style={[styles.srHalaCell, { width: "70%" }]}>
                  <Text style={styles.srHalaVal}>{riyals}</Text>
                </View>
                <View style={[styles.srHalaCell, { width: "30%", borderRightWidth: 0 }]}>
                  <Text style={styles.srHalaVal}>{halalas}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Dotted Form Rows ─── */}
          <View style={styles.formContainer}>
            {/* Row 1: Date */}
            <View style={styles.dottedRow}>
              <Text style={styles.rowLabelEn}>Date</Text>
              <View style={styles.dottedMiddle}>
                <Text style={styles.dottedLeader}>..........................................................................................................................</Text>
                <Text style={styles.rowValDate}>{dateTimeStr}</Text>
              </View>
              <Text style={styles.rowLabelAr}>تاريخ السند</Text>
            </View>

            {/* Row 2: Pay To / Received From */}
            <View style={styles.dottedRow}>
              <Text style={styles.rowLabelEn}>{partyLabelEn}</Text>
              <View style={styles.dottedMiddle}>
                <Text style={styles.dottedLeader}>..........................................................................................................................</Text>
                <Text style={styles.rowValCenter}>{payeeName}</Text>
              </View>
              <Text style={styles.rowLabelAr}>{partyLabelAr}</Text>
            </View>

            {/* Row 3: Amount Spelled */}
            <View style={styles.dottedRow}>
              <Text style={styles.rowLabelEn}>Amount</Text>
              <View style={styles.dottedMiddle}>
                <Text style={styles.dottedLeader}>..........................................................................................................................</Text>
                <Text style={styles.rowValCenter}>{amountSpelled}</Text>
              </View>
              <Text style={styles.rowLabelAr}>مبلغ وقدره</Text>
            </View>

            {/* Row 4: Cash / Bank */}
            <View style={styles.dottedRow}>
              <Text style={styles.rowLabelEn}>Cash / Bank</Text>
              <View style={styles.dottedMiddle}>
                <Text style={styles.dottedLeader}>..........................................................................................................................</Text>
                <Text style={styles.rowValCenter}>{methodText}</Text>
              </View>
              <Text style={styles.rowLabelAr}>نقدا / شيك برقم</Text>
            </View>

            {/* Row 5: Being (Purpose) */}
            <View style={styles.dottedRow}>
              <Text style={styles.rowLabelEn}>Being</Text>
              <View style={styles.dottedMiddle}>
                <Text style={styles.dottedLeader}>..........................................................................................................................</Text>
                <Text style={styles.rowValCenter}>{purpose}</Text>
              </View>
              <Text style={styles.rowLabelAr}>وذلك مقابل</Text>
            </View>
          </View>

          {/* ─── Signatures Row ─── */}
          <View style={styles.signaturesRow}>
            <Text style={styles.sigText}>Receiver / المستلم</Text>
            <Text style={styles.sigText}>Accountant / المحاسب</Text>
          </View>
        </View>

        {/* ─── Bottom Dark Navy Bar ─── */}
        {companyAddress ? (
          <View style={styles.bottomBar}>
            <Text style={styles.bottomBarText}>{companyAddress}</Text>
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
    paddingHorizontal: 28,
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

  // ─── Header ───
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  topHeaderSide: {
    width: 220,
  },
  companyEn: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "left",
    lineHeight: 1.3,
  },
  companyAr: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },
  logoImage: {
    width: 80,
    height: 45,
    objectFit: "contain",
  },

  // ─── Main Bordered Box ───
  mainBox: {
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // ─── Card Top ───
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  titleCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  titleAr: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 3,
  },
  titleEn: {
    fontSize: 12.5,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  voucherNumberRed: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#DC2626",
    textAlign: "center",
    letterSpacing: 1,
  },

  // ─── SR / Halalas Box ───
  srHalaBox: {
    width: 140,
    borderWidth: 0.75,
    borderColor: "#94A3B8",
    backgroundColor: "#F8FAFC",
  },
  srHalaHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: "#94A3B8",
  },
  srHalaValRow: {
    flexDirection: "row",
  },
  srHalaCell: {
    borderRightWidth: 0.75,
    borderRightColor: "#94A3B8",
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  srHalaLabel: {
    fontSize: 7.5,
    color: "#475569",
    textAlign: "center",
  },
  srHalaVal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },

  // ─── Dotted Form ───
  formContainer: {
    marginBottom: 28,
  },
  dottedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  rowLabelEn: {
    width: 90,
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "left",
  },
  rowLabelAr: {
    width: 120,
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },
  dottedMiddle: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dottedLeader: {
    fontSize: 8.5,
    color: "#94A3B8",
    letterSpacing: 2,
    textAlign: "center",
  },
  rowValCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    color: "#0F172A",
  },
  rowValDate: {
    position: "absolute",
    right: 12,
    fontSize: 9,
    fontWeight: "bold",
    color: "#0F172A",
  },

  // ─── Signatures ───
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 60,
    paddingTop: 10,
  },
  sigText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E293B",
  },

  // ─── Bottom Dark Bar ───
  bottomBar: {
    backgroundColor: "#1E3A5F",
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBarText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
