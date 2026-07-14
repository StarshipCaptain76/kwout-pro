## Goal

Introduce a **Business Type → Feature Modules** system so owners can pick their industry once and the invoice/quote form automatically shows the right extra fields. Owners can also toggle individual modules on/off in Settings.

## Data model

### New file `src/lib/modules.ts` (single source of truth)

- `BusinessType` union of the 20 types + `"other"`.
- `ModuleKey` union: `location | vehicle | equipment | time | materials | waste | measurements | delivery | compliance`.
- `MODULES: Record<ModuleKey, { label; icon; description; fields: FieldDef[] }>` describing each module and the fields it adds.
- `BUSINESS_TYPES: Array<{ key; label; defaultModules: ModuleKey[] }>` — the 20 types with the module mapping from the brief.
- Helpers: `defaultModulesFor(type)`, `moduleFields(key)`.

Field definitions are declarative (`{ key, label, type: 'text'|'number'|'date'|'time'|'textarea'|'address', unit?, group? }`) so the invoice form can render them generically without per-module React components.

### Store additions (`src/lib/store.ts`)

- Extend `Company` with `businessType?: BusinessType` and `enabledModules?: ModuleKey[]`.
- Extend `Doc` with `moduleData?: Partial<Record<ModuleKey, Record<string, unknown>>>` (JSON blob keyed by module → field key → value). Line items unchanged.
- Migration in the persisted store `migrate()` to seed `enabledModules` from `defaultModulesFor(company.businessType ?? 'other')` when missing.

### Database migration

- Add `business_type text` and `enabled_modules text[]` columns to `company_profile`.
- Add `module_data jsonb` column to `docs`.
- `sync.ts` `pushCompanyProfile` / `pushDoc` extended to persist the new columns.
- Types regenerate after migration.

Using JSONB keeps the schema stable regardless of which modules a business enables and avoids 9 side tables.

## UI

### Onboarding / first-run

- In Settings → Company, add a required **Business type** select (the 20 options). Selecting a type calls `setCompany({ ...c, businessType, enabledModules: defaultModulesFor(type) })`. A short helper text lists which modules were enabled.
- If `businessType` is unset on load and the current user is the owner, show a one-time inline prompt on `/` ("Pick your business type to tailor the app").

### Settings → new "Modules" tab

- Owner-only (gated behind a new `settings.modules` permission added to `permissions.ts`, defaulted on for owner).
- Lists every module with the icon, label, description, and a `<Switch>` bound to `enabledModules`.
- "Reset to defaults for {business type}" button.

### Invoice / quote form (`src/routes/doc.$id.tsx`)

- After the customer + line-items sections, render one collapsible card per **enabled** module (`company.enabledModules`).
- Each card renders its `FieldDef[]` generically, writing into `doc.moduleData[moduleKey][fieldKey]` via `upsertDoc`.
- Existing hard-coded blocks that duplicate module concepts get folded in rather than duplicated:
  - **Location** module owns `fromAddress`, `toAddress`, `fromCoords`, `toCoords`, `distanceKm` (already on `Doc`) — the module card wraps the existing address/route UI so behaviour is unchanged when Location is on, and hidden when off.
  - **Waste** module owns the existing disposal-site helper.
  - Other modules render only inside `moduleData`.
- If no modules are enabled, no extra cards render — form stays clean.

### PDF (`src/lib/pdf.ts`)

- Append a "Job details" section listing populated module fields (label: value) grouped by module. Empty fields are skipped so PDFs stay tidy.

## Permissions

- Add `settings.modules` to `Action`, `ACTION_GROUPS` ("Settings sections"), and `PRESETS` (owner: true, manager/staff: false).
- Gate the new Modules tab and the business-type select behind it.

## Files to change

- **New:** `src/lib/modules.ts`
- **New migration:** add `business_type`, `enabled_modules`, `module_data` columns
- `src/lib/store.ts` — extend `Company`, `Doc`, add migration step
- `src/lib/sync.ts` — persist new columns
- `src/lib/permissions.ts` — add `settings.modules`
- `src/routes/settings.tsx` — Business type select in Company tab + new Modules tab
- `src/routes/doc.$id.tsx` — render module cards; fold Location/Waste into modules
- `src/routes/index.tsx` — one-time "pick your business type" nudge for owners
- `src/lib/pdf.ts` — render module data section

## Out of scope

- No changes to auth, workspace switching, payments, or the 20-type wording beyond what the brief listed.
- No per-module DB tables — JSONB only. Can be split later if reporting on specific fields is needed.
- No RLS changes.

## Open questions

1. Should the business-type picker appear as a **required step at first sign-in** (blocking modal) or as a soft prompt on the home page? I've planned the soft prompt — confirm if you want it enforced.
2. For existing workspaces with data, should I default `businessType` to `"other"` with **all modules off** (safe, invoice looks exactly like today) or infer from usage? Planned: default `"other"` + all off.
