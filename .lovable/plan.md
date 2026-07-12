## Customer Statements

Add monthly customer statements with an aging summary (Current / 30 / 60 / 90 / 120+ days overdue) that the owner can download as PDF, share via WhatsApp, or send via email.

### Where it lives

- New route `src/routes/statements.tsx` — reachable from the customers section of the Docs page (a "Statement" button per customer) and from a top-level "Statements" tab under Results.
- Owner + `docs.view` permission gated (matches how existing reports are gated).

### Statement contents

For a selected **customer** and **period** (defaults to current month, with a month picker + "as-of date"):
- Company header (logo, name, address, VAT/reg, banking) — reuses existing PDF header helper.
- Customer block (name, address, contact).
- Statement number (`STMT-{yyyyMM}-{customerShortId}`), statement date, period.
- Opening balance (sum of outstanding at period start).
- Line table of activity in the period: date, doc number, description, debit (invoice total), credit (payment), running balance. Payments = invoices marked `paid` with `paidAt` in period.
- Closing balance.
- **Aging buckets** based on invoice age vs. the as-of date, using invoice `createdAt`:
  - Current (0–29 days)
  - 30–59
  - 60–89
  - 90–119
  - 120+
  Each bucket sums the outstanding balance (total − deposit-if-paid) of unpaid/partially-paid invoices. Quotes are excluded.
- Total outstanding + banking details for payment.

### Computation (client-side)

New pure module `src/lib/statements.ts`:
- `buildStatement(customerId, asOf, docs, billing) → Statement` returning line items, opening/closing balance, and the five aging buckets.
- Uses existing `docTotals()` and `computeVat()`; ignores `archived` and `cancelled` docs.
- Considers `depositPaid` as a partial credit and `status === "paid"` with `paidAt` as full credit.

### PDF

New `src/lib/statement-pdf.ts` using the same `jsPDF` + `jspdf-autotable` stack as `payslip-pdf.ts` and `pdf.ts`:
- `generateStatementPdf(statement, company, banking)` → returns a Blob + suggested filename.
- Reuses styling from existing invoice PDF for brand consistency.

### Delivery

`StatementDialog` component with three actions:
1. **Download PDF** — triggers file save via existing helper.
2. **WhatsApp** — opens `wa.me/<phone>?text=<encoded>` with a short summary ("Statement for {month} — Total outstanding {amount}. Please see attached PDF."), and auto-downloads the PDF so the user can attach it in WhatsApp. Same pattern as payslips.
3. **Email** — sends via Lovable Emails (managed) using a new React Email template `customer-statement`. The PDF is regenerated server-side is not viable here (jsPDF is client-only) so the email body contains the statement summary + aging table inline, and links to a hosted copy — but since we have no public hosting for the PDF, v1 sends the summary inline via email and offers a "Download PDF" button next to it for the owner to attach manually if they need the full doc. If the user later wants the PDF attached, we'll switch to a server-rendered PDF; noted as follow-up.

**Prerequisite for email:** Lovable Emails domain must be configured. If not, the dialog's Email button opens the standard email-setup flow instead of sending.

### Files

- New: `src/routes/statements.tsx`, `src/lib/statements.ts`, `src/lib/statement-pdf.ts`, `src/components/statements/StatementDialog.tsx`, `src/lib/email-templates/customer-statement.tsx`, `src/lib/send-statement.functions.ts` (server fn), and a "Statement" entry in the customer row of `docs.tsx`.
- Edit: `src/routeTree.gen.ts` auto-updates. `src/lib/permissions.ts` gains a `statements.view` action defaulting to owner. `src/routes/results.tsx` gets a "Statements" tab link.

### Out of scope

- Attaching the generated PDF to the outbound email (needs server-side PDF renderer — noted as v2).
- Bulk-sending statements to all customers at once (v2 — add "Send to all with outstanding balance" after v1 is validated).
- Multi-currency; uses the existing `billing.currency`.
- Recording partial payments outside of the existing `depositPaid` field.