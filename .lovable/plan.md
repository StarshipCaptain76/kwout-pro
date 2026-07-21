## Goal
Replace the plain "Quotes (month)" / "Invoices (month)" tiles on `/home` with two side-by-side status frames matching the reference:

- **INVOICES:** Draft · Unpaid · Overdue · Paid
- **QUOTES:** Draft · Awaiting acceptance · Accepted · Declined

Each row shows the label and a colored count pill; tapping a row navigates to `/docs` pre-filtered to that status.

## Data / status changes

**Add one new stored status:** `"declined"` for quotes.
- Extend `DocStatus` in `src/lib/store.ts` to `"draft" | "sent" | "accepted" | "declined" | "paid" | "cancelled"`.

**Derived (not stored) statuses:**
- **Awaiting acceptance** = quote with status `sent`.
- **Unpaid** = invoice with status in {`draft`,`sent`,`accepted`} and not overdue.
- **Overdue** = invoice not paid AND `createdAt` older than `invoiceDueDays` (see settings). Derived on the fly via a helper `getInvoiceStatus(doc, dueDays)` in `src/lib/store.ts`.

**New setting:** `invoiceDueDays` (default 30) on `BillingSettings`. Editable in **Settings → Billing** ("Invoice payment terms (days)"). Persisted to `company_profile.billing` JSONB — no migration needed (JSONB column already exists).

## Home page frames

New component `src/components/app/StatusFrame.tsx` renders a titled card with rows: label + colored count pill. Colors per reference:
- Draft: amber
- Unpaid / Awaiting acceptance: blue
- Overdue / Declined: red
- Paid / Accepted: green

Rows are clickable → navigate to `/docs` with the appropriate search params.

Placement in `src/routes/index.tsx`: replace the two `Stat` tiles for "Quotes (month)" / "Invoices (month)" with a 2-column responsive grid of the two frames. Keep the owner-only "Outstanding" and "Paid (month)" tiles above them unchanged.

Counts are computed across all non-archived, non-cancelled docs (not just this month), matching the reference's plain totals.

## /docs filter support

Extend `/docs` route search schema and filter logic in `src/routes/docs.tsx` to accept:
- `status`: `draft | awaiting | accepted | declined | unpaid | overdue | paid`
- `type`: `quote | invoice` (existing)

Filter mapping uses the same `getInvoiceStatus` helper so "overdue" and "unpaid" are consistent between home and docs.

## Handling "Declined"

Add a "Mark declined" action on the quote view (`/doc/$id`) alongside the existing "Mark accepted" action, plus "Reopen" to move back to `sent`. No new UI beyond a small dropdown/button — implementation kept minimal.

## Files touched
- `src/lib/store.ts` — extend `DocStatus`, add `invoiceDueDays` to billing, add `getInvoiceStatus` helper.
- `src/lib/sync.ts` — pass `invoiceDueDays` through the billing JSONB (already generic JSONB, likely no change; verify during implementation).
- `src/routes/settings.tsx` — add "Payment terms (days)" input in the Billing tab.
- `src/routes/index.tsx` — swap monthly tiles for the two status frames.
- `src/routes/docs.tsx` — accept new status filters, apply via helper.
- `src/routes/doc.$id.tsx` — add "Mark declined" / "Reopen" buttons for quotes.
- `src/components/app/StatusFrame.tsx` — new.

## Out of scope
- "Sent to accounting" row (excluded per your instruction).
- No DB migration (statuses stored as text; JSONB billing already flexible).
