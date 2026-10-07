import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { asCustomerId, type CustomerId } from "@/domain/branding";
import type {
  CustomerRecord,
  CustomerRepository,
} from "@/application/ports/customer-repository";
import type { Database } from "@/application/tx";
import { ValidationError } from "@/domain/errors";
import { formatDatabaseError } from "@/lib/format-db-error";
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
    clientEmployee: row.clientEmployee ?? null,
    addressCity: row.addressCity,
    addressDistrict: row.addressDistrict,
    addressStreet: row.addressStreet,
    addressBuildingNumber: row.addressBuildingNumber,
    addressPostalCode: row.addressPostalCode,
    addressAdditionalNumber: row.addressAdditionalNumber,
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
      clientEmployee?: string | null;
      addressCity: string | null;
      addressDistrict?: string | null;
      addressStreet: string | null;
      addressBuildingNumber?: string | null;
      addressPostalCode?: string | null;
      addressAdditionalNumber?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord> {
    try {
      const [row] = await this.db
        .insert(customers)
        .values({
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn?.trim() || null,
          vatNumber: input.vatNumber?.trim() || null,
          unifiedNumber: input.unifiedNumber?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          clientEmployee: input.clientEmployee?.trim() || null,
          addressCity: input.addressCity?.trim() || null,
          addressDistrict: input.addressDistrict?.trim() || null,
          addressStreet: input.addressStreet?.trim() || null,
          addressBuildingNumber: input.addressBuildingNumber?.trim() || null,
          addressPostalCode: input.addressPostalCode?.trim() || null,
          addressAdditionalNumber: input.addressAdditionalNumber?.trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to insert customer — no row returned");
      }
      return mapCustomerRow(row);
    } catch (err) {
      const pgErr = (err as { cause?: unknown })?.cause ?? err;
      if (pgErr && typeof pgErr === "object" && ("code" in pgErr || "constraint" in pgErr)) {
        throw new ValidationError(formatDatabaseError(err, "تعذر حفظ بيانات العميل", "customer"));
      }
      throw err;
    }
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
      clientEmployee?: string | null;
      addressCity: string | null;
      addressDistrict?: string | null;
      addressStreet: string | null;
      addressBuildingNumber?: string | null;
      addressPostalCode?: string | null;
      addressAdditionalNumber?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord> {
    try {
      const [row] = await this.db
        .update(customers)
        .set({
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn?.trim() || null,
          vatNumber: input.vatNumber?.trim() || null,
          unifiedNumber: input.unifiedNumber !== undefined ? (input.unifiedNumber?.trim() || null) : undefined,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          clientEmployee: input.clientEmployee !== undefined ? (input.clientEmployee?.trim() || null) : undefined,
          addressCity: input.addressCity?.trim() || null,
          addressDistrict: input.addressDistrict !== undefined ? (input.addressDistrict?.trim() || null) : undefined,
          addressStreet: input.addressStreet?.trim() || null,
          addressBuildingNumber: input.addressBuildingNumber !== undefined ? (input.addressBuildingNumber?.trim() || null) : undefined,
          addressPostalCode: input.addressPostalCode !== undefined ? (input.addressPostalCode?.trim() || null) : undefined,
          addressAdditionalNumber: input.addressAdditionalNumber !== undefined ? (input.addressAdditionalNumber?.trim() || null) : undefined,
          updatedAt: now,
        })
        .where(eq(customers.id, id))
        .returning();
      if (!row) {
        throw new Error("Failed to update customer — customer not found");
      }
      return mapCustomerRow(row);
    } catch (err) {
      const pgErr = (err as { cause?: unknown })?.cause ?? err;
      if (pgErr && typeof pgErr === "object" && ("code" in pgErr || "constraint" in pgErr)) {
        throw new ValidationError(formatDatabaseError(err, "تعذر تحديث بيانات العميل", "customer"));
      }
      throw err;
    }
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
          ilike(customers.addressDistrict, `%${search}%`),
          ilike(customers.addressPostalCode, `%${search}%`),
          ilike(customers.clientEmployee, `%${search}%`),
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
