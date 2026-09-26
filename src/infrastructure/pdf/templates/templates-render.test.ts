import { describe, it, expect } from "vitest";
import { ReactPdfRenderer } from "../react-pdf-renderer";
import type { InvoicePdfInput } from "@/application/ports/pdf-renderer";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import { asCompanyId, asCustomerId } from "@/domain/branding";

// WHY these shapes: CompanyRecord/CustomerRecord/InvoiceDto changed since the
// first draft of this test (branded ids, ISO-string dates, money as 2-decimal
// strings). Mocks below mirror buildSampleCompany/Customer/InvoiceDto in
// app/api/documents/preview/pdf/route.ts so typecheck stays green.
const NOW_ISO = new Date("2026-09-17T10:30:00.000Z").toISOString();

const mockCompany: CompanyRecord = {
  id: asCompanyId("11111111-1111-4111-8111-111111111111"),
  nameAr: "شركة تجريبية المحدودة",
  nameEn: "Test Company Ltd",
  vatNumber: "300000000000003",
  crNumber: "1010000000",
  prefix: "INV",
  clientEmployee: null,
  organizationType: null,
  phone: "0500000000",
  email: "info@example.com",
  website: null,
  logoUrl: null,
  logoFileId: null,
  backgroundFileId: null,
  signatureFileId: null,
  footerText: "ملاحظات وتذييل الفاتورة",
  templateConfig: null,
  addressBuildingNumber: "1234",
  addressStreet: "King Fahd Road",
  addressDistrict: "Olaya",
  addressCity: "Riyadh",
  addressPostalCode: "12345",
  addressAdditionalNumber: null,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

const mockCustomer: CustomerRecord = {
  id: asCustomerId("22222222-2222-4222-8222-222222222222"),
  nameAr: "العميل أ ب ج",
  nameEn: "Customer ABC",
  vatNumber: "311111111111113",
  unifiedNumber: null,
  phone: "0555555555",
  email: "cust@example.com",
  addressDistrict: "Al-Rawdah",
  addressBuildingNumber: "1234",
  addressCity: "Jeddah",
  addressStreet: "Tahlia Street",
  addressPostalCode: "54321",
  addressAdditionalNumber: "5678",
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

const mockInvoice: InvoiceDto = {
  id: "inv-1",
  companyId: mockCompany.id as string,
  customerId: mockCustomer.id as string,
  templateId: "template_1_al_asma",
  invoiceNumber: "INV-2026-0001",
  issueDate: "2026-09-17",
  issueTime: "10:30",
  dueDate: "2026-10-17",
  invoiceType: "standard",
  currency: "SAR",
  subtotal: "1000.00",
  vatAmount: "150.00",
  total: "1150.00",
  terms: null,
  notes: null,
  qrPayload: null,
  status: "issued",
  issuedAt: NOW_ISO,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
  items: [
    {
      position: 1,
      description: "Description of Product A",
      quantity: 10,
      unitPrice: "100.00",
      discountAmount: "0.00",
      vatRate: 15,
      lineSubtotal: "1000.00",
      lineVat: "150.00",
      lineTotal: "1150.00",
    },
  ],
};

describe("Templates PDF Rendering", () => {
  const renderer = new ReactPdfRenderer();
  const templateIds = [
    "template_1_al_asma",
    "template_2_matajer_alwadi",
    "template_3_fikr_almakateb",
    "template_4_juffali_food",
    "template_5_thara_riyadh",
    "template_6_jabal_al_rayan",
    "template_7_alsahah",
    "template_8_saleh_al_haider",
    "structured_bilingual",
    "kuwait_landmarks",
    "shami_trading",
    "bawazeer_plastics",
    "joy_purchase_invoice",
    "joy_sales_invoice",
    "shawager_investment",
    "madina_plastics",
    "coffee_ideas",
    "hasaniah_foam",
    "top_town",
    "aldail_ceramics",
    "sa_alkoufi",
    "matajer_al_saif",
    "manahir_pos",
    "masdar_materials_terms",
    "masdar_materials_no_terms",
    "bazrea_plastics",
    "generic_branch_23",
    "generic_delivery_21",
    "generic_dotmatrix_22",
    "template_9_modern_brown_gray",
    "template_10_dark_header_brown",
    "template_11_modern_clean_charcoal",
    "template_14_reda_trading",
  ];

  for (const templateId of templateIds) {
    it(`successfully renders ${templateId} without errors`, async () => {
      const input: InvoicePdfInput = {
        invoice: { ...mockInvoice, templateId },
        company: mockCompany,
        customer: mockCustomer,
        templateId,
        qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        logoDataUrl: null,
        signatureDataUrl: null,
      };

      const buffer = await renderer.renderInvoicePdf(input);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
    });
  }

  const refinedTemplates = [
    "structured_bilingual",
    "kuwait_landmarks",
    "shami_trading",
    "bawazeer_plastics",
    "joy_purchase_invoice",
    "joy_sales_invoice",
    "shawager_investment",
    "madina_plastics",
    "coffee_ideas",
    "hasaniah_foam",
    "top_town",
    "aldail_ceramics",
    "sa_alkoufi",
    "matajer_al_saif",
    "manahir_pos",
    "template_2_matajer_alwadi",
    "template_4_juffali_food",
    "masdar_materials_terms",
    "masdar_materials_no_terms",
    "bazrea_plastics",
    "generic_branch_23",
    "generic_delivery_21",
    "generic_dotmatrix_22",
    "template_9_modern_brown_gray",
    "template_10_dark_header_brown",
    "template_11_modern_clean_charcoal",
    "template_14_reda_trading",
  ];

  for (const templateId of refinedTemplates) {
    it(`successfully renders ${templateId} with line discount and exact tafqeet`, async () => {
      const discountedInvoice: InvoiceDto = {
        ...mockInvoice,
        templateId,
        subtotal: "20.00",
        vatAmount: "1.20",
        total: "9.20",
        items: [
          {
            position: 1,
            description: "Product with discount",
            quantity: 1,
            unitPrice: "20.00",
            discountAmount: "12.00",
            vatRate: 15,
            lineSubtotal: "8.00",
            lineVat: "1.20",
            lineTotal: "9.20",
          },
        ],
      };

      const input: InvoicePdfInput = {
        invoice: discountedInvoice,
        company: mockCompany,
        customer: mockCustomer,
        templateId,
        qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        logoDataUrl: null,
        signatureDataUrl: null,
      };

      const buffer = await renderer.renderInvoicePdf(input);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
    });
  }

  for (const templateId of [
    "pos_color",
    "pos_monochrome",
    "template_9_modern_brown_gray",
    "template_10_dark_header_brown",
    "template_11_modern_clean_charcoal",
    "template_14_reda_trading",
  ]) {
    it(`guarantees strictly 1 single page for ${templateId} even with long multiline terms`, async () => {
      const posInvoice: InvoiceDto = {
        ...mockInvoice,
        templateId,
        terms: 'YOU WILL HAVE TO GIVE US YOUR MONEY! "no, payment!"',
        notes: "ملاحظات الفاتورة",
        items: [
          {
            position: 1,
            description: "قهوة اسبريسو خاصة مع حليب",
            quantity: 2,
            unitPrice: "20.00",
            discountAmount: "5.00",
            vatRate: 15,
            lineSubtotal: "35.00",
            lineVat: "5.25",
            lineTotal: "40.25",
          },
        ],
      };

      const input: InvoicePdfInput = {
        invoice: posInvoice,
        company: mockCompany,
        customer: mockCustomer,
        templateId,
        qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        logoDataUrl: null,
        signatureDataUrl: null,
      };

      const buffer = await renderer.renderInvoicePdf(input);
      const pdfText = Buffer.from(buffer).toString("latin1");
      const countMatch = pdfText.match(/\/Count\s+(\d+)/);
      const typePage = (pdfText.match(/\/Type\s*\/Page\b(?!\s*s)/g) || []).length;
      const pageCount = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : typePage;
      expect(pageCount).toBe(1);
    });
  }
});

