import type { CompanyId, Halalas } from "@/domain/branding";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import type { Tx } from "../tx";

export interface CompanyRecord {
  id: CompanyId;
  nameAr: string;
  nameEn: string | null;
  vatNumber: string;
  crNumber: string | null;
  prefix: string;
  logoUrl: string | null;
  templateConfig: unknown;
  addressBuildingNumber: string | null;
  addressStreet: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressPostalCode: string | null;
  addressAdditionalNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRepository {
  create(
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
  ): Promise<CompanyRecord>;
  findById(id: CompanyId, tx: Tx): Promise<CompanyRecord | null>;
  list(limit: number, offset: number): Promise<CompanyRecord[]>;
}

// Re-export for use in port signatures without circular imports.
export type { CompanyId, Halalas, DocumentStatus };
