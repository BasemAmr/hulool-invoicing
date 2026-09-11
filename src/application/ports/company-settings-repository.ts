import type { CompanyId } from "@/domain/branding";
import type { CompanySettingsInput } from "@/domain/contracts";

export interface CompanySettingsRecord {
  companyId: string;
  numberFormat: "ar" | "en";
  dateFormat: string;
  currencyCode: string;
  currencyPosition: "before" | "after";
  thousandsSeparator: string;
  decimalSeparator: string;
  decimalPlaces: number;
  defaultVatRate: number;
  paperSize: "A4" | "Letter";
  paperOrientation: "portrait" | "landscape";
  defaultTemplateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettingsRepository {
  getByCompanyId(companyId: CompanyId | string): Promise<CompanySettingsRecord | null>;
  upsert(input: CompanySettingsInput): Promise<CompanySettingsRecord>;
}
