import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId, asCompanyId, asCustomerId } from "@/domain/branding";
import { toInvoiceDto, type InvoiceDto } from "@/application/dto";
import { calculateTotalsExact } from "@/domain/services/totals-calculator";
import {
  fromDecimalString,
  halalas,
  priceStringToHalalas,
  toDecimalString,
} from "@/domain/value-objects/money";
import QRCode from "qrcode";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import type { ReceiptVoucherRecord } from "@/application/ports/receipt-voucher-repository";

const container = createContainer(db);

async function safeLoadFileAsDataUrl(fileId: string | null): Promise<string | null> {
  if (!fileId) return null;
  try {
    const result = await container.fileRepository.findById(fileId);
    if (!result) return null;
    const base64 = Buffer.from(result.data).toString("base64");
    return `data:${result.record.mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

// Shared sample QR payload (kept identical for sample + draft previews so the
// QR block always renders; real saved invoices carry their own qrPayload).
const SAMPLE_QR_PAYLOAD =
  "AQZIdWxvb2wCCzMxMTExMTExMTExMAMTMjAyNi0wOC0yM1QwNDowMDowMFoEBTAwMC4wBQE3NTAuMDA=";

function buildSampleCompany(): CompanyRecord {
  return {
    id: asCompanyId("00000000-0000-0000-0000-000000000001"),
    nameAr: "شركة التقنية المتقدمة",
    nameEn: "Hulool Advanced Tech Co.",
    vatNumber: "31111111111123",
    crNumber: "1010998877",
    prefix: "HL",
    clientEmployee: null,
    organizationType: null,
    phone: "0501234567",
    email: "billing@hulool.sa",
    website: "https://hulool.sa",
    logoUrl: null,
    logoFileId: null,
    backgroundFileId: null,
    signatureFileId: null,
    footerText: "شركة سعودية مسجلة — الرقم الضريبي: 31111111111123",
    templateConfig: null,
    addressBuildingNumber: "7421",
    addressStreet: "طريق الملك فهد",
    addressDistrict: "العليا",
    addressCity: "الرياض",
    addressPostalCode: "12214",
    addressAdditionalNumber: "1234",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildSampleCustomer(): CustomerRecord {
  return {
    id: asCustomerId("00000000-0000-0000-0000-000000000002"),
    nameAr: "مؤسسة الأفق للتجارة والتوريدات",
    nameEn: "Al-Ofuq Trading Est.",
    vatNumber: "300987654321003",
    unifiedNumber: "7001234567",
    addressBuildingNumber: "3456",
    addressStreet: "شارع التحلية",
    addressDistrict: "السليمانية",
    addressCity: "الرياض",
    addressPostalCode: "12241",
    addressAdditionalNumber: "7890",
    phone: "0559876543",
    email: "info@alofuq.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildSampleInvoiceDto(
  company: CompanyRecord,
  customer: CustomerRecord,
  templateId: string,
): InvoiceDto {
  return {
    id: "preview-sample",
    companyId: company.id as string,
    customerId: customer.id as string,
    invoiceNumber: `${company.prefix || "INV"}-00001`,
    invoiceType: "simplified",
    status: "issued",
    issueDate: new Date().toISOString().slice(0, 10),
    // Sample preview only: current local time, display-only (QR is a fixed sample).
    issueTime: (() => {
      const n = new Date();
      return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    })(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: "SAR",
    subtotal: "5000.00",
    vatAmount: "750.00",
    total: "5750.00",
    notes: "شكراً لتعاملكم معنا. الدفع خلال 30 يوماً من تاريخ الفاتورة.",
    terms: "البضاعة المباعة لا ترد ولا تستبدل إلا وفق الشروط المعتمدة.",
    templateId,
    qrPayload: SAMPLE_QR_PAYLOAD,
    issuedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        position: 1,
        description: "خدمات تصميم وتطوير المنظومة السحابية",
        quantity: 1,
        unitPrice: "3500.00",
        discountAmount: "0.00",
        vatRate: 0.15,
        lineSubtotal: "3500.00",
        lineVat: "525.00",
        lineTotal: "4025.00",
      },
      {
        position: 2,
        description: "استشارات دعم فني وصيانة دورية سنوية",
        quantity: 1,
        unitPrice: "1500.00",
        discountAmount: "0.00",
        vatRate: 0.15,
        lineSubtotal: "1500.00",
        lineVat: "225.00",
        lineTotal: "1725.00",
      },
    ],
  };
}

// ─── Draft sanitizers (defensive: NaN/negative garbage → safe defaults) ───

function toSafeVatRate(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  // Invalid/negative → company default 15%.
  if (!Number.isFinite(n) || n < 0) return 0.15;
  // Tolerate percent input (e.g. 15 → 0.15); clamp anything absurd to default.
  if (n > 1 && n <= 100) return n / 100;
  if (n > 1) return 0.15;
  return n;
}

/**
 * Keep a raw decimal string for EXACT math (never parseFloat a price that
 * will be multiplied: 17.95319 → parseFloat → toFixed(2) → 17.95 loses
 * qty×fraction before the multiply — the 5368-vs-5367.05 bug). Accepts
 * legacy numbers via String(v); garbage → fallback.
 */
function toSafeDecimalString(v: unknown, fallback: string): string {
  const s =
    typeof v === "number"
      ? String(v)
      : typeof v === "string"
        ? v.trim()
        : "";
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return fallback;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  return s;
}

interface DraftItemInput {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  discountAmount?: unknown;
  vatRate?: unknown;
}

interface DraftInput {
  items?: unknown;
  notes?: unknown;
  terms?: unknown;
  issueDate?: unknown;
  issueTime?: unknown;
  dueDate?: unknown;
  invoiceType?: unknown;
  invoiceNumber?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Build a preview InvoiceDto from live wizard draft state.
 * Returns null when there are no usable items → caller falls back to the
 * hardcoded sample invoice (keeps the picker useful on an empty new form).
 */
function buildDraftInvoiceDto(
  draft: DraftInput,
  company: CompanyRecord,
  customer: CustomerRecord,
  templateId: string,
): InvoiceDto | null {
  if (!draft || !Array.isArray(draft.items)) return null;

  const usable = (draft.items as DraftItemInput[]).filter((raw) => {
    const desc = typeof raw?.description === "string" ? raw.description.trim() : "";
    return desc.length > 0;
  });
  if (usable.length === 0) return null;

  const sanitized = usable.map((raw) => ({
    description:
      (typeof raw.description === "string" ? raw.description.trim() : "") ||
      "بند غير مسمى",
    // Raw strings feed calculateTotalsExact (multiply full precision, round
    // ONCE) — identical to wizard display + save math.
    quantityStr: toSafeDecimalString(raw.quantity, "1"),
    unitPriceStr: toSafeDecimalString(raw.unitPrice, "0"),
    discountStr: toSafeDecimalString(raw.discountAmount, "0"),
    vatRate: toSafeVatRate(raw.vatRate),
  }));

  // Integer-halalas math via the shared exact domain calculator (same
  // semantics as the create/update use cases: exact gross - discount clamped
  // at 0, VAT per line). Discounts are halala-denominated (2 decimals), so
  // they go through the same fromDecimalString(toFixed(2)) normalization the
  // wizard display uses.
  let totals;
  try {
    totals = calculateTotalsExact(
      sanitized.map((l) => ({
        unitPrice: l.unitPriceStr,
        quantity: l.quantityStr,
        discountAmount: fromDecimalString(
          (parseFloat(l.discountStr) || 0).toFixed(2),
        ),
        vatRate: l.vatRate,
      })),
    );
  } catch {
    return null;
  }

  const items = sanitized.map((l, i) => {
    const line = totals.lines[i];
    // calculateTotalsExact guarantees one output line per input line.
    const safeLine = line ?? { lineSubtotal: halalas(0), lineVat: halalas(0), lineTotal: halalas(0) };
    // Persisted unit_price is numeric(15,2): show the same half-up-rounded
    // value the DB stores, while line totals stay exact (rounded once after
    // multiply). parseFloat here is display-only rounding, not math input.
    let storedUnitPrice: string;
    let storedDiscount: string;
    try {
      storedUnitPrice = toDecimalString(priceStringToHalalas(l.unitPriceStr));
    } catch {
      storedUnitPrice = "0.00";
    }
    try {
      storedDiscount = toDecimalString(
        fromDecimalString((parseFloat(l.discountStr) || 0).toFixed(2)),
      );
    } catch {
      storedDiscount = "0.00";
    }
    return {
      position: i + 1,
      description: l.description,
      quantity: parseFloat(l.quantityStr) || 1,
      unitPrice: storedUnitPrice,
      discountAmount: storedDiscount,
      vatRate: l.vatRate,
      lineSubtotal: toDecimalString(safeLine.lineSubtotal),
      lineVat: toDecimalString(safeLine.lineVat),
      lineTotal: toDecimalString(safeLine.lineTotal),
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const issueDate =
    typeof draft.issueDate === "string" && DATE_RE.test(draft.issueDate)
      ? draft.issueDate
      : today;
  const dueDate =
    typeof draft.dueDate === "string" && DATE_RE.test(draft.dueDate)
      ? draft.dueDate
      : null;
  // Draft preview only feeds display (QR is the fixed sample): accept a valid
  // HH:MM, else midnight — never garbage.
  const issueTime =
    typeof draft.issueTime === "string" && TIME_RE.test(draft.issueTime)
      ? draft.issueTime
      : "00:00";
  const notes =
    typeof draft.notes === "string" && draft.notes.trim().length > 0 ? draft.notes : null;
  const terms =
    typeof draft.terms === "string" && draft.terms.trim().length > 0 ? draft.terms : null;
  const invoiceType = draft.invoiceType === "standard" ? "standard" : "simplified";
  const invoiceNumber =
    typeof draft.invoiceNumber === "string" && draft.invoiceNumber.trim().length > 0
      ? draft.invoiceNumber.trim()
      : `${company.prefix || "INV"}-00001`;

  return {
    id: "preview-draft",
    companyId: company.id as string,
    customerId: customer.id as string,
    invoiceNumber,
    invoiceType,
    status: "issued",
    issueDate,
    issueTime,
    dueDate,
    currency: "SAR",
    subtotal: toDecimalString(totals.subtotal),
    vatAmount: toDecimalString(totals.vatTotal),
    total: toDecimalString(totals.total),
    notes,
    terms,
    templateId,
    qrPayload: SAMPLE_QR_PAYLOAD,
    issuedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
  };
}

async function resolveSettings(company: CompanyRecord, templateId: string): Promise<CompanySettingsRecord> {
  try {
    if (company.id && company.id !== "00000000-0000-0000-0000-000000000001") {
      const s = await container.companySettingsRepository.getByCompanyId(company.id as any);
      if (s) return s;
    }
  } catch {
    // fall through to defaults
  }
  return {
    companyId: company.id as string,
    numberFormat: "en",
    dateFormat: "YYYY-MM-DD",
    currencyCode: "SAR",
    currencyPosition: "after",
    thousandsSeparator: ",",
    decimalSeparator: ".",
    decimalPlaces: 2,
    defaultVatRate: 0.15,
    paperSize: "A4",
    paperOrientation: "portrait",
    defaultTemplateId: templateId || "simple_red",
    defaultReceiptTemplateId: "receipt_standard",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function renderPreviewPdfResponse(
  invoiceDto: InvoiceDto,
  company: CompanyRecord,
  customer: CustomerRecord,
  templateId: string,
  isReceipt: boolean,
): Promise<Response> {
  const settings = await resolveSettings(company, templateId);

  const [logoDataUrl, backgroundDataUrl, signatureDataUrl] = await Promise.all([
    safeLoadFileAsDataUrl(company.logoFileId),
    safeLoadFileAsDataUrl(company.backgroundFileId),
    safeLoadFileAsDataUrl(company.signatureFileId),
  ]);

  // Read-time safety net (same as GET /api/documents/[id]/pdf): historical
  // payloads with millis Tag 3 normalize here so previews stay valid.
  // Falls back to the raw payload if corrupt so the PDF never 500s.
  let qrPayloadForRender = invoiceDto.qrPayload;
  if (qrPayloadForRender) {
    try {
      const { normalizeStoredQrPayload } = await import(
        "@/domain/services/zatca-qr-service"
      );
      qrPayloadForRender = normalizeStoredQrPayload(qrPayloadForRender);
    } catch {
      qrPayloadForRender = invoiceDto.qrPayload;
    }
  }
  const qrDataUrl = qrPayloadForRender
    ? await QRCode.toDataURL(qrPayloadForRender, { margin: 1, width: 256 })
    : null;

  let bytes: Uint8Array;
  if (isReceipt) {
    // Receipt mode is a sample voucher by design — never driven by live data.
    const sampleVoucher: ReceiptVoucherRecord = {
      id: "preview-receipt",
      companyId: company.id as string,
      customerId: customer.id as string,
      invoiceId: null,
      voucherNumber: `${company.prefix || "INV"}-REC-00001`,
      voucherDate: new Date().toISOString().slice(0, 10),
      amount: 575000 as any,
      paymentMethod: "bank_transfer",
      reference: "TRX-987654321",
      notes: "سند قبض مالي معتمد لقاء الفاتورة الضريبية.",
      qrPayload: invoiceDto.qrPayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    bytes = await container.pdfRenderer.renderReceiptVoucherPdf({
      voucher: sampleVoucher,
      company,
      customer,
      invoice: invoiceDto,
      settings,
      templateId,
      logoDataUrl,
      backgroundDataUrl,
      signatureDataUrl,
    });
  } else {
    bytes = await container.pdfRenderer.renderInvoicePdf({
      invoice: invoiceDto,
      company,
      customer,
      templateId,
      settings,
      qrDataUrl,
      logoDataUrl,
      backgroundDataUrl,
      signatureDataUrl,
    });
  }

  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="template-preview-${templateId}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId") || "simple_red";
    const invoiceId = url.searchParams.get("invoiceId");
    const companyId = url.searchParams.get("companyId");
    const customerIdParam = url.searchParams.get("customerId");

    let invoiceDto: InvoiceDto | null = null;
    let company: CompanyRecord | null = null;
    let customer: CustomerRecord | null = null;

    if (invoiceId) {
      try {
        const existingInvoice = await container.invoiceRepository.findByIdWithItems(
          asInvoiceId(invoiceId)
        );
        if (existingInvoice) {
          invoiceDto = toInvoiceDto(existingInvoice);
          company = await container.companyRepository.findById(existingInvoice.companyId);
          customer = await container.customerRepository.findById(existingInvoice.customerId);
        }
      } catch (e) {
        console.error("Failed to load invoice for preview:", e);
      }
    }

    if (!company && companyId) {
      try {
        company = await container.companyRepository.findById(asCompanyId(companyId));
      } catch (e) {
        console.error("Failed to load company for preview:", e);
      }
    }

    // Fallback sample company
    company = company ?? buildSampleCompany();

    // Customer resolution: saved invoice's customer → customerId param lookup
    // (unsaved wizard selection) → hardcoded sample. Mirrors the company block:
    // lookup failures keep the sample rather than failing the preview.
    if (!customer && customerIdParam) {
      try {
        customer = await container.customerRepository.findById(
          asCustomerId(customerIdParam)
        );
      } catch (e) {
        console.error("Failed to load customer for preview:", e);
      }
    }

    // Fallback sample customer
    customer = customer ?? buildSampleCustomer();

    // If no existing invoice, create a clean realistic sample invoice
    invoiceDto = invoiceDto ?? buildSampleInvoiceDto(company, customer, templateId);

    const isReceipt = url.searchParams.get("type") === "receipt";

    return renderPreviewPdfResponse(invoiceDto, company, customer, templateId, isReceipt);
  } catch (err) {
    console.error("[preview/pdf] Error rendering PDF:", err);
    return new Response(
      JSON.stringify({ error: "Failed to render PDF preview", details: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const isReceipt = url.searchParams.get("type") === "receipt";

    let body: {
      templateId?: unknown;
      companyId?: unknown;
      customerId?: unknown;
      draft?: DraftInput;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const templateId =
      (typeof body.templateId === "string" && body.templateId) ||
      url.searchParams.get("templateId") ||
      "simple_red";
    const companyIdParam =
      (typeof body.companyId === "string" && body.companyId) ||
      url.searchParams.get("companyId");
    const customerIdParam =
      (typeof body.customerId === "string" && body.customerId) ||
      url.searchParams.get("customerId");

    let company: CompanyRecord | null = null;
    let customer: CustomerRecord | null = null;

    if (companyIdParam) {
      try {
        company = await container.companyRepository.findById(asCompanyId(companyIdParam));
      } catch (e) {
        console.error("Failed to load company for preview:", e);
      }
    }
    company = company ?? buildSampleCompany();

    if (customerIdParam) {
      try {
        customer = await container.customerRepository.findById(
          asCustomerId(customerIdParam)
        );
      } catch (e) {
        console.error("Failed to load customer for preview:", e);
      }
    }
    customer = customer ?? buildSampleCustomer();

    // Receipt mode stays sample-by-design; draft payload is invoice-only.
    let invoiceDto: InvoiceDto | null = null;
    if (!isReceipt && body.draft) {
      try {
        invoiceDto = buildDraftInvoiceDto(body.draft, company, customer, templateId);
      } catch (e) {
        console.error("Failed to build draft preview:", e);
        invoiceDto = null;
      }
    }
    invoiceDto = invoiceDto ?? buildSampleInvoiceDto(company, customer, templateId);

    return renderPreviewPdfResponse(invoiceDto, company, customer, templateId, isReceipt);
  } catch (err) {
    console.error("[preview/pdf] Error rendering PDF:", err);
    return new Response(
      JSON.stringify({ error: "Failed to render PDF preview", details: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
