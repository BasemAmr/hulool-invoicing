import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { asCustomerId, type CustomerId } from "@/domain/branding";
import type {
  CustomerRecord,
  CustomerRepository,
} from "@/application/ports/customer-repository";
import type { Database } from "@/application/tx";
import { customers, invoices } from "../schema";

type CustomerRow = typeof customers.$inferSelect;

function mapCustomerRow(row: CustomerRow): CustomerRecord {
  return {
    id: asCustomerId(row.id),
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    vatNumber: row.vatNumber,
    unifiedNumber: row.unifiedNumber,
    phone: row.phone,
    email: row.email,
    addressCity: row.addressCity,
    addressStreet: row.addressStreet,
    addressPostalCode: row.addressPostalCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private readonly db: Database) {}

  async create(
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string | null;
      unifiedNumber?: string | null;
      phone: string | null;
      email: string | null;
      addressCity: string | null;
      addressStreet: string | null;
      addressPostalCode?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord> {
    const [row] = await this.db
      .insert(customers)
      .values({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        vatNumber: input.vatNumber,
        unifiedNumber: input.unifiedNumber ?? null,
        phone: input.phone,
        email: input.email,
        addressCity: input.addressCity,
        addressStreet: input.addressStreet,
        addressPostalCode: input.addressPostalCode ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert customer — no row returned");
    }
    return mapCustomerRow(row);
  }

  async update(
    id: CustomerId,
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string | null;
      unifiedNumber?: string | null;
      phone: string | null;
      email: string | null;
      addressCity: string | null;
      addressStreet: string | null;
      addressPostalCode?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord> {
    const [row] = await this.db
      .update(customers)
      .set({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        vatNumber: input.vatNumber,
        unifiedNumber: input.unifiedNumber !== undefined ? input.unifiedNumber : undefined,
        phone: input.phone,
        email: input.email,
        addressCity: input.addressCity,
        addressStreet: input.addressStreet,
        addressPostalCode: input.addressPostalCode !== undefined ? input.addressPostalCode : undefined,
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning();
    if (!row) {
      throw new Error("Failed to update customer — customer not found");
    }
    return mapCustomerRow(row);
  }

  async delete(id: CustomerId): Promise<void> {
    await this.db.delete(customers).where(eq(customers.id, id));
  }

  async countInvoices(id: CustomerId): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.customerId, id));
    return result?.count ?? 0;
  }

  async findById(id: CustomerId): Promise<CustomerRecord | null> {
    const [row] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));
    if (!row) return null;
    return mapCustomerRow(row);
  }

  async list(
    search: string | null,
    limit: number,
    offset: number,
  ): Promise<CustomerRecord[]> {
    const where = search
      ? or(
          ilike(customers.nameAr, `%${search}%`),
          ilike(customers.nameEn, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.vatNumber, `%${search}%`),
          ilike(customers.unifiedNumber, `%${search}%`),
          ilike(customers.addressCity, `%${search}%`),
          ilike(customers.addressPostalCode, `%${search}%`),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapCustomerRow);
  }
}
