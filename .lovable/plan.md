## Goal

Turn this MOOVE-specific app into a generic billing & operations platform for a one-person mobile business (movers, plumbers, electricians, mobile mechanics, cleaners, etc.). Each signed-in user gets their own workspace — data is already scoped by `owner_user_id`, so the model is right; the surface, defaults, and branding need to go generic.

## 1. Strip MOOVE branding

- Remove hardcoded `MOOVE` / `Moving Company` / Stilbaai address / FNB account defaults from `src/lib/store.ts`. New users start with empty company / banking / catalog.
- Remove the bundled `moove-logo.png.asset.json` import from `src/routes/auth.tsx`, `src/lib/pdf.ts`, and `src/components/app/Shell.tsx`. Replace with either the user's uploaded logo or a neutral text mark using the company name from settings.
- Retire the demo "MOOVE Staat" historical import and the FNB 2026 bank import from the Data settings tab (they're seeded from one specific business and don't belong in a generic template). Keep the `importHistorical` engine but drop the buttons and the two JSON files from the shipped UI.
- Update all `<title>` / meta / OG copy (root, auth, index) from "MOOVE" to a generic product name driven by company settings, with a neutral fallback like "Field Ops".

## 2. Logo upload in Settings

- Add a Lovable Cloud storage bucket `company-assets` (private, per-user path `<uid>/logo.<ext>`).
- Add a "Logo" section to Settings → Company: file picker (PNG/JPG/SVG, max ~2 MB), preview, remove button.
- Store the public/signed URL on `company_profile` (new `logo_url` column) and mirror it into the Zustand `company.logo` field.
- Consume `company.logo` in the auth page, app shell header, and PDF header. Fallback to the company name text when unset.

## 3. Theme: two user-chosen brand colors

- Add `theme: { primary: string; accent: string }` to `company_profile` (persisted per user).
- Settings → Appearance: two color pickers ("Primary" and "Accent"), each with a small preset palette plus a free hex input. Live preview swatch.
- Runtime: a `<ThemeInjector>` component in `__root.tsx` writes the two chosen colors into CSS custom properties (`--primary`, `--accent`, plus derived foregrounds via a simple luminance check for white/black text). Replaces the current red-ish `oklch(0.58 0.22 25)` defaults.
- Ship neutral defaults (a calm blue primary + slate accent) so a fresh install looks generic, not red/black.

## 4. Authentication rework

- Enable public sign-up in Lovable Cloud Auth (`disable_signup: false`, keep `auto_confirm_email: false` so verification is required, enable HIBP).
- Add email verification: on sign-up call `supabase.auth.signUp` with `emailRedirectTo: ${origin}/auth/callback`. Add a small `/auth/callback` public route that waits for the session then bounces to `/`.
- Add Google sign-in via the managed broker (`lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`) — call `supabase--configure_social_auth` with `["google"]` in the same change so the provider is actually enabled.
- Rebuild `/auth` as a tabbed Sign in / Create account form with: email+password, "Continue with Google" button, "Forgot password" link, and a `/reset-password` public route.
- Scaffold branded auth emails (verification, magic link, recovery, invite, email change, reauthentication) via `email_domain--scaffold_auth_email_templates` — this requires an email domain; if none is configured we'll surface the domain-setup dialog first.

## 5. Configurable primary billing unit

- Extend `BillingSettings` with `primaryUnit: Unit` (default `"km"`) and `customUnits: string[]` (user-defined labels like "site visit", "delivery", "bag", "load").
- Settings → Billing: dropdown "Primary unit for rate-based work" (each / hour / km / job / custom…) and a small editor to add/remove custom unit labels.
- Rename the "Rate per KM" field to "Rate per {primaryUnit}"; the underlying `ratePerKm` field stays but is treated as the primary rate.
- In the invoice/quote editor and `CatalogPicker`, the unit selector shows the four built-ins plus any custom units the user added. Line items already carry their own `unit`, so the doc-level override the user asked for works out of the box — we just widen the picker.
- Route/distance features (from/to address, distance auto-calc) stay available but become opt-in per line item instead of assumed.

## 6. Generic-platform polish (things overlooked)

- Currency: promote `billing.currency` to a real currency picker (ZAR, USD, EUR, GBP, AUD, CAD, NZD, custom) with matching locale for `fmtMoney`. Currently hardcoded `en-ZA`.
- Expense categories: swap "Grass Purchase" / "Sand/Stone/Trailer Hire" / "Truck Payment" for a neutral set (Fuel, Vehicle, Tools & Materials, Subcontractors, Office, Software, Marketing, Travel, Meals, Other). Users can still add/rename/delete.
- Demo catalog seed ("Local Move…", "Packing Service…") → an empty catalog with a one-time "Add your first service" empty state.
- Route bar name: `Planner` stays, `Results` stays, but wording that assumes "moves" / "jobs on the road" gets softened to "jobs" / "work".
- WhatsApp share templates in `src/lib/whatsapp.ts` and `share-message.ts` — audit for MOOVE-specific phrasing, generalize.
- README / package name: keep internal; user-facing product name comes from company settings.

## 7. Data migration

Existing rows are already keyed on `owner_user_id`, so multi-tenancy is not the issue — the demo defaults are. Migration:

- Add columns: `company_profile.logo_url text`, `company_profile.theme jsonb`, `company_profile.primary_unit text`, `company_profile.custom_units text[]`.
- Backfill: leave existing rows untouched (their MOOVE company/banking data is their own now). New sign-ups get empty defaults from the client, not the old seeded ones.
- Create private storage bucket `company-assets` with RLS: users can read/write only under `auth.uid()/…`.
- No destructive changes; no cross-user data movement needed.

## Technical section

- Files touched: `src/lib/store.ts` (defaults, new fields), `src/lib/sync.ts` (new columns), `src/routes/auth.tsx` (rebuild), `src/routes/settings.tsx` (logo, theme, unit sections), `src/routes/__root.tsx` (ThemeInjector + generic meta), `src/components/app/Shell.tsx` and `src/lib/pdf.ts` (logo + company name from store), new `src/routes/auth.callback.tsx` and `src/routes/reset-password.tsx`, new `src/components/app/LogoUploader.tsx` and `src/components/app/ColorPicker.tsx`.
- Tools: one `supabase--migration` (columns), one `supabase--storage_create_bucket` + RLS migration, `supabase--configure_auth` (signup on, HIBP on), `supabase--configure_social_auth` (Google), `email_domain--scaffold_auth_email_templates` (after confirming email domain).
- Delete: `src/assets/moove-logo.png.asset.json`, `src/data/historical.json`, `src/data/bank-import-2026.json` (and the two import buttons).
- No breaking changes for existing users; their current data stays, and they can rename the company in Settings.

## Out of scope for this pass

- Team/multi-user workspaces (the schema uses `owner_user_id`, not `workspace_id`; a real teams feature would be a separate migration).
- Marketplace of industry templates. Doable later once the generic base is in.
- Mobile-app / PWA install polish.
