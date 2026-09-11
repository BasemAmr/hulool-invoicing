"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import {
  savedProductCreateSchema,
  savedProductUpdateSchema,
} from "@/domain/contracts";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function createSavedProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const nameAr = formData.get("nameAr")?.toString();
  const nameEn = formData.get("nameEn")?.toString() || undefined;
  const description = formData.get("description")?.toString() || undefined;
  const priceRaw = formData.get("unitPrice")?.toString();
  const vatRateRaw = formData.get("vatRate")?.toString();

  const unitPrice = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : undefined;
  const vatRate = vatRateRaw ? parseFloat(vatRateRaw) : 0.15;

  const parsed = savedProductCreateSchema.safeParse({
    nameAr,
    nameEn,
    description,
    unitPrice,
    vatRate,
    isActive: true,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة",
    };
  }

  try {
    await container.savedProductRepository.create(parsed.data);
    revalidatePath("/products");
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حفظ المنتج",
    };
  }
}

export async function updateSavedProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get("id")?.toString();
  const nameAr = formData.get("nameAr")?.toString();
  const nameEn = formData.get("nameEn")?.toString() || undefined;
  const description = formData.get("description")?.toString() || undefined;
  const priceRaw = formData.get("unitPrice")?.toString();
  const vatRateRaw = formData.get("vatRate")?.toString();
  const isActive = formData.get("isActive") === "true";

  const unitPrice = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : undefined;
  const vatRate = vatRateRaw ? parseFloat(vatRateRaw) : 0.15;

  const parsed = savedProductUpdateSchema.safeParse({
    id,
    nameAr,
    nameEn,
    description,
    unitPrice,
    vatRate,
    isActive,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة",
    };
  }

  try {
    await container.savedProductRepository.update(parsed.data);
    revalidatePath("/products");
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل تعديل المنتج",
    };
  }
}

export async function createSavedProductDirectAction(input: {
  nameAr: string;
  nameEn?: string;
  description?: string;
  unitPrice?: number;
  vatRate: number;
  isActive?: boolean;
}): Promise<{ status: "success"; product: { id: string; nameAr: string; unitPrice: number | null; vatRate: number; description: string | null } } | { status: "error"; message: string }> {
  const parsed = savedProductCreateSchema.safeParse({
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    description: input.description,
    unitPrice: input.unitPrice,
    vatRate: input.vatRate,
    isActive: input.isActive ?? true,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات المنتج غير صحيحة",
    };
  }

  try {
    const created = await container.savedProductRepository.create(parsed.data);
    revalidatePath("/products");
    return {
      status: "success",
      product: {
        id: created.id,
        nameAr: created.nameAr,
        unitPrice: created.unitPrice,
        vatRate: created.vatRate,
        description: created.description,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حفظ المنتج",
    };
  }
}

export async function updateSavedProductDirectAction(input: {
  id: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  unitPrice?: number;
  vatRate: number;
  isActive?: boolean;
}): Promise<{ status: "success" } | { status: "error"; message: string }> {
  const parsed = savedProductUpdateSchema.safeParse({
    id: input.id,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    description: input.description,
    unitPrice: input.unitPrice,
    vatRate: input.vatRate,
    isActive: input.isActive ?? true,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات المنتج غير صحيحة",
    };
  }

  try {
    await container.savedProductRepository.update(parsed.data);
    revalidatePath("/products");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل تعديل المنتج",
    };
  }
}

export async function deleteSavedProductAction(
  id: string
): Promise<ActionState> {
  try {
    await container.savedProductRepository.delete(id);
    revalidatePath("/products");
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حذف المنتج",
    };
  }
}

