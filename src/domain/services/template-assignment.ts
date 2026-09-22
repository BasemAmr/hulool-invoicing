import type { Database } from "@/infrastructure/database";
import { companySettings, invoices, companies } from "@/infrastructure/database/schema";
import { TEMPLATES_LIST } from "@/infrastructure/pdf/templates/registry";

/**
 * Finds the next unique template in sequence (1..N) that is not currently
 * assigned to or used by any company.
 *
 * Accounts for existing companies having non-sequential/scattered templates:
 * it collects all template IDs in use across company settings and existing invoices,
 * and iterates TEMPLATES_LIST in order to pick the lowest-indexed unused template.
 *
 * If all templates have been assigned at least once, it cycles through
 * TEMPLATES_LIST based on the total company count.
 */
export async function getNextAvailableTemplateId(db: Database): Promise<string> {
  const [settingsRows, invoiceRows] = await Promise.all([
    db.select({ templateId: companySettings.defaultTemplateId }).from(companySettings),
    db.selectDistinct({ templateId: invoices.templateId }).from(invoices),
  ]);

  const usedTemplateIds = new Set<string>();
  for (const row of settingsRows) {
    if (row.templateId) usedTemplateIds.add(row.templateId);
  }
  for (const row of invoiceRows) {
    if (row.templateId) usedTemplateIds.add(row.templateId);
  }

  // Find the first template in sequence that is not yet used by any company
  for (const template of TEMPLATES_LIST) {
    if (!usedTemplateIds.has(template.id)) {
      return template.id;
    }
  }

  // Fallback when all templates are exhausted: cycle sequentially based on total company count
  const allCompanies = await db.select({ id: companies.id }).from(companies);
  const cycleIndex = allCompanies.length % TEMPLATES_LIST.length;
  return TEMPLATES_LIST[cycleIndex]?.id || TEMPLATES_LIST[0]!.id;
}
