"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { receiptVoucherCreateSchema, receiptVoucherUpdateSchema } from "@/domain/contracts";
import type { ActionState } from "./types";

const container = createContainer(db);

export async function createReceiptVoucherAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const companyId = formData.get("companyId")?.toString();
  const customerId = formData.get("customerId")?.toString();
  const invoiceId = formData.get("invoiceId")?.toString() || undefined;
  const voucherDate = formData.get("voucherDate")?.toString();
  const amountRaw = formData.get("amount")?.toString();
  const paymentMethod = formData.get("paymentMethod")?.toString() as "cash" | "bank_transfer" | "other";
  const reference = formData.get("reference")?.toString() || undefined;
  const notes = formData.get("notes")?.toString() || undefined;

  const amount = amountRaw ? Math.round(parseFloat(amountRaw) * 100) : 0;

  const parsed = receiptVoucherCreateSchema.safeParse({
    companyId,
    customerId,
    invoiceId,
    voucherDate,
    amount,
    paymentMethod,
    reference,
    notes,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات سند القبض غير صحيحة",
    };
  }

  try {
    await container.receiptVoucherRepository.create(parsed.data);
    revalidatePath(`/c/${companyId}/receipts`);
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل إنشاء سند القبض",
    };
  }
}

export async function createReceiptVoucherDirectAction(input: {
  companyId: string;
  customerId: string;
  invoiceId?: string;
  voucherDate: string;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "other";
  reference?: string;
  notes?: string;
}): Promise<{ status: "success"; voucher: { id: string; voucherNumber: string } } | { status: "error"; message: string }> {
  const parsed = receiptVoucherCreateSchema.safeParse({
    companyId: input.companyId,
    customerId: input.customerId,
    invoiceId: input.invoiceId,
    voucherDate: input.voucherDate,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    notes: input.notes,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات سند القبض غير صحيحة",
    };
  }

  try {
    const created = await container.receiptVoucherRepository.create(parsed.data);
    revalidatePath(`/c/${input.companyId}/receipts`);
    revalidatePath(`/c/${input.companyId}`);
    return {
      status: "success",
      voucher: {
        id: created.id,
        voucherNumber: created.voucherNumber,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل إنشاء سند القبض",
    };
  }
}

export async function deleteReceiptVoucherAction(
  id: string,
  companyId: string
): Promise<ActionState> {
  try {
    await container.receiptVoucherRepository.delete(id);
    revalidatePath(`/c/${companyId}/receipts`);
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل حذف سند القبض",
    };
  }
}

export async function updateReceiptVoucherAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get("id")?.toString();
  const companyId = formData.get("companyId")?.toString();
  if (!id || !companyId) {
    return { status: "error", message: "معرف السند أو المنشأة مفقود" };
  }

  const existing = await container.receiptVoucherRepository.findById(id);
  if (!existing) {
    return { status: "error", message: "سند القبض غير موجود" };
  }
  if (existing.invoiceId) {
    return { status: "error", message: "لا يمكن تعديل سند قبض مرتبط بفاتورة مصدرة آلياً" };
  }

  const customerId = formData.get("customerId")?.toString();
  const voucherDate = formData.get("voucherDate")?.toString();
  const amountRaw = formData.get("amount")?.toString();
  const paymentMethod = formData.get("paymentMethod")?.toString() as "cash" | "bank_transfer" | "other";
  const reference = formData.get("reference")?.toString() || undefined;
  const notes = formData.get("notes")?.toString() || undefined;

  const amount = amountRaw ? Math.round(parseFloat(amountRaw) * 100) : undefined;

  const parsed = receiptVoucherUpdateSchema.safeParse({
    customerId,
    voucherDate,
    amount,
    paymentMethod,
    reference,
    notes,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "بيانات سند القبض غير صحيحة",
    };
  }

  try {
    await container.receiptVoucherRepository.update(id, parsed.data);
    revalidatePath(`/c/${companyId}/receipts`);
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "فشل تعديل سند القبض",
    };
  }
}

