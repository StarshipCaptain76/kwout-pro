## Payslips module (Reports → Payslips)

Owner-only feature that generates SA-compliant payslips for staff, wired as a second tab on the Reports page.

### 1. Data model (one migration)

Add compensation fields to `staff_members`:
- `pay_type` text: `salary` | `hourly` | `commission` | `manual` (default `salary`)
- `base_salary` numeric (monthly, for `salary`)
- `hourly_rate` numeric (for `hourly`)
- `commission_pct` numeric (0–100, % of assigned/completed jobs revenue in period)
- `id_number` text (SA ID, appears on payslip)
- `tax_status` text: `paye` | `provisional` | `exempt` (default `paye`)

New table `payslips` (owner-scoped, owner-only RLS):
- `workspace_owner_id`, `staff_id`, `period_start`, `period_end`, `period_label`
- `hours` numeric, `gross` numeric, `commission_amount` numeric
- `paye`, `uif_employee`, `uif_employer`, `sdl`, `other_deductions` numeric
- `deductions_breakdown` jsonb (line items shown on the payslip)
- `net` numeric, `status` text (`draft` | `finalized`), `finalized_at`, `sent_at`
- Standard `id`, `created_at`, `updated_at`, GRANTs, RLS `workspace_owner_id = auth.uid()`, updated_at trigger.

### 2. Statutory calculations (`src/lib/payroll.ts`)

Pure functions, easy to unit-test, using SA 2025/26 tables (annualise monthly gross, apply brackets, primary rebate R17,235; +65 rebate; +75 rebate; UIF 1% employee + 1% employer capped at R177.12 each on R17,712 ceiling; SDL 1% employer if payroll > R500k p.a. — owner toggle in settings; tax_status `provisional` skips PAYE, `exempt` skips PAYE+UIF).

Exports:
- `calcPAYE(monthlyGross, age)` → number
- `calcUIF(monthlyGross)` → `{ employee, employer }`
- `calcSDL(monthlyGross, enabled)` → number
- `computeGross(staff, { hours, periodStart, periodEnd, docs })` → `{ gross, commissionAmount, breakdown }`

### 3. Server functions (`src/lib/payslips.functions.ts`, owner-only)

All use `requireSupabaseAuth` and check the caller is the workspace owner (not staff).
- `listPayslips({ from, to })`
- `generatePayslipDraft({ staffId, periodStart, periodEnd, hours?, manualGross? })` — computes gross from staff config + jobs assigned in period, applies statutory calcs, returns draft (not saved).
- `savePayslip(draft)` / `finalizePayslip(id)` / `deletePayslip(id)`
- `markPayslipSent(id, channel)` — records `sent_at`.

### 4. UI

**Reports page** — convert single view into tabs (shadcn `Tabs`): "Overview" (existing content) + "Payslips" (owner-only; hidden for staff via `can()` check on a new `payslips.view` action, defaulted true for owner role only).

**Payslips tab** (`src/components/payslips/PayslipsTab.tsx`):
- Period picker (month selector, defaults to previous month) + "Include SDL" toggle.
- Staff table: name, pay type, hours input (only for hourly), commission auto-preview, gross, PAYE, UIF, net, status chip, actions.
- "Generate all" button creates drafts for every active staff member.
- Row click → `PayslipDialog` showing formatted payslip (company header from `company_profile`, employee details, earnings lines, deductions lines, net pay, YTD totals if available).
- Dialog actions: **Download PDF**, **Email**, **WhatsApp**, **Finalize**.

**PDF generation** (`src/lib/payslip-pdf.ts`) — client-side using `jspdf` + `jspdf-autotable` (already in the stack for docs; if not, add). Filename `payslip-{staffName}-{period}.pdf`.

**Email send** — calls a new server route `/api/payslips/send-email` that renders a React Email template (`src/lib/email-templates/payslip.tsx`) and calls `sendTemplateEmail('payslip', staff.email, { templateData })`. Requires `email_domain--scaffold_transactional_email_templates` if not yet done + email domain setup (checked in-flow; prompts owner to set it up first if missing).

**WhatsApp send** — `wa.me/{phone}?text=` link with pre-filled message ("Your payslip for {period}: Gross Rxx, Net Rxx. PDF attached separately."); PDF must be downloaded and attached manually (WhatsApp deep-links don't support attachments).

**Compensation fields** — add a "Compensation" section to the existing staff edit dialog in Settings: pay type dropdown, base salary / hourly rate / commission %, ID number, tax status.

### 5. Access & scope

- Owner-only across the board (no staff self-view in this iteration, matching answer to Access question).
- `can("payslips.view")` gates the Reports tab and Settings compensation section.
- All server fns re-verify the caller is the workspace owner (not just a manager) before returning data.

### 6. Files touched / added

Added:
- `supabase/migrations/*_payslips.sql`
- `src/lib/payroll.ts`, `src/lib/payslips.functions.ts`, `src/lib/payslip-pdf.ts`
- `src/lib/email-templates/payslip.tsx` (+ registry update)
- `src/routes/api/payslips.send-email.ts`
- `src/components/payslips/PayslipsTab.tsx`, `PayslipDialog.tsx`, `CompensationSection.tsx`

Edited:
- `src/routes/results.tsx` — wrap in Tabs, mount `PayslipsTab`
- `src/routes/settings.tsx` — add Compensation section inside staff edit
- `src/lib/permissions.ts` — new `payslips.view` / `payslips.manage` actions (owner-only default)
- `src/lib/store.ts` — extend `StaffMember` type with compensation fields

### 7. Out of scope (per your "Standard" choice)

Loans / IOU / salary advances, YTD PAYE certificates (IRP5), multi-currency, staff self-service payslip inbox — all deferrable to a later iteration.
