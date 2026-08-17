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
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export async function createDraftInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawItems = formData.get("items");
  let items: RawItem[];
  try {
    items = typeof rawItems === "string" ? (JSON.parse(rawItems) as RawItem[]) : [];
  } catch {
    return { status: "error", message: "تعذّر قراءة بنود الفاتورة" };
  }

  const input = {
    companyId: String(formData.get("companyId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: nonEmpty(formData.get("dueDate")),
    notes: nonEmpty(formData.get("notes")),
    items,
  };

  let invoiceId: string;
  try {
    const draft = await new CreateDraftInvoice(
      container.invoiceRepository,
    ).execute(input);
    invoiceId = draft.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      return { status: "error", message: error.message };
    }
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
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

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}
