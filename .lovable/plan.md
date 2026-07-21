# Expand Industries & Modules

Grow the business-type catalog from ~17 flat entries to the grouped list in the spec, and update the Settings UI to select business type by industry category.

## Scope

### 1. `src/lib/modules.ts`

- Add an `IndustryCategory` type with the 8 groups:
  - Electrical & Mechanical Services
  - Plumbing & Related
  - Construction & Renovation
  - Finishing & Exterior
  - Cleaning & Waste
  - Security & Specialist
  - Professional Services
  - Logistics & Other
- Extend `BusinessType` union with the new keys:
  `electrical_av`, `hvac`, `appliance_services`, `fire_services`, `plumbing_gas`,
  `property_maintenance`, `residential_renovations`, `new_residential_builds`,
  `commercial_construction`, `industrial_construction`, `carpentry`, `roofing`,
  `flooring`, `glazing`, `concreting`, `earthworks`, `fencing_decking`,
  `engineering`, `painting`, `landscaping_lawns`, `cleaning`,
  `security_services`, `bookkeeping`, `it_services`.
- Add a `category` field to `BusinessTypeDef` and populate it for every existing + new entry so all types belong to exactly one group.
- Re-order `BUSINESS_TYPES` to match the spec's grouping/order.
- Add a `INDUSTRY_CATEGORIES` list (ordered) and a `businessTypesByCategory()` helper.
- Preserve all existing keys (`plumber`, `electrician`, `mechanic`, etc.) so historical `company_profile.business_type` values keep working.
- Field/module definitions in `MODULES` remain unchanged (spec adds no new module fields).

### 2. Settings UI — `src/routes/settings.tsx` (Company tab)

- Replace the flat business-type `<Select>` with a grouped select using shadcn `SelectGroup` + `SelectLabel`, one group per industry category, in the spec's order.
- Selecting a type still calls `defaultModulesFor(...)` and refreshes `enabled_modules` as it does today.
- No changes to Modules tab, permissions, PDF, or doc editor — those already read dynamically from `MODULES`/`BUSINESS_TYPES`.

### 3. Docs

- Update `docs/industries-and-modules.md` if any category naming or defaults drift from the spec during implementation (structure already matches).

## Out of scope

- No database migration (business_type is free-form text; enabled_modules is a string array — new keys just work).
- No new module fields, no PDF changes, no permissions changes.
- No renaming/removal of existing business types (kept for backward compatibility alongside their new grouped counterparts).

## Technical notes

- Some spec entries are near-duplicates of existing ones (e.g. "Plumbing & Gas" vs "Plumber", "Painting" vs "Painter / Wall Finishing"). Both are kept as distinct selectable types per the spec table; owners choose whichever label fits.
- The default-modules table in the spec is copied verbatim into `BUSINESS_TYPES`.
