## Default Terms & Conditions for all owners

Add a shared constant `DEFAULT_BILLING_TERMS` in `src/lib/store.ts`:

> "Balances exceeding R1000.00 requires a 50% deposit before work starts. When making any payment please use the Quote/Invoice number as payment reference"

Use it as the fallback wherever billing terms are read, so every existing and new owner sees it without a migration:

- **`src/lib/store.ts`** — export `DEFAULT_BILLING_TERMS`; seed it on the initial `billing.terms` in the default state and in `resetToDefaults()`.
- **`src/routes/settings.tsx`** — Terms textarea shows `s.billing.terms ?? DEFAULT_BILLING_TERMS` so the field is pre-filled; owners can still edit or blank it.
- **`src/routes/doc.$id.tsx`** — render `billing.terms ?? DEFAULT_BILLING_TERMS` above Notes (only hide the block if the owner has explicitly cleared it to empty string).
- **`src/lib/pdf.ts`** — same fallback for the Terms block above Notes.

No DB changes; the field remains stored on the client-side `billing` blob and syncs through `company_profile.billing` as today. Owners who have already customised terms keep their value.
