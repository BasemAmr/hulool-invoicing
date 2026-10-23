import { eq, desc, sql } from "drizzle-orm";
import type { Database, Tx } from "@/application/tx";
import { receiptVouchers } from "@/infrastructure/database/schema";
import type {
  ReceiptVoucherRecord,
  ReceiptVoucherRepository,
} from "@/application/ports/receipt-voucher-repository";
import type { ReceiptVoucherCreateInput, ReceiptVoucherUpdateInput } from "@/domain/contracts";
import type { CompanyId } from "@/domain/branding";
import { halalas } from "@/domain/value-objects/money";

function mapReceiptVoucherRow(
  row: typeof receiptVouchers.$inferSelect
): ReceiptVoucherRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    customerId: row.customerId,
    invoiceId: row.invoiceId,
    voucherNumber: row.voucherNumber,
    voucherDate: row.voucherDate,
    amount: halalas(Math.round(parseFloat(row.amount) * 100)),
    paymentMethod: row.paymentMethod as "cash" | "bank_transfer" | "other",
    reference: row.reference,
    notes: row.notes,
    qrPayload: row.qrPayload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ReceiptVoucherRepositoryImpl implements ReceiptVoucherRepository {
  constructor(private readonly db: Database) {}

  async create(input: ReceiptVoucherCreateInput, tx?: Tx): Promise<ReceiptVoucherRecord> {
    const voucherNumber = input.voucherNumber ?? `REC-${Date.now().toString().slice(-6)}`;
    const executor = tx ?? this.db;
    const [row] = await executor
      .insert(receiptVouchers)
      .values({
        companyId: input.companyId,
        customerId: input.customerId,
        invoiceId: input.invoiceId ?? null,
        voucherNumber,
        voucherDate: input.voucherDate,
        amount: (input.amount / 100).toFixed(2),
        paymentMethod: input.paymentMethod,
        reference: input.reference,
        notes: input.notes,
      })
      .returning();
    if (!row) throw new Error("Failed to create receipt voucher");
    return mapReceiptVoucherRow(row);
  }

  async update(
    id: string,
    input: ReceiptVoucherUpdateInput,
    tx?: Tx
  ): Promise<ReceiptVoucherRecord> {
    const executor = tx ?? this.db;
    const values: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (input.customerId !== undefined) values.customerId = input.customerId;
    if (input.voucherDate !== undefined) values.voucherDate = input.voucherDate;
    if (input.amount !== undefined) values.amount = (input.amount / 100).toFixed(2);
    if (input.paymentMethod !== undefined) values.paymentMethod = input.paymentMethod;
    if (input.reference !== undefined) values.reference = input.reference;
    if (input.notes !== undefined) values.notes = input.notes;

    const [row] = await executor
      .update(receiptVouchers)
      .set(values)
      .where(eq(receiptVouchers.id, id))
      .returning();
    if (!row) throw new Error("سند القبض غير موجود");
    return mapReceiptVoucherRow(row);
  }

  async findById(id: string, tx?: Tx): Promise<ReceiptVoucherRecord | null> {
    const executor = tx ?? this.db;
    const [row] = await executor
      .select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.id, id));
    if (!row) return null;
    return mapReceiptVoucherRow(row);
  }

  async findByInvoiceId(invoiceId: string, tx?: Tx): Promise<ReceiptVoucherRecord | null> {
    const executor = tx ?? this.db;
    const [row] = await executor
      .select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.invoiceId, invoiceId))
      .orderBy(desc(receiptVouchers.createdAt))
      .limit(1);
    if (!row) return null;
    return mapReceiptVoucherRow(row);
  }

  async listByCompany(
    companyId: CompanyId | string,
    limit = 50,
    offset = 0
  ): Promise<ReceiptVoucherRecord[]> {
    const rows = await this.db
      .select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.companyId, companyId))
      .orderBy(desc(receiptVouchers.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapReceiptVoucherRow);
  }

  async listByCustomer(
    customerId: CompanyId | string,
    limit = 50,
    offset = 0
  ): Promise<ReceiptVoucherRecord[]> {
    const rows = await this.db
      .select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.customerId, customerId))
      .orderBy(desc(receiptVouchers.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapReceiptVoucherRow);
  }

  async countByCustomer(
    customerId: CompanyId | string
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(receiptVouchers)
      .where(eq(receiptVouchers.customerId, customerId));
    return row?.count ?? 0;
  }

  async delete(id: string, tx?: Tx): Promise<void> {
    const executor = tx ?? this.db;
    await executor.delete(receiptVouchers).where(eq(receiptVouchers.id, id));
  }
}
