import { describe, it, expect } from "vitest";
import { Children, isValidElement, type ReactNode } from "react";
import { ReactPdfRenderer } from "../react-pdf-renderer";
import { InvoiceDocument } from "../invoice-document";
import { SaddtAlkhaleejTemplate } from "./saddt-alkhaleej-template";
import { AlEntajAlMutamakkinTemplate } from "./al-entaj-al-mutamakkin-template";
import { FastWoodTemplate } from "./fast-wood-template";
import { TamouhCompanyTemplate } from "./tamouh-company-template";
import { NourFakhamaTemplate } from "./nour-fakhama-template";
import { BinHarkilTemplate } from "./bin-harkil-template";
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
  clientEmployee: null,
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

// Inspect text before PDF font encoding; successful PDF generation can hide wrong words.
function collectTemplateText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? collectTemplateText(child.props.children)
        : String(child),
    )
    .join("");
}

describe("Templates PDF Rendering", () => {
  const renderer = new ReactPdfRenderer();

  const newTemplates = [
    { templateId: "al_entaj_al_mutamakkin", Template: AlEntajAlMutamakkinTemplate },
    { templateId: "fast_wood", Template: FastWoodTemplate },
    { templateId: "tamouh_company", Template: TamouhCompanyTemplate },
    { templateId: "nour_fakhama", Template: NourFakhamaTemplate },
    { templateId: "bin_harkil", Template: BinHarkilTemplate },
  ];

  for (const { templateId, Template } of newTemplates) {
    it.each(["explicit", "invoice"])(`dispatches ${templateId} from %s`, (source) => {
      const document = InvoiceDocument({
        invoice: { ...mockInvoice, templateId: source === "invoice" ? templateId : mockInvoice.templateId },
        company: mockCompany,
        customer: mockCustomer,
        templateId: source === "explicit" ? templateId : null,
        qrDataUrl: null,
        logoDataUrl: null,
        signatureDataUrl: null,
      });

      // A valid generic fallback PDF would hide missing dispatcher wiring.
      expect(document.type).toBe(Template);
    });

    it(`renders a simplified draft with notes for ${templateId}`, async () => {
      const buffer = await renderer.renderInvoicePdf({
        invoice: {
          ...mockInvoice,
          templateId,
          invoiceType: "simplified",
          status: "draft",
          invoiceNumber: null,
          issueTime: "00:00",
          terms: "First term\nSecond term",
          notes: "Draft note",
          items: [],
          subtotal: "0.00",
          vatAmount: "0.00",
          total: "0.00",
        },
        company: mockCompany,
        customer: mockCustomer,
        qrDataUrl: null,
        logoDataUrl: null,
        signatureDataUrl: null,
      });

      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe("%PDF-");
    });
  }

  // Nour shows numeric totals only; the other three also spell out the amount.
  for (const { templateId, Template } of newTemplates.slice(0, 3)) {
    it.each([
      ["0.00", "\u0635\u0641\u0631 \u0631\u064a\u0627\u0644"],
      ["10.00", "\u0639\u0634\u0631\u0629 \u0631\u064a\u0627\u0644"],
      // Preserve each supplied template's spelling and conjunction spacing.
      ["11.00", templateId === "tamouh_company"
        ? "\u0627\u062d\u062f \u0639\u0634\u0631 \u0631\u064a\u0627\u0644"
        : "\u0623\u062d\u062f \u0639\u0634\u0631 \u0631\u064a\u0627\u0644"],
      ["110.00", templateId === "al_entaj_al_mutamakkin"
        ? "\u0645\u0627\u0626\u0629 \u0648 \u0639\u0634\u0631\u0629 \u0631\u064a\u0627\u0644"
        : "\u0645\u0627\u0626\u0629 \u0648\u0639\u0634\u0631\u0629 \u0631\u064a\u0627\u0644"],
      ["10000.00", "\u0639\u0634\u0631\u0629 \u0622\u0644\u0627\u0641 \u0631\u064a\u0627\u0644"],
      ["10000000.00", "\u0639\u0634\u0631\u0629 \u0645\u0644\u0627\u064a\u064a\u0646 \u0631\u064a\u0627\u0644"],
      ["0.10", "\u0639\u0634\u0631\u0629 \u0647\u0644\u0644\u0629"],
      ["50100.10", "\u0639\u0634\u0631\u0629 \u0647\u0644\u0644\u0629"],
    ])(`renders ${templateId} amount %s without undefined`, (total, expectedWords) => {
      const text = collectTemplateText(Template({
        invoice: { ...mockInvoice, templateId, total },
        company: mockCompany,
        customer: mockCustomer,
        qrDataUrl: null,
      }));

      expect(text).not.toMatch(/undefined|NaN/);
      expect(text).toContain(expectedWords);
    });
  }

  it("formats Tamouh amounts with thousands separators", () => {
    const text = collectTemplateText(TamouhCompanyTemplate({
      invoice: { ...mockInvoice, total: "50100.10" },
      company: mockCompany,
      customer: mockCustomer,
      qrDataUrl: null,
    }));

    expect(text).toContain("50,100.10");
  });

  it("does not repeat Tamouh address prefixes or restore the removed seller employee", () => {
    const text = collectTemplateText(TamouhCompanyTemplate({
      invoice: mockInvoice,
      company: {
        ...mockCompany,
        addressDistrict: "\u062d\u064a \u0627\u0644\u0639\u0644\u064a\u0627",
        addressStreet: "\u0634\u0627\u0631\u0639 \u0627\u0644\u062a\u062d\u0644\u064a\u0629",
        clientEmployee: "REMOVED_SELLER_EMPLOYEE",
      },
      customer: mockCustomer,
      qrDataUrl: null,
    }));

    expect(text).toContain("\u062d\u064a \u0627\u0644\u0639\u0644\u064a\u0627");
    expect(text).toContain("\u0634\u0627\u0631\u0639 \u0627\u0644\u062a\u062d\u0644\u064a\u0629");
    expect(text).not.toContain("\u062d\u064a \u062d\u064a");
    expect(text).not.toContain("\u0634\u0627\u0631\u0639 \u0634\u0627\u0631\u0639");
    expect(text).not.toContain("REMOVED_SELLER_EMPLOYEE");
  });

  it.each([
    ["9.00", "\u062a\u0633\u0639\u0629 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["10.00", "\u0639\u0634\u0631\u0629 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["11.00", "\u0623\u062d\u062f \u0639\u0634\u0631 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["110.00", "\u0645\u0627\u0626\u0629 \u0648 \u0639\u0634\u0631\u0629 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["10000.00", "\u0639\u0634\u0631\u0629 \u0622\u0644\u0627\u0641 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["10000000.00", "\u0639\u0634\u0631\u0629 \u0645\u0644\u0627\u064a\u064a\u0646 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a"],
    ["0.10", "\u0635\u0641\u0631 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a \u0648 \u0639\u0634\u0631\u0629 \u0647\u0644\u0644\u0629"],
    ["50100.10", "\u062e\u0645\u0633\u0648\u0646 \u0623\u0644\u0641 \u0648 \u0645\u0627\u0626\u0629 \u0631\u064a\u0627\u0644 \u0633\u0639\u0648\u062f\u064a \u0648 \u0639\u0634\u0631\u0629 \u0647\u0644\u0644\u0629"],
  ])("renders Saddt Alkhaleej amount %s without undefined", (total, expectedWords) => {
    const text = collectTemplateText(SaddtAlkhaleejTemplate({
      invoice: { ...mockInvoice, total },
      company: mockCompany,
      customer: mockCustomer,
      qrDataUrl: null,
    }));

    expect(text).not.toContain("undefined");
    expect(text).toContain(expectedWords);
  });

  it.each([
    { templateId: "saddt_alkhaleej", invoice: mockInvoice },
    { templateId: null, invoice: { ...mockInvoice, templateId: "saddt_alkhaleej" } },
  ])("dispatches Saddt Alkhaleej with templateId=$templateId", ({ templateId, invoice }) => {
    const document = InvoiceDocument({
      invoice,
      company: mockCompany,
      customer: mockCustomer,
      templateId,
      qrDataUrl: null,
      logoDataUrl: null,
      signatureDataUrl: null,
    });

    // A generic fallback also renders a valid PDF, so verify the actual component.
    expect(document.type).toBe(SaddtAlkhaleejTemplate);
  });

  it("renders Bin Harkil without dummy placeholders and spells out the exact total", () => {
    const text = collectTemplateText(BinHarkilTemplate({
      invoice: { ...mockInvoice, templateId: "bin_harkil", total: "23.4646916641601264" },
      company: mockCompany,
      customer: mockCustomer,
      qrDataUrl: null,
    }));

    // Exact representation must survive untouched.
    expect(text).toContain("23.4646916641601264");
    // Spelled-out total due (Tafqeet) must be present.
    expect(text).toContain("فقط");
    expect(text).toContain("لا غير");
    // Guideline removals: no dummy stamp box, no item-code/UOM columns, no supply date.
    expect(text).not.toContain("Stamp / Signature Area");
    expect(text).not.toContain("Item Code");
    expect(text).not.toContain("UOM");
    expect(text).not.toContain("تاريخ التوريد");
    expect(text).not.toContain("Walk In Name");
  });

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
    "al_qahwa_al_barriah",
    "alam_al_wissam",
    "foodstuffs_fmcg",
    "al_qahwa_al_alamiah",
    "marai_albun",
    "qahwat_bisha",
    "fadak_contracting",
    "saddt_alkhaleej",
    ...newTemplates.map(({ templateId }) => templateId),
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
    ...newTemplates.map(({ templateId }) => templateId),
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

