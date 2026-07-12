## Rebrand to KWOUT

Replace all user-visible "On the MOOVE" / "ONTHEMOOVE" branding with **KWOUT**, and reposition the app as a simple, generic accounting/billing solution for entrepreneurs (drop transport-specific framing).

### Code changes

1. **`src/routes/__root.tsx`** — Update default title, og:title, twitter:title, description, og:description, twitter:description to KWOUT-branded, generic (non-transport) copy. New title: `KWOUT | Simple Accounting & Billing for Entrepreneurs`.

2. **`src/routes/auth.tsx`** (line 104) — Change fallback brand from `"On the MOOVE"` to `"KWOUT"`.

3. **`src/lib/pdf.ts`** (line 161) — Change PDF watermark from `powered by ONTHEMOOVE.CO.ZA` to `powered by KWOUT.CO.ZA`.

4. **`public/sitemap.xml`** and **`public/robots.txt`** — Update comments to KWOUT and generic accounting/billing wording.

### Content changes

5. **`README.md`** — Full rewrite:
   - Title: **KWOUT — Simple Accounting & Billing for Entrepreneurs**
   - Positioning: quotes, invoices, expenses, customer statements, light scheduling, reports — for any small business / solopreneur
   - Remove: MOOVE Transport story, truck/trailer/removal/rubble references, km/distance pricing emphasis, Google Maps distance calc as headline feature (still supported but framed as optional address autocomplete), planner framed as "job scheduling" instead of "truck routes"
   - Keep: tech stack, project structure, getting-started, Lovable Cloud/Supabase setup, roadmap (generalized)
   - Update repo URL references from `onthemoove` → generic placeholder (or drop)

### Explicitly out of scope

- `src/data/historical.json` — contains real bank-transaction records where "Moove" is part of the transaction description/vendor text (not app branding). Leaving untouched.
- Runtime company profile / user data (`company.name` in the store) — the fallback changes, but any customer's saved company name in Cloud is unchanged.
- No logo/favicon asset changes (none reference the old name in file contents).
- No database migrations, no route or feature changes.

### Verification

- Re-run `rg -in "onthemoove|on the moove"` after edits — should return only historical.json matches.
- Visually confirm header/auth page show KWOUT before company profile loads.
