## Goal

Make two auth moments obvious instead of a tiny toast:

1. After **sign-up**, show a dedicated "Check your email to verify" screen (not just a toast).
2. On **sign-in**, if the email isn't registered (or credentials are wrong), show a clear prompt with a one-click "Create an account" action.

## Changes (all in `src/routes/auth.tsx`)

### 1. Post-signup verification screen

- Add local state `pendingVerification: { email: string } | null`.
- In `signUp()`, when Supabase returns no session (email confirmation required), set `pendingVerification` instead of just toasting.
- Render a new panel inside the existing `Card` when `pendingVerification` is set:
  - Heading: "Verify your email"
  - Body: "We sent a verification link to **{email}**. Click it to activate your KWOUT account."
  - Secondary actions:
    - "Resend email" → calls `supabase.auth.resend({ type: 'signup', email })` with a 30-second cooldown.
    - "Use a different email" → clears state, returns to the signup tab.
  - Small note: "Check your spam folder if it doesn't arrive within a minute."
- If the user already has a session on submit (auto-confirm on), keep existing behavior (navigate home).

### 2. "Not registered" prompt on sign-in

Supabase does not tell us "user does not exist" directly — for security it returns `invalid_credentials` for both wrong password and unknown email. We handle it by parsing the error and offering both paths in one dialog:

- Add state `signInProblem: { kind: 'invalid' | 'unverified' | 'other'; message: string } | null`.
- In `signIn()`, on error inspect `err.message` / `err.code`:
  - `email_not_confirmed` → `kind: 'unverified'` → show "Your email isn't verified yet" panel with Resend button (same as above) + "Back to sign in".
  - `invalid_credentials` / `invalid_grant` → `kind: 'invalid'` → show an inline alert card above the form: "We couldn't sign you in. Either the password is wrong or this email isn't registered yet." with two buttons:
    - **Create an account with this email** → switches to the signup tab, pre-fills email.
    - **Try again** → clears the alert, keeps email, focuses password.
  - Anything else → toast the raw message (current behavior).
- Replace the current `toast.error` on sign-in failure with this inline UI so it doesn't disappear.

### 3. Small UX polish

- Keep Google sign-in visible on both the normal auth screen and the "not registered" alert (users who fail email sign-in often meant to use Google).
- Preserve the KWOUT branding wrapper and clear-brand-cookie logic.

## What stays untouched

- `signInWithGoogle`, `sendReset`, forgot-password flow, `ensureOwner`, and routing to `/` on success.
- The Resend-powered auth email hook, Supabase auth settings, and every other route.

## Technical notes

- Uses only `supabase.auth.resend` and existing shadcn primitives (`Card`, `Button`, `Alert` — will add if missing) — no new deps.
- All state is local to `AuthPage`; no store changes.
- Cooldown implemented with a `useEffect` timer on `resendCooldown` (number of seconds).

Reply **approve** to proceed.
