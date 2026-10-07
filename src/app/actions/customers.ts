"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CreateCustomer } from "@/application/use-cases/create-customer";
import { DomainError, ValidationError } from "@/domain/errors";
import { formatDatabaseError } from "@/lib/format-db-error";
import { toWesternDigits } from "@/lib/format";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = {
    nameAr: String(formData.get("nameAr") ?? "").trim(),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: westernNonEmpty(formData.get("vatNumber")) ?? "",
    unifiedNumber: westernNonEmpty(formData.get("unifiedNumber")) ?? "",
    phone: westernNonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    clientEmployee: nonEmpty(formData.get("clientEmployee")),
    addressCity: String(formData.get("addressCity") ?? "").trim(),
    addressDistrict: nonEmpty(formData.get("addressDistrict")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressBuildingNumber: westernNonEmpty(formData.get("addressBuildingNumber")),
    addressPostalCode: westernNonEmpty(formData.get("addressPostalCode")) ?? "",
    addressAdditionalNumber: westernNonEmpty(formData.get("addressAdditionalNumber")),
  };

  try {
    await new CreateCustomer(
      container.customerRepository,
      container.clock,
    ).execute(input);
  } catch (error) {
    return { status: "error", message: formatDatabaseError(error, "تعذر إنشاء العميل", "customer") };
  }

  revalidatePath("/customers");
  redirect("/customers");
}

/**
 * Direct customer creation action for inline modal usage without navigation redirect.
 */
export async function createCustomerDirectAction(input: {
  nameAr: string;
  nameEn?: string;
  vatNumber: string;
  unifiedNumber: string;
  phone?: string;
  email?: string;
  clientEmployee?: string;
  addressCity: string;
  addressDistrict?: string;
  addressStreet?: string;
  addressBuildingNumber?: string;
  addressPostalCode: string;
  addressAdditionalNumber?: string;
}): Promise<{ status: "success"; customer: { id: string; nameAr: string } } | { status: "error"; message: string }> {
  try {
    const result = await new CreateCustomer(
      container.customerRepository,
      container.clock,
    ).execute(input);

    revalidatePath("/customers");
    revalidatePath("/invoices/new");

    return {
      status: "success",
      customer: {
        id: result.id,
        nameAr: input.nameAr.trim(),
      },
    };
  } catch (error) {
    return { status: "error", message: formatDatabaseError(error, "تعذر إنشاء العميل", "customer") };
  }
}

export async function updateCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: "معرّف العميل مفقود" };
  }

  const input = {
    id,
    nameAr: String(formData.get("nameAr") ?? "").trim(),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: westernNonEmpty(formData.get("vatNumber")) ?? "",
    unifiedNumber: westernNonEmpty(formData.get("unifiedNumber")) ?? "",
    phone: westernNonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    clientEmployee: nonEmpty(formData.get("clientEmployee")),
    addressCity: String(formData.get("addressCity") ?? "").trim(),
    addressDistrict: nonEmpty(formData.get("addressDistrict")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressBuildingNumber: westernNonEmpty(formData.get("addressBuildingNumber")),
    addressPostalCode: westernNonEmpty(formData.get("addressPostalCode")) ?? "",
    addressAdditionalNumber: westernNonEmpty(formData.get("addressAdditionalNumber")),
  };

  try {
    const { UpdateCustomer } = await import("@/application/use-cases/update-customer");
    await new UpdateCustomer(
      container.customerRepository,
      container.clock,
    ).execute(input);
  } catch (error) {
    return { status: "error", message: formatDatabaseError(error, "تعذر تحديث بيانات العميل", "customer") };
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerDirectAction(input: {
  id: string;
  nameAr: string;
  nameEn?: string;
  vatNumber: string;
  unifiedNumber: string;
  phone?: string;
  email?: string;
  clientEmployee?: string;
  addressCity: string;
  addressDistrict?: string;
  addressStreet?: string;
  addressBuildingNumber?: string;
  addressPostalCode: string;
  addressAdditionalNumber?: string;
}): Promise<{ status: "success"; customer: { id: string; nameAr: string } } | { status: "error"; message: string }> {
  try {
    const { UpdateCustomer } = await import("@/application/use-cases/update-customer");
    await new UpdateCustomer(
      container.customerRepository,
      container.clock,
    ).execute({
      ...input,
      nameAr: input.nameAr.trim(),
      vatNumber: toWesternDigits(input.vatNumber.trim()),
      unifiedNumber: toWesternDigits(input.unifiedNumber.trim()),
      phone: input.phone?.trim() ? toWesternDigits(input.phone.trim()) : undefined,
      addressPostalCode: toWesternDigits(input.addressPostalCode.trim()),
      addressAdditionalNumber: input.addressAdditionalNumber?.trim()
        ? toWesternDigits(input.addressAdditionalNumber.trim())
        : undefined,
      addressBuildingNumber: input.addressBuildingNumber?.trim()
        ? toWesternDigits(input.addressBuildingNumber.trim())
        : undefined,
    });

    revalidatePath("/customers");
    return {
      status: "success",
      customer: {
        id: input.id,
        nameAr: input.nameAr.trim(),
      },
    };
  } catch (error) {
    return { status: "error", message: formatDatabaseError(error, "تعذر تحديث بيانات العميل", "customer") };
  }
}

export async function deleteCustomerAction(id: string): Promise<{ status: "success" } | { status: "error"; message: string }> {
  if (!id) {
    return { status: "error", message: "معرّف العميل مفقود" };
  }

  try {
    const { DeleteCustomer } = await import("@/application/use-cases/delete-customer");
    await new DeleteCustomer(container.customerRepository).execute({ id });
    revalidatePath("/customers");
    return { status: "success" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر حذف العميل" };
  }
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}

function westernNonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? toWesternDigits(value).trim() : "";
  return str.length > 0 ? str : undefined;
}

