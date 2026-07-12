## Overview

Add staff/team support: the owner creates login accounts for staff, assigns each a role plus optional per-permission overrides, and can assign jobs (quotes/invoices) to them. Reports get a revenue-by-staff breakdown and month-over-month / year-over-year comparisons.

## Data model

New tables (backend):

- `staff_members` — one row per team member of a workspace
  - `workspace_owner_id` (= owner's auth user id), `user_id` (auth user, unique), `name`, `email`, `role` (`owner` / `manager` / `staff`), `permissions` (jsonb overrides), `active`
- `user_roles` — enum (`owner`, `manager`, `staff`) with security-definer `has_role()` helper (never store roles on profile)
- Security-definer helper `is_workspace_member(_owner_id uuid)` used by RLS

Existing tables (`docs`, `customers`, `catalog_items`, `expenses`, `company_profile`, `expense_categories`) currently gate by `owner_user_id = auth.uid()`. RLS is widened to `owner_user_id = auth.uid() OR is_workspace_member(owner_user_id)` so staff read/write the owner's workspace data. Field-level filtering (e.g. field staff only sees their own jobs) is applied in the app layer for the UI, since the tables share one dataset per workspace.

Add column `docs.assigned_to uuid` (nullable, references staff user) for job assignment.

## Permission model

Three presets:

- **Owner** — full access, cannot be removed. Auto-created for the account holder.
- **Manager** — everything except Staff management, Company/Banking settings, and deleting historical data.
- **Field staff** — only jobs assigned to them, log own expenses, view own reports.

Per-staff override tick-boxes (stored in `permissions` jsonb, default `{}` = use preset):

```text
Jobs        [ ] view all jobs (not just assigned)  [ ] create  [ ] edit  [ ] mark paid  [ ] delete
Expenses    [ ] add own  [ ] view all  [ ] edit any
Customers   [ ] view  [ ] add  [ ] edit
Catalog     [ ] view  [ ] edit
Reports     [ ] view own  [ ] view all staff
Planner     [ ] view  [ ] edit schedule
```

Each preset seeds the tick-boxes; owner ticks/unticks to override. Owner sees an "Effective permissions" summary.

## Server work (`createServerFn`, admin-loaded inside handler)

- `createStaffAccount({email, password, name, role, permissions})` — verifies caller is owner via `has_role`, calls `supabaseAdmin.auth.admin.createUser` (email confirmed), inserts `staff_members` and `user_roles`. Returns the temporary credentials to show once.
- `updateStaffMember({id, name?, role?, permissions?, active?})` — owner-only.
- `deleteStaffMember({id})` — owner-only; disables login via admin API and marks inactive.
- `listStaffMembers()` — returns all staff for the caller's workspace (owner or member).
- `resetStaffPassword({id, newPassword})` — owner-only.

## Client changes

**Store (`src/lib/store.ts`)**
- Add `staff: StaffMember[]`, `currentStaff: StaffMember | null` (resolved after sign-in).
- Add `assignedTo?: string` to `Doc`.
- Helper `can(action)` reading role + permission overrides.

**Sync (`src/lib/sync.ts`)**
- On sign-in, resolve which workspace the user belongs to. If they're a staff member (not owner), load the workspace-owner's data instead of their own; treat `owner_user_id` as the workspace id for reads and writes. Push writes with the workspace-owner id so RLS lets owner + all staff see them.
- Fetch staff list.

**Settings page (`src/routes/settings.tsx`)**
- New "Staff" section (owner-only): list members with role chip, add button, edit sheet with role dropdown + permission tick-boxes, remove.
- Add-staff sheet: name, email, temp password (generate button), role. On save show one-time credentials with "Copy" + "Send via WhatsApp" buttons.

**Doc editor (`src/routes/doc.$id.tsx`)**
- "Assigned to" dropdown near the customer block, populated from active staff. Owner + managers can reassign; field staff can only see (not change).

**Docs list (`src/routes/docs.tsx`) & Planner**
- Show assignee chip on each row. Add "All / Mine / Unassigned" filter. Field-staff view is auto-filtered to their own.

**Reports (`src/routes/results.tsx`)**
- New **Revenue by staff** card: table of staff → jobs paid, revenue, avg, % of total, plus a horizontal bar chart.
- New **Trends** panel with two comparison rows always visible:
  - **Month-over-month** — this calendar month vs previous; revenue, expenses, net, jobs paid.
  - **Year-over-year** — same period last year vs current selected range; same metrics.
  Each shown as value + delta % with up/down arrow, matching existing `Stat` styling.
- Reports respect permissions: field staff sees only their own numbers; managers/owner see everyone. Existing "vs previous period" logic stays.

**Route guards**
- Hide nav items the user cannot access (e.g. Settings → Staff for non-owners; Reports for staff without report permission).
- Action buttons are hidden or disabled based on `can()`.

## User-facing notes

- Owner sets up a staff member by entering their name, email, and a starter password. Staff logs in with those credentials and can change the password from Settings.
- All staff share the same workspace data (customers, catalog, expenses). Job visibility for field staff is limited to jobs assigned to them.
- Revenue-by-staff needs an assigned person on the job; unassigned jobs show under "Unassigned" in the report.
- Existing local-only data created before this change stays with the owner account.
