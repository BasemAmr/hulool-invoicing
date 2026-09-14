import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId, asCompanyId, asCustomerId } from "@/domain/branding";
import { toInvoiceDto, type InvoiceDto } from "@/application/dto";
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId") || "simple_red";
    const invoiceId = url.searchParams.get("invoiceId");
    const companyId = url.searchParams.get("companyId");

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
    const validCompany: CompanyRecord = company ?? {
      id: asCompanyId("00000000-0000-0000-0000-000000000001"),
      nameAr: "شركة حلول التقنية المتقدمة",
      nameEn: "Hulool Advanced Tech Co.",
      vatNumber: "31111111111123",
      crNumber: "1010998877",
      prefix: "HL",
      clientEmployee: null,
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
    company = validCompany;

    // Fallback sample customer
    if (!customer) {
      customer = {
        id: asCustomerId("00000000-0000-0000-0000-000000000002"),
        nameAr: "مؤسسة الأفق للتجارة والتوريدات",
        nameEn: "Al-Ofuq Trading Est.",
        vatNumber: "300987654321003",
        unifiedNumber: "7001234567",
        addressStreet: "شارع التحلية، السليمانية",
        addressCity: "الرياض",
        addressPostalCode: "12241",
        phone: "0559876543",
        email: "info@alofuq.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // If no existing invoice, create a clean realistic sample invoice
    const validInvoiceDto: InvoiceDto = invoiceDto ?? {
      id: "preview-sample",
      companyId: validCompany.id as string,
      customerId: customer.id as string,
      invoiceNumber: `${validCompany.prefix || "INV"}-00001`,
      invoiceType: "simplified",
      status: "issued",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      currency: "SAR",
      subtotal: "5000.00",
      vatAmount: "750.00",
      total: "5750.00",
      notes: "شكراً لتعاملكم معنا. الدفع خلال 30 يوماً من تاريخ الفاتورة.",
      terms: "البضاعة المباعة لا ترد ولا تستبدل إلا وفق الشروط المعتمدة.",
      templateId,
      qrPayload: "AQZIdWxvb2wCCzMxMTExMTExMTExMAMTMjAyNi0wOC0yM1QwNDowMDowMFoEBTAwMC4wBQE3NTAuMDA=",
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
    invoiceDto = validInvoiceDto;

    let settings: CompanySettingsRecord | null = null;
    try {
      if (validCompany.id && validCompany.id !== "00000000-0000-0000-0000-000000000001") {
        settings = await container.companySettingsRepository.getByCompanyId(validCompany.id as any);
      }
    } catch {
      settings = null;
    }

    if (!settings) {
      settings = {
        companyId: validCompany.id as string,
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

    const [logoDataUrl, backgroundDataUrl, signatureDataUrl] = await Promise.all([
      safeLoadFileAsDataUrl(validCompany.logoFileId),
      safeLoadFileAsDataUrl(validCompany.backgroundFileId),
      safeLoadFileAsDataUrl(validCompany.signatureFileId),
    ]);

    const qrDataUrl = validInvoiceDto.qrPayload
      ? await QRCode.toDataURL(validInvoiceDto.qrPayload, { margin: 1, width: 256 })
      : null;

    const isReceipt = url.searchParams.get("type") === "receipt";

    let bytes: Uint8Array;
    if (isReceipt) {
      const sampleVoucher: ReceiptVoucherRecord = {
        id: "preview-receipt",
        companyId: validCompany.id as string,
        customerId: customer.id as string,
        invoiceId: null,
        voucherNumber: `${validCompany.prefix || "INV"}-REC-00001`,
        voucherDate: new Date().toISOString().slice(0, 10),
        amount: 575000 as any,
        paymentMethod: "bank_transfer",
        reference: "TRX-987654321",
        notes: "سند قبض مالي معتمد لقاء الفاتورة الضريبية.",
        qrPayload: validInvoiceDto.qrPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      bytes = await container.pdfRenderer.renderReceiptVoucherPdf({
        voucher: sampleVoucher,
        company: validCompany,
        customer,
        invoice: validInvoiceDto,
        settings,
        templateId,
        logoDataUrl,
        backgroundDataUrl,
        signatureDataUrl,
      });
    } else {
      bytes = await container.pdfRenderer.renderInvoicePdf({
        invoice: validInvoiceDto,
        company: validCompany,
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
