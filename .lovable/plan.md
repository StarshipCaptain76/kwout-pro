## The problem

When an owner tries to add a staff member whose email is already registered (either they have their own KWOUT account, or work for another business on KWOUT), the create-staff flow fails: `supabaseAdmin.auth.admin.createUser` errors with "already registered" and no staff row is created.

Related issues in the same code path:
- `deleteStaffMember` deletes the underlying auth user. With `staff_members.user_id ON DELETE CASCADE`, removing someone from Business A also destroys their own KWOUT account and every other workspace they belong to.
- `resolveWorkspace` picks the oldest active staff row, so a user in multiple workspaces has no way to switch.
- `resetStaffPassword` lets an owner overwrite the password of a user who owns their own account or works for another business.

The schema already supports the multi-workspace case: `staff_members` is unique on `(workspace_owner_id, user_id)`, so one user can hold rows in many workspaces.

## Fix

### 1. Add-by-email that reuses existing users (`src/lib/staff.functions.ts`)

Rework `createStaffAccount` into an "add staff" flow:

- Look up the email via `supabaseAdmin.auth.admin.listUsers` (paginated filter). Two branches:
  - **Existing user**: skip user creation, do NOT touch their password. Insert the staff_members row with their existing `user_id`. If a row for `(workspace_owner_id, user_id)` already exists, surface "already a staff member of this workspace".
  - **New user**: create with `email_confirm: true` and the provided password (current behavior).
- Return a discriminated result `{ kind: "created", tempPassword } | { kind: "linked" }` so the UI can show the right confirmation.

Password field on the add form becomes optional — required only when the email is new. Simpler UX: try to link first; if the API reports "new user", prompt for a password inline.

### 2. Removing a staff member unlinks — never deletes the auth account

Rewrite `deleteStaffMember` to `DELETE FROM staff_members WHERE id = $1 AND workspace_owner_id = caller` and delete the matching `user_roles` row scoped to that workspace. The auth user is never touched. Also remove/clean up any `user_roles` row where `workspace_owner_id` matches.

### 3. Owner can't reset another owner's password

`resetStaffPassword` should only work when the target staff row was originally provisioned by this workspace and the user isn't the owner of another workspace or already using their own account. Safest and simplest: only allow reset when the target user's email is not confirmed by another means and they have exactly one staff row (this workspace). Otherwise return an error telling the owner to ask the user to use "Forgot password" themselves. In the UI, hide the reset button in this case.

### 4. Workspace switching

- Add `active_workspace_id uuid` to a new `user_preferences` table (or reuse an existing lightweight table if one exists) keyed by `user_id`, with RLS `user_id = auth.uid()`.
- New server fn `setActiveWorkspace({ workspaceOwnerId })` — validates the caller has an active staff row in that workspace, then upserts the preference.
- `resolveWorkspace` uses the preference if set and still valid; otherwise falls back to the oldest active row (current behavior).
- New server fn `listMyWorkspaces()` returning `{ workspaceOwnerId, businessName, role }[]` for every active staff row.
- UI: a small workspace switcher in the app shell header (dropdown), visible only when the user has more than one workspace. Selecting a workspace calls `setActiveWorkspace` then invalidates queries / reloads.

### 5. UI updates

- `StaffSection.tsx` (add-staff sheet): make password optional; label the primary button "Add staff"; after submit, show either "Account created — share this temporary password" (new) or "Existing KWOUT user linked to this workspace" (linked).
- Hide the key/reset-password button on rows where reset isn't allowed (server returns a small `canResetPassword` flag on each staff row via `listStaff`).
- Add the workspace switcher control in `src/components/app/Shell.tsx`.

## Files touched

- `src/lib/staff.functions.ts` — rewrite create/delete/reset, add `listMyWorkspaces`, `setActiveWorkspace`, `canResetPassword` on `listStaff`.
- `src/components/app/StaffSection.tsx` — optional-password form, updated result copy, hide reset when disallowed.
- `src/components/app/Shell.tsx` — workspace switcher.
- New migration — `user_preferences` table (or equivalent) with RLS + grants; no destructive schema changes.

## Out of scope

- Sending an invite email to new staff users (still shows the temp password inline, current behavior).
- Cross-workspace notifications.
- Per-workspace role admin UI beyond what already exists.