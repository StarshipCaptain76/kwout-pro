## Problem

On first paint (fresh login, new device, or hard refresh), the app briefly shows the default "On the MOOVE" name and the default blue/slate theme before the customer's real company name, logo and brand colours load from the cloud. This creates a visible flash of unbranded content (FOUC).

**Why it happens today:**
1. Zustand's `persist` reads from `localStorage` on the client only — on a new device/browser it's empty, so `company` and `theme` start at their built-in defaults.
2. `ThemeInjector` writes CSS vars in a `useEffect`, so it can't run until after hydration.
3. The Shell falls back to the literal string `"On the MOOVE"` and the default logo slot whenever `company.name` is empty.
4. The cloud fetch of `company_profile` happens after auth resolves and after the first render, so defaults flash for a few hundred ms up to a second.

## Fix

Cache the customer's brand (name, logo URL, primary, accent) in a **cookie** the moment we know it, then use it during SSR / very first client paint so the app renders branded from frame one. Where the brand truly isn't known yet, show a neutral skeleton instead of the default name/colours.

### 1. Brand cookie (client-writable, SSR-readable)

- New helper `src/lib/brand-cookie.ts` with `readBrandCookie()` / `writeBrandCookie(brand)`.
- Cookie name: `otm_brand`. Value: compact JSON `{ n, l, p, a }` (name, logoUrl-or-null, primaryHex, accentHex). ~200 B, safe for a cookie.
- Written whenever `setCompany` runs and after the cloud hydrate in `sync.ts` populates `company`. (Not written for logos larger than a threshold — for those we store only the primary/accent + name and continue to load the logo async, but at least the colours + name are correct on first paint.)
- Cleared on sign-out.

### 2. SSR uses the cookie for first paint

- `__root.tsx` `beforeLoad` reads the cookie via `getWebRequest()` and returns `brand` on the router context.
- `head()` injects an inline `<style id="brand-vars">:root{--primary:...;--primary-foreground:...;--secondary:...;--accent:...;--ring:...}</style>` derived from the cookie. This means the very first painted frame already has the customer's colours — no blue flash.
- `RootShell` also passes `brand.name` down so `<title>` and the shell header can render the real name immediately on SSR.

### 3. Shell: no default-name fallback until brand is known

- `Shell.tsx` replaces the literal `"On the MOOVE"` fallback with a small skeleton (a neutral rounded bar) when both cookie and store are empty. This only shows on a genuine first visit (no cookie yet) and disappears the moment cloud hydrate completes.
- Same treatment for the logo slot: skeleton square instead of the missing-image placeholder.

### 4. Hydrate order

- `ThemeInjector` keeps working for live edits, but it now no-ops when the CSS vars already match the cookie values (avoids a redundant repaint).
- On login, `sync.ts` writes the cookie as soon as `company_profile` arrives so subsequent navigations/refreshes are instant-branded even before cloud data reloads.

### 5. Preload the logo

- When the cookie has a `logoUrl`, add `<link rel="preload" as="image" href={logoUrl}>` in `head()` so the logo image request starts alongside the HTML, not after React mounts.

## Out of scope

- Server-rendering the full authenticated app (still client-hydrated).
- Storing the logo binary in the cookie (too large — logo still loads via URL; only colours + name are inlined).
- Changing the default theme values themselves.

## Files touched

- New: `src/lib/brand-cookie.ts`
- Edit: `src/routes/__root.tsx` (beforeLoad + head + shell prop)
- Edit: `src/components/app/Shell.tsx` (skeleton fallbacks)
- Edit: `src/components/app/ThemeInjector.tsx` (skip redundant writes)
- Edit: `src/lib/sync.ts` (write cookie after hydrate; clear on sign-out)
- Edit: `src/lib/store.ts` (`setCompany` writes cookie)

## Result

First paint on any device with an existing session shows the correct company name, logo request already in flight, and correct brand colours. Only a first-ever visit (no cookie) sees a neutral skeleton for ~1 frame instead of the wrong-branded flash.