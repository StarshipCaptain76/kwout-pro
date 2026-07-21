// Accounting data export.
//
// Turns the local store's docs / expenses / customers into CSV strings
// tailored to a target accounting package. Everything runs client-side —
// no server round-trip needed.

import type { Doc, Expense, Customer, BillingSettings } from "@/lib/store";

export type AccountingPackage = "csv" | "quickbooks" | "sage";

export const ACCOUNTING_PACKAGES: Array<{ value: AccountingPackage; label: string; hint: string }> = [
  { value: "csv", label: "CSV (Excel)", hint: "Plain CSV — opens in Excel, Numbers, Google Sheets." },
  { value: "quickbooks", label: "QuickBooks Online", hint: "CSV shapes matching QuickBooks Online's import templates." },
  { value: "sage", label: "Sage Accounting", hint: "CSV shapes matching Sage Accounting's import layout." },
];

export type DataSet = "invoices" | "quotes" | "payments" | "expenses" | "customers";

// ─── CSV helpers ────────────────────────────────────────────────────────────
const BOM = "\uFEFF"; // makes Excel open UTF-8 correctly
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows: Array<Array<unknown>>): string {
  return BOM + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
function docSubtotal(d: Doc): number {
  return d.items.reduce((sum, it) => sum + it.qty * it.price, 0);
}
function docTax(d: Doc, vatPct: number): number {
  return vatPct > 0 ? docSubtotal(d) * (vatPct / 100) : 0;
}
function docTotal(d: Doc, vatPct: number): number {
  return docSubtotal(d) + docTax(d, vatPct);
}
function inRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

// ─── CSV (default) ──────────────────────────────────────────────────────────
function csvInvoices(docs: Doc[], billing: BillingSettings): string {
  const vat = billing.chargesVat ? billing.vatPct : 0;
  const header = ["Date", "Number", "Type", "Status", "Customer", "Email", "Phone", "Subtotal", "VAT", "Total", "Currency", "Notes"];
  const rows = docs.map((d) => [
    d.createdAt.slice(0, 10),
    d.number,
    d.type,
    d.status,
    d.customer?.name ?? "",
    d.customer?.email ?? "",
    d.customer?.phone ?? "",
    money(docSubtotal(d)),
    money(docTax(d, vat)),
    money(docTotal(d, vat)),
    billing.currency,
    d.notes ?? "",
  ]);
  return toCsv([header, ...rows]);
}
function csvPayments(docs: Doc[], billing: BillingSettings): string {
  const vat = billing.chargesVat ? billing.vatPct : 0;
  const header = ["Paid date", "Invoice #", "Customer", "Amount", "Method", "Currency"];
  const rows = docs
    .filter((d) => d.status === "paid" && d.paidAt)
    .map((d) => [d.paidAt!.slice(0, 10), d.number, d.customer?.name ?? "", money(docTotal(d, vat)), d.paymentMethod ?? "", billing.currency]);
  return toCsv([header, ...rows]);
}
function csvExpenses(expenses: Expense[], billing: BillingSettings): string {
  const header = ["Date", "Category", "Vendor", "Description", "Amount", "VAT", "Payment method", "Currency", "Notes"];
  const rows = expenses.map((e) => [
    e.date,
    e.category,
    e.vendor,
    e.description ?? "",
    money(e.amount),
    money(e.vatAmount ?? 0),
    e.paymentMethod ?? "",
    billing.currency,
    e.notes ?? "",
  ]);
  return toCsv([header, ...rows]);
}
function csvCustomers(customers: Customer[]): string {
  const header = ["Name", "Email", "Phone", "Address"];
  const rows = customers.map((c) => [c.name, c.email, c.phone, c.address ?? ""]);
  return toCsv([header, ...rows]);
}

// ─── QuickBooks Online ──────────────────────────────────────────────────────
function qboInvoices(docs: Doc[], billing: BillingSettings): string {
  const vat = billing.chargesVat ? billing.vatPct : 0;
  const taxCode = vat > 0 ? "VAT" : "NON";
  const header = [
    "InvoiceNo", "Customer", "InvoiceDate", "DueDate",
    "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount",
    "ItemTaxCode", "ItemTaxAmount", "Currency",
  ];
  const rows: Array<Array<unknown>> = [];
  for (const d of docs.filter((x) => x.type === "invoice")) {
    for (const it of d.items) {
      const amount = it.qty * it.price;
      const itemTax = vat > 0 ? amount * (vat / 100) : 0;
      rows.push([
        d.number, d.customer?.name ?? "",
        d.createdAt.slice(0, 10), d.createdAt.slice(0, 10),
        it.description, it.description,
        it.qty, money(it.price), money(amount),
        taxCode, money(itemTax), billing.currency,
      ]);
    }
  }
  return toCsv([header, ...rows]);
}
function qboExpenses(expenses: Expense[]): string {
  const header = ["Date", "Payee", "Account", "Amount", "Memo", "PaymentMethod"];
  const rows = expenses.map((e) => [
    e.date, e.vendor, e.category, money(e.amount + (e.vatAmount ?? 0)),
    e.description ?? e.notes ?? "", e.paymentMethod ?? "",
  ]);
  return toCsv([header, ...rows]);
}
function qboCustomers(customers: Customer[]): string {
  const header = ["Name", "Company", "Email", "Phone", "BillingAddress"];
  const rows = customers.map((c) => [c.name, c.name, c.email, c.phone, c.address ?? ""]);
  return toCsv([header, ...rows]);
}

// ─── Sage Accounting ────────────────────────────────────────────────────────
function sageInvoices(docs: Doc[], billing: BillingSettings): string {
  const vat = billing.chargesVat ? billing.vatPct : 0;
  const header = ["Date", "Reference", "Customer", "Description", "Net", "VAT", "Total", "Ledger"];
  const rows = docs
    .filter((d) => d.type === "invoice")
    .map((d) => [
      d.createdAt.slice(0, 10),
      d.number,
      d.customer?.name ?? "",
      d.items.map((it) => it.description).join("; ") || "Sales",
      money(docSubtotal(d)),
      money(docTax(d, vat)),
      money(docTotal(d, vat)),
      "Sales",
    ]);
  return toCsv([header, ...rows]);
}
function sageExpenses(expenses: Expense[]): string {
  const header = ["Date", "Reference", "Supplier", "Description", "Net", "VAT", "Total", "Ledger"];
  const rows = expenses.map((e, i) => {
    const net = e.amount;
    const vatAmt = e.vatAmount ?? 0;
    return [e.date, `EXP-${String(i + 1).padStart(5, "0")}`, e.vendor, e.description ?? e.category, money(net), money(vatAmt), money(net + vatAmt), e.category];
  });
  return toCsv([header, ...rows]);
}
function sageCustomers(customers: Customer[]): string {
  const header = ["Reference", "Name", "Email", "Phone", "Address 1", "VAT number"];
  const rows = customers.map((c, i) => [`CUST${String(i + 1).padStart(4, "0")}`, c.name, c.email, c.phone, c.address ?? "", ""]);
  return toCsv([header, ...rows]);
}

// ─── Public API ────────────────────────────────────────────────────────────
export interface ExportInput {
  docs: Doc[];
  expenses: Expense[];
  customers: Customer[];
  billing: BillingSettings;
  from?: string; // yyyy-mm-dd inclusive
  to?: string;   // yyyy-mm-dd inclusive
  sets: DataSet[];
  pkg: AccountingPackage;
}
export interface ExportFile {
  name: string;
  content: string;
  mime: string;
}

export function buildExportFiles(input: ExportInput): ExportFile[] {
  const { pkg, sets, from, to, billing } = input;
  const docs = input.docs.filter((d) => inRange(d.createdAt.slice(0, 10), from, to));
  const invoices = docs.filter((d) => d.type === "invoice");
  const quotes = docs.filter((d) => d.type === "quote");
  const expenses = input.expenses.filter((e) => inRange(e.date, from, to));
  const customers = input.customers;
  const tag = pkg === "csv" ? "csv" : pkg === "quickbooks" ? "quickbooks" : "sage";
  const range = from || to ? `_${from ?? "start"}_${to ?? "end"}` : "";
  const mk = (name: string, content: string): ExportFile => ({
    name: `kwout_${tag}_${name}${range}.csv`,
    content,
    mime: "text/csv;charset=utf-8",
  });

  const out: ExportFile[] = [];
  for (const set of sets) {
    if (set === "invoices") {
      if (pkg === "quickbooks") out.push(mk("invoices", qboInvoices(invoices, billing)));
      else if (pkg === "sage") out.push(mk("invoices", sageInvoices(invoices, billing)));
      else out.push(mk("invoices", csvInvoices(invoices, billing)));
    } else if (set === "quotes") {
      // Quotes are proposal documents, not accounting postings — plain CSV for every format.
      out.push(mk("quotes", csvInvoices(quotes, billing)));
    } else if (set === "payments") {
      out.push(mk("payments", csvPayments(invoices, billing)));
    } else if (set === "expenses") {
      if (pkg === "quickbooks") out.push(mk("expenses", qboExpenses(expenses)));
      else if (pkg === "sage") out.push(mk("expenses", sageExpenses(expenses)));
      else out.push(mk("expenses", csvExpenses(expenses, billing)));
    } else if (set === "customers") {
      if (pkg === "quickbooks") out.push(mk("customers", qboCustomers(customers)));
      else if (pkg === "sage") out.push(mk("customers", sageCustomers(customers)));
      else out.push(mk("customers", csvCustomers(customers)));
    }
  }
  return out;
}

export function downloadFiles(files: ExportFile[]): void {
  for (const f of files) {
    const blob = new Blob([f.content], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
