# Database

## Quick Commands
- Start the database: `pnpm db:up`
- Push the schema (interactive): `pnpm db:push`
- Apply migrations: `pnpm db:migrate`
- Open Drizzle Studio: `pnpm db:studio`

## Schema Modifications & Non-Interactive Migrations
For modifying schemas, adding new fields, or migrating in non-interactive CI/CD/AI environments, consult the authoritative guide:
👉 **[Drizzle Schema Expansion & Type Safety Guide](../../../docs/DRIZZLE_SCHEMA_EXPANSION_GUIDE.md)**

### Key Non-Interactive Commands:
- **Versioned Migration (Recommended):**
  ```bash
  npx drizzle-kit generate --name=add_<field>_to_<table>
  npx drizzle-kit migrate
  ```
- **Direct Push (Staging / Docker):**
  ```bash
  npx drizzle-kit push --force
  ```
  *(Never run bare `drizzle-kit push` in automation as it hangs waiting for stdin confirmation).*