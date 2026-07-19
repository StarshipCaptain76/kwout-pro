## Goal
Replace the current bare "+" (which inserts an empty inline row) with a polished **Add item** modal. On save it inserts the item into the current quote/invoice **and** saves it to the master Catalog, with a confirmation toast. The "+ Catalog" picker stays for browsing existing catalog items.

## UX
- Line items header keeps two buttons:
  - **+ Catalog** (existing) — browse/select from saved catalog.
  - **+ Add item** (was the bare "+") — opens the new modal.
- Modal (shadcn `Dialog`, styled to match the current green theme):
  - Fields:
    - Name / Service (required, autofocus)
    - Description (optional, textarea)
    - Quantity (number, default 1)
    - Unit price / Rate (number, prefixed with currency)
    - Unit (Select bound to `BUILTIN_UNITS` + `billing.customUnits`, default = `billing.primaryUnit`)
    - "Also save to Catalog" checkbox, checked by default
  - Buttons: Cancel · **Add to quote**
  - Validation: name required, qty ≥ 0, price ≥ 0. Inline error under the offending field.
- On save:
  - Append a new `LineItem` to `doc.items` (description = name; if description text was entered, append as a second line joined with " — ").
  - If "Also save to Catalog" is on AND no existing catalog item has the same case-insensitive name, call `upsertCatalog({ id: newId(), name, price, unit })`.
  - Toast:
    - Both actions → `"Item added to quote and saved to catalog"`
    - Item only → `"Item added to quote"`
    - Duplicate skipped → `"Item added to quote (already in catalog)"`
- Empty-inline-row fallback: the tiny inline "add empty row" affordance is removed; all new items flow through the modal or the catalog picker.

## Files
- `src/routes/doc.$id.tsx` — swap the bare `+` button for one that opens the new modal; wire save handler using existing `addItem` + `upsertCatalog` from the store; sonner `toast`.
- `src/components/app/AddItemDialog.tsx` (new) — the dialog form, using `Dialog`, `Input`, `Textarea`, `Select`, `Checkbox`, `Button` from `@/components/ui/*`. Props: `open`, `onOpenChange`, `currency`, `defaultUnit`, `units: string[]`, `onSubmit(item, { saveToCatalog })`.

## Out of scope
- No catalog "category/tag" field is added — the existing `CatalogItem` shape has no category. (Happy to add one in a follow-up if wanted; would need a store + Supabase migration.)
- KM/Distance button unchanged.