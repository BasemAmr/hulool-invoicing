"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CreateCustomer } from "@/application/use-cases/create-customer";
import { DomainError, ValidationError } from "@/domain/errors";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = {
    nameAr: String(formData.get("nameAr") ?? ""),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: String(formData.get("vatNumber") ?? ""),
    unifiedNumber: String(formData.get("unifiedNumber") ?? ""),
    phone: nonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    addressCity: String(formData.get("addressCity") ?? ""),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressPostalCode: String(formData.get("addressPostalCode") ?? ""),
  };

  try {
    await new CreateCustomer(
      container.customerRepository,
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
  addressCity: string;
  addressStreet?: string;
  addressPostalCode: string;
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
        nameAr: input.nameAr,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر إنشاء العميل" };
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
    nameAr: String(formData.get("nameAr") ?? ""),
    nameEn: nonEmpty(formData.get("nameEn")),
    vatNumber: String(formData.get("vatNumber") ?? ""),
    unifiedNumber: String(formData.get("unifiedNumber") ?? ""),
    phone: nonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    addressCity: String(formData.get("addressCity") ?? ""),
    addressStreet: nonEmpty(formData.get("addressStreet")),
    addressPostalCode: String(formData.get("addressPostalCode") ?? ""),
  };

  try {
    const { UpdateCustomer } = await import("@/application/use-cases/update-customer");
    await new UpdateCustomer(
      container.customerRepository,
      container.clock,
    ).execute(input);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
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
  addressCity: string;
  addressStreet?: string;
  addressPostalCode: string;
}): Promise<{ status: "success"; customer: { id: string; nameAr: string } } | { status: "error"; message: string }> {
  try {
    const { UpdateCustomer } = await import("@/application/use-cases/update-customer");
    await new UpdateCustomer(
      container.customerRepository,
      container.clock,
    ).execute(input);

    revalidatePath("/customers");
    return {
      status: "success",
      customer: {
        id: input.id,
        nameAr: input.nameAr,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر تحديث بيانات العميل" };
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

