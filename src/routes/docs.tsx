import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, invoiceView, quoteView, type Doc } from "@/lib/store";
import { ChevronRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Assignee = "all" | "mine" | "unassigned";
type StatusFilter = "draft" | "unpaid" | "overdue" | "paid" | "awaiting" | "accepted" | "declined";
const STATUS_VALUES: StatusFilter[] = ["draft", "unpaid", "overdue", "paid", "awaiting", "accepted", "declined"];
const STATUS_LABEL: Record<StatusFilter, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  awaiting: "Awaiting acceptance",
  accepted: "Accepted",
  declined: "Declined",
};

export const Route = createFileRoute("/docs")({
  component: DocsListPage,
  head: () => ({
    meta: [
      { title: "Quotes & Invoices — KWOUT" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Browse and filter your quotes and invoices, spot outstanding balances and assign work to staff." },
      { property: "og:title", content: "Quotes & Invoices — KWOUT" },
      { property: "og:description", content: "All your quotes and invoices in one list." },
      { property: "og:url", content: "https://kwout.co.za/docs" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/docs" }],
  }),
  validateSearch: (search: { type?: unknown; status?: unknown; who?: unknown }) => ({
    type: search.type === "quote" || search.type === "invoice" ? search.type : undefined,
    status: STATUS_VALUES.includes(search.status as StatusFilter) ? (search.status as StatusFilter) : undefined,
    who: (search.who === "mine" || search.who === "unassigned" ? search.who : "all") as Assignee,
  }),
});

function DocsListPage() {
  const { docs, billing, staff, currentStaff, currentUserId } = useStore();
  const { type, status, who } = useSearch({ from: "/docs" });
  const nav = useNavigate({ from: "/docs" });

  const isFieldStaff = currentStaff?.role === "staff";
  const effectiveWho: Assignee = isFieldStaff ? "mine" : who;
  const myId = currentStaff?.userId ?? currentUserId ?? "";
  const dueDays = billing.invoiceDueDays ?? 30;

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    staff.forEach((s) => m.set(s.userId, s.name || s.email));
    return m;
  }, [staff]);

  const title = status
    ? `${STATUS_LABEL[status as StatusFilter]} ${type ?? (["awaiting", "accepted", "declined"].includes(status) ? "quotes" : "invoices")}`
    : type === "quote"
      ? "Quotes"
      : type === "invoice"
        ? "Invoices"
        : "Quotes & Invoices";

  const filtered = docs
    .filter((d) => {
      if (type && d.type !== type) return false;
      if (!(d.type === "quote" || d.type === "invoice")) return false;
      if (status) {
        if (d.type === "invoice") {
          if (!["draft", "unpaid", "overdue", "paid"].includes(status)) return false;
          if (invoiceView(d, dueDays) !== status) return false;
        } else {
          if (!["draft", "awaiting", "accepted", "declined"].includes(status)) return false;
          if (quoteView(d) !== status) return false;
        }
      }
      if (effectiveWho === "mine" && d.assignedTo !== myId) return false;
      if (effectiveWho === "unassigned" && d.assignedTo) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl">{title}</h1>
      </div>

      {!isFieldStaff && staff.length > 0 && (
        <div className="flex gap-1 mb-3">
          {(["all", "mine", "unassigned"] as Assignee[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={effectiveWho === k ? "default" : "outline"}
              onClick={() => nav({ search: (s) => ({ ...s, who: k }) })}
              className="capitalize"
            >
              {k}
            </Button>
          ))}
        </div>
      )}

      <Card className="p-3 sm:p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No {status ? STATUS_LABEL[status as StatusFilter].toLowerCase() : type ?? "quotes or invoices"} found.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                currency={billing.currency}
                vat={billing.vatPct}
                assigneeName={d.assignedTo ? staffMap.get(d.assignedTo) : undefined}
              />
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function DocRow({
  doc, currency, vat, assigneeName,
}: {
  doc: Doc; currency: string; vat: number; assigneeName?: string;
}) {
  const t = docTotals(doc, vat);
  return (
    <li>
      <Link
        to="/doc/$id"
        params={{ id: doc.id }}
        className="flex items-center gap-2 py-3 -mx-1 px-1 active:bg-muted rounded"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                doc.type === "invoice"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {doc.type}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{doc.number}</span>
            {doc.status === "paid" && <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />}
            {doc.type === "invoice" && doc.status !== "paid" && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">unpaid</span>
            )}
            {assigneeName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {assigneeName}
              </span>
            )}
          </div>

          <div className="font-medium truncate">{doc.customer.name || "—"}</div>
          <div className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "d MMM yyyy")}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{fmtMoney(t.total, currency)}</div>
          {doc.scheduledDate && <div className="text-[10px] text-muted-foreground">{format(new Date(doc.scheduledDate), "d MMM")}</div>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}
