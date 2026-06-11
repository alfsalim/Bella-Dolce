---
name: tenant-scoping
description: Enforce multi-tenant data isolation on every DB read, write, and operation
---

# Tenant Scoping (Non-Negotiable)

Every byte of business data in g50-services belongs to exactly one tenant. Cross-tenant access is forbidden, enforced at BOTH the app layer and the database layer (RLS).

## Stack

Raw SQL via `PostgresDriver` (src/drivers/postgres.driver.ts) — no ORM, no Prisma. Column is `tenant_id` (snake_case, UUID).

## Schema rules

- Every tenant-scoped table MUST have a `tenant_id UUID NOT NULL` column (exceptions: global lookups with no tenant concept)
- Every tenant-scoped table MUST have an index on `tenant_id` (composite for hot paths: `(tenant_id, status)`, `(tenant_id, created_at)`, etc.)
- Every tenant-scoped table MUST have RLS enabled — see "Database-layer enforcement (RLS)" below. A new table without RLS is a defect.

## App-layer query rules

- All reads/updates/deletes MUST include `tenant_id` in the `WHERE` clause, in addition to relying on RLS — defense in depth.
- All writes go through `tenantSafeUpsert` (private method on `PostgresDriver`, see postgres.driver.ts:97). The SQL passed to it MUST:
  - Use `ON CONFLICT (...) DO UPDATE SET ... WHERE <table>.tenant_id = EXCLUDED.tenant_id`
  - This causes `rowCount === 0` on a cross-tenant PK collision, which `tenantSafeUpsert` turns into a `TenantIsolationError`.
- ❌ NEVER write a raw `INSERT ... ON CONFLICT DO UPDATE` outside `tenantSafeUpsert` for tenant-scoped tables.

## Source of `tenant_id`

- Always from `getRLSContext()` (src/middleware/rls-context.ts), populated via `setRLSContext(tenantId)` in src/app.ts after identity resolution.
- NEVER from request body / query string / client input.
- `setRLSContext` must be called before any DB call in a request — the driver's pool wrapper reads `getRLSContext()` and runs `SELECT set_config('app.current_tenant', tenantId, false)` on the connection before executing the query (postgres.driver.ts:76-91). If context is missing, `app.current_tenant` is unset and policies deny all rows (see point 4 below).

## Database-layer enforcement (RLS)

Every tenant-scoped table MUST have, matching the pattern in migrations 012 and 015:

1. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
2. `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;` (so even the table owner is subject to RLS)
3. Four policies covering SELECT, INSERT, UPDATE (USING + WITH CHECK), and DELETE.
4. Use the 2-arg form `current_setting('app.current_tenant', true)` (per migration 015), which returns `NULL` instead of raising when the setting is unset. Policy conditions must guard against NULL explicitly:
   ```sql
   current_setting('app.current_tenant', true) IS NOT NULL
     AND current_setting('app.current_tenant', true) <> ''
     AND tenant_id = (current_setting('app.current_tenant', true))::UUID
   ```
   With no `app.current_tenant` set, this evaluates to false for every row — fail-closed, zero rows visible/affected. Don't add a default/fallback that weakens this.

## Critical: RLS only engages for non-superuser roles

RLS (including `FORCE ROW LEVEL SECURITY`) is bypassed entirely for superusers, roles with `BYPASSRLS`, and table owners (unless `FORCE` is set). The app DB role is `g50_app` (non-superuser, non-bypassrls). Any RLS test or runtime connection that uses the admin/migration role will silently bypass RLS and give a false sense of security — always verify against `g50_app`.

## Enforcement checklist (before commit)

1. New table with `tenant_id`? Confirm RLS ENABLE + FORCE + all 4 policies are added in the same migration, using the fail-closed 2-arg `current_setting` pattern.
2. New query/mutation? Confirm `tenant_id` is in `WHERE`, and writes go through `tenantSafeUpsert`.
3. New API route/job? Confirm `setRLSContext(tenantId)` is called (directly or via middleware) before any DB call, sourced from authenticated identity — never client input.
4. Guardrail test (recommended, not yet in permanent suite — see tests/unit/rls-verification.spike.test.ts for the pattern): for any new RLS-bearing table, add a test connecting as `g50_app` that (a) confirms `pg_policies` has all 4 policies for the table, (b) confirms cross-tenant rows are invisible with tenant A context set, and (c) confirms zero rows are visible with no context set (fail-closed).

## When this skill applies

- Adding or modifying any tenant-scoped table or migration
- Writing or modifying any DB query in `src/drivers/postgres.driver.ts`
- Writing or modifying any API route or background job that touches tenant data
