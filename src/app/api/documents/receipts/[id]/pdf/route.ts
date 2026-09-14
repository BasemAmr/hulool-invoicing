import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { toInvoiceDto } from "@/application/dto";

const container = createContainer(db);

async function loadFileAsDataUrl(fileId: string | null): Promise<string | null> {
  if (!fileId) return null;
  const result = await container.fileRepository.findById(fileId);
  if (!result) return null;
  const base64 = Buffer.from(result.data).toString("base64");
  return `data:${result.record.mimeType};base64,${base64}`;
}

/**
 * GET /api/documents/receipts/[id]/pdf
 * Streams a receipt voucher PDF. Supports download=true for direct file download.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "true";
  const isPreview = url.searchParams.get("preview") === "true";
  const sig = url.searchParams.get("sig");
  const expStr = url.searchParams.get("exp");

  // Check authorization (signed URL, session cookie, or preview)
  let isAuthorized = isPreview;
  if (!isAuthorized && sig && expStr) {
    const exp = parseInt(expStr, 10);
    isAuthorized = container.urlSigner.verify(id, sig, exp);
  }

  if (!isAuthorized) {
    const cookieHeader = request.headers.get("cookie") || "";
    const sessionMatch = cookieHeader.match(/app_session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (sessionId) {
      const sessionResult = await container.sessionRepository.validateSession(sessionId);
      if (sessionResult) {
        isAuthorized = true;
      }
    }
  }

  // If still not authorized, allow public access for receipt sharing with link
  const voucher = await container.receiptVoucherRepository.findById(id);
  if (!voucher) {
    return Response.json({ error: "Receipt voucher not found" }, { status: 404 });
  }

  const [company, customer, settings, invoiceRaw] = await Promise.all([
    container.companyRepository.findById(voucher.companyId as any),
    container.customerRepository.findById(voucher.customerId as any),
    container.companySettingsRepository.getByCompanyId(voucher.companyId),
    voucher.invoiceId
      ? container.invoiceRepository.findByIdWithItems(asInvoiceId(voucher.invoiceId))
      : null,
  ]);

  if (!company || !customer) {
    return Response.json(
      { error: "Company or customer missing for this receipt voucher" },
      { status: 422 },
    );
  }

  const invoice = invoiceRaw ? toInvoiceDto(invoiceRaw) : null;

  const [logoDataUrl, backgroundDataUrl, signatureDataUrl] = await Promise.all([
    loadFileAsDataUrl(company.logoFileId),
    loadFileAsDataUrl(company.backgroundFileId),
    loadFileAsDataUrl(company.signatureFileId),
  ]);

  const bytes = await container.pdfRenderer.renderReceiptVoucherPdf({
    voucher,
    company,
    customer,
    invoice,
    settings,
    templateId: settings?.defaultReceiptTemplateId,
    logoDataUrl,
    backgroundDataUrl,
    signatureDataUrl,
  });

  const invNum = invoice?.invoiceNumber ?? voucher.voucherNumber;
  const rawFilename = `سند القبض فاتورة رقم ${invNum}.pdf`;
  const encodedFilename = encodeURIComponent(rawFilename);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);

  const dispositionType = isDownload ? "attachment" : "inline";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}