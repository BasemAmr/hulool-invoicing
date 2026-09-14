import path from "node:path";

import React from "react";
import {
  Font,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";

import type {
  InvoicePdfInput,
  ReceiptVoucherPdfInput,
  PdfRenderer,
} from "@/application/ports/pdf-renderer";
import { InvoiceDocument } from "./invoice-document";
import { ReceiptVoucherDocument } from "./receipt-voucher-document";
import { resolveTemplateConfig } from "./template";

let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const amiriFonts = [
    { src: path.join(fontsDir, "Amiri-Regular.ttf"), fontWeight: "normal" as const },
    { src: path.join(fontsDir, "Amiri-Bold.ttf"), fontWeight: "bold" as const },
  ];
  Font.register({
    family: "Amiri",
    fonts: amiriFonts,
  });
  Font.register({
    family: "Tajawal",
    fonts: amiriFonts,
  });
  // Disable hyphenation — Arabic + short English labels don't need it,
  // and the default English hyphenator mis-breaks Arabic words.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/**
 * @react-pdf/renderer implementation of PdfRenderer.
 * Strategy: parametric InvoiceDocument & ReceiptVoucherDocument + per-company DocumentTemplateConfig.
 */
export class ReactPdfRenderer implements PdfRenderer {
  async renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
    ensureFontsRegistered();

    const element = React.createElement(InvoiceDocument, {
      invoice: input.invoice,
      company: input.company,
      customer: input.customer,
      templateId: input.templateId ?? input.invoice.templateId,
      settings: input.settings,
      qrDataUrl: input.qrDataUrl,
      logoDataUrl: input.logoDataUrl ?? null,
      backgroundDataUrl: input.backgroundDataUrl ?? input.stampDataUrl ?? null,
      signatureDataUrl: input.signatureDataUrl ?? null,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  async renderReceiptVoucherPdf(input: ReceiptVoucherPdfInput): Promise<Uint8Array> {
    ensureFontsRegistered();
    const template = resolveTemplateConfig(input.company.templateConfig);

    const element = React.createElement(ReceiptVoucherDocument, {
      voucher: input.voucher,
      company: input.company,
      customer: input.customer,
      invoice: input.invoice,
      settings: input.settings,
      template,
      templateId: input.templateId,
      logoDataUrl: input.logoDataUrl ?? null,
      backgroundDataUrl: input.backgroundDataUrl ?? input.stampDataUrl ?? null,
      signatureDataUrl: input.signatureDataUrl ?? null,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

}
