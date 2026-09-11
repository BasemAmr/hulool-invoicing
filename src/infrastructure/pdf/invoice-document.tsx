import React from "react";
import type { InvoiceDto } from "@/application/dto";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { CustomerRecord } from "@/application/ports/customer-repository";
import type { CompanySettingsRecord } from "@/application/ports/company-settings-repository";
import { getTemplateById, type TemplateDefinition } from "./templates/registry";
import { SimpleTemplate } from "./templates/simple-template";
import { ModernTemplate } from "./templates/modern-template";
import { PosTemplate } from "./templates/pos-template";
import { ClassicTemplate } from "./templates/classic-template";
import { BilingualZatcaTemplate } from "./templates/bilingual-zatca-template";

export interface InvoiceDocumentProps {
  invoice: InvoiceDto;
  company: CompanyRecord;
  customer: CustomerRecord;
  templateId?: string | null;
  settings?: CompanySettingsRecord | null;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  backgroundDataUrl?: string | null;
  /** @deprecated - for backward compatibility */
  stampDataUrl?: string | null;
  signatureDataUrl: string | null;
}

/**
 * Universal PDF Invoice Document Dispatcher.
 * Selects the matching template from the 17-template registry and renders with pixel-perfect fidelity.
 */
export function InvoiceDocument({
  invoice,
  company,
  customer,
  templateId,
  settings,
  qrDataUrl,
  logoDataUrl,
  backgroundDataUrl,
  stampDataUrl,
  signatureDataUrl,
}: InvoiceDocumentProps) {
  const chosenTemplateId =
    templateId ||
    invoice.templateId ||
    (company.templateConfig as any)?.templateId ||
    "simple_red";

  const templateDef: TemplateDefinition = getTemplateById(chosenTemplateId);
  const effectiveBg = backgroundDataUrl ?? stampDataUrl ?? null;

  const props = {
    invoice,
    company,
    customer,
    template: templateDef,
    settings,
    qrDataUrl,
    logoDataUrl,
    backgroundDataUrl: effectiveBg,
    signatureDataUrl,
  };

  switch (templateDef.category) {
    case "modern":
      return <ModernTemplate {...props} />;
    case "pos":
      return <PosTemplate {...props} />;
    case "classic":
      return <ClassicTemplate {...props} />;
    case "bilingual":
      return <BilingualZatcaTemplate {...props} />;
    case "simple":
    default:
      return <SimpleTemplate {...props} />;
  }
}
