"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { CreateDraftInvoice } from "@/application/use-cases/create-draft-invoice";
import { IssueInvoice } from "@/application/use-cases/issue-invoice";
import { DomainError, ValidationError } from "@/domain/errors";
import type { ActionState } from "./types";

const container = createContainer(db);

/** Serialized line item coming from the client builder (unitPrice in halalas). */
interface RawItem {
  savedProductId?: string;
  saveToProducts?: boolean;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
}

export async function createDraftInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const items = parseItemsFromFormData(formData);
  if (items.length === 0) {
    return { status: "error", message: "يجب إضافة بند واحد على الأقل في الفاتورة" };
  }

  // Handle auto-saving products if requested
  for (const item of items) {
    if (item.saveToProducts && !item.savedProductId) {
      try {
        const saved = await container.savedProductRepository.create({
          nameAr: item.description,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          isActive: true,
        });
        item.savedProductId = saved.id;
      } catch (err) {
        console.error("Failed to auto-save product from line item:", err);
      }
    }
  }

  const invoiceType =
    (formData.get("invoiceType") as "standard" | "simplified") ||
    (formData.get("isSimplified") === "true" ? "simplified" : "standard");
  const templateId = String(formData.get("templateId") ?? "simple_red");

  const input = {
    companyId: String(formData.get("companyId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    templateId,
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: nonEmpty(formData.get("dueDate")),
    notes: nonEmpty(formData.get("notes")),
    invoiceType,
    terms: nonEmpty(formData.get("terms")),
    items,
  };

  let invoiceId: string;
  try {
    const draft = await new CreateDraftInvoice(
      container.invoiceRepository,
    ).execute(input);
    invoiceId = draft.id;

    const actionValue = formData.get("_action");
    if (actionValue === "issue" || formData.get("status") === "issued") {
      try {
        await new IssueInvoice(
          container.invoiceRepository,
          container.companyRepository,
          container.sequenceService,
          container.clock,
          container.idempotencyStore,
          container.db,
          container.receiptVoucherRepository,
        ).execute({ invoiceId });
      } catch (issueError) {
        console.error("Failed to issue invoice immediately:", issueError);
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { status: "error", message: error.message };
    }
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const companyId = String(formData.get("companyId") ?? "");
  if (companyId) {
    revalidatePath(`/c/${companyId}/invoices`);
    revalidatePath(`/c/${companyId}/invoices/${invoiceId}`);
    redirect(`/c/${companyId}/invoices/${invoiceId}`);
  } else {
    revalidatePath("/invoices");
    redirect(`/invoices/${invoiceId}`);
  }
}

export async function issueInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) {
    return { status: "error", message: "معرّف الفاتورة مفقود" };
  }

  try {
    await new IssueInvoice(
      container.invoiceRepository,
      container.companyRepository,
      container.sequenceService,
      container.clock,
      container.idempotencyStore,
      container.db,
      container.receiptVoucherRepository,
    ).execute({ invoiceId });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function updateDraftInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const invoiceId = String(formData.get("id") ?? formData.get("invoiceId") ?? "");
  if (!invoiceId) {
    return { status: "error", message: "معرّف الفاتورة مفقود" };
  }

  const items = parseItemsFromFormData(formData);
  if (items.length === 0) {
    return { status: "error", message: "يجب إضافة بند واحد على الأقل في الفاتورة" };
  }

  // Handle auto-saving products if requested
  for (const item of items) {
    if (item.saveToProducts && !item.savedProductId) {
      try {
        const saved = await container.savedProductRepository.create({
          nameAr: item.description,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          isActive: true,
        });
        item.savedProductId = saved.id;
      } catch (err) {
        console.error("Failed to auto-save product from line item:", err);
      }
    }
  }

  const invoiceType =
    (formData.get("invoiceType") as "standard" | "simplified") ||
    (formData.get("isSimplified") === "true" ? "simplified" : "standard");
  const templateId = String(formData.get("templateId") ?? "simple_red");

  const input = {
    id: invoiceId,
    companyId: String(formData.get("companyId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    templateId,
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: nonEmpty(formData.get("dueDate")),
    notes: nonEmpty(formData.get("notes")),
    invoiceType,
    terms: nonEmpty(formData.get("terms")),
    items,
  };

  try {
    const { UpdateDraftInvoice } = await import("@/application/use-cases/update-draft-invoice");
    await new UpdateDraftInvoice(container.invoiceRepository).execute(input);

    const actionValue = formData.get("_action");
    if (actionValue === "issue" || formData.get("status") === "issued") {
      try {
        await new IssueInvoice(
          container.invoiceRepository,
          container.companyRepository,
          container.sequenceService,
          container.clock,
          container.idempotencyStore,
          container.db,
          container.receiptVoucherRepository,
        ).execute({ invoiceId });
      } catch (issueError) {
        console.error("Failed to issue invoice on update:", issueError);
      }
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const companyId = String(formData.get("companyId") ?? "");
  if (companyId) {
    revalidatePath(`/c/${companyId}/invoices`);
    revalidatePath(`/c/${companyId}/invoices/${invoiceId}`);
    redirect(`/c/${companyId}/invoices/${invoiceId}`);
  } else {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    redirect(`/invoices/${invoiceId}`);
  }
}

function parseItemsFromFormData(formData: FormData): RawItem[] {
  const rawJson = formData.get("items");
  if (typeof rawJson === "string") {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fall through to index parsing
    }
  }

  const items: RawItem[] = [];
  let idx = 0;
  while (formData.has(`items[${idx}].description`)) {
    const description = String(formData.get(`items[${idx}].description`) ?? "").trim();
    if (description) {
      const quantity = parseFloat(String(formData.get(`items[${idx}].quantity`) ?? "1")) || 1;
      const unitPrice = parseInt(String(formData.get(`items[${idx}].unitPrice`) ?? "0"), 10) || 0;
      const discountAmount = parseInt(String(formData.get(`items[${idx}].discountAmount`) ?? "0"), 10) || 0;
      const vatRate = parseFloat(String(formData.get(`items[${idx}].vatRate`) ?? "0.15")) || 0.15;
      const savedProductId = nonEmpty(formData.get(`items[${idx}].savedProductId`));
      const saveToProducts = formData.get(`items[${idx}].saveToProducts`) === "true";

      items.push({
        description,
        quantity,
        unitPrice,
        discountAmount,
        vatRate,
        savedProductId,
        saveToProducts,
      });
    }
    idx++;
  }
  return items;
}


export async function deleteDraftInvoiceAction(id: string): Promise<{ status: "success" } | { status: "error"; message: string }> {
  if (!id) {
    return { status: "error", message: "معرّف الفاتورة مفقود" };
  }

  try {
    const { DeleteDraftInvoice } = await import("@/application/use-cases/delete-draft-invoice");
    await new DeleteDraftInvoice(container.invoiceRepository).execute({ id });
    revalidatePath("/invoices");
    return { status: "success" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "تعذر حذف الفاتورة" };
  }
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}
