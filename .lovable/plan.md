
## Goal

A single, elegant `/welcome` landing page — the marketing + auth entry point for KWOUT. Simple by default, playful in the details. Signed-in users go straight to the app.

## What we're building

### 1. `/welcome` route (new) — `src/routes/welcome.tsx`
Single-page, editorial-minimal, KWOUT stationery vibe.

Sections (top to bottom, generous whitespace):
- **Hero**: giant Bebas Neue headline ("Run your business. Not your paperwork."), navy on off-white (`#F5F5F0`), green accent underline. Two CTAs side-by-side: **Start free** (email+password inline signup) and **Sign in** (toggles to login form).
- **What's included** — one-line list with green checkmarks: Quotes · Invoices · Statements · Payslips · Expenses · Financial reports. No feature cards, no icons zoo.
- **Pricing**: "30 days free. Then R100/month. Everything included." One sentence. No comparison table.
- **Playful touches** (fun, not loud): a subtle rotating stamp SVG ("KWOUT APPROVED"), one hand-drawn arrow pointing at the CTA, a tiny animated pen underline on the headline. Framer-motion for the pen stroke and stamp rotation only.
- **Footer**: KWOUT wordmark, tiny "R100/mo after trial. Cancel anytime."

Auth form (inline, no modal):
- Tabs: Start free / Sign in
- Email + password fields, one Google button
- Reuses the same Supabase calls from `src/routes/auth.tsx` (extract into `src/lib/auth-actions.ts` so both pages share logic; `/auth` keeps working for existing links)
- On success → navigate to `/`

Signed-in users hitting `/welcome` are redirected to `/`.

Head: unique title/description/og for the landing page.

### 2. Trial + subscription state
New table `public.subscriptions` (one row per user):
- `user_id uuid PK references auth.users on delete cascade`
- `trial_started_at timestamptz default now()`
- `status text default 'trial'` — `trial | active | past_due | cancelled`
- `payfast_token text` (subscription token from PayFast ITN)
- `current_period_end timestamptz`
- `updated_at timestamptz default now()`

Standard GRANTs + RLS: user can `SELECT` own row; only service_role writes. Trigger: on `auth.users` insert → insert subscription row with `trial_started_at = now()`.

Server fn `getSubscriptionStatus()` returns `{ status, daysLeftInTrial, needsPayment }`.

### 3. Trial reminder (in-app, day 30+)
`src/components/app/TrialBanner.tsx` — rendered inside `Shell.tsx`. When `status === 'trial'` and `daysLeftInTrial <= 7`, show a slim banner ("7 days left in your free trial · Subscribe"). At day 30, banner becomes blocking dialog on next app action: "Your free trial ended. Subscribe for R100/month to keep going." → button routes to `/settings?tab=billing`.

No email reminders in this pass (in-app only; can add via cron + Resend later).

### 4. Billing UI — new tab in `src/routes/settings.tsx`
"Billing" tab shows:
- Plan: KWOUT — R100/month
- Status badge (Trial · X days left / Active / Past due / Cancelled)
- **Subscribe** button (when not active) → calls `createPayfastCheckout` server fn, redirects browser to PayFast hosted checkout
- **Cancel subscription** button (when active) → calls PayFast cancel API via server fn
- Small print: "Billed monthly by PayFast. Cancel anytime."

### 5. PayFast integration
Secrets needed (request via `add_secret`):
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE` = `sandbox` or `live`

Files:
- `src/lib/payfast.functions.ts` — `createPayfastCheckout()` server fn. Builds a subscription payment payload (recurring, `subscription_type=1`, `frequency=3` monthly, `cycles=0` indefinite, R100 amount), signs it with the passphrase MD5 method PayFast requires, returns hosted-checkout URL. Also `cancelPayfastSubscription()` calling PayFast's subscription API with basic-auth token.
- `src/routes/api/public/payfast-itn.ts` — public server route for PayFast ITN webhook. Verifies signature, validates source IP against PayFast's published ranges, posts back to PayFast `/eng/query/validate` for confirmation, then updates `subscriptions` row (`status`, `payfast_token`, `current_period_end`).
- Return URLs: `/settings?billing=success`, `/settings?billing=cancelled`, `notify_url` → the ITN route above (using the stable `project--<id>.lovable.app` URL).

### 6. Router / index behaviour
- Keep `/` as-is (app dashboard for signed-in users). `/welcome` is a separate, public marketing page.
- Update `src/routes/__root.tsx` head defaults so `/welcome` metadata isn't overridden.
- No changes to signed-in app flows besides the trial banner.

## Out of scope
- Email reminders (in-app only for now)
- Multi-tier pricing / annual plan
- Team seats
- Migrating existing users' trial start date (they'll get `trial_started_at = now()` via backfill, or we set it to their `auth.users.created_at` in the migration — one-line SQL, included)

## Files touched
- New: `src/routes/welcome.tsx`, `src/lib/auth-actions.ts`, `src/lib/payfast.functions.ts`, `src/lib/subscription.functions.ts`, `src/components/app/TrialBanner.tsx`, `src/routes/api/public/payfast-itn.ts`, one migration
- Edited: `src/routes/auth.tsx` (extract shared handlers), `src/routes/settings.tsx` (Billing tab), `src/components/app/Shell.tsx` (mount `TrialBanner`), `src/routes/__root.tsx` (head defaults)

## Confirm before I build
I'll request the four PayFast secrets at the start of the build turn. OK to proceed?
