import { and, asc, desc, eq } from "drizzle-orm";

import { asCompanyId, asCustomerId, asInvoiceId, type CompanyId, type InvoiceId } from "@/domain/branding";
import type {
  CreateDraftInvoiceInput,
  InvoiceItemRecord,
  InvoiceListFilters,
  InvoiceRecord,
  InvoiceRepository,
  MarkIssuedInput,
} from "@/application/ports/invoice-repository";
import type { Database, Tx } from "@/application/tx";
import { InvalidTransitionError, NotFoundError } from "@/domain/errors";
import { fromDecimalString, toDecimalString } from "@/domain/value-objects/money";
import { invoices, invoiceItems } from "../schema";

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceItemRow = typeof invoiceItems.$inferSelect;

function mapItemRow(item: InvoiceItemRow): InvoiceItemRecord {
  return {
    savedProductId: item.savedProductId,
    position: item.position,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: fromDecimalString(item.unitPrice),
    discountAmount: fromDecimalString(item.discountAmount),
    vatRate: Number(item.vatRate),
    lineSubtotal: fromDecimalString(item.lineSubtotal),
    lineVat: fromDecimalString(item.lineVat),
    lineTotal: fromDecimalString(item.lineTotal),
  };
}

function mapInvoiceRow(inv: InvoiceRow, items: InvoiceItemRow[]): InvoiceRecord {
  return {
    id: asInvoiceId(inv.id),
    companyId: asCompanyId(inv.companyId),
    customerId: asCustomerId(inv.customerId),
    templateId: inv.templateId || "simple_red",
    invoiceType: inv.invoiceType,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    currency: inv.currency,
    subtotal: fromDecimalString(inv.subtotal),
    vatAmount: fromDecimalString(inv.vatAmount),
    total: fromDecimalString(inv.total),
    terms: inv.terms,
    notes: inv.notes,
    qrPayload: inv.qrPayload,
    issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: items.map(mapItemRow),
  };
}

export class InvoiceRepositoryImpl implements InvoiceRepository {
  constructor(private readonly db: Database) {}

  async createDraft(
    input: CreateDraftInvoiceInput,
    now: Date,
  ): Promise<InvoiceRecord> {
    return this.db.transaction(async (tx) => {
      const [inv] = await tx
        .insert(invoices)
        .values({
          companyId: input.companyId,
          customerId: input.customerId,
          templateId: input.templateId || "simple_red",
          invoiceType: input.invoiceType,
          invoiceNumber: null,
          status: "draft",
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal: toDecimalString(input.subtotal),
          vatAmount: toDecimalString(input.vatAmount),
          total: toDecimalString(input.total),
          terms: input.terms,
          notes: input.notes,
          qrPayload: null,
          issuedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!inv) {
        throw new Error("Failed to insert invoice — no row returned");
      }

      const itemRows = await tx
        .insert(invoiceItems)
        .values(
          input.items.map((item) => ({
            invoiceId: inv.id,
            savedProductId: item.savedProductId ?? null,
            position: item.position,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: toDecimalString(item.unitPrice),
            discountAmount: toDecimalString(item.discountAmount),
            vatRate: String(item.vatRate),
            lineSubtotal: toDecimalString(item.lineSubtotal),
            lineVat: toDecimalString(item.lineVat),
            lineTotal: toDecimalString(item.lineTotal),
          })),
        )
        .returning();

      return mapInvoiceRow(inv, itemRows);
    });
  }

  async updateDraft(
    id: InvoiceId,
    input: CreateDraftInvoiceInput,
    now: Date,
  ): Promise<InvoiceRecord> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      if (!existing) {
        throw new NotFoundError("Invoice not found");
      }
      // Business rule (2026-09): published invoices are fully editable.
      // Only cancelled invoices stay locked; drafts + issued can be updated
      // in place (invoiceNumber/status/qr are preserved by the SET below —
      // QR is refreshed by the action layer after totals change).
      if (existing.status === "cancelled") {
        throw new InvalidTransitionError("لا يمكن تعديل فاتورة ملغاة");
      }

      const [updatedInv] = await tx
        .update(invoices)
        .set({
          companyId: input.companyId,
          customerId: input.customerId,
          templateId: input.templateId || existing.templateId || "simple_red",
          invoiceType: input.invoiceType,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal: toDecimalString(input.subtotal),
          vatAmount: toDecimalString(input.vatAmount),
          total: toDecimalString(input.total),
          terms: input.terms,
          notes: input.notes,
          updatedAt: now,
        })
        .where(eq(invoices.id, id))
        .returning();


      if (!updatedInv) {
        throw new NotFoundError("Invoice not found");
      }

      // Delete existing items and insert new ones
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      const newItemRows = await tx
        .insert(invoiceItems)
        .values(
          input.items.map((item) => ({
            invoiceId: id,
            savedProductId: item.savedProductId ?? null,
            position: item.position,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: toDecimalString(item.unitPrice),
            discountAmount: toDecimalString(item.discountAmount),
            vatRate: String(item.vatRate),
            lineSubtotal: toDecimalString(item.lineSubtotal),
            lineVat: toDecimalString(item.lineVat),
            lineTotal: toDecimalString(item.lineTotal),
          })),
        )
        .returning();

      return mapInvoiceRow(updatedInv, newItemRows);
    });
  }

  async deleteDraft(id: InvoiceId): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));

    if (!existing) {
      throw new NotFoundError("Invoice not found");
    }
    // Business rule (2026-09): any invoice (draft or published) can be
    // deleted from the table or preview. No status guard.

    await this.db.delete(invoices).where(eq(invoices.id, id));
  }

  async findByIdWithItems(
    id: InvoiceId,
    tx?: Tx,
  ): Promise<InvoiceRecord | null> {
    const executor = tx ?? this.db;
    const [inv] = await executor
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    if (!inv) return null;

    const items = await executor
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position));

    return mapInvoiceRow(inv, items);
  }

  async markIssued(
    id: InvoiceId,
    input: MarkIssuedInput,
    tx: Tx,
  ): Promise<InvoiceRecord> {
    const issuedDate = new Date(input.issuedAt);
    const [updated] = await tx
      .update(invoices)
      .set({
        invoiceNumber: input.invoiceNumber,
        status: "issued",
        qrPayload: input.qrPayload,
        issuedAt: issuedDate,
        updatedAt: issuedDate,
      })
      .where(eq(invoices.id, id))
      .returning();
    if (!updated) {
      throw new NotFoundError("Invoice not found");
    }

    const items = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position));

    return mapInvoiceRow(updated, items);
  }

  async listByCompany(
    companyId: CompanyId,
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]> {
    return this.listWithConditions(
      [eq(invoices.companyId, companyId)],
      filters,
      limit,
      offset,
    );
  }

  async listAll(
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]> {
    return this.listWithConditions([], filters, limit, offset);
  }

  /**
   * Shared list path. Items are fetched per-invoice: acceptable at MVP scale
   * (≤ DEFAULT_PAGE_SIZE invoices per page); revisit with a join if lists grow.
   */
  private async listWithConditions(
    companyConditions: ReturnType<typeof eq>[],
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]> {
    const conditions = [...companyConditions];
    if (filters.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    const rows = await this.db
      .select()
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const result: InvoiceRecord[] = [];
    for (const row of rows) {
      const items = await this.db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, row.id))
        .orderBy(asc(invoiceItems.position));
      result.push(mapInvoiceRow(row, items));
    }
    return result;
  }
}
