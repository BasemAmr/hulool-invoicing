import type { Halalas } from "@/domain/branding";
import type { SavedProductCreateInput, SavedProductUpdateInput } from "@/domain/contracts";

export interface SavedProductRecord {
  id: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  unitPrice: Halalas | null;
  vatRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedProductRepository {
  create(input: SavedProductCreateInput): Promise<SavedProductRecord>;
  findById(id: string): Promise<SavedProductRecord | null>;
  list(
    search?: string | null,
    limit?: number,
    offset?: number
  ): Promise<SavedProductRecord[]>;
  update(input: SavedProductUpdateInput): Promise<SavedProductRecord>;
  delete(id: string): Promise<void>;
}
