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
    vatNumber: nonEmpty(formData.get("vatNumber")),
    phone: nonEmpty(formData.get("phone")),
    email: nonEmpty(formData.get("email")),
    addressCity: nonEmpty(formData.get("addressCity")),
    addressStreet: nonEmpty(formData.get("addressStreet")),
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

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}
