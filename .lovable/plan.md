# Platform admin console (`/admin`)

A KWOUT-flavoured version of the neomatrix Admin dashboard, restricted to
`dawie@polka.co.za` and `julius@polka.co.za` — the two founders. Read-only,
one page, mobile-friendly, matches the existing app shell.

## Access control (two layers)

**Server (source of truth).** New server function `getAdminOverview` in
`src/lib/admin.functions.ts` uses `requireSupabaseAuth`, reads
`context.claims.email`, and throws 403 unless it is one of the two allowed
addresses. All queries then run through dynamically-imported `supabaseAdmin`
so we can read across every user (bypassing RLS by design — this is the
platform view). The allowlist lives in one constant at the top of the file.

**Client (UX only).** Route `src/routes/_authenticated/admin.tsx` uses the
managed `_authenticated` gate for sign-in, and a `beforeLoad` checks the
same email allowlist via `supabase.auth.getUser()`; non-allowed users are
redirected to `/`. Owners see a new "Admin" entry in the app menu; anyone
else does not.

Emails come straight from `auth.users` (Supabase-managed) — no schema
change, no role table entry needed.

## Metrics (all derived from existing tables)

Computed inside `getAdminOverview` with `supabaseAdmin` against
`auth.users`, `subscriptions`, `workspaces`, `docs`, `expenses`,
`staff_members`:

- **Hero KPIs**
  - MRR — active paying subscriptions × R100
  - Paying customers — count of `subscriptions.status = 'active'`
  - Trial users — count with active `trial_started_at` window
  - Total signups — `auth.users` count
  - New signups (30 d) — `auth.users.created_at >= now() - 30d`
  - Trial → Paid conversion % — active ÷ (active + expired trials to date)
- **Subscription pipeline** — horizontal bar: active / trial / past_due /
  cancelled / expired / none, from `subscriptions.status` + users with no
  subscription row.
- **Acquisition chart** — new signups by month for last 12 months (bar).
- **Cumulative users** — running total per month (area).
- **Activity signals** — docs created (30 d), invoices marked paid (30 d),
  GMV processed through KWOUT invoices (30 d, sum of paid `docs` totals),
  active workspaces in last 7 d (distinct `owner_user_id` with a doc/expense).
- **Top workspaces** — top 10 by invoices-issued count with company name
  (from `company_profile.data->>'name'`) and paid GMV.
- **Recent signups** — last 15 users: email, created_at, current sub status.

All computation is server-side; the page just renders the returned JSON.

## UI

New route file `src/routes/_authenticated/admin.tsx`, rendered inside the
existing `<Shell>` so header/nav match the app.

- Uses `useSuspenseQuery` + `queryOptions` (loader prefetches via
  `context.queryClient.ensureQueryData`) — canonical Query pattern.
- Charts with `recharts` (already installed).
- Layout: hero KPI strip → subscription pipeline + activity tiles →
  acquisition + cumulative charts → top-workspaces table → recent signups.
- Colour language: primary green accent (`#3FA34D`), muted card surfaces,
  no new tokens.
- `head()` sets `noindex` (owner-only page, keep it out of search).
- Loading + error boundaries per route rules.

## Menu entry

`src/components/app/Shell.tsx` — add an "Admin" link that only renders when
the current signed-in email is on the allowlist (small `useAdminAccess()`
hook that calls `supabase.auth.getUser()` and memoises the result).

## Files

- New: `src/lib/admin.functions.ts` — server function + email allowlist +
  Zod-validated inputs (revenue window select).
- New: `src/routes/_authenticated/admin.tsx` — page + client-side allowlist
  gate + charts.
- New: `src/hooks/use-admin-access.ts` — small hook powering the menu entry.
- Edit: `src/components/app/Shell.tsx` — conditional "Admin" nav item.

## Non-goals

- No writes, no impersonation, no destructive actions.
- No demo-tenant generator (neomatrix-specific; KWOUT doesn't need it).
- No schema changes and no new tables.
