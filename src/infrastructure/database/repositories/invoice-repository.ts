import { and, asc, desc, eq } from "drizzle-orm";

import { asCompanyId, asCustomerId, asInvoiceId } from "@/domain/branding";
import type {
  CreateDraftInvoiceInput,
  InvoiceItemRecord,
  InvoiceListFilters,
  InvoiceRecord,
  InvoiceRepository,
  MarkIssuedInput,
} from "@/application/ports/invoice-repository";
import type { Database, Tx } from "@/application/tx";
import { NotFoundError } from "@/domain/errors";
import { fromDecimalString, toDecimalString } from "@/domain/value-objects/money";
import { invoices, invoiceItems } from "../schema";

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceItemRow = typeof invoiceItems.$inferSelect;

function mapItemRow(item: InvoiceItemRow): InvoiceItemRecord {
  return {
    position: item.position,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: fromDecimalString(item.unitPrice),
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
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    currency: inv.currency,
    subtotal: fromDecimalString(inv.subtotal),
    vatAmount: fromDecimalString(inv.vatAmount),
    total: fromDecimalString(inv.total),
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
          invoiceNumber: null,
          status: "draft",
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal: toDecimalString(input.subtotal),
          vatAmount: toDecimalString(input.vatAmount),
          total: toDecimalString(input.total),
          notes: input.notes,
          qrPayload: null,
          issuedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!inv) {
        throw new Error("Failed to insert invoice â€” no row returned");
      }

      const itemRows = await tx
        .insert(invoiceItems)
        .values(
          input.items.map((item) => ({
            invoiceId: inv.id,
            position: item.position,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: toDecimalString(item.unitPrice),
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

  async findByIdWithItems(
    id: ReturnType<typeof asInvoiceId>,
    tx: Tx,
  ): Promise<InvoiceRecord | null> {
    const [inv] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    if (!inv) return null;

    const items = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position));

    return mapInvoiceRow(inv, items);
  }

  async markIssued(
    id: ReturnType<typeof asInvoiceId>,
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
      throw new NotFoundError(`Invoice not found`);
    }

    const items = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position));

    return mapInvoiceRow(updated, items);
  }

  async listByCompany(
    companyId: ReturnType<typeof asCompanyId>,
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]> {
    const conditions = [eq(invoices.companyId, companyId)];
    if (filters.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(...conditions))
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
