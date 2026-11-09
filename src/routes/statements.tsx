import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore, fmtMoney, useCan, useIsOwner } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { Download, MessageCircle, Mail } from "lucide-react";
import { buildStatement, type CustomerStatement } from "@/lib/statements";
import { downloadStatementPdf, statementPdfFile } from "@/lib/statement-pdf";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/statements")({
  head: () => ({
    meta: [
      { title: "Customer Statements — KWOUT" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Monthly customer statements with 30/60/90/120 day aging, ready to download, WhatsApp or email." },
      { property: "og:title", content: "Customer Statements — KWOUT" },
      { property: "og:description", content: "Send aged customer statements in one tap." },
      { property: "og:url", content: "https://kwout.co.za/statements" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/statements" }],
  }),
  component: StatementsPage,
});

function StatementsPage() {
  const { docs, customers, company, banking, billing } = useStore();
  const canView = useCan("customers.view");
  const isOwner = useIsOwner();
  const nav = useNavigate();

  useEffect(() => {
    if (!canView) nav({ to: "/" });
  }, [canView, nav]);

  // yyyy-MM month selector, defaults to current month.
  const [monthStr, setMonthStr] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [customerId, setCustomerId] = useState<string>("");

  // Union of customers list and any customer id found on invoices (in case
  // customers table doesn't include all).
  const allCustomers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string; phone?: string; address?: string }>();
    for (const c of customers) map.set(c.id, c);
    for (const d of docs) {
      if (d.type !== "invoice") continue;
      if (!map.has(d.customer.id)) map.set(d.customer.id, d.customer);
    }
    // Only customers who actually have at least one invoice (statements aren't for quote-only leads).
    const withInvoices = new Set(docs.filter((d) => d.type === "invoice").map((d) => d.customer.id));
    return Array.from(map.values())
      .filter((c) => withInvoices.has(c.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [customers, docs]);

  useEffect(() => {
    if (!customerId && allCustomers.length) setCustomerId(allCustomers[0].id);
  }, [allCustomers, customerId]);

  const { periodStart, periodEnd } = useMemo(() => {
    const base = parse(monthStr + "-01", "yyyy-MM-dd", new Date());
    return { periodStart: startOfMonth(base), periodEnd: endOfMonth(base) };
  }, [monthStr]);

  const selected = allCustomers.find((c) => c.id === customerId);

  const statement: CustomerStatement | null = useMemo(() => {
    if (!selected) return null;
    return buildStatement(
      selected.id,
      { name: selected.name, email: selected.email, phone: selected.phone, address: selected.address },
      periodStart,
      periodEnd,
      docs,
      billing,
    );
  }, [selected, periodStart, periodEnd, docs, billing]);

  const totalOutstandingByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of allCustomers) {
      const s = buildStatement(
        c.id,
        { name: c.name, email: c.email, phone: c.phone, address: c.address },
        periodStart,
        periodEnd,
        docs,
        billing,
      );
      if (s.totalOutstanding > 0.005) map.set(c.id, s.totalOutstanding);
    }
    return map;
  }, [allCustomers, periodStart, periodEnd, docs, billing]);

  const onDownload = async () => {
    if (!statement) return;
    try {
      await downloadStatementPdf(statement, company, banking, billing);
    } catch (e) {
      console.error(e);
      toast.error("Could not create PDF");
    }
  };

  const summaryMessage = (s: CustomerStatement) =>
    [
      `Hi ${s.customerName || ""}`.trim() + ",",
      "",
      `Please find your statement for ${format(s.periodEnd, "MMMM yyyy")} (${s.statementNumber}).`,
      `Total outstanding: ${fmtMoney(s.totalOutstanding, billing.currency)}`,
      "",
      `Aging:`,
      `  Current: ${fmtMoney(s.aging.current, billing.currency)}`,
      `  30 days: ${fmtMoney(s.aging.d30, billing.currency)}`,
      `  60 days: ${fmtMoney(s.aging.d60, billing.currency)}`,
      `  90 days: ${fmtMoney(s.aging.d90, billing.currency)}`,
      `  120+ days: ${fmtMoney(s.aging.d120, billing.currency)}`,
      "",
      company.name ? `— ${company.name}` : "",
    ].filter((l) => l !== undefined).join("\n");

  const onWhatsApp = async () => {
    if (!statement) return;
    if (!statement.customerPhone) {
      toast.error("This customer has no phone number saved.");
      return;
    }
    // Auto-download the PDF so the user can attach it in WhatsApp.
    try {
      await downloadStatementPdf(statement, company, banking, billing);
      toast.message("PDF downloaded", { description: "Attach it to the WhatsApp chat." });
    } catch (e) {
      console.error(e);
    }
    openWhatsApp(statement.customerPhone, summaryMessage(statement));
  };

  const onEmail = async () => {
    if (!statement) return;
    if (!statement.customerEmail) {
      toast.error("This customer has no email address saved.");
      return;
    }
    const subject = `Statement ${statement.statementNumber} — ${format(statement.periodEnd, "MMMM yyyy")}`;
    const body = summaryMessage(statement);
    try {
      const file = await statementPdfFile(statement, company, banking, billing);
      // Prefer native share sheet on mobile so PDF is a real attachment.
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav && "canShare" in nav && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: subject, text: body });
          return;
        } catch { /* fall through */ }
      }
      // Desktop fallback: download the PDF and open a mailto draft.
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.message("PDF downloaded", { description: "Attach it to the email draft." });
      window.location.href = `mailto:${statement.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (e) {
      console.error(e);
      toast.error("Could not build the email");
    }
  };

  if (!canView) return null;

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display">Customer Statements</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monthly account statement with 30/60/90/120 day aging.
          </p>
        </div>
      </div>

      <Card className="p-3 mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="stmt-customer" className="text-xs">Customer</Label>
            <select
              id="stmt-customer"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {allCustomers.length === 0 && <option value="">No customers with invoices yet</option>}
              {allCustomers.map((c) => {
                const out = totalOutstandingByCustomer.get(c.id) ?? 0;
                const suffix = out > 0.005 ? ` — ${fmtMoney(out, billing.currency)} due` : "";
                return (
                  <option key={c.id} value={c.id}>
                    {c.name || "(unnamed)"}{suffix}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <Label htmlFor="stmt-month" className="text-xs">Statement month</Label>
            <Input
              id="stmt-month"
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </Card>

      {statement && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-1.5" /> Download PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={onWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
            </Button>
            <Button size="sm" variant="secondary" onClick={onEmail}>
              <Mail className="h-4 w-4 mr-1.5" /> Email
            </Button>
          </div>

          {/* Aging summary */}
          <Card className="p-3 mb-3">
            <div className="text-sm font-semibold mb-2">Aging summary — as of {format(statement.asOf, "d MMM yyyy")}</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              <AgingCell label="Current" value={statement.aging.current} cur={billing.currency} />
              <AgingCell label="30 days" value={statement.aging.d30} cur={billing.currency} />
              <AgingCell label="60 days" value={statement.aging.d60} cur={billing.currency} />
              <AgingCell label="90 days" value={statement.aging.d90} cur={billing.currency} />
              <AgingCell label="120+ days" value={statement.aging.d120} cur={billing.currency} tone="danger" />
              <AgingCell label="Total due" value={statement.totalOutstanding} cur={billing.currency} tone="primary" />
            </div>
          </Card>

          {/* Activity */}
          <Card className="p-0 overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <div className="text-sm font-semibold">
                Activity — {format(statement.periodStart, "d MMM")} to {format(statement.periodEnd, "d MMM yyyy")}
              </div>
              <div className="text-xs text-muted-foreground">{statement.statementNumber}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Ref</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2">Debit</th>
                    <th className="text-right px-3 py-2">Credit</th>
                    <th className="text-right px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t font-medium">
                    <td className="px-3 py-2">{format(statement.periodStart, "dd MMM")}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">Opening balance</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(statement.openingBalance, billing.currency)}</td>
                  </tr>
                  {statement.lines.length === 0 && (
                    <tr className="border-t">
                      <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No activity in this period.
                      </td>
                    </tr>
                  )}
                  {statement.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{format(new Date(l.date), "dd MMM")}</td>
                      <td className="px-3 py-2">{l.docNumber}</td>
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="px-3 py-2 text-right">{l.debit ? fmtMoney(l.debit, billing.currency) : ""}</td>
                      <td className="px-3 py-2 text-right">{l.credit ? fmtMoney(l.credit, billing.currency) : ""}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(l.balance, billing.currency)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-primary/10 font-semibold">
                    <td className="px-3 py-2" colSpan={5}>Closing balance</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(statement.closingBalance, billing.currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {!isOwner && (
            <p className="text-xs text-muted-foreground mt-3">
              Tip: only workspace owners see all customer balances in the aging list.
            </p>
          )}
        </>
      )}
    </Shell>
  );
}

function AgingCell({
  label, value, cur, tone,
}: { label: string; value: number; cur: string; tone?: "primary" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted/50";
  return (
    <div className={`rounded p-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-semibold">{fmtMoney(value, cur)}</div>
    </div>
  );
}
