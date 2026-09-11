import QRCode from "qrcode";

import { createContainer } from "@/application/container";
import { toInvoiceDto } from "@/application/dto";
import { asInvoiceId } from "@/domain/branding";
import { db } from "@/infrastructure/database";

const container = createContainer(db);

async function loadFileAsDataUrl(fileId: string | null): Promise<string | null> {
  if (!fileId) return null;
  const result = await container.fileRepository.findById(fileId);
  if (!result) return null;
  const base64 = Buffer.from(result.data).toString('base64');
  return `data:${result.record.mimeType};base64,${base64}`;
}

/**
 * GET /api/documents/[id]/pdf
 * Streams a ZATCA Phase 1 tax-invoice PDF for an ISSUED invoice.
 *
 * Next 16: params are async — await via RouteContext helper.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  const expStr = url.searchParams.get("exp");

  // 1. Check authorization (either valid HMAC signed URL or active Admin session)
  let isAuthorized = false;
  if (sig && expStr) {
    const exp = parseInt(expStr, 10);
    isAuthorized = container.urlSigner.verify(id, sig, exp);
  }

  if (!isAuthorized) {
    // Check admin session cookie
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

  if (!isAuthorized) {
    return Response.json(
      { error: "غير مصرح بالوصول إلى هذا المستند" },
      { status: 403 },
    );
  }

  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id),
  );
  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }
  const templateQuery = url.searchParams.get("template");
  const isPreview = url.searchParams.get("preview") === "true";

  if (invoice.status !== "issued" && !isPreview && !isAuthorized) {
    return Response.json(
      { error: "PDF is only available for issued invoices" },
      { status: 409 },
    );
  }

  const [company, customer] = await Promise.all([
    container.companyRepository.findById(invoice.companyId),
    container.customerRepository.findById(invoice.customerId),
  ]);
  if (!company || !customer) {
    return Response.json(
      { error: "Company or customer missing for this invoice" },
      { status: 422 },
    );
  }

  const dto = toInvoiceDto(invoice);
  const qrDataUrl = dto.qrPayload
    ? await QRCode.toDataURL(dto.qrPayload, { margin: 1, width: 256 })
    : null;

  const [logoDataUrl, backgroundDataUrl, signatureDataUrl, settings] = await Promise.all([
    loadFileAsDataUrl(company.logoFileId),
    loadFileAsDataUrl(company.backgroundFileId),
    loadFileAsDataUrl(company.signatureFileId),
    container.companySettingsRepository.getByCompanyId(invoice.companyId),
  ]);

  const bytes = await container.pdfRenderer.renderInvoicePdf({
    invoice: dto,
    company,
    customer,
    templateId: templateQuery || invoice.templateId,
    settings,
    qrDataUrl,
    logoDataUrl,
    backgroundDataUrl,
    signatureDataUrl,
  });


  const isDownload = url.searchParams.get("download") === "true";
  const filename = invoice.invoiceNumber ? `invoice-${invoice.invoiceNumber}.pdf` : "tax-invoice.pdf";
  // Copy into a fresh ArrayBuffer-backed Uint8Array so BodyInit accepts it.
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);

  const dispositionType = isDownload ? "attachment" : "inline";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });


}
