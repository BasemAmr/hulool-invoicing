import { and, desc, eq } from "drizzle-orm";

import { asCompanyId, type CompanyId } from "@/domain/branding";
import type { CompanyRepository } from "@/application/ports/company-repository";
import type { CompanyRecord } from "@/application/ports/company-repository";
import type { Database, Tx } from "@/application/tx";
import { companies } from "../schema";

type CompanyRow = typeof companies.$inferSelect;

function mapCompanyRow(row: CompanyRow): CompanyRecord {
  return {
    id: asCompanyId(row.id),
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    vatNumber: row.vatNumber,
    crNumber: row.crNumber,
    prefix: row.prefix,
    logoUrl: row.logoUrl,
    templateConfig: row.templateConfig,
    addressBuildingNumber: row.addressBuildingNumber,
    addressStreet: row.addressStreet,
    addressDistrict: row.addressDistrict,
    addressCity: row.addressCity,
    addressPostalCode: row.addressPostalCode,
    addressAdditionalNumber: row.addressAdditionalNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CompanyRepositoryImpl implements CompanyRepository {
  constructor(private readonly db: Database) {}

  async create(
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string;
      crNumber: string | null;
      prefix: string;
      logoUrl: string | null;
      addressBuildingNumber: string | null;
      addressStreet: string | null;
      addressDistrict: string | null;
      addressCity: string | null;
      addressPostalCode: string | null;
      addressAdditionalNumber: string | null;
    },
    now: Date,
  ): Promise<CompanyRecord> {
    const [row] = await this.db
      .insert(companies)
      .values({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        vatNumber: input.vatNumber,
        crNumber: input.crNumber,
        prefix: input.prefix,
        logoUrl: input.logoUrl,
        addressBuildingNumber: input.addressBuildingNumber,
        addressStreet: input.addressStreet,
        addressDistrict: input.addressDistrict,
        addressCity: input.addressCity,
        addressPostalCode: input.addressPostalCode,
        addressAdditionalNumber: input.addressAdditionalNumber,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert company — no row returned");
    }
    return mapCompanyRow(row);
  }

  async findById(id: CompanyId, tx?: Tx): Promise<CompanyRecord | null> {
    const executor = tx ?? this.db;
    const [row] = await executor
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    if (!row) return null;
    return mapCompanyRow(row);
  }

  async list(limit: number, offset: number): Promise<CompanyRecord[]> {
    const rows = await this.db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapCompanyRow);
  }
}

// Local alias: keeps port signatures readable without importing branding twice.

