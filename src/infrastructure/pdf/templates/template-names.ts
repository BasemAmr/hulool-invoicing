import type { TemplateDefinition } from "./registry";

export interface TemplateNameOverride {
  ar?: string;
  en?: string;
}

export type TemplateOverridesMap = Record<string, TemplateNameOverride>;

/**
 * Resolves the display names for a given template definition against any company overrides.
 */
export function resolveTemplateName(
  template: { id: string; nameAr: string; nameEn: string },
  overrides?: TemplateOverridesMap | null
): { nameAr: string; nameEn: string; isOverridden: boolean } {
  const o = overrides?.[template.id];
  const ar = o?.ar?.trim();
  const en = o?.en?.trim();
  return {
    nameAr: ar ? ar : template.nameAr,
    nameEn: en ? en : template.nameEn,
    isOverridden: Boolean(ar || en),
  };
}

/**
 * Returns a list of templates with their Arabic and English names resolved with company overrides.
 */
export function applyTemplateNames(
  templates: TemplateDefinition[],
  overrides?: TemplateOverridesMap | null
): TemplateDefinition[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return templates;
  }
  return templates.map((t) => {
    const resolved = resolveTemplateName(t, overrides);
    return {
      ...t,
      nameAr: resolved.nameAr,
      nameEn: resolved.nameEn,
    };
  });
}
