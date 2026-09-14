"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { companySettingsSchema } from "@/domain/contracts";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function updateCompanySettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const companyId = formData.get("companyId")?.toString();
  const numberFormat = formData.get("numberFormat")?.toString() as "ar" | "en";
  const dateFormat = formData.get("dateFormat")?.toString();
  const currencyCode = formData.get("currencyCode")?.toString();
  const currencyPosition = formData.get("currencyPosition")?.toString() as "before" | "after";
  const thousandsSeparator = formData.get("thousandsSeparator")?.toString();
  const decimalSeparator = formData.get("decimalSeparator")?.toString();
  const decimalPlaces = parseInt(formData.get("decimalPlaces")?.toString() ?? "2", 10);
  const defaultVatRate = parseFloat(formData.get("defaultVatRate")?.toString() ?? "0.15");
  const paperSize = formData.get("paperSize")?.toString() as "A4" | "Letter";
  const paperOrientation = formData.get("paperOrientation")?.toString() as "portrait" | "landscape";
  const defaultTemplateId = formData.get("defaultTemplateId")?.toString() || "simple_red";
  const defaultReceiptTemplateId = formData.get("defaultReceiptTemplateId")?.toString() || "receipt_standard";

  const parsed = companySettingsSchema.safeParse({
    companyId,
    numberFormat,
    dateFormat,
    currencyCode,
    currencyPosition,
    thousandsSeparator,
    decimalSeparator,
    decimalPlaces,
    defaultVatRate,
    paperSize,
    paperOrientation,
    defaultTemplateId,
    defaultReceiptTemplateId,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات الإعدادات غير صالحة",
    };
  }

  try {
    await container.companySettingsRepository.upsert(parsed.data);
    revalidatePath(`/c/${companyId}/settings`);
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حفظ الإعدادات",
    };
  }
}
