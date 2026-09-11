import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database";
import { companySettings } from "@/infrastructure/database/schema";
import type {
  CompanySettingsRecord,
  CompanySettingsRepository,
} from "@/application/ports/company-settings-repository";
import type { CompanySettingsInput } from "@/domain/contracts";
import type { CompanyId } from "@/domain/branding";

function mapCompanySettingsRow(
  row: typeof companySettings.$inferSelect
): CompanySettingsRecord {
  return {
    companyId: row.companyId,
    numberFormat: row.numberFormat as "ar" | "en",
    dateFormat: row.dateFormat,
    currencyCode: row.currencyCode,
    currencyPosition: row.currencyPosition as "before" | "after",
    thousandsSeparator: row.thousandsSeparator,
    decimalSeparator: row.decimalSeparator,
    decimalPlaces: row.decimalPlaces,
    defaultVatRate: parseFloat(row.defaultVatRate),
    paperSize: row.paperSize as "A4" | "Letter",
    paperOrientation: row.paperOrientation as "portrait" | "landscape",
    defaultTemplateId: row.defaultTemplateId || "simple_red",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CompanySettingsRepositoryImpl implements CompanySettingsRepository {
  constructor(private readonly db: Database) {}

  async getByCompanyId(
    companyId: CompanyId | string
  ): Promise<CompanySettingsRecord | null> {
    const [row] = await this.db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId));
    if (!row) return null;
    return mapCompanySettingsRow(row);
  }

  async upsert(input: CompanySettingsInput): Promise<CompanySettingsRecord> {
    const [row] = await this.db
      .insert(companySettings)
      .values({
        companyId: input.companyId,
        numberFormat: input.numberFormat,
        dateFormat: input.dateFormat,
        currencyCode: input.currencyCode,
        currencyPosition: input.currencyPosition,
        thousandsSeparator: input.thousandsSeparator,
        decimalSeparator: input.decimalSeparator,
        decimalPlaces: input.decimalPlaces,
        defaultVatRate: input.defaultVatRate.toFixed(4),
        paperSize: input.paperSize,
        paperOrientation: input.paperOrientation,
        defaultTemplateId: input.defaultTemplateId || "simple_red",
      })
      .onConflictDoUpdate({
        target: companySettings.companyId,
        set: {
          numberFormat: input.numberFormat,
          dateFormat: input.dateFormat,
          currencyCode: input.currencyCode,
          currencyPosition: input.currencyPosition,
          thousandsSeparator: input.thousandsSeparator,
          decimalSeparator: input.decimalSeparator,
          decimalPlaces: input.decimalPlaces,
          defaultVatRate: input.defaultVatRate.toFixed(4),
          paperSize: input.paperSize,
          paperOrientation: input.paperOrientation,
          defaultTemplateId: input.defaultTemplateId || "simple_red",
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert company settings");
    return mapCompanySettingsRow(row);
  }
}
