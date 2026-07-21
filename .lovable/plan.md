# Accounting Data Export

Give owners the ability to export invoices, payments, and expenses to formats their accountant can import into QuickBooks, Sage, or plain Excel.

## 1. Owner setting

In **Settings → Billing** (or a new "Accounting" card):
- **Preferred accounting package** dropdown: `CSV (Excel)` [default], `QuickBooks Online (IIF/CSV)`, `Sage (CSV)`, `All formats`.
- Persist on `company_profile.accounting_package` (new column, text, default `csv`).
- Only owners see and change this (staff hidden per existing permissions).

## 2. Export UI

Add an **"Export accounting"** card on the Settings page (owner-only) with:
- Date range picker (This month / Last month / YTD / Custom).
- Data-set checkboxes: Invoices, Payments received, Expenses, Customers.
- Format selector — defaults to the owner's preferred package, but always allows `CSV` fallback.
- "Download" button generates one `.zip` (or single `.csv` when only one set is chosen).

Also add a small **"Export"** button on the Expenses page that reuses the same generator for expenses only, honoring the preferred format.

## 3. Format spec

All generation client-side (no backend needed) using existing store data.

- **CSV (default / Excel)** — one file per data set, plain headers (`Date, Number, Customer, Subtotal, Tax, Total, Status, ...`). Uses `;`-safe quoting and UTF-8 BOM so Excel opens ZAR characters correctly.
- **QuickBooks Online** — CSV shapes matching QBO's import templates:
  - Invoices: `InvoiceNo, Customer, InvoiceDate, DueDate, Item(Product/Service), ItemDescription, ItemQuantity, ItemRate, ItemAmount, ItemTaxCode, ItemTaxAmount`.
  - Customers: `Name, Company, Email, Phone, BillingAddress...`.
  - Expenses: `Date, Payee, Account, Amount, Memo`.
- **Sage** — CSV matching Sage Accounting's import layout:
  - Sales invoices: `Date, Reference, Customer, Description, Net, VAT, Total, Ledger`.
  - Expenses/purchases: `Date, Reference, Supplier, Description, Net, VAT, Total, Ledger`.
  - Customers: `Reference, Name, Email, Phone, Address 1..5, VAT number`.

VAT rate comes from `company_profile.tax_rate`; blank when 0.

## 4. Files to add / change

- `supabase/migrations/*` — add `company_profile.accounting_package` text default `'csv'`.
- `src/lib/store.ts` — extend `CompanyProfile` type + default.
- `src/lib/sync.ts` — include new column in upsert/select.
- `src/lib/exports/accounting.ts` (new) — pure functions that turn `Doc[] / Expense[] / Customer[]` into CSV strings per format, plus a `buildExportZip()` helper (uses existing `jszip` if present, else concatenates single-file download).
- `src/components/app/AccountingExportCard.tsx` (new) — Settings UI.
- `src/routes/settings.tsx` — mount the card in Billing tab and add the package selector.
- `src/routes/expenses.tsx` — add "Export" button wired to the same generator.

## Out of scope

- No live API push to QuickBooks/Sage (OAuth integrations). This is file export only, which covers 100% of the "give this to my accountant" use case.
- Payslips export (already handled elsewhere) unless you want it bundled — say the word and I'll include it.
