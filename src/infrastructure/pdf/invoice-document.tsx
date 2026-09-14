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
import { ContractingInvoiceTemplate } from "./templates/contracting-invoice-template";
import { SahmInvoiceTemplate } from "./templates/sahm-invoice-template";
import { MahalaPosTemplate } from "./templates/mahala-pos-template";
import { StructuredBilingualTemplate } from "./templates/structured-bilingual-template";
import { KuwaitLandmarksTemplate } from "./templates/kuwait-landmarks-template";
import { ShamiTradingTemplate } from "./templates/shami-trading-template";
import { BawazeerPlasticsTemplate } from "./templates/bawazeer-plastics-template";
import { JoyInvoiceTemplate } from "./templates/joy-invoice-template";
import { ShawagerInvestmentTemplate } from "./templates/shawager-investment-template";
import { MadinaPlasticsTemplate } from "./templates/madina-plastics-template";
import { CoffeeIdeasTemplate } from "./templates/coffee-ideas-template";
import { MatajerAlSaifTemplate } from "./templates/matajer-al-saif-template";
import { ManahirPosTemplate } from "./templates/manahir-pos-template";
import { HasaniahFoamTemplate } from "./templates/hasaniah-foam-template";
import { TopTownTemplate } from "./templates/top-town-template";

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

  if (templateDef.id === "sahm_coral") {
    return <SahmInvoiceTemplate {...props} />;
  }
  if (templateDef.id === "contracting_advance") {
    return <ContractingInvoiceTemplate {...props} />;
  }
  if (templateDef.id === "mahala_pos") {
    return <MahalaPosTemplate {...props} />;
  }
  if (templateDef.id === "structured_bilingual") {
    return <StructuredBilingualTemplate {...props} />;
  }
  if (templateDef.id === "kuwait_landmarks") {
    return <KuwaitLandmarksTemplate {...props} />;
  }
  if (templateDef.id === "shami_trading") {
    return <ShamiTradingTemplate {...props} />;
  }
  if (templateDef.id === "bawazeer_plastics") {
    return <BawazeerPlasticsTemplate {...props} />;
  }
  if (templateDef.id === "joy_purchase_invoice") {
    return <JoyInvoiceTemplate {...props} isPurchase={true} />;
  }
  if (templateDef.id === "joy_sales_invoice") {
    return <JoyInvoiceTemplate {...props} isPurchase={false} />;
  }
  if (templateDef.id === "shawager_investment") {
    return <ShawagerInvestmentTemplate {...props} />;
  }
  if (templateDef.id === "madina_plastics") {
    return <MadinaPlasticsTemplate {...props} />;
  }
  if (templateDef.id === "coffee_ideas") {
    return <CoffeeIdeasTemplate {...props} />;
  }
  if (templateDef.id === "matajer_al_saif") {
    return <MatajerAlSaifTemplate {...props} />;
  }
  if (templateDef.id === "manahir_pos") {
    return <ManahirPosTemplate {...props} />;
  }
  if (templateDef.id === "hasaniah_foam") {
    return <HasaniahFoamTemplate {...props} />;
  }
  if (templateDef.id === "top_town") {
    return <TopTownTemplate {...props} />;
  }

  switch (templateDef.category) {
    case "contracting":
      return <ContractingInvoiceTemplate {...props} />;
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
