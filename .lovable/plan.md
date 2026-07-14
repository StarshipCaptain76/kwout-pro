## Goal

Ensure every list-style Supabase read fetches ALL rows, not just the PostgREST default first 1000. The expenses sync path was already fixed; several server-side aggregation queries still cap at 1000 and silently under-count.

## Queries to fix

**`src/lib/admin.functions.ts` (platform admin dashboard)** — aggregates across all users, easily exceeds 1000 rows:
- `subscriptions` (line 99) — one row per user
- `docs` (line 154) — quotes + invoices across the whole platform (highest risk)
- `expenses` (line 197) — all expenses across the platform
- `workspaces` (line 207)
- `company_profile` (line 212)

**`src/lib/payslips.functions.ts`**:
- `listPayslips` (line 300) — grows every pay cycle
- Commission docs read (line 190) — filtered by staff + paid + date range, but a long-tenured staff member can still exceed 1000 paid docs

**Already fixed** — `src/lib/sync.ts` pages all six workspace tables (catalog_items, customers, docs, expenses, expense_categories, company_profile).

**Bounded / safe** — `src/lib/staff.functions.ts` (per-workspace staff/roles), `src/lib/subscription.functions.ts` (single-user reads), all write/upsert/delete calls.

## Approach

1. Add a small shared helper `fetchAllRows(builder)` in a new `src/lib/pagination.server.ts` that loops `.range(from, from + 999)` until a short page is returned. Server-only, so it can live in a `.server.ts` file.
2. Wrap each of the 7 queries above to use it. Keep column projections and filters identical — only the fetch loop changes.
3. Typecheck via `tsgo --noEmit`.

## Non-goals

- No schema changes, no new indexes, no UI changes.
- No changes to `staff.functions.ts` or `subscription.functions.ts` (bounded).
- No client-side changes (client store already receives fully-paged data from `sync.ts`).
