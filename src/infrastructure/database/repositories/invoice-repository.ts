import { and, asc, desc, eq } from "drizzle-orm";

import { asCompanyId, asCustomerId, asInvoiceId, type CompanyId, type InvoiceId } from "@/domain/branding";
import type {
  CreateDraftInvoiceInput,
  InvoiceItemRecord,
  InvoiceListFilters,
  InvoiceRecord,
  InvoiceRepository,
  MarkIssuedInput,
  UpdateDraftInvoiceInput,
} from "@/application/ports/invoice-repository";
import type { Database, Tx } from "@/application/tx";
import { InvalidTransitionError, NotFoundError } from "@/domain/errors";
import { normalizeIssueTime } from "@/domain/services/invoice-datetime";
import { fromDecimalString, toDecimalString } from "@/domain/value-objects/money";
import { invoices, invoiceItems, receiptVouchers } from "../schema";

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
    // Legacy rows predate the column: the DB default backfills "00:00", but
    // null-guard here too so in-memory/older snapshots never leak undefined.
    issueTime: inv.issueTime ?? "00:00",
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
          // Normalize at the DB boundary: legacy callers omitting the time
          // (and any corrupt value) persist as midnight, never null/garbage.
          issueTime: normalizeIssueTime(input.issueTime),
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
    input: UpdateDraftInvoiceInput,
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
          // Same midnight fallback as createDraft: an omitted time on edit
          // (legacy callers) keeps a valid HH:MM instead of nulling the column.
          issueTime: normalizeIssueTime(input.issueTime),
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal: toDecimalString(input.subtotal),
          vatAmount: toDecimalString(input.vatAmount),
          total: toDecimalString(input.total),
          terms: input.terms,
          notes: input.notes,
          updatedAt: now,
          // Rename ONLY on explicit request: undefined (every legacy/auto
          // caller) leaves the stored number untouched, so the auto path is
          // byte-for-byte identical to before. A defined value comes
          // pre-validated + pre-checked from UpdateDraftInvoice; a concurrent
          // duplicate still hitting the unique constraint aborts this whole
          // transaction (parent UPDATE runs before the item delete/insert
          // below), so no partial write is possible.
          ...(input.invoiceNumber !== undefined
            ? { invoiceNumber: input.invoiceNumber }
            : {}),
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
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      if (!existing) {
        throw new NotFoundError("Invoice not found");
      }
      // Business rule (2026-09): any invoice (draft or published) can be
      // deleted from the table or preview. No status guard.

      // Children-before-parent ordering is mandatory: the live
      // `invoice_items.invoice_id` FK is ON DELETE NO ACTION (see
      // drizzle/0000 + snapshots; schema.ts declares cascade but the DB
      // was created without it), so deleting the parent first raises an
      // FK violation for every invoice that has lines — i.e. all of them.
      // Mirrors the existing updateDraft pattern (delete items, then act
      // on the parent) so the fix stays fixed regardless of DB state.
      // Receipt vouchers are deleted here too (same tx) instead of the
      // action layer: their FK is ON DELETE SET NULL, which would
      // otherwise leave an orphan voucher with a nulled invoice_id.
      await tx
        .delete(receiptVouchers)
        .where(eq(receiptVouchers.invoiceId, id));
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
    });
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

  async findByNumber(
    companyId: CompanyId,
    invoiceNumber: string,
    tx?: Tx,
  ): Promise<InvoiceRecord | null> {
    const executor = tx ?? this.db;
    const [inv] = await executor
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.invoiceNumber, invoiceNumber),
        ),
      );
    if (!inv) return null;

    const items = await executor
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, inv.id))
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
