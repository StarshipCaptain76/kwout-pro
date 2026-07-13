
## The problem

Every user sees the same company profile, invoices, expenses, customers and catalog. The database and RLS policies are already correctly scoped per `owner_user_id` — the leak is client-side.

- The Zustand store in `src/lib/store.ts` uses `persist({ name: "app-store-v1" })` — a single localStorage key shared by every account that ever signs in on that browser/device.
- On sign-out we don't clear that persisted store.
- On the next sign-in, `loadAll()` in `src/lib/sync.ts` runs `mergeById(remote, prev.local)` for docs, customers, catalog, expenses and category names, then calls `pushDoc / pushExpense / pushCustomer / pushCatalogItem / pushExpenseCategory` for every "local-only" row (lines 411–415). Those rows get written into the newly signed-in user's workspace with their `owner_user_id`.
- Same story for the company profile: if the remote row is empty, the previous user's `company / banking / billing` from localStorage is kept and then pushed up via `pushCompanyProfile()` on the first mutation.

Net result: User B logs in on a device where User A was signed in and inherits — and permanently copies into their own account — User A's docs, customers, expenses, catalog and (until they save settings) company profile.

## Fix

Scope the persisted store to the current user, and stop treating a previous user's leftover local state as "anonymous data to upload".

### 1. Namespace the persisted store per user

In `src/lib/store.ts`, keep one Zustand store but store its persisted snapshot under a user-scoped key so switching accounts on a shared device can never cross-contaminate.

- Change `persist` to use a dynamic name resolved from the current auth user id, e.g. `app-store::<userId>` and `app-store::anon` before sign-in. Implement by giving `persist` a small custom `storage` adapter that reads/writes `localStorage.getItem(\`app-store::\${currentKey()}\`)`, where `currentKey()` reads a module-level variable updated by the sync layer.
- Expose `setPersistKey(userId: string | null)` from the store module. Sync calls it on `SIGNED_IN` (before hydrating) and on `SIGNED_OUT` (to switch back to the anon key).
- Keep `partialize` as-is (still strips `staff / currentUserId / currentStaff`).
- Migrate the legacy `app-store-v1` key once on first load for the anon slot only, so already-signed-in users don't lose in-flight local edits — but do not migrate it into any signed-in user slot.

### 2. Reset in-memory state on account change

In `src/lib/sync.ts`, in the `onAuthStateChange` handler and at initial boot:

- On `SIGNED_OUT`: call a new `useStore.getState().resetToDefaults()` action that clears `docs / expenses / customers / catalog / expenseCategories` (back to defaults) and resets `company / banking / billing / density / theme` to the built-in defaults. Then switch the persist key back to anon.
- On `SIGNED_IN` where `newUid !== state.userId` (any account change, including first sign-in after a previous session): call `resetToDefaults()` first, switch the persist key to the new user, then run `resolveAndLoad()`. This guarantees `loadAll()` starts from a clean slate, so `mergeById(...)` cannot fold a previous user's rows into the new session and the "push local-only rows up" branch becomes a no-op for a fresh account.

### 3. Stop uploading leftover local rows on sign-in

Even with the reset above, harden `loadAll()` in `src/lib/sync.ts` so a stray local row can never leak into another account:

- Remove the four `localOnly.forEach(push*)` calls (lines 411–415) and the `localOnlyCats.forEach(pushExpenseCategory)` call. Local-only rows are only meaningful for a user who created them while signed in, which is already covered by normal push-on-mutate. Leftover local rows from a previous account must not be uploaded.
- Correspondingly, change `mergeById` usage so the store is set to just `remote` (not `remote + localOnly`). The store then reflects exactly what the signed-in user owns.
- Keep the "seed defaults for a brand-new user" branch (`if (!profileRes.data) pushCompanyProfile()` and the default expense categories seed), because that only runs when the remote workspace is genuinely empty for this user.

### 4. Make sign-out actually clear the slate

In whatever component triggers sign-out (Shell / Settings), after `supabase.auth.signOut()`:

- `useStore.getState().resetToDefaults()`
- clear the anon-slot persist key too (so the just-signed-out user's data isn't left readable in localStorage for the next person on that device)
- navigate to `/auth` with `replace: true`
- (React Query cache teardown is already covered elsewhere; no change needed here)

### 5. Verify

- Sign in as User A, create a doc, an expense, a customer, a catalog item; set a company name.
- Sign out. Confirm the app shows empty defaults and the `app-store::<A-id>` localStorage key still exists but `app-store::anon` is empty.
- Sign in as User B on the same browser. Confirm: empty workspace, no A rows visible, no new rows created in B's DB tables with A's content.
- Sign back in as A. Confirm all A's data returns from the server (and from A's own persisted slot).
- Repeat on a second browser to confirm remote-only load still works.

## Technical notes

- `src/lib/store.ts`: switch `persist` to a custom `storage` adapter keyed by a module-level `currentKey`; add `setPersistKey(uid)` and `resetToDefaults()` actions.
- `src/lib/sync.ts`: call `setPersistKey` and `resetToDefaults` on auth transitions; drop the localOnly upload branch in `loadAll`; set store to remote-only.
- No database migration required — RLS and per-user grants are already correct.
- No changes needed to `staff_members`, `payslips`, or workspace resolution logic. Owners and their staff continue to share the workspace via `workspaceOwnerId`.

Files touched: `src/lib/store.ts`, `src/lib/sync.ts`, and the sign-out handler (likely `src/components/app/Shell.tsx` or `src/routes/settings.tsx` — confirmed during implementation).
