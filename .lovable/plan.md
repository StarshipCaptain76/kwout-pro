## Problem

On `/auth`, the first paint is KWOUT navy (correct), then colors flip to a lighter blue after ~1 frame. Cause: `ThemeInjector` runs on every route (including `/auth`) and writes CSS vars from `useStore().company.theme`. Two sources feed it stale lighter-blue values:

1. **Persisted Zustand state** in `localStorage` (`app-store-v1`, version 3) — existing users hydrated before the KWOUT default swap still have `company.theme.primary = "#2563eb"` (or similar) saved. The migration at version 3 only fills in a missing theme; it never resets an old-default theme.
2. **`otm_brand` cookie** — written by `ThemeInjector` from that same stale theme, so `BRAND_BOOTSTRAP_SCRIPT` also re-applies lighter blue before React mounts on subsequent loads.

The auth page also shouldn't be tenant-themed at all — it must always be KWOUT navy/green regardless of any stored company brand.

## Fix

1. **`src/routes/auth.tsx`** — Wrap the page in a small effect that, on mount, forces the KWOUT default CSS vars onto `document.documentElement` (primary/accent/secondary/ring + foregrounds), overriding whatever the bootstrap script / ThemeInjector wrote. Also clears the `otm_brand` cookie so the next paint anywhere else starts clean until the real company loads. Same treatment for `/reset-password` and `/auth/callback` (all pre-auth routes).

2. **`src/components/app/ThemeInjector.tsx`** — Skip execution when `location.pathname` starts with `/auth` or equals `/reset-password`. Prevents the stale store from repainting the auth screen after hydration.

3. **`src/lib/store.ts`** — Bump persist `version` to 4 and extend `migrate`: if `company.theme.primary` matches any known previous default (`#2563eb`, `#0f172a`, or is missing), reset `company.theme = DEFAULT_THEME`. Also reset `company.logo` if it's empty/undefined so signed-in users don't stay on old branding accidentally — but leave any user-customised value alone.

4. **`src/lib/brand-cookie.ts`** — No API change, but ensure `clearBrandCookie()` is exported (already is) and called from step 1.

## Out of scope

- No changes to Settings, business logic, or the branded experience for authenticated tenant routes (they keep using the store's theme once loaded).
- No visual changes beyond removing the flash.

## Technical notes

- Order matters: the effect in step 1 must run synchronously in a `useLayoutEffect` so the override lands before the browser paints the hydrated frame.
- Step 2's pathname check uses `window.location.pathname` inside the effect (client-only), safe under SSR.
