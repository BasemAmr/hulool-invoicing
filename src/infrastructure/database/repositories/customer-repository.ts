import { desc, eq, ilike, or } from "drizzle-orm";

import { asCustomerId } from "@/domain/branding";
import type {
  CustomerRecord,
  CustomerRepository,
} from "@/application/ports/customer-repository";
import type { Database } from "@/application/tx";
import { customers } from "../schema";

type CustomerRow = typeof customers.$inferSelect;

function mapCustomerRow(row: CustomerRow): CustomerRecord {
  return {
    id: asCustomerId(row.id),
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    vatNumber: row.vatNumber,
    phone: row.phone,
    email: row.email,
    addressCity: row.addressCity,
    addressStreet: row.addressStreet,
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
      phone: string | null;
      email: string | null;
      addressCity: string | null;
      addressStreet: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord> {
    const [row] = await this.db
      .insert(customers)
      .values({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        vatNumber: input.vatNumber,
        phone: input.phone,
        email: input.email,
        addressCity: input.addressCity,
        addressStreet: input.addressStreet,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert customer — no row returned");
    }
    return mapCustomerRow(row);
  }

  async findById(id: ReturnType<typeof asCustomerId>): Promise<CustomerRecord | null> {
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
