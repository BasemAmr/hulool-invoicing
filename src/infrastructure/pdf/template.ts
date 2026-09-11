import {
  documentTemplateConfigSchema,
  type DocumentTemplateConfig,
} from "@/domain/contracts";

/**
 * Default template — one parametric master layout absorbs the 30–40 client
 * themes later via companies.template_config JSON overrides.
 */
export const DEFAULT_TEMPLATE_CONFIG: DocumentTemplateConfig = {
  primaryColor: "#0F766E",
  accentColor: "#134E4A",
  showLogo: true,
  footerNoteAr: "شكراً لتعاملكم معنا",
  footerNoteEn: "Thank you for your business",
  titleAr: "فاتورة ضريبية",
  titleEn: "TAX INVOICE",
};

/**
 * Merge company.templateConfig (unknown JSON) over defaults.
 * Invalid / missing config falls back silently to defaults — never blocks PDF.
 */
export function resolveTemplateConfig(
  raw: unknown,
): DocumentTemplateConfig {
  if (raw === null || raw === undefined) {
    return DEFAULT_TEMPLATE_CONFIG;
  }
  const parsed = documentTemplateConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_TEMPLATE_CONFIG;
  }
  return parsed.data;
}
