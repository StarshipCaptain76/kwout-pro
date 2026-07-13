## Problem

`public/apple-touch-icon.png` exists but is 0 bytes (previous copy attempts didn't land the file). The `<link rel="apple-touch-icon">` tag is already wired up in `src/routes/__root.tsx`, so iOS is fetching a broken icon and falling back to a screenshot of the page when installed to the home screen.

## Fix

Copy the newly uploaded `kwoutlogo180-3.png` (180×180 PNG, correct Apple touch icon size) over `public/apple-touch-icon.png`, replacing the empty file.

No code changes — the `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">` and precomposed fallback already exist in `__root.tsx` from the earlier turn.

## After deploy

iPhone users who already added KWOUT to the home screen will keep seeing the old (blank) icon — iOS caches the icon at install time. They need to remove the home-screen shortcut and re-add it to pick up the new one.
