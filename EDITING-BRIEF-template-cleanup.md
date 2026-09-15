# Editing Brief — Template Picker Label Cleanup

- **Branch:** `chore/template-label-cleanup`
- **Base commit:** `dd38ff4` ("finally", main at worktree creation)
- **Worktree path:** `D:\_awad work\invoice app\hulool-invoicing-template-cleanup`
- **Status:** changes complete, **uncommitted**, nothing pushed. Main repo untouched.

## Goal recap

Picker must show Arabic-only labels: group headers without `(Company Chosen)` /
`(System Default)`, rows as `نموذج N` (+ existing `★` for company-chosen), no
English `(...)` anywhere in the picker.

## Files changed (all edits only in this worktree)

1. `src/infrastructure/pdf/templates/registry.ts` — root-cause data fix + display helpers:
   - Added `stripEnglishParenthetical()` / `getTemplateDisplayName()` (single source
     of truth for picker row labels; strips only Latin-containing `(...)`, keeps
     Arabic qualifiers like `(مع الشروط)`).
   - Renamed all 17 invoice `system_default` templates to generic
     `نموذج 1`..`نموذج 17` / `Template 1`..`Template 17` (IDs unchanged).
   - Renamed all 6 receipt `system_default` templates to generic
     `نموذج 1`..`نموذج 6` / `Receipt Template 1`..`Receipt Template 6` (IDs unchanged).
   - `company_chosen` entries already were `نموذج N` in `nameAr`; their `nameEn`
     kept as-is (internal only, no longer rendered).
2. `src/components/forms/company-settings-form.tsx` — removed `({nameEn})` spans
   from both selected-value cards; `optgroup` labels now come from
   `PARENT_CATEGORY_LABELS.*.ar` (Arabic only); options render
   `★ {displayName}` / `{displayName}`.
3. `src/components/drawers/template-browser-drawer.tsx` — same cleanup for the
   preview-drawer dropdown; dropped the redundant `{idx + 1}.` prefix on system
   rows (numbering now lives in `nameAr`); loading line uses the helper.
4. `src/components/forms/invoice-wizard-form.tsx` — flat template `<select>` now
   uses `getTemplateDisplayName(t)` (was already Arabic-only; helper is
   defense-in-depth, output unchanged for current data).

No files added or deleted. (`node_modules/` was installed in the worktree for
verification; it is gitignored, not part of the change.)

## Old vs new label logic

- Before (row): `★ {t.nameAr} ({t.nameEn})` → e.g. `★ نموذج 3 (Thermal POS Roll Receipt)`
  After: `★ {getTemplateDisplayName(t)}` → `★ نموذج 3`
- Before (group): `قوالب المنشأة المختارة (Company Chosen)` /
  `قوالب النظام الافتراضية (System Default)`
  After: `PARENT_CATEGORY_LABELS.company_chosen.ar` → `قوالب المنشأة المختارة`,
  `PARENT_CATEGORY_LABELS.system_default.ar` → `قوالب النظام الافتراضية`
- Before (selected card): `{nameAr}` + `({nameEn})` span → After: `{displayName}` only
- Before (system-default source): `nameAr: "نموذج بسيط أحمر"`, `nameEn: "Simple Red"`, …
  After: `nameAr: "نموذج 1"`, `nameEn: "Template 1"`, … (sequential in registry order)
- Edge case preserved: `نموذج 17 (مع الشروط)` vs `نموذج 17 (بدون شروط)` keep
  their Arabic qualifiers (verified by runtime check) so the two variants stay distinct.

## DB / seed / migration impact

- **None required.** Template names come from registry constants; the DB stores
  only template IDs (`defaultTemplateId`, `templateId`, defaults `"simple_red"`),
  and no ID was changed. Existing rows resolve to the new generic labels automatically.
- No seed re-run, no migration. `seed-admin.ts` / `seed-products.ts` contain no
  template names.

## How to verify

- UI: company settings → قالب الفاتورة / قالب سند القبض cards + `<select>`s;
  open `معاينة واختيار القالب` drawer dropdown; new-invoice wizard `القالب` select.
  Expect Arabic-only groups/rows; badges (`قالب مخصص للمنشأة` / `قالب نظام معتمد`)
  were already Arabic-only and untouched. RTL layout unchanged (only text shortened).
- Grep (should return nothing template-related):
  `Company Chosen|System Default` under `src/components` and `nameEn}` in picker files.
  (Remaining `nameEn` hits are product/customer/company fields — out of scope —
  plus inert `nameEn` values in the registry that are no longer rendered.)
- Automated: `pnpm typecheck` ✅ (clean),
  `pnpm vitest run src/infrastructure/pdf/templates/registry.test.ts` ✅ (3 passed),
  runtime `stripEnglishParenthetical` check ✅
  (`نموذج 3 (Thermal…)` → `نموذج 3`; `(مع الشروط)`/`(بدون شروط)` preserved).

## Conflicts / risks for merge

- `registry.ts`, `company-settings-form.tsx`, `template-browser-drawer.tsx`,
  `invoice-wizard-form.tsx` are the only touched files — if main touched the same
  picker/registry areas, expect textual conflicts (mechanical: keep Arabic-only
  rendering + helper).
- Numbering overlap is intentional per spec: invoice `system_default` is
  `نموذج 1..17` while `company_chosen` is `نموذج 1..20` (groups + `★` disambiguate);
  receipt pickers overlap `نموذج 1..6` vs `نموذج 1..3` the same way. The wizard's
  **flat** (ungrouped) invoice list therefore contains duplicate numbers across the
  two sets — flagged, not changed (grouping that list would exceed this task's scope).
- `PARENT_CATEGORY_LABELS.en` / `badgeEn` fields retained for type compat; nothing
  renders them in the picker anymore.
