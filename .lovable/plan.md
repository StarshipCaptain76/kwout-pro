# Set KWOUT logo and brand colors as defaults

Make the uploaded KWOUT mark the app's default logo, and set the navy + green sampled from it as the default theme colors. These become the KWOUT baseline shown on `/auth`, `/reset-password`, and any fresh install before a customer overrides them in Settings.

## Colors (sampled from uploaded Adobe-RGB readings)

- Primary (navy K): `#151C63` — from R 0.081 / G 0.110 / B 0.390
- Accent (green bars/check): `#4F8C2E` — from R 0.311 / G 0.550 / B 0.181

## Changes

1. **Upload the logo as a Lovable Asset**
   - `lovable-assets create --file /mnt/user-uploads/kwoutlogo.png --filename kwout-logo.png > src/assets/kwout-logo.png.asset.json`
   - Import the pointer where the default logo is needed.

2. **`src/lib/store.ts`** — Update `DEFAULT_THEME` (and the default `company` seed) so:
   - `theme.primary = "#151C63"`
   - `theme.accent  = "#4F8C2E"`
   - Default `company.logo` points at the KWOUT asset URL, and default `company.name = "KWOUT"` (if not already).

3. **`src/styles.css`** — Replace the current red `--primary` / `--accent` / `--ring` and dark navy `--secondary` in `:root` with oklch equivalents of the two brand colors so the very first paint (before any JS) is already KWOUT navy + green. Mirror sensible values in `.dark`.

4. **`src/routes/auth.tsx`** — Swap the hardcoded initial tile / fallback to use the imported KWOUT asset (keeps auth screen on-brand even with no store hydration).

5. **`src/routes/__root.tsx`** — If a `<link rel="icon">` / apple-touch-icon is set, point it at the KWOUT asset URL too.

## Out of scope

- No changes to Settings UX (users can still override name/logo/colors per company).
- No changes to PDF watermark, business logic, or auth flow.
- No migration of existing persisted `company` records — only the defaults shipped in code change.
