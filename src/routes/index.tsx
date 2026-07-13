import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { ChevronRight, FileText, Truck, Check } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { clearBrandCookie } from "@/lib/brand-cookie";
const kwoutLogo = { url: "/kwout-logo.png" };

export const Route = createFileRoute("/")({
  component: IndexRoute,
  head: () => ({
    meta: [
      { title: "KWOUT — Run your business. Not your paperwork." },
      {
        name: "description",
        content:
          "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 days free, then R100/month. Everything included.",
      },
      { property: "og:title", content: "KWOUT — Run your business. Not your paperwork." },
      {
        property: "og:description",
        content: "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 days free, then R100/month. Everything included.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kwout.co.za/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KWOUT — Run your business. Not your paperwork." },
      { name: "twitter:description", content: "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 days free, then R100/month. Everything included." },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/" }],
  }),
});

function IndexRoute() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setState(data.user ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState(session?.user ? "in" : "out");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") return <div className="min-h-[100svh] bg-[#F5F5F0]" />;
  if (state === "out") return <Landing />;
  return <Dashboard />;
}

/* -------------------- Landing (signed out) -------------------- */

const INCLUDED = ["Quotes", "Invoices", "Statements", "Payslips", "Expenses", "Reports"];

function Landing() {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    for (const v of [
      "--primary",
      "--primary-foreground",
      "--accent",
      "--accent-foreground",
      "--secondary",
      "--secondary-foreground",
      "--ring",
    ]) {
      root.style.removeProperty(v);
    }
    clearBrandCookie();
  }, []);

  return (
    <div className="min-h-[100svh] bg-[#F5F5F0] text-[#111111]">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={kwoutLogo.url} alt="KWOUT" className="h-9 w-9 rounded object-contain" />
          <span className="font-display text-2xl tracking-wide">KWOUT</span>
        </div>
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="text-sm font-medium underline underline-offset-4 hover:text-primary"
        >
          Sign in
        </button>
      </header>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-8 sm:pt-16 pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-start">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-display leading-[0.9] tracking-tight text-[15vw] sm:text-8xl lg:text-[7.5rem] text-primary"
          >
            Run your <span className="text-[#3FA34D]">business</span>.<br />
            <span className="relative inline-block">
              Not your
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.6, ease: "easeInOut" }}
                viewBox="0 0 300 14"
                className="absolute -bottom-2 left-0 w-full h-3 text-[#3FA34D]"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <motion.path d="M4 8 C 70 2, 150 12, 296 4" />
              </motion.svg>
            </span>{" "}
            paperwork.
          </motion.h1>

          <p className="mt-8 text-lg sm:text-xl text-[#111111]/70 max-w-xl">
            <strong>Quotes —&nbsp;Invoices —&nbsp;Statements —&nbsp;Payslips</strong>
            <br />
            the whole KWOUT stationery, in your pocket.
            <span className="block mt-2 font-medium text-[#111111]">
              <br />
              30 days free. Everything included.
            </span>
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {INCLUDED.map((f) => (
              <li key={f} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#3FA34D]" strokeWidth={3} />
                <span className="font-medium">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <motion.div
            initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
            animate={{ rotate: -12, scale: 1, opacity: 1 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 120 }}
            className="absolute -top-6 -right-2 sm:-right-6 z-10 pointer-events-none"
          >
            <div className="border-4 border-[#3FA34D] text-[#3FA34D] rounded-full w-28 h-28 grid place-items-center text-center font-display tracking-widest text-sm leading-tight opacity-90">
              KWOUT
              <br />
              APPROVED
            </div>
          </motion.div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-xl p-6 sm:p-7">
            <div className="mb-4">
              <div className="font-display text-3xl tracking-wide text-primary">Start free</div>
              <div className="text-xs text-[#111111]/80 mt-1">No card needed. Set up in under a minute.</div>
            </div>
            <div className="grid gap-3">
              <Button className="h-11" onClick={() => navigate({ to: "/auth" })}>
                Start my 30-day free trial
              </Button>
              <Button variant="outline" className="h-11 bg-white" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-[#111111]/80">R100/month after your trial. Cancel anytime.</p>
        </div>
      </section>

      <footer className="border-t border-black/10 mt-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#111111]/80">
          <div className="flex items-center gap-2">
            <img src={kwoutLogo.url} alt="" className="h-5 w-5 rounded object-contain opacity-80" />
            <span className="font-display tracking-wide text-sm text-[#111111]">KWOUT</span>
          </div>
          <div>Made for entrepreneurs. Billed monthly by PayFast. Cancel anytime.</div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------- Dashboard (signed in) -------------------- */

function Dashboard() {
  const { docs, billing, upsertDoc } = useStore();

  useEffect(() => {
    const now = new Date();
    docs.forEach((d) => {
      if (
        d.type === "quote" &&
        !d.archived &&
        (d.status === "draft" || d.status === "sent") &&
        differenceInCalendarDays(now, new Date(d.createdAt)) > 10
      ) {
        upsertDoc({ ...d, archived: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = docs.filter((d) => !d.archived);
  const ARCHIVED_CUTOFF = "2026-07-10";
  const archived = docs.filter((d) => d.archived && (d.createdAt ?? "") >= ARCHIVED_CUTOFF);
  const [showArchived, setShowArchived] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const jobDate = (d: Doc) =>
    d.scheduledDate || (d.status === "paid" && d.paidAt ? format(new Date(d.paidAt), "yyyy-MM-dd") : undefined);
  const todayJobs = docs.filter((d) => jobDate(d) === today && d.status !== "cancelled");

  const thisMonth = format(new Date(), "yyyy-MM");
  const inThisMonth = (d: (typeof docs)[number]) => (d.createdAt ?? "").startsWith(thisMonth);
  const stats = {
    quotes: docs.filter((d) => d.type === "quote" && inThisMonth(d)).length,
    invoices: docs.filter((d) => d.type === "invoice" && inThisMonth(d)).length,
    outstanding: docs
      .filter((d) => d.type === "invoice" && d.status !== "paid")
      .reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0),
    paidThisMonth: docs
      .filter((d) => {
        if (d.status !== "paid") return false;
        const stamp = d.paidAt ?? d.createdAt;
        return stamp?.startsWith(thisMonth);
      })
      .reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0),
  };

  return (
    <Shell>
      <h1 className="sr-only">Business Dashboard</h1>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
        <Stat
          label="Outstanding"
          value={fmtMoney(stats.outstanding, billing.currency)}
          accent
          to="/docs"
          search={{ status: "unpaid" }}
        />
        <Stat label="Paid (month)" value={fmtMoney(stats.paidThisMonth, billing.currency)} />
        <Stat label="Quotes (month)" value={String(stats.quotes)} to="/docs" search={{ type: "quote" }} />
        <Stat label="Invoices (month)" value={String(stats.invoices)} to="/docs" search={{ type: "invoice" }} />
      </div>

      <Card className="p-3 sm:p-4">
        <Tabs defaultValue="today">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="today">
              <Truck className="h-4 w-4 mr-1.5" />
              Today ({todayJobs.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              <FileText className="h-4 w-4 mr-1.5" />
              Recent ({visible.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-0">
            {todayJobs.length === 0 ? (
              <Empty>No jobs scheduled today.</Empty>
            ) : (
              <List docs={todayJobs} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
          <TabsContent value="recent" className="mt-0">
            {visible.length === 0 ? (
              <Empty>Tap + to create your first quote or invoice.</Empty>
            ) : (
              <List docs={visible.slice(0, 15)} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {archived.length > 0 && (
        <div className="mt-4">
          <button className="text-xs text-muted-foreground underline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide" : "Show"} archived quotes ({archived.length})
          </button>
          {showArchived && (
            <Card className="p-3 mt-2">
              <ul className="divide-y">
                {archived.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-2">
                    <Link to="/doc/$id" params={{ id: d.id }} className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-muted-foreground">{d.number}</div>
                      <div className="font-medium truncate">{d.customer.name || "—"}</div>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => upsertDoc({ ...d, archived: false })}>
                      Unarchive
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}

function Stat({
  label,
  value,
  accent,
  to,
  search,
}: {
  label: string;
  value: string;
  accent?: boolean;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const body = (
    <>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display mt-1 leading-none ${accent ? "text-primary" : ""} text-xl sm:text-2xl truncate`}>
        {value}
      </div>
    </>
  );
  return (
    <Card
      className={cn(
        "p-3 sm:p-4",
        accent ? "border-primary/30 bg-primary/5" : "",
        to && "hover:bg-accent/50 transition-colors",
      )}
    >
      {to ? (
        <Link to={to} search={search} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{children}</p>;
}

function List({ docs, currency, vat }: { docs: Doc[]; currency: string; vat: number }) {
  return (
    <ul className="divide-y">
      {docs.map((d) => {
        const t = docTotals(d, vat);
        return (
          <li key={d.id}>
            <Link
              to="/doc/$id"
              params={{ id: d.id }}
              className="flex items-center gap-2 py-3 -mx-1 px-1 active:bg-muted rounded"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${d.type === "invoice" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {d.type}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{d.number}</span>
                  {d.status === "paid" && <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />}
                  {d.type === "invoice" && d.status !== "paid" && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">
                      unpaid
                    </span>
                  )}
                </div>

                <div className="font-medium truncate">{d.customer.name || "—"}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{fmtMoney(t.total, currency)}</div>
                {d.scheduledDate && (
                  <div className="text-[10px] text-muted-foreground">{format(new Date(d.scheduledDate), "d MMM")}</div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
