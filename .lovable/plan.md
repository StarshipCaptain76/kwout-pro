## 1. Staff add not creating

Diagnose first, then fix. Suspected causes (in order):
- `createStaffAccount` fails silently — the toast shows an error but the sheet already closed on a prior state. Check the browser network response for `/_serverFn/createStaffAccount`.
- `user_roles` insert may violate its unique/foreign‑key constraint (schema has `workspace_owner_id` in `user_roles` — verify column exists and matches insert payload).
- Auth admin `createUser` may reject because email confirmation / signups are disabled at the auth provider level.

Actions:
1. Add error logging in `createStaffAccount` handler (log `cErr`, `sErr`, roles insert error) and surface them in the toast.
2. Reproduce in preview, capture the exact error, then apply the targeted fix (most likely a missing `user_roles.workspace_owner_id` column or an RLS/unique conflict — a migration will be issued only if schema is the culprit).
3. Ensure the sheet stays open when creation fails (it already does; verify no state leak).

## 2. VAT rules in Settings + expenses/quotes/invoices

- **Cap VAT slider at 15%** in `src/routes/settings.tsx` (`PctSlider` — pass a `max` prop, default 100, use 15 for the VAT row).
- **Default VAT to 15%** on new workspaces (`src/lib/store.ts` initial `billing.vatPct: 15`). Existing workspaces keep their saved value.
- **Add "Charge VAT" toggle + VAT number field** in Settings → Company (or Billing) tab, persisted in `billing` jsonb (no migration — `billing` is already jsonb):
  - `billing.chargesVat: boolean` (default false)
  - `billing.vatNumber: string`
- **Quotes/invoices**: when `chargesVat` is true, VAT line uses `billing.vatPct` and the PDF footer/header shows the VAT number. When false, VAT line is hidden and `vatPct` treated as 0 in totals.
- **Expenses**: when `chargesVat` is true, "Includes VAT" defaults on with 15% (already wired to `billing.vatPct`); when false, VAT input is hidden. Auto‑compute continues to use `computeVat(amount, vatPct)`.

## 3. Google address autocomplete no longer working

The Google Maps connector key may have rotated or the connection lost scopes. Steps:
1. Verify the connector via `standard_connectors--call_gateway_connection` with a tiny `places:autocomplete` probe — surface the exact provider error.
2. If the gateway returns an auth error, run `standard_connectors--reconnect` on the Google Maps connection so the user re‑authorises; the injected `GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_BROWSER_KEY` refresh automatically.
3. If it's a provider error (referrer restriction, disabled Places API New on their custom key), report it back and adjust — the managed key already covers `*.lovable.app`, but `kwout.co.za` needs a custom key with Places API (New) enabled and the domain on the referrer allowlist.
4. Improve `AddressAutocomplete` error UX to show the underlying error text instead of a generic "Address search failed".

## Files likely touched
- `src/lib/staff.functions.ts` (error surfacing)
- `src/routes/settings.tsx` (VAT cap 15, VAT number input, chargesVat toggle, PctSlider max prop)
- `src/lib/store.ts` (billing type + defaults for `chargesVat`, `vatNumber`, `vatPct=15`)
- `src/routes/expenses.tsx` (respect `chargesVat`)
- `src/lib/pdf.ts` (show VAT number, honour `chargesVat`)
- `src/components/app/AddressAutocomplete.tsx` (better error text)
- Reconnect Google Maps connector (tool call, no code)

No DB migrations expected unless staff diagnosis surfaces a schema mismatch.
