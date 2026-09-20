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
  clientEmployee: string | null;
  organizationType: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  logoFileId: string | null;
  backgroundFileId: string | null;
  signatureFileId: string | null;
  footerText: string | null;
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
      clientEmployee?: string | null;
      organizationType?: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      logoUrl: string | null;
      logoFileId: string | null;
      backgroundFileId: string | null;
      signatureFileId: string | null;
      footerText?: string | null;
      addressBuildingNumber: string | null;
      addressStreet: string | null;
      addressDistrict: string | null;
      addressCity: string | null;
      addressPostalCode: string | null;
      addressAdditionalNumber: string | null;
    },
    now: Date,
  ): Promise<CompanyRecord>;
  update(
    id: CompanyId,
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string;
      crNumber: string | null;
      prefix: string;
      clientEmployee?: string | null;
      organizationType?: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      logoUrl: string | null;
      logoFileId: string | null;
      backgroundFileId: string | null;
      signatureFileId: string | null;
      footerText?: string | null;
      addressBuildingNumber: string | null;
      addressStreet: string | null;
      addressDistrict: string | null;
      addressCity: string | null;
      addressPostalCode: string | null;
      addressAdditionalNumber: string | null;
    },
    now: Date,
  ): Promise<CompanyRecord>;
  delete(id: CompanyId): Promise<void>;
  countInvoices(id: CompanyId): Promise<number>;
  /** Pass a Tx inside use-case transactions; omit for plain reads. */

  findById(id: CompanyId, tx?: Tx): Promise<CompanyRecord | null>;
  list(limit: number, offset: number): Promise<CompanyRecord[]>;
}

// Re-export for use in port signatures without circular imports.
export type { CompanyId, Halalas, DocumentStatus };
