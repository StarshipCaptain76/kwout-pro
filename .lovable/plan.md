# Plan

## 1. Settings tabs — mobile UI

The 8 tabs are forced into `grid-cols-8` on all viewports, which crushes labels on mobile.

Replace the tab bar with a responsive pattern:

- **Mobile (< sm)**: render a single `Select` (shadcn) as the tab switcher — full-width, one tap, always readable. Controlled `Tabs` via `value`/`onValueChange`.
- **Tablet (sm–lg)**: horizontal scrollable `TabsList` with `overflow-x-auto`, `flex`, `whitespace-nowrap` triggers, and subtle edge fade. Active tab auto-scrolls into view.
- **Desktop (lg+)**: keep the current `grid grid-cols-8` layout.

Change `Tabs` from `defaultValue` to controlled state so the mobile `Select` and desktop tabs stay in sync. No other Settings content changes.

## 2. Auto-create owner staff row on signup

Today, `resolveWorkspace` treats a user with no `staff_members` row as "owner" implicitly. Staff listing, payroll, and permission checks then miss the primary account as an actual staff member.

Fix: on signup, insert an owner `staff_members` row for the new user so they appear in Staff and can be paid/managed like any staff.

**Server function** — new `ensureOwnerStaff` in `src/lib/staff.functions.ts`:
- Middleware: `requireSupabaseAuth`.
- Idempotent: if a `staff_members` row exists for `user_id = auth.uid()`, return it.
- Else insert `{ workspace_owner_id: userId, user_id: userId, name: <from user metadata or email prefix>, email: <auth email>, role: 'owner', active: true, permissions: {} }`.
- Also insert into `user_roles` with role `admin` (via existing pattern) if not present, so `has_role` checks pass.

**Signup flow** — `src/routes/auth.tsx`:
- After a successful `signUp` (and after Google OAuth returns a session on `/auth` callback), call `ensureOwnerStaff` via `useServerFn` before navigating to `/`.
- For Google OAuth, hook into the existing post-auth session detection (session listener on `/auth`) so it also runs on first Google sign-in.

**Backward compatibility** — because it's idempotent, existing owner accounts get their staff row created on their next visit to `/auth` or via a lightweight call from `resolveWorkspace`: extend `resolveWorkspace` to auto-create the owner row if missing (single insert, ignore conflicts). This backfills existing users without a migration.

No schema changes required; `staff_members` already supports owner rows.

## Technical notes

- Controlled `Tabs`: `const [tab, setTab] = useState("subscription")`; pass `value={tab} onValueChange={setTab}`.
- Mobile select uses the same 8 values; label map defined once.
- `ensureOwnerStaff` uses the authenticated `supabase` client from context so RLS applies (owner inserting own row).
- Insert uses `.upsert(..., { onConflict: 'user_id,workspace_owner_id' })` or a `select().maybeSingle()` guard to stay idempotent.
