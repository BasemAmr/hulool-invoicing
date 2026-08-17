"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CreateCompany } from "@/application/use-cases/create-company";
import { DomainError, ValidationError } from "@/domain/errors";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = {
    nameAr: String(formData.get("nameAr") ?? ""),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: String(formData.get("vatNumber") ?? ""),
    crNumber: nonEmpty(formData.get("crNumber")),
    prefix: String(formData.get("prefix") ?? "").toUpperCase(),
    addressBuildingNumber: nonEmpty(formData.get("addressBuildingNumber")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressDistrict: nonEmpty(formData.get("addressDistrict")),
    addressCity: nonEmpty(formData.get("addressCity")),
    addressPostalCode: nonEmpty(formData.get("addressPostalCode")),
    addressAdditionalNumber: nonEmpty(formData.get("addressAdditionalNumber")),
  };

  try {
    await new CreateCompany(
      container.companyRepository,
      container.clock,
    ).execute(input);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { status: "error", message: error.message };
    }
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/companies");
  redirect("/companies");
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}
