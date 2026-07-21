## Getting Started checklist on /home

Add a Tradify-style onboarding card at the top of the owner dashboard. Each row links to the place the task is completed. When all tasks are done (or the owner dismisses it), the card disappears for good.

### Visibility
- Owners only (`useIsOwner()`). Staff never see it.
- Auto-hides when every task is complete, when the owner clicks "Dismiss", or once ≥14 days after signup (whichever comes first, to avoid clutter for legacy accounts).
- Persist dismissal in the Zustand store (`onboardingDismissed: boolean`), synced through the existing preferences path so it survives device switches.

### Tasks (7, matching KWOUT's setup)
Each row shows: icon, label, and a check ✓ (done) or → (open). Clicking navigates to the target route; the card highlights the section using a `?focus=…` search param where useful.

1. **Account created** — always ✓ (baseline).
2. **Choose your business type** — done when `company.businessType` is set and not `"other"`. Link: `/settings?tab=company`.
3. **Add company details** — done when `company.name` and either `company.email` or `company.phone` are set. Link: `/settings?tab=company`.
4. **Set up billing** — done when `billing.currency` is set AND at least one of: `ratePerKm > 0`, `baseCallout > 0`, or a catalog item exists. Link: `/settings?tab=billing`.
5. **Add banking details** — done when `banking.accountNumber` is set (needed for invoice PDFs). Link: `/settings?tab=banking`.
6. **Add your first customer** — done when `customers.length > 0`. Link: `/customers` (new customer button already there).
7. **Create your first quote or invoice** — done when `docs.length > 0`. Link: uses the existing "New quote" flow (same handler as the FAB).

Progress ring shows `X / 7` like the reference image.

### Files to change
- `src/lib/store.ts` — add `onboardingDismissed: boolean` to persisted state (schema version bump + migration default `false`); add `setOnboardingDismissed(v)`.
- `src/components/app/OnboardingChecklist.tsx` (new) — the card, progress ring, task rows, dismiss button.
- `src/routes/index.tsx` — render `<OnboardingChecklist />` above the status frames for owners; replaces the current standalone "Tailor KWOUT to your business" card (which becomes task #2 inside the checklist).
- `src/routes/settings.tsx` — accept an optional `?tab=` search param so deep links open the right tab (Company / Billing / Banking). Small addition using `validateSearch` + `defaultValue` on the existing `<Tabs>`.

### Behavior details
- Completed rows are muted grey with a green check; open rows have full contrast and a chevron.
- Clicking a completed row still navigates (owners can revisit).
- "Dismiss" is a small text link at the bottom-right of the card with a confirm toast.
- No card = card unmounts entirely (no empty state).
