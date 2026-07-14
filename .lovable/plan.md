## Problem

Field-staff and manager accounts currently see everything because permission checks are almost never wired up:

- The `Shell` nav shows **Settings** to every signed-in user, and `/settings` has no role gate — a non-owner can open every tab (Company, Banking, Staff, Catalog, Billing…).
- `/expenses` and `/planner` never look at `currentStaff.role` or `useCan(...)`, so a field-staff user sees all workspace data.
- Home (`/`) shows owner-only KPIs and lists without gating.
- Only `docs`, `doc.$id`, `results`, `statements` do partial checks — inconsistent and easy to bypass.
- The staff permission editor in Settings has no rows for **Settings sub-sections**, so an owner can't grant/deny per-section access.

## Fix

### 1. Central gating hooks (`src/lib/store.ts` / `src/lib/permissions.ts`)
- Keep `useCan(action)` / `useIsOwner()` as the single source of truth.
- Add finer settings actions to `Action` and `PRESETS`:
  - `settings.view` (any settings access at all)
  - `settings.company`, `settings.banking`, `settings.billing`, `settings.appearance`, `settings.catalog`, `settings.expenses`, `settings.staff`, `settings.subscription`
- Presets: owner = all true; manager/staff = all false by default. Owner can tick individual sub-sections on per staff/manager in the Staff editor.

### 2. Staff permission editor (`src/components/app/StaffSection.tsx` + `permissions.ts` `ACTION_GROUPS`)
- Add a new "Settings access" group listing every `settings.*` sub-section as tickable overrides so an owner can grant a manager access to, e.g., Catalog + Billing only.
- `settings.staff` and `settings.subscription` remain owner-only (not shown as tickable, or shown disabled).

### 3. Nav gating (`src/components/app/Shell.tsx`)
- Desktop `nav` array and mobile `tabs` array: filter out `Settings` when `!useCan("settings.view")` (i.e. no sub-section granted and not owner).
- Same treatment for **Results** (`reports.viewOwn || reports.viewAll`), **Planner** (`planner.view`), **Expenses** (`expenses.addOwn || expenses.viewAll`).

### 4. Route-level guards
For each route, if the user lacks the minimum permission, render an "Access restricted" card instead of the page body (do not throw redirects — keeps back-button sane). Applies to:
- `/settings` — require `settings.view`; render each `TabsTrigger` + `TabsContent` conditionally on its `settings.<sub>` action. Filter the mobile `<Select>` list the same way.
- `/expenses` — require `expenses.addOwn || expenses.viewAll`; scope list to own rows when only `addOwn`.
- `/planner` — require `planner.view`; hide edit controls when `!planner.edit`.
- `/results` — already partially gated; add outer `reports.viewOwn` guard.
- `/statements` — already gated; keep.
- `/` (index) — hide owner-only KPI tiles/lists behind `reports.viewAll`; show a simplified "My jobs today" for field staff.

### 5. Server-side safety net
RLS today lets any workspace member read most workspace rows. Client gating hides UI but the API is still open. Add restrictive RLS so a field-staff user can only:
- `SELECT` docs where `assigned_to = auth.uid()` OR their role permits `jobs.viewAll` (encoded via a `has_workspace_permission(uid, workspace, action)` SQL function reading `staff_members.permissions` + role preset).
- `SELECT/INSERT` expenses restricted to own `user_id` unless `expenses.viewAll`.
- Block all writes to `company_profile`, `catalog_items`, `expense_categories`, `staff_members` unless the corresponding `settings.*` permission is granted.

This is the only way "restrictions actually work" — client-only gating is cosmetic.

### 6. QA
Sign in as `moove@mweb.co.za` (field staff) and verify:
- Settings tab is hidden in header + bottom bar.
- Direct navigation to `/settings` shows "Access restricted".
- `/expenses` shows only own rows; no "add category" / edit-any controls.
- `/planner` is read-only.
- Home hides workspace totals.
Repeat as a manager to confirm defaults + owner-granted overrides.

## Files to change

- `src/lib/permissions.ts` — new `settings.*` actions, presets, `ACTION_GROUPS` entry.
- `src/components/app/StaffSection.tsx` — render new group; keep `settings.staff` / `settings.subscription` owner-only.
- `src/components/app/Shell.tsx` — filter desktop nav + mobile tabs by permission.
- `src/routes/settings.tsx` — outer guard + per-tab filtering.
- `src/routes/expenses.tsx`, `src/routes/planner.tsx`, `src/routes/index.tsx` — add role/permission guards and scoped queries.
- New migration: `has_workspace_permission()` SQL function + restrictive RLS policies on `docs`, `expenses`, `catalog_items`, `expense_categories`, `company_profile`, `staff_members`.

No changes to auth, workspace switching, or the payments flow.
