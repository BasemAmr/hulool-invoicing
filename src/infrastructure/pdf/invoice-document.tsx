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
import { MasdarBuildingMaterialsTemplate } from "./templates/masdar-materials-template";
import { AldailCeramicsTemplate } from "./templates/aldail-ceramics-template";
import { BazreaPlasticsTemplate } from "./templates/bazrea-plastics-template";
import { SaAlkoufiTemplate } from "./templates/sa-alkoufi-template";
import { GenericDeliveryNoteTemplate } from "./templates/generic-delivery-note-template";
import { GenericDotmatrix22Template } from "./templates/generic-dotmatrix-22-template";
import { GenericBranch23Template } from "./templates/generic-branch-23-template";
import { GenericFoodstuffs24Template } from "./templates/generic-foodstuffs-24-template";
import { GenericSimplified25Template } from "./templates/generic-simplified-25-template";
import { Template1AlAsma } from "./templates/template-1-al-asma";
import { Template2MatajerAlwadi } from "./templates/template-2-matajer-alwadi";
import { Template3FikrAlmakateb } from "./templates/template-3-fikr-almakateb";
import { Template4JuffaliFood } from "./templates/template-4-juffali-food";
import { Template5TharaRiyadh } from "./templates/template-5-thara-riyadh";
import { Template6JabalAlRayan } from "./templates/template-6-jabal-al-rayan";
import { Template7Alsahah } from "./templates/template-7-alsahah";
import { Template8SalehAlHaider } from "./templates/template-8-saleh-al-haider";

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
 * Selects the matching template from the registry and renders with pixel-perfect fidelity.
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
    settings?.defaultTemplateId ||
    (company.templateConfig as { templateId?: string } | null)?.templateId ||
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
  if (templateDef.id === "aldail_ceramics") {
    return <AldailCeramicsTemplate {...props} />;
  }
  if (templateDef.id === "bazrea_plastics") {
    return <BazreaPlasticsTemplate {...props} />;
  }
  if (templateDef.id === "sa_alkoufi") {
    return <SaAlkoufiTemplate {...props} />;
  }
  if (templateDef.id === "generic_delivery_21") {
    return <GenericDeliveryNoteTemplate {...props} />;
  }
  if (templateDef.id === "generic_dotmatrix_22") {
    return <GenericDotmatrix22Template {...props} />;
  }
  if (templateDef.id === "generic_branch_23") {
    return <GenericBranch23Template {...props} />;
  }
  if (templateDef.id === "generic_foodstuffs_24") {
    return <GenericFoodstuffs24Template {...props} />;
  }
  if (templateDef.id === "template_1_al_asma") {
    return <Template1AlAsma {...props} />;
  }
  if (templateDef.id === "template_2_matajer_alwadi") {
    return <Template2MatajerAlwadi {...props} />;
  }
  if (templateDef.id === "template_3_fikr_almakateb") {
    return <Template3FikrAlmakateb {...props} />;
  }
  if (templateDef.id === "template_4_juffali_food") {
    return <Template4JuffaliFood {...props} />;
  }
  if (templateDef.id === "template_5_thara_riyadh") {
    return <Template5TharaRiyadh {...props} />;
  }
  if (templateDef.id === "template_6_jabal_al_rayan") {
    return <Template6JabalAlRayan {...props} />;
  }
  if (templateDef.id === "template_7_alsahah") {
    return <Template7Alsahah {...props} />;
  }
  if (templateDef.id === "template_8_saleh_al_haider") {
    return <Template8SalehAlHaider {...props} />;
  }
  if (templateDef.id === "masdar_materials_terms") {
    return <MasdarBuildingMaterialsTemplate {...props} withTerms={true} />;
  }
  if (templateDef.id === "masdar_materials_no_terms") {
    return <MasdarBuildingMaterialsTemplate {...props} withTerms={false} />;
  }
  if (templateDef.id === "masdar_materials") {
    return <MasdarBuildingMaterialsTemplate {...props} withTerms={true} />;
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
