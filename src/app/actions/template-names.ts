"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import {
  TEMPLATES_REGISTRY,
  RECEIPT_TEMPLATES_REGISTRY,
} from "@/infrastructure/pdf/templates/registry";
import type { TemplateOverridesMap } from "@/infrastructure/pdf/templates/template-names";

const container = createContainer(db);

/**
 * Retrieves the custom template name overrides map for a specific company.
 */
export async function getCompanyTemplateOverridesAction(
  companyId: string
): Promise<TemplateOverridesMap> {
  if (!companyId) return {};
  try {
    const settings = await container.companySettingsRepository.getByCompanyId(companyId);
    return (settings?.templateNameOverrides as TemplateOverridesMap) || {};
  } catch (error) {
    console.error("Failed to load template name overrides:", error);
    return {};
  }
}

/**
 * Updates or sets a custom template name override for a specific company.
 * Both Arabic and English names can be customized.
 */
export async function updateTemplateNameAction(
  companyId: string,
  templateId: string,
  nameAr?: string,
  nameEn?: string
): Promise<{ success: boolean; overrides?: TemplateOverridesMap; error?: string }> {
  try {
    if (!companyId) {
      return { success: false, error: "معرف المنشأة مطلوب" };
    }
    if (!templateId) {
      return { success: false, error: "معرف القالب مطلوب" };
    }

    const isValidTemplate =
      templateId in TEMPLATES_REGISTRY || templateId in RECEIPT_TEMPLATES_REGISTRY;
    if (!isValidTemplate) {
      return { success: false, error: "معرف القالب غير معتمد في النظام" };
    }

    const currentSettings = await container.companySettingsRepository.getByCompanyId(companyId);
    const existingOverrides: TemplateOverridesMap =
      (currentSettings?.templateNameOverrides as TemplateOverridesMap) || {};

    const trimmedAr = nameAr?.trim();
    const trimmedEn = nameEn?.trim();

    const nextOverrides: TemplateOverridesMap = { ...existingOverrides };

    if (!trimmedAr && !trimmedEn) {
      delete nextOverrides[templateId];
    } else {
      nextOverrides[templateId] = {
        ar: trimmedAr || undefined,
        en: trimmedEn || undefined,
      };
    }

    await container.companySettingsRepository.upsert({
      companyId,
      numberFormat: currentSettings?.numberFormat ?? "en",
      dateFormat: currentSettings?.dateFormat ?? "YYYY-MM-DD",
      currencyCode: currentSettings?.currencyCode ?? "SAR",
      currencyPosition: currentSettings?.currencyPosition ?? "after",
      thousandsSeparator: currentSettings?.thousandsSeparator ?? ",",
      decimalSeparator: currentSettings?.decimalSeparator ?? ".",
      decimalPlaces: currentSettings?.decimalPlaces ?? 2,
      defaultVatRate: currentSettings?.defaultVatRate ?? 0.15,
      paperSize: currentSettings?.paperSize ?? "A4",
      paperOrientation: currentSettings?.paperOrientation ?? "portrait",
      defaultTemplateId: currentSettings?.defaultTemplateId ?? "simple_red",
      defaultReceiptTemplateId:
        currentSettings?.defaultReceiptTemplateId ?? "receipt_standard",
      templateNameOverrides: nextOverrides,
    });

    revalidatePath(`/c/${companyId}`);
    return { success: true, overrides: nextOverrides };
  } catch (error: any) {
    console.error("Error updating template name:", error);
    return {
      success: false,
      error: error?.message || "حدث خطأ أثناء حفظ مسمى القالب الجديد",
    };
  }
}

/**
 * Resets a template's name back to its system default.
 */
export async function resetTemplateNameAction(
  companyId: string,
  templateId: string
): Promise<{ success: boolean; overrides?: TemplateOverridesMap; error?: string }> {
  return updateTemplateNameAction(companyId, templateId, undefined, undefined);
}
