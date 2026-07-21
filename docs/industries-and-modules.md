# Industries & Modules

KWOUT ships with a lightweight, modular system that adapts quotes and invoices to the way a specific trade actually works. Instead of forcing every business into one rigid template, an owner picks a **business type** and KWOUT auto-enables a set of **feature modules** that add the right fields to documents, PDFs, and settings.

Owners can override the defaults at any time — enabling extra modules or disabling ones they don't need.

---

## 1. Concept

There are two layers:

1. **Business type** — a single label that describes what the workspace does (e.g. Plumber, Mechanic, Caterer). Selecting a type pre-selects a sensible default set of modules.
2. **Modules** — reusable bundles of fields (e.g. Vehicle, Waste, Measurements). Each module, when enabled, injects its fields into the document editor and PDF output.

Field values are stored on each document under `doc.moduleData[moduleKey][fieldKey]`, keeping the core `Doc` shape stable while allowing industry-specific data to travel with the quote/invoice.

Source of truth: `src/lib/modules.ts`.

---

## 2. Supported Business Types

Each type comes with a default module set. Owners can add or remove modules afterwards in **Settings → Modules**.

| Business type | Default modules |
|---|---|
| Plumber | Location, Time, Materials, Measurements, Compliance |
| Electrician | Location, Time, Materials, Compliance |
| Mechanic / Auto Repair | Vehicle, Equipment, Time, Materials, Compliance |
| Transporter / Truck Operator | Location, Vehicle, Time, Waste, Delivery |
| Rubble Removal / Waste Hauler | Location, Waste, Measurements |
| Landscaper / Gardener | Location, Time, Materials, Waste, Measurements |
| Domestic / House Cleaner | Location, Time |
| Painter / Wall Finishing | Location, Time, Materials, Measurements, Compliance |
| Carpenter / Furniture Maker | Location, Time, Materials, Measurements |
| Builder / Contractor | Location, Time, Materials, Waste, Measurements, Compliance |
| Caterer / Prepared Meals | Location, Materials, Delivery |
| Freelance Photographer | Location, Time, Delivery |
| IT Technician / Computer Repair | Equipment, Time, Compliance |
| Appliance Repair Technician | Location, Equipment, Time, Materials, Compliance |
| Mobile Car Wash / Detailing | Location, Vehicle, Time |
| Pool Maintenance | Location, Equipment, Time, Materials, Compliance |
| Business Consultant / Freelance Professional | Time |
| Other | (none — fully manual) |

---

## 3. Available Modules

| Module | Purpose | Fields |
|---|---|---|
| **Location** 📍 | Where the work happened or goods went. | Job site / property address, GPS coordinates |
| **Vehicle** 🚗 | Vehicle-specific details for auto trades. | Registration #, VIN / Chassis #, Make & model, Year, Odometer in, Odometer out |
| **Equipment** 🔧 | Assets being repaired or serviced. | Appliance / tool type, Brand, Model, Serial #, Fault reported |
| **Time** 🕒 | Billable labour time. | Start time, End time, Total labour hours, Waiting time, Number of workers |
| **Materials & parts** 📦 | Physical items used beyond line items. | Part numbers, Consumables used |
| **Waste** 🗑️ | Rubbish removal and disposal. | Disposal site address, Disposal receipt #, Load description, Weight, Volume, Skip size |
| **Measurements** 📏 | Dimensions for painting, landscaping, etc. | Area, Surface type, Number of coats, Garden size, Paint colour / brand |
| **Delivery & logistics** 📦 | Packaging and delivery specifics. | Portions / meals, Dietary requirements, Delivery date, Delivery time, Packaging fee, Item count |
| **Compliance & warranty** ⚙️ | Legal and quality assurance. | CoC number, Warranty period, Next service date, Safety test results, Water test results |

Field types supported today: `text`, `number` (with optional suffix like `km` / `m²`), `date`, `time`, `textarea`.

---

## 4. Owner Workflow

1. **Pick a business type** in *Settings → Company*. Default modules toggle on automatically.
2. **Fine-tune modules** in *Settings → Modules* — enable extras (e.g. add Compliance to a cleaner) or disable ones that don't apply.
3. **Configure module-specific defaults** where relevant, e.g. the default **Disposal site** address for the Waste module.
4. **Create a quote or invoice** — enabled module fields appear as an extra "Job details" block below the core fields.
5. **Generate the PDF** — a *JOB DETAILS* section renders any populated module fields alongside the standard quote/invoice content.

New workspaces that haven't chosen a business type see a dashboard nudge prompting them to pick one.

---

## 5. Data Model

- `company_profile.business_type` — the selected type (nullable; `Other` allowed).
- `company_profile.enabled_modules` — string array of active module keys.
- `docs.module_data` — JSONB, shape `{ [moduleKey]: { [fieldKey]: value } }`.

Because module data is JSONB per document, changing which modules are enabled later never mutates historical documents — old jobs keep whatever they were saved with, and new jobs pick up the current module set.

---

## 6. Extending the System

To add a new module:

1. Add a `ModuleDef` (key, label, icon, description, fields) to `MODULES` in `src/lib/modules.ts`.
2. Append the key to `MODULE_KEYS`.
3. Optionally add it to one or more `BUSINESS_TYPES` default sets.

To add a new business type:

1. Add a `BusinessTypeDef` entry to `BUSINESS_TYPES` with its default module keys.

No schema migration is needed for either — the document editor, settings UI, and PDF renderer all read from `MODULES` and `BUSINESS_TYPES` dynamically.

---

## 7. Permissions

Access to the module system respects the standard role/permissions matrix (`src/lib/permissions.ts`):

- **Owners** can change business type, toggle modules, and edit module-related defaults (e.g. disposal site).
- **Managers / staff** can fill in module fields on jobs they have edit rights to, but cannot change the workspace-wide module configuration unless the owner grants `settings.modules`.
