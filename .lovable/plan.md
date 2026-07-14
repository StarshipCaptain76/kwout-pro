## Goal

Treat `dawie@polka.co.za`, `julius@polka.co.za`, and `nadia.jvr1668@gmail.com` as legacy free-unlimited accounts in the `/admin` overview. They should never appear as "trial", "trial_expired", "paying", "past_due", or "cancelled" — they get their own "legacy_free" bucket and are excluded from MRR and trial-conversion math.

## Changes

**`src/lib/admin.functions.ts`** (only file touched):

1. Add a constant set:
   ```ts
   const LEGACY_FREE_EMAILS = new Set([
     "dawie@polka.co.za",
     "julius@polka.co.za",
     "nadia.jvr1668@gmail.com",
   ]);
   ```
2. Build a `legacyUserIds: Set<string>` from `allUsers` by matching lowercased email.
3. In the subscription-tally loop, `continue` early for any `s.user_id` in `legacyUserIds` and increment a `legacyFree` counter instead.
4. Adjust `noSub` so legacy users without a subscription row are also counted as legacy, not as `no_sub`:
   `noSub = max(0, allUsers.length - subs.length - (legacyUsersWithoutSubRow))`.
5. Exclude legacy users from `mrr` (already handled since they're skipped from `payingUsers`) and from `trialConversionPct` base.
6. Add `{ status: "legacy_free", count: legacyFree }` to `subscriptionBreakdown` (filtered out if 0).
7. In `recentSignups`, override `subStatus` to `"legacy_free"` when the user's email is in the set.

No UI changes needed — `/admin` renders whatever statuses come back from `subscriptionBreakdown` and `recentSignups`, so the new `legacy_free` label will render automatically.

## Non-goals

- No schema change, no `subscriptions` row edits, no billing logic changes.
- No changes to `subscription.functions.ts` — those users' own `/settings` view is out of scope for this request.
- Access rules (who can view `/admin`) unchanged.
