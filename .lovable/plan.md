## Goal
Add a Google Map at the top of the Planner → Agenda tab showing the next 7 days of scheduled jobs, with color-coded pins, pickup→drop-off route lines, and each collection pin labeled with its scheduled date.

## What gets built

**New component:** `src/components/app/AgendaMap.tsx`
- Loads Google Maps JS API using the existing browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) — connector already linked, no new setup.
- Auto-fits bounds to all pins in the 7-day window; graceful empty state ("No scheduled jobs with mapped addresses in the next 7 days").
- Renders per job:
  - **Pickup pin** (collection) — colored by day, labeled with day abbrev (e.g. "Tue 22"), title = customer + address.
  - **Drop-off pin** (if `toCoords` present) — same color, hollow/darker variant so pickup vs drop-off is visually distinct.
  - **Route line** — `google.maps.Polyline` connecting pickup → drop-off in the day's color (straight line; keeps quota use low and works without extra Routes API calls).
- Click a pin → opens InfoWindow with customer, address, doc number, and a link to `/doc/$id`.
- Color palette: 7 fixed distinct colors mapped by day-offset (today = index 0) so the same day is always the same color.
- Legend strip below the map showing each of the 7 dates with its color swatch and job count.

**Planner integration:** `src/routes/planner.tsx`
- In the agenda view (`view === "agenda"`), render `<AgendaMap jobs={next7DaysJobs} />` above the day list.
- Compute `next7DaysJobs` = jobs with `scheduledDate` within `[today, today+6]` (uses existing `jobs` memo) and at least one of `fromCoords` or `toCoords`.
- Map is only rendered when agenda tab is active (avoid loading the script on week/month views).

## Notes / non-goals
- Uses straight polylines between pickup and drop-off, not driving directions — avoids Routes API calls and matches the "indicate the route" requirement without extra cost.
- Jobs without coordinates are skipped from the map but still appear in the day list below.
- No changes to data model, permissions, or PDF; purely additive UI on the agenda tab.
- Desktop and mobile: fixed height (~320px) with responsive width.

## Technical bits
- Script loaded once via a module-level singleton promise (idempotent across mount/unmount) with `loading=async` + `callback` param, per Google Maps connector rules.
- Uses classic `google.maps.Marker` (no `mapId`/AdvancedMarker) per connector guidance.
- Cleans up markers and polylines on unmount / jobs-change.
