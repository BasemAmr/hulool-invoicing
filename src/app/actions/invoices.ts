"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { invoices } from "@/infrastructure/database/schema";
import { TEMPLATES_REGISTRY } from "@/infrastructure/pdf/templates/registry";
import { CreateDraftInvoice } from "@/application/use-cases/create-draft-invoice";
import { IssueInvoice } from "@/application/use-cases/issue-invoice";
import { DomainError, ValidationError } from "@/domain/errors";
import { halalas, priceStringToHalalas } from "@/domain/value-objects/money";
import type { ActionState } from "./types";

const container = createContainer(db);

/**
 * Serialized line item coming from the client builder.
 * unitPrice is the full-precision SAR decimal string from the hidden input
 * (e.g. "17.95319") — NOT halalas. Legacy numeric JSON payloads may still
 * carry halalas integers; the Zod union in contracts accepts both.
 */
interface RawItem {
  savedProductId?: string;
  saveToProducts?: boolean;
  description: string;
  quantity: number;
  unitPrice: string | number;
  vatRate: number;
  discountAmount: number;
}

/** Convert a RawItem unit price to halalas for the products catalog (numeric(15,2)). */
function rawUnitPriceToHalalas(unitPrice: string | number): number {
  if (typeof unitPrice === "string") {
    return priceStringToHalalas(unitPrice.trim() || "0");
  }
  return halalas(unitPrice);
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
          unitPrice: rawUnitPriceToHalalas(item.unitPrice),
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

    // Business rule (2026-09): every invoice is published immediately.
    // The draft toggle was removed from the UI, so issuance is mandatory
    // here — and its error must surface instead of silently leaving a
    // draft behind (the old silent catch is what made new invoices appear
    // to "reuse" INV-00001: the issue failed, the draft kept a null number,
    // and the form's cosmetic PREFIX-00001 never advanced).
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
          unitPrice: rawUnitPriceToHalalas(item.unitPrice),
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
    // Snapshot status before update: drafts get issued after saving,
    // already-issued invoices stay issued but need QR + receipt refresh
    // because totals/customer may have changed.
    const { asInvoiceId } = await import("@/domain/branding");
    const before = await container.invoiceRepository.findByIdWithItems(
      asInvoiceId(invoiceId),
    );
    const wasIssued = before?.status === "issued";

    const { UpdateDraftInvoice } = await import("@/application/use-cases/update-draft-invoice");
    await new UpdateDraftInvoice(container.invoiceRepository).execute(input);

    if (!wasIssued) {
      // Former draft (or legacy draft rows): publish it now. Errors surface.
      await new IssueInvoice(
        container.invoiceRepository,
        container.companyRepository,
        container.sequenceService,
        container.clock,
        container.idempotencyStore,
        container.db,
        container.receiptVoucherRepository,
      ).execute({ invoiceId });
    } else {
      // Issued invoice was edited: rebuild ZATCA QR (totals changed) and
      // sync the linked receipt voucher amount. Best-effort but logged —
      // the totals edit itself already succeeded above.
      try {
        const { buildQrPayload } = await import("@/domain/services/zatca-qr-service");
        const after = await container.invoiceRepository.findByIdWithItems(
          asInvoiceId(invoiceId),
        );
        const company = after
          ? await container.companyRepository.findById(after.companyId)
          : null;
        if (after && company) {
          const qrPayload = buildQrPayload({
            sellerName: company.nameAr,
            vatNumber: company.vatNumber,
            timestampIso: new Date().toISOString(),
            invoiceTotal: after.total,
            vatTotal: after.vatAmount,
          });
          await db
            .update(invoices)
            .set({ qrPayload, updatedAt: new Date() })
            .where(eq(invoices.id, invoiceId));
          const voucher =
            await container.receiptVoucherRepository.findByInvoiceId(invoiceId);
          if (voucher) {
            await container.receiptVoucherRepository.delete(voucher.id);
            await container.receiptVoucherRepository.create({
              companyId: after.companyId as unknown as string,
              customerId: after.customerId as unknown as string,
              invoiceId,
              voucherDate: after.issueDate,
              amount: after.total as unknown as number,
              paymentMethod: "other",
              reference: after.invoiceNumber ?? undefined,
              notes: `سند قبض للفاتورة رقم ${after.invoiceNumber ?? ""}`,
            } as never);
          }
        }
      } catch (qrError) {
        console.error("Failed to refresh QR/receipt after editing issued invoice:", qrError);
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
      // Full-precision SAR string straight from the hidden input — NEVER
      // parseFloat/toFixed(2) here: that was the 5368-vs-5367.05 truncation
      // (17.95319 → 17.95 before ×260). Exact rounding happens once, in the
      // use-case via lineSubtotalHalalasExact/priceStringToHalalas.
      const unitPrice = String(formData.get(`items[${idx}].unitPrice`) ?? "").trim() || "0";
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


/**
 * Persist a template change from the invoice preview template picker.
 * Presentation-only: safe for both draft and issued invoices (totals untouched).
 */
export async function updateInvoiceTemplateAction(
  invoiceId: string,
  templateId: string,
  companyId?: string,
): Promise<ActionState> {
  if (!invoiceId) {
    return { status: "error", message: "معرّف الفاتورة مفقود" };
  }
  if (!templateId || !(templateId in TEMPLATES_REGISTRY)) {
    return { status: "error", message: "القالب المختار غير معروف" };
  }

  try {
    const updated = await db
      .update(invoices)
      .set({ templateId, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning({ id: invoices.id });
    if (updated.length === 0) {
      return { status: "error", message: "الفاتورة غير موجودة" };
    }
  } catch {
    return { status: "error", message: "تعذر حفظ القالب المختار" };
  }

  if (companyId) {
    revalidatePath(`/c/${companyId}/invoices`);
    revalidatePath(`/c/${companyId}/invoices/${invoiceId}`);
  }
  revalidatePath(`/invoices/${invoiceId}`);
  return { status: "ok" };
}

export async function deleteDraftInvoiceAction(
  id: string,
  companyId?: string,
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  if (!id) {
    return { status: "error", message: "معرّف الفاتورة مفقود" };
  }

  // Resolve the owning company for cache invalidation. Callers should pass
  // companyId, but dashboard call sites historically omit it — look it up
  // so the company list never goes stale after a dashboard-initiated delete.
  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId) {
    try {
      const { asInvoiceId } = await import("@/domain/branding");
      const existing = await container.invoiceRepository.findByIdWithItems(
        asInvoiceId(id),
      );
      if (existing) {
        resolvedCompanyId = String(existing.companyId);
      }
    } catch {
      // Deliberate swallow: company resolution is only for revalidation.
      // If the lookup fails, the delete below still runs and surfaces the
      // real result; worst case is a stale list until the next refresh.
    }
  }

  try {
    // Voucher + line-item cleanup happens atomically inside
    // InvoiceRepository.deleteDraft (single transaction: vouchers →
    // items → parent). It used to be a best-effort voucher delete here
    // BEFORE the invoice delete, which was non-atomic: when the parent
    // delete then failed on the invoice_items FK, the voucher was already
    // gone. Kept out of this layer on purpose.
    const { DeleteDraftInvoice } = await import("@/application/use-cases/delete-draft-invoice");
    await new DeleteDraftInvoice(container.invoiceRepository).execute({ id });
    if (resolvedCompanyId) {
      revalidatePath(`/c/${resolvedCompanyId}/invoices`);
      revalidatePath(`/c/${resolvedCompanyId}/invoices/${id}`);
    }
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    // Deliberate generic message: unexpected errors here are FK/DB
    // failures with no actionable detail for the user. Log server-side
    // so the real cause is still observable.
    console.error("deleteDraftInvoiceAction failed:", error);
    return { status: "error", message: "تعذر حذف الفاتورة" };
  }
}

/** Alias with published-invoice naming; same implementation, kept so both
 *  old (`deleteDraftInvoiceAction`) and new call sites work after merge. */
export const deleteInvoiceAction = deleteDraftInvoiceAction;

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : undefined;
}
