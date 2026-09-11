import type { InvoiceDto } from "../dto";
import type { CompanyRecord } from "./company-repository";
import type { CustomerRecord } from "./customer-repository";
import type { CompanySettingsRecord } from "./company-settings-repository";
import type { ReceiptVoucherRecord } from "./receipt-voucher-repository";

/** Input for rendering an issued invoice PDF. */
export interface InvoicePdfInput {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  templateId?: string | null;
  settings?: CompanySettingsRecord | null;
  /** Pre-generated QR image as a data URI (PNG). */
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl?: string | null;
  stampDataUrl?: string | null;
  signatureDataUrl: string | null;
}

/** Input for rendering a receipt voucher PDF. */
export interface ReceiptVoucherPdfInput {
  voucher: ReceiptVoucherRecord;
  company: CompanyRecord;
  customer: CustomerRecord;
  invoice?: InvoiceDto | null;
  templateId?: string | null;
  settings?: CompanySettingsRecord | null;
  logoDataUrl: string | null;
  backgroundDataUrl?: string | null;
  stampDataUrl?: string | null;
  signatureDataUrl: string | null;
}


/**
 * Port for PDF rendering (Strategy).
 * Infrastructure implements this with @react-pdf/renderer + parametric templates.
 */
export interface PdfRenderer {
  renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array>;
  renderReceiptVoucherPdf(input: ReceiptVoucherPdfInput): Promise<Uint8Array>;
}

