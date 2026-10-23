# Template Plan — New "نموذج شركة كنان" + Client Rename (standardized)

## Part A — Add new template "نموذج شركة كنان"

### A1. Create component
- `src/infrastructure/pdf/templates/kenan-company-template.tsx`
- Follow `simple-template.tsx` props contract; BiDi-safe (label/colon/value as separate Text nodes); single PDF page (scale height on overflow); exact raw numbers; title "فاتورة ضريبية"; conditional logo (no placeholder); issue date only; ZATCA QR only; no payment method/signature/item-code/unit columns; company + client fields per guidelines; totals + Tafqeet on `invoice.total`.

### A2. Register
- `registry.ts` → add `kenan_company` entry (company_chosen, modern, colors, isBilingual, descriptionAr). Name default "نموذج شركة كنان" / "Kenan Company Template".

### A3. Wire (refactor dispatcher to a map — cleaner than if-chain)
- `invoice-document.tsx`: replace the long `if (templateDef.id === ...)` chain with a lookup map:
  ```
  const TEMPLATE_COMPONENTS: Record<string, ComponentType<TemplateProps>> = { sahm_coral: SahmInvoiceTemplate, ... };
  const Specific = TEMPLATE_COMPONENTS[templateDef.id];
  if (Specific) return <Specific {...props} withTerms={...} />;
  ```
  Keep masdar `withTerms` handling via a small wrapper or props. Then fallback `switch (category)`.
- Add `kenan_company: KenanCompanyTemplate` to the map.

### A4. Tests
- `registry.test.ts`: count 38 → 39; add "kenan_company" to expectedIds.

## Part B — Client rename (standardized, no hardcoding, performant)

### B1. Data model (single source of truth)
- `schema.ts`: add to `company_settings`:
  `templateNameOverrides: jsonb("template_name_overrides").$type<Record<string, { ar?: string; en?: string }>>().default({})`
- Run `pnpm db:push`.

### B2. Port + repository
- `application/ports/company-settings-repository.ts`:
  - Add `templateNameOverrides: Record<string, { ar?: string; en?: string }>` to `CompanySettingsRecord`.
  - No new methods; rename flows through existing `upsert` (atomic full-map update).
- Repository maps the column (default `{}`).

### B3. Name resolver (no hardcoding)
- New `src/infrastructure/pdf/templates/template-names.ts`:
  ```
  export function resolveTemplateName(def, overrides) {
    const o = overrides?.[def.id];
    return { nameAr: o?.ar?.trim() || def.nameAr, nameEn: o?.en?.trim() || def.nameEn };
  }
  export function applyTemplateNames(templates, overrides) {
    return templates.map(t => ({ ...t, ...resolveTemplateName(t, overrides) }));
  }
  ```
- Drawer/UI use `applyTemplateNames(TEMPLATES_LIST, overrides)` instead of touching registry.

### B4. Server action (validated, atomic)
- `src/app/actions/templates.ts`:
  - `renameTemplate(companyId, templateId, nameAr?, nameEn?)`: Zod-validate templateId exists in registry, trim, reject empty; read current settings, merge into overrides map, `upsert`.
  - `resetTemplateName(companyId, templateId)`: delete key, upsert.
  - Return updated overrides.

### B5. UI (prop-driven, no per-open fetch)
- `TemplateBrowserDrawer` props: add `templateNameOverrides` (default `{}`) and `onRenameTemplate?: (templateId, nameAr?, nameEn?) => Promise<void>`.
- Compute `templatesList = applyTemplateNames(baseList, overrides)`.
- Display names via resolved list; loading text uses resolved active name.
- Rename UI: small pencil on active template → inline inputs + save/cancel + reset-to-default. On save, call `onRenameTemplate`, optimistically update local overrides state, revert on error.
- Parents pass overrides from already-fetched company settings and wire `onRenameTemplate` to the server action, then update their settings state. No extra fetch on drawer open.

### B6. Parents to update
- `company-settings-form.tsx`, `invoice-preview-client.tsx`, `invoice-wizard-form.tsx`: pass `templateNameOverrides={settings?.templateNameOverrides}` and `onRenameTemplate`. (Invoice wizard may not have settings; fall back to `{}` and disable rename or fetch settings once.)

## Rationale
- No hardcoded per-template name logic; resolver is generic.
- No per-open network fetch; overrides ride along with settings already loaded.
- Atomic upsert avoids partial-update races.
- Map-based dispatcher makes future templates a one-line registration.
