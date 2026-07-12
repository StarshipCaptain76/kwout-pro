## Goal

1. When adding an expense, auto-calculate VAT at the configured rate (South Africa = 15%) by default, with a per-expense toggle to mark it as **VAT-exempt / zero-rated** (e.g. basic foodstuffs, fuel).
2. Add a **VAT summary** section to the Reports page: VAT collected on paid invoices, VAT paid on expenses, and net VAT payable to SARS for the period.

## Changes

### 1. Expense entry (`src/routes/expenses.tsx`)
- Replace the raw "VAT (optional)" tumbler with a smarter block:
  - Checkbox: **"Includes VAT"** (default ON when `billing.vatPct > 0`).
  - When ON: VAT auto-computed as `amount − amount / (1 + vatPct/100)` and shown read-only (still overridable by tapping to edit).
  - When OFF: VAT cleared (zero-rated / exempt item).
- Recompute whenever `amount` or the toggle changes. AI-parsed VAT from a slip overrides the auto value.
- New expenses default `vatAmount` using the configured rate.

### 2. Store (`src/lib/store.ts`)
- Add a small helper `computeVat(amount, vatPct)` exported for reuse.
- No schema change — we keep using the existing `vatAmount` field. A zero/undefined `vatAmount` = exempt.

### 3. Reports page (`src/routes/results.tsx`)
Add a **VAT** card block (only rendered when `billing.vatPct > 0`) between the KPI stats and the charts:

```text
┌─ VAT (SARS)  ─── period: <label> ──────────────┐
│ Output VAT (collected)     R  1,234.00         │
│ Input VAT (paid on exp.)   R    567.00         │
│ ───────────────────────────────────────────    │
│ Net VAT payable            R    667.00         │
└────────────────────────────────────────────────┘
```

Calculations:
- **Output VAT** = sum of `docTotals(d, vatPct).vat` for `paid` invoices in range.
- **Input VAT** = sum of `e.vatAmount` for expenses in range (exempt items contribute 0).
- **Net payable** = Output − Input (negative = refund due).

Also add these three columns to the CSV export.

## Notes for the user

- Default VAT rate lives in **Settings → Billing → VAT %** — set it to 15 for South Africa. If left at 0, the VAT panel stays hidden.
- Common zero-rated / exempt items (brown bread, maize meal, fresh produce, most fuel purchases): open the expense and untick **"Includes VAT"**.
