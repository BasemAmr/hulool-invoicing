"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { companySettingsSchema } from "@/domain/contracts";
import {
  parseDecimalPlacesInput,
  parseVatRateInput,
} from "@/lib/settings-input";
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
  const decimalPlaces = parseDecimalPlacesInput(formData.get("decimalPlaces")?.toString());
  // Boundary normalization (Arabic-Indic digits, trailing %, whole-number
  // percents like "15" → 0.15) so user input never fails validation on
  // digit shape alone. Unparseable input yields NaN, which Zod rejects below.
  const defaultVatRate = parseVatRateInput(formData.get("defaultVatRate")?.toString());
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
    // The new-invoice page consumes defaultVatRate + defaultTemplateId
    // server-side; without this it keeps serving the pre-save cached page,
    // which looks exactly like "the setting didn't save".
    revalidatePath(`/c/${companyId}/invoices/new`);
    return { status: "ok" };
  } catch (error) {
    // Deliberate swallow: surface a safe message to the form toast; the
    // raw error (e.g. DB constraint detail) must not leak to the client.
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حفظ الإعدادات",
    };
  }
}
