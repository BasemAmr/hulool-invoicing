"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CreateCompany } from "@/application/use-cases/create-company";
import { DomainError, ValidationError } from "@/domain/errors";
import type { CompanyRecord } from "@/application/ports/company-repository";
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
    clientEmployee: nonEmpty(formData.get("clientEmployee")),
    addressBuildingNumber: nonEmpty(formData.get("addressBuildingNumber")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressDistrict: nonEmpty(formData.get("addressDistrict")),
    addressCity: nonEmpty(formData.get("addressCity")),
    addressPostalCode: nonEmpty(formData.get("addressPostalCode")),
    addressAdditionalNumber: nonEmpty(formData.get("addressAdditionalNumber")),
    phone: nonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    website: nonEmpty(formData.get("website")),
    logoFileId: nonEmpty(formData.get("logoFileId")),
    backgroundFileId: nonEmpty(formData.get("backgroundFileId")),
    signatureFileId: nonEmpty(formData.get("signatureFileId")),
    footerText: nonEmpty(formData.get("footerText")),
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

export async function updateCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: "معرّف الشركة مفقود" };
  }

  const input = {
    id,
    nameAr: String(formData.get("nameAr") ?? ""),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: String(formData.get("vatNumber") ?? ""),
    crNumber: nonEmpty(formData.get("crNumber")),
    prefix: String(formData.get("prefix") ?? "").toUpperCase(),
    clientEmployee: nonEmpty(formData.get("clientEmployee")),
    addressBuildingNumber: nonEmpty(formData.get("addressBuildingNumber")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressDistrict: nonEmpty(formData.get("addressDistrict")),
    addressCity: nonEmpty(formData.get("addressCity")),
    addressPostalCode: nonEmpty(formData.get("addressPostalCode")),
    addressAdditionalNumber: nonEmpty(formData.get("addressAdditionalNumber")),
    phone: nonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    website: nonEmpty(formData.get("website")),
    logoFileId: nonEmpty(formData.get("logoFileId")),
    backgroundFileId: nonEmpty(formData.get("backgroundFileId")),
    signatureFileId: nonEmpty(formData.get("signatureFileId")),
    footerText: nonEmpty(formData.get("footerText")),
  };

  try {
    const { UpdateCompany } = await import("@/application/use-cases/update-company");
    await new UpdateCompany(
      container.companyRepository,
      container.clock,
    ).execute(input);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/companies");
  redirect("/companies");
}

export async function deleteCompanyAction(id: string): Promise<{ status: "success" } | { status: "error"; message: string }> {
  if (!id) {
    return { status: "error", message: "معرّف الشركة مفقود" };
  }

  try {
    const { DeleteCompany } = await import("@/application/use-cases/delete-company");
    await new DeleteCompany(container.companyRepository).execute({ id });
    revalidatePath("/companies");
    return { status: "success" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر حذف الشركة" };
  }
}

export async function createCompanyDirectAction(data: {
  nameAr: string;
  nameEn?: string;
  vatNumber: string;
  crNumber?: string;
  prefix: string;
  clientEmployee?: string;
  addressBuildingNumber?: string;
  addressStreet?: string;
  addressDistrict?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressAdditionalNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoFileId?: string;
  backgroundFileId?: string;
  signatureFileId?: string;
  footerText?: string;
}): Promise<{ status: "success"; data: CompanyRecord } | { status: "error"; message: string }> {
  try {
    const { asCompanyId } = await import("@/domain/branding");
    const result = await new CreateCompany(
      container.companyRepository,
      container.clock,
    ).execute({
      ...data,
      prefix: data.prefix.toUpperCase(),
    });
    const company = await container.companyRepository.findById(asCompanyId(result.id));
    if (!company) {
      return { status: "error", message: "تعذر العثور على المنشأة بعد إنشائها" };
    }
    revalidatePath("/companies");
    return { status: "success", data: company };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر حفظ بيانات المنشأة" };
  }
}

export async function updateCompanyDirectAction(
  id: string,
  data: {
    nameAr: string;
    nameEn?: string;
    vatNumber: string;
    crNumber?: string;
    prefix: string;
    clientEmployee?: string;
    addressBuildingNumber?: string;
    addressStreet?: string;
    addressDistrict?: string;
    addressCity?: string;
    addressPostalCode?: string;
    addressAdditionalNumber?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoFileId?: string;
    backgroundFileId?: string;
    signatureFileId?: string;
    footerText?: string;
  }
): Promise<{ status: "success"; data: CompanyRecord } | { status: "error"; message: string }> {
  if (!id) {
    return { status: "error", message: "معرّف الشركة مفقود" };
  }

  try {
    const { asCompanyId } = await import("@/domain/branding");
    const { UpdateCompany } = await import("@/application/use-cases/update-company");
    const result = await new UpdateCompany(
      container.companyRepository,
      container.clock,
    ).execute({
      id,
      ...data,
      prefix: data.prefix.toUpperCase(),
    });
    const updated = await container.companyRepository.findById(asCompanyId(result.id));
    if (!updated) {
      return { status: "error", message: "تعذر العثور على المنشأة بعد تحديثها" };
    }
    revalidatePath("/companies");
    revalidatePath(`/c/${id}`);
    return { status: "success", data: updated };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر تحديث بيانات المنشأة" };
  }
}



function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}

