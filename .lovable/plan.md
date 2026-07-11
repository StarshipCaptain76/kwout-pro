Replace the "Field Ops" fallback brand name with "On the MOOVE" across the app.

## Changes

- `src/routes/__root.tsx` — update `title`, `og:title`, `twitter:title` from "Field Ops — Quote, Invoice & Plan" to "On the MOOVE — Quote, Invoice & Plan".
- `src/routes/auth.tsx` — change fallback `const brand = company.name || "Field Ops"` to `"On the MOOVE"`.
- `src/components/app/Shell.tsx` — same fallback change.

## Out of scope

- `README.md` and `src/data/historical.json` (bank-import fixtures) are not user-facing brand strings; leaving untouched unless you say otherwise.
- No changes to defaults stored per-user in Zustand/Cloud — the fallback only shows when a user hasn't set a company name.
