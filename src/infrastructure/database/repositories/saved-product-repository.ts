import { eq, desc, or, ilike } from "drizzle-orm";
import type { Database } from "@/infrastructure/database";
import { savedProducts } from "@/infrastructure/database/schema";
import type {
  SavedProductRecord,
  SavedProductRepository,
} from "@/application/ports/saved-product-repository";
import type {
  SavedProductCreateInput,
  SavedProductUpdateInput,
} from "@/domain/contracts";
import { halalas } from "@/domain/value-objects/money";

function mapSavedProductRow(row: typeof savedProducts.$inferSelect): SavedProductRecord {
  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    description: row.description,
    unitPrice: row.unitPrice ? halalas(Math.round(parseFloat(row.unitPrice) * 100)) : null,
    vatRate: parseFloat(row.vatRate),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SavedProductRepositoryImpl implements SavedProductRepository {
  constructor(private readonly db: Database) {}

  async create(input: SavedProductCreateInput): Promise<SavedProductRecord> {
    const [row] = await this.db
      .insert(savedProducts)
      .values({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        description: input.description,
        unitPrice: input.unitPrice !== undefined ? (input.unitPrice / 100).toFixed(2) : null,
        vatRate: input.vatRate.toFixed(4),
        isActive: input.isActive ?? true,
      })
      .returning();
    if (!row) throw new Error("Failed to insert saved product");
    return mapSavedProductRow(row);
  }

  async findById(id: string): Promise<SavedProductRecord | null> {
    const [row] = await this.db
      .select()
      .from(savedProducts)
      .where(eq(savedProducts.id, id));
    if (!row) return null;
    return mapSavedProductRow(row);
  }

  async list(
    search?: string | null,
    limit = 100,
    offset = 0
  ): Promise<SavedProductRecord[]> {
    const where = search
      ? or(
          ilike(savedProducts.nameAr, `%${search}%`),
          ilike(savedProducts.nameEn, `%${search}%`),
          ilike(savedProducts.description, `%${search}%`),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(savedProducts)
      .where(where)
      .orderBy(desc(savedProducts.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapSavedProductRow);
  }

  async update(input: SavedProductUpdateInput): Promise<SavedProductRecord> {
    const [row] = await this.db
      .update(savedProducts)
      .set({
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        description: input.description,
        unitPrice: input.unitPrice !== undefined ? (input.unitPrice / 100).toFixed(2) : null,
        vatRate: input.vatRate.toFixed(4),
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(savedProducts.id, input.id))
      .returning();
    if (!row) throw new Error("Failed to update saved product");
    return mapSavedProductRow(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(savedProducts).where(eq(savedProducts.id, id));
  }
}
