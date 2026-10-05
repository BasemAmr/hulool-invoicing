# Drizzle Schema Expansion & End-to-End Type Safety Guide

This guide establishes the mandatory engineering standards for adding, modifying, and migrating database fields in **hulool-invoicing**. Any human engineer or AI agent working on database schemas must follow this playbook strictly to avoid silent data loss, non-interactive CI/CD deadlocks, and type-coercion bugs.

---

## 1. Executive Summary & Non-Interactive Migration Law

Adding a column in this codebase is never a simple one-line SQL change. It touches **9 vertical layers** under Clean Architecture:

```
schema.ts (Drizzle pgTable)
  ↓
application/ports/*-repository.ts (EntityRecord & Input interfaces)
  ↓
infrastructure/database/repositories/*-repository.ts (mapRow, insert, update)
  ↓
domain/contracts/index.ts (Zod schema: client + server validation)
  ↓
application/use-cases/* (Input validation & ?? null bridging)
  ↓
app/actions/* ('use server' FormData extraction & DirectAction variants)
  ↓
components/forms/* (useActionState, name= bindings, inline dialogs)
  ↓
application/dto.ts & PDF templates (Output presentation & rendering)
  ↓
Test Fixtures & Mock Builders (preview route & unit test fixtures)
```

### The Non-Interactive Command Matrix

When running in CI/CD, Docker, or automated AI/LLM environments, terminal interaction is disabled. Running interactive commands will freeze the process indefinitely.

| Workflow Goal | Command | Interactive? | Description & Context |
|---|---|:---:|---|
| **Custom Migration (Non-TTY Safe)** | `npx drizzle-kit generate --custom --name=add_<field>_to_<table>` | **NO** | Safest for AI/CI: avoids TTY column conflict prompts, creates timestamped SQL in `./drizzle`, and updates `_journal.json`. |
| **Auto-Diff Migration** | `npx drizzle-kit generate --name=add_<field>_to_<table>` | TTY Only | Diffs schema against snapshot; prompts on column rename conflicts (fails in non-TTY). |
| **Apply Versioned Migrations** | `npx drizzle-kit migrate` | **NO** | Replays unapplied migration files in journal order. |
| **App-Native Migration Replay** | `node --import=tsx src/infrastructure/database/migrate.ts` | **NO** | Runs `drizzle-orm/node-postgres/migrator` over `./drizzle`. |
| **Direct Schema Sync (Staging / Docker boot)** | `npx drizzle-kit push --force` | **NO** | Diffs `schema.ts` against Postgres directly. `--force` auto-approves all prompts. |
| **Bare Push (FORBIDDEN IN AUTOMATION)** | `drizzle-kit push` | **YES** | Prompts on stdin if it detects potential data loss or column shifts. **Hangs non-TTY sessions.** |

> [!CAUTION]
> **Never run bare `drizzle-kit push` in automated sessions or agent turns.** Always supply `--force` if pushing directly, or use `generate` + `migrate`.

---

## 2. Safe Schema DDL Conventions

File: `src/infrastructure/database/schema.ts`  
Config: `drizzle.config.ts`

1. **Naming:** Column property in TypeScript is `camelCase`; PostgreSQL column name is explicitly `snake_case`:
   ```typescript
   customField: text("custom_field"),
   ```
2. **Nullable / Optional Additive Fields:**
   ```typescript
   clientEmployee: text("client_employee"),
   ```
   Generates safe SQL: `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "client_employee" text;`
3. **Required Additive Fields (Mandatory Backfill):**
   When adding a `NOT NULL` column to a table that may already contain records, you **must** supply a `.default(...)`:
   ```typescript
   // Existing rows backfill to '00:00' automatically on migration
   issueTime: text("issue_time").notNull().default("00:00"),
   ```
   Generates safe SQL: `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issue_time" text DEFAULT '00:00' NOT NULL;`
   *(Omitting `.default(...)` causes PostgreSQL to reject the DDL if the table is non-empty).*
4. **Money Fields (The Money Law):**
   - In DB schema: `numeric("amount", { precision: 15, scale: 2 }).notNull()`
   - Never use `float`, `real`, or bare `integer` in the DB schema for currency.
   - Money is stored as a decimal string in Postgres and converted to integer `Halalas` inside the repository layer.

---

## 3. The 9-Layer Implementation Walkthrough

When adding a field `<field>` to entity `<entity>`, execute edits across all 9 layers in order:

### Layer 1: Database Schema (`src/infrastructure/database/schema.ts`)
Add the column to the appropriate `pgTable`:
```typescript
export const companies = pgTable("companies", {
  // ...
  newField: text("new_field"),
});
```

