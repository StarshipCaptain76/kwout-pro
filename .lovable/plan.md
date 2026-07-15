## Overview

Apply every item from `moove-edits-since-jul-13.md`. Some items overlap what KWOUT already ships — those are noted and reduced to the delta. All work stays in the client (frontend, sync, store, pdf) except one DB migration for the new `scheduled_end_date` column.

Ordering below matches the source file.

---

### 1. Expenses — persist/rehydrate race + pagination
Cloud pagination already exists in `src/lib/sync.ts` (`fetchAll` at PAGE=1000). Only the persist/rehydrate race remains:

- In `src/lib/sync.ts` `loadAll()`, `await useStore.persist.rehydrate()` **before** calling `useStore.setState(...)`, so a late rehydrate can't clobber the freshly-loaded remote data.
- On sign-in in `initSync()`, gate `resolveAndLoad()` behind rehydrate as well.

### 2. Expenses — donut + colour coding
Already present in `src/routes/expenses.tsx` (recharts `PieChart`, `categoryColor()`, deterministic hash fallback, coloured left border on rows). No change needed — leave as-is.

### 3. Expense categories — stop phantom duplicates
Audit every write path so categories only mutate on explicit user action:

- `src/lib/sync.ts` `loadAll()`: keep `remoteCategoryNames` as source of truth (already does).
- `src/lib/store.ts` `importHistorical()`: stop merging `p.newExpenseCategories` into the categories set; map unknown category names to `"Other"` on the incoming expenses instead.
- `pushExpense`/`upsertExpense` must NOT touch categories — verify no side-effect exists (currently clean, keep it that way).

### 4. Quote/Invoice PDF — FROM/TO block
Footer watermark ("powered by KWOUT.CO.ZA") already exists in `src/lib/pdf.ts`. Add just the FROM/TO block:

- Between the customer details header and the items table, when `doc.fromAddress` or `doc.toAddress` is set, draw a subtle branded box (accent green from `company.theme.accent`, ~8% fill), two half-width columns labelled `FROM` / `TO`, wrapped with `splitTextToSize`. Include `distanceKm` on the right if present.
- Shift the items-table `y` down by the block height.

### 5. Mobile safe-area — top inset
Bottom insets are already applied throughout Shell/sheets. Add top inset:

- `src/components/app/Shell.tsx` header: apply `paddingTop: env(safe-area-inset-top)` to the sticky `<header>` and increase its computed height so the status bar doesn't overlap the logo/nav.

### 6. Planner — data feed
In `src/routes/planner.tsx`:

- `jobs` filter: include all non-cancelled, non-archived statuses (`draft`, `sent`, `accepted`, `paid`) so newly-created invoices show up. Add `!d.archived` guard.
- `unscheduled`: `!d.scheduledDate && !d.archived && d.status !== "paid" && d.status !== "cancelled"`. Paid without `scheduledDate` stays out (still rendered on `paidAt` day via existing `plannerDate`).
- Add a **"Archive all unscheduled"** button on the unscheduled bar (visible when `unscheduled.length > 0`, `canEdit`, confirm dialog). Iterates `upsertDoc({ ...d, archived: true })`.

### 7. Planner — 3-line job card
Rewrite `JobCard`, `AgendaJob`, and `MiniJob` in `src/routes/planner.tsx` to a shared 3-line layout:

```
Line 1: [name .............................] [payment dot]
Line 2: [INV-1256 · address (truncate)]
Line 3: [CATEGORY .......................] [R price]
```

- Extract a `<JobCardLayout doc currency vat variant="agenda|week|month" />` component. Use `flex min-w-0` + `truncate` everywhere. Address = `doc.fromAddress || doc.toAddress || "no address"`.
- Line 3 category = new helper `jobCategory(doc)` (see item 8).
- Month/mini keeps compact size (smaller text, drop the price if space is tight) but keeps the same three-line structure — no view-specific data.

### 8. Planner — soft styling for "other" category
Introduce a category resolver + palette map:

- New util `jobCategory(doc): "rubble"|"garden"|"furniture"|"waste"|"sand"|"tree"|"labour"|"other"` — scans `doc.items[].description` similar to `SUMMARY_KEYWORDS`, returns the first strong match else `"other"`.
- New `CATEGORY_STYLES` map with soft tinted backgrounds and readable foregrounds using existing theme tokens (e.g. `bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100` for `other`; distinct tints for the other categories). Apply to card root instead of the current `bg-background` / `bg-secondary/60`.

### 9. Planner — show notes on "other" jobs
In `JobCardLayout` when `jobCategory(doc) === "other"` AND `variant !== "month"` AND `doc.notes`:

- Render notes with `line-clamp-2 whitespace-pre-line text-[11px] text-muted-foreground` below line 3.

### 10. Multi-day jobs
Persist a `scheduled_end_date` column and render spans.

**DB migration** (`docs` table):
- `ALTER TABLE public.docs ADD COLUMN scheduled_end_date date NULL;` (no grant/policy changes; existing docs policies cover it).

**Types + store** (`src/lib/store.ts`): add `scheduledEndDate?: string` to `Doc`.

**Sync** (`src/lib/sync.ts`): read/write `scheduled_end_date` in `pushDoc` and `loadAll` mapper. Regenerated types picked up on next build.

**Edit UI** (`src/routes/doc.$id.tsx`): inside the "Scheduled date" card, add a "Multi-day job" checkbox; when on, show a second DatePicker bound to `scheduledEndDate` (must be ≥ scheduledDate; auto-clamp).

**Planner rendering** (`src/routes/planner.tsx`):
- Replace `plannerDate === iso` filter with a range check: doc appears on day `iso` when `iso ∈ [scheduledDate, scheduledEndDate ?? scheduledDate]` (or paid-fallback day for closed jobs).
- Drag: preserve span by shifting both dates by the same delta (compute delta in days from old start to new start).

### 11. Multi-day jobs — visual linkage
In `JobCardLayout`:

- If `scheduledEndDate` and it spans >1 day, compute `dayIdx` (1-based) and `dayN`. Render a small pill `"Day dayIdx/dayN"` with a `Link` icon (lucide `Link2`) on line 1, right of the name (before the payment dot).
- Continuation days (`dayIdx > 1`): apply `border-l-2 border-dashed border-muted-foreground/40 opacity-90` and slightly muted background.
- Applied uniformly to agenda / week / month via the shared layout.

---

## Technical notes

- New helpers land in `src/routes/planner.tsx` (kept local; they're planner-specific).
- Only one migration; everything else is store/sync/component work.
- No new packages needed (recharts + dnd-kit + lucide already present).
- Typecheck after each block; build-time verification at the end.