### Layer 2: Application Port (`src/application/ports/<entity>-repository.ts`)
Add `<field>` to the domain record interface and the input types:
```typescript
export interface CompanyRecord {
  // ...
  newField: string | null;
}

export interface CompanyRepository {
  create(input: { ...; newField?: string | null }, now: Date): Promise<CompanyRecord>;
  update(id: CompanyId, input: { ...; newField?: string | null }, now: Date): Promise<CompanyRecord>;
}
```

### Layer 3: Infrastructure Repository (`src/infrastructure/database/repositories/<entity>-repository.ts`)
Update:
1. `map<Entity>Row`: Coalesce undefined to null (`row.newField ?? null`).
2. `create`: Pass `newField: input.newField ?? null`.
3. `update`: Pass `newField: input.newField !== undefined ? input.newField : undefined` (or `input.newField ?? null`).
4. If searchable, add `ilike(<entity>s.<col>, \`%${search}%\`)` to `list()`.

```typescript
function mapCompanyRow(row: CompanyRow): CompanyRecord {
  return {
    // ...
    newField: row.newField ?? null,
  };
}
```

### Layer 4: Domain Contracts (`src/domain/contracts/index.ts`)
Add the field to the Zod schema. Inferred types (`<Entity>CreateInput`, `<Entity>UpdateInput`) automatically pick up the change:
```typescript
export const companyCreateSchema = z.object({
  // ...
  newField: z.string().optional(),
});
```

### Layer 5: Application Use Cases (`src/application/use-cases/create-<entity>.ts`, `update-<entity>.ts`)
Pass the validated value through to the repository with `?? null` bridging:
```typescript
const record = await this.companyRepository.create({
  // ...
  newField: data.newField ?? null,
}, now);
```

### Layer 6: Server Actions (`src/app/actions/<entity>s.ts`)
Extract from `FormData` or accept as direct typed arguments:
- Use `nonEmpty(formData.get("newField"))` for standard optional text.
- Use `westernNonEmpty(formData.get("newField"))` for numeric strings (VAT, phone, postal code) to automatically normalize Arabic-Indic digits (`٠-٩` → `0-9`).
- Update **all** action variants: `create<Entity>Action`, `update<Entity>Action`, and any `create<Entity>DirectAction`.

```typescript
const input = {
  // ...
  newField: nonEmpty(formData.get("newField")),
};
```

### Layer 7: Presentation UI (`src/components/forms/<entity>-form.tsx`)
Add form field bound to the matching `name`:
```tsx
<Field
  label="الحقل الجديد"
  name="newField"
  defaultValue={initialCompany?.newField ?? ""}
/>
```
> [!IMPORTANT]
> The JSX `name="newField"` attribute must **identically match** the key in `formData.get("newField")`.

### Layer 8: DTOs & PDF Templates (`src/application/dto.ts` & `src/infrastructure/pdf/templates/*`)
If the field is displayed on invoices or exported in API DTOs, update:
- `InvoiceDto` and `toInvoiceDto()` in `src/application/dto.ts`.
- The PDF template component props and address formatters.

### Layer 9: Test Mocks & Fixtures
Update all mock builders to satisfy the updated `CompanyRecord` or `CustomerRecord` types:
1. `src/app/api/documents/preview/pdf/route.ts` (`buildSampleCompany()`, `buildSampleCustomer()`).
2. `src/infrastructure/pdf/templates/templates-render.test.ts` (`mockCompany`, `mockCustomer`).
3. `src/application/use-cases/*.test.ts` (any local fake repository or test fixtures).

---

## 4. Special Case: The Client (`customers`) Schema

The `customers` table represents the bureau-wide customer book. It has unique characteristics that differ from `companies`:

### Multi-Action Architecture
Unlike other entities, `customers` has **4 server actions** in `src/app/actions/customers.ts`:
1. `createCustomerAction`: Standard page submission via `FormData`.
2. `createCustomerDirectAction`: Modal submission from the invoice creation wizard via typed JSON payload `{ nameAr: string; ... }`.
3. `updateCustomerAction`: Standard edit page submission via `FormData`.
4. `updateCustomerDirectAction`: Inline editing via typed JSON payload.

### Two Separate UI Implementations
1. `src/components/forms/customer-form.tsx`: Uses React 19 `useActionState(action, idleState)` with `<form action={formAction}>`.
2. `src/components/forms/inline-customer-dialog.tsx`: Renders inside the invoice wizard. **It intentionally uses a `<div>` with `useState` and calls `createCustomerDirectAction`** to prevent invalid nested `<form>` HTML hydration crashes.
   - It maintains its own local validation state (`handleSave`).
   - If you add a required field, you **must** add it to `inline-customer-dialog.tsx`, or users will be unable to create customers from inside the invoice wizard.

### Search Filtering
In `src/infrastructure/database/repositories/customer-repository.ts`:
```typescript
const where = search
  ? or(
      ilike(customers.nameAr, `%${search}%`),
      ilike(customers.nameEn, `%${search}%`),
      ilike(customers.phone, `%${search}%`),
      ilike(customers.vatNumber, `%${search}%`),
      ilike(customers.unifiedNumber, `%${search}%`),
      ilike(customers.addressCity, `%${search}%`),
      ilike(customers.addressPostalCode, `%${search}%`),
      // ADD NEW FIELD HERE IF SEARCHABLE:
      ilike(customers.newField, `%${search}%`),
    )
  : undefined;
```

---

## 5. Type Conversions & Nullability Matrix

Because values traverse from raw browser strings to Postgres primitives, follow this nullability matrix:

| Boundary | Type Representation | Conversion / Helper |
|---|---|---|
| Browser HTML Input | `""` or string | `<input name="code" />` |
| Server Action (`FormData`) | `FormDataEntryValue \| null` | `nonEmpty(formData.get("code"))` → `string \| undefined` |
| Arabic-Indic Digits (`٠-٩`) | String with eastern numerals | `westernNonEmpty(formData.get("vat"))` → Latin digits |
| Zod Contract (`domain/contracts`) | `z.string().optional()` | Results in `string \| undefined` |
| Use Case → Repository Input | `string \| null` | `data.code ?? null` |
| Database Column (`schema.ts`) | `text("code")` | Nullable Postgres `text` |
| Repository Row → Domain Record | `row.code ?? null` | Normalizes database `null` to `string \| null` |
| Domain Record → Form Input | `initialRecord?.code ?? ""` | Value for JSX `defaultValue` |

---

## 6. Common Pitfalls & Silent Failure Debugging

### Symptom 1: Value is saved as `NULL` despite filling the form
- **Cause A:** The JSX input `name="foo"` does not match `formData.get("foo")`.
- **Cause B:** Missed `nonEmpty(...)` in `app/actions/*.ts`.
- **Cause C:** Missing property mapping in `application/use-cases/*.ts` (Zod `safeParse` strips unknown keys).
- **Cause D:** Missing assignment in repository `insert()` or `update()` values object.

### Symptom 2: Form displays empty field on edit page
- **Cause:** Repository `map<Entity>Row()` did not map `row.newField`. The database has the value, but the returned record leaves it `undefined`.

### Symptom 3: `pnpm typecheck` fails in unrelated tests
- **Cause:** You updated `<Entity>Record`, but did not update `buildSample<Entity>()` in `src/app/api/documents/preview/pdf/route.ts` or `mock<Entity>` in `templates-render.test.ts`.

### Symptom 4: Modal customer creation fails with error in wizard
- **Cause:** You added a required field to `customerCreateSchema` in Zod, but did not add the corresponding field input to `src/components/forms/inline-customer-dialog.tsx`.

---

## 7. Standard Verification Checklist

Before opening a PR or claiming task completion:

1. **Migrate Non-Interactively:**
   ```powershell
   # Step 1: Generate migration file
   npx drizzle-kit generate --name=add_<field>_to_<table>
   
   # Step 2: Verify SQL in drizzle/NNNN_*.sql contains IF NOT EXISTS
   
   # Step 3: Run migration
   npx drizzle-kit migrate
   ```
2. **Typecheck Entire Monorepo:**
   ```powershell
   pnpm typecheck
   ```
3. **Run Test Suite:**
   ```powershell
   pnpm test
   ```
4. **End-to-End Validation:**
   - Create entity from UI form → verify database persistence.
   - Edit entity from UI form → verify persisted value populates the input.
   - (For customers) Create customer from invoice wizard modal dialog → verify creation succeeds without redirect.

---

## 8. LLM Feature Prompt Template

When instructing an AI assistant to add a field, provide this exact prompt:

```text
Follow the guidelines in docs/DRIZZLE_SCHEMA_EXPANSION_GUIDE.md:
1. Add field `<field_name>` (<type>) to table `<table_name>` in src/infrastructure/database/schema.ts.
2. Wire all 9 layers: port Record, repository mapRow/CRUD, Zod contracts, use cases, server actions (including DirectAction if customers), client UI forms, DTOs, and test fixtures (buildSample/mocks).
3. Execute the migration non-interactively using:
   npx drizzle-kit generate --name=add_<field_name>_to_<table_name>
   npx drizzle-kit migrate
4. Verify using `pnpm typecheck` and `pnpm test`. Never run bare `drizzle-kit push`.
```
