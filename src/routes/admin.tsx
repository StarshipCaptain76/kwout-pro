import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { format } from "date-fns";
import {
  Users, TrendingUp, DollarSign, Activity, Building2, Target,
  Loader2, ShieldAlert, FileText, Wallet, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";

import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getAdminOverview, type AdminOverview } from "@/lib/admin.functions";
import { fmtMoney } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Platform Console · KWOUT" },
      { name: "description", content: "KWOUT platform acquisition, revenue and subscription metrics." },
      { property: "og:title", content: "Platform Console · KWOUT" },
      { property: "og:description", content: "KWOUT platform acquisition, revenue and subscription metrics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  legacy_free: "Founding user · Free forever",
  active: "Active",
  trial: "Trial",
  trial_expired: "Trial expired",
  past_due: "Past due",
  cancelled: "Cancelled",
  no_sub: "No subscription",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-[#3FA34D]",
  trial: "bg-blue-500",
  trial_expired: "bg-orange-500",
  past_due: "bg-amber-500",
  cancelled: "bg-muted-foreground/50",
  no_sub: "bg-muted-foreground/20",
};

function AdminPage() {
  const { loading, isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getAdminOverview);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, isAdmin, navigate]);

  const { data, isLoading, error } = useQuery<AdminOverview>({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (loading || (isAdmin && !data && isLoading)) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell>
        <Card className="p-8 flex flex-col items-center text-center gap-3">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <div className="font-semibold">Restricted</div>
          <p className="text-sm text-muted-foreground">This page is for platform admins.</p>
        </Card>
      </Shell>
    );
  }
  if (error || !data) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="font-semibold text-destructive">Could not load metrics</div>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </Card>
      </Shell>
    );
  }

  const t = data.totals;
  const a = data.activity;
  const totalPipeline = data.subscriptionBreakdown.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <Shell>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-primary leading-none">
            Platform Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {format(new Date(data.generatedAt), "d MMM yyyy, HH:mm")}
          </p>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 mb-4">
        <Kpi label="MRR" value={fmtMoney(t.mrr, "ZAR")} icon={DollarSign} accent
          sub={`${t.payingUsers} paying`} />
        <Kpi label="Signups" value={String(t.users)} icon={Users}
          sub={`+${t.newUsers30d} in 30d`} />
        <Kpi label="Trial (active)" value={String(t.trialActive)} icon={Clock}
          sub={`${t.trialExpired} expired`} />
        <Kpi label="Paying" value={String(t.payingUsers)} icon={Building2}
          sub={`${t.pastDue} past due`} />
        <Kpi label="Trial → Paid" value={`${t.trialConversionPct}%`} icon={Target}
          sub="lifetime" />
        <Kpi label="GMV paid (30d)" value={fmtMoney(a.gmvPaid30d, "ZAR")} icon={TrendingUp}
          sub={`${a.invoicesPaid30d} invoices`} />
      </div>

      {/* Pipeline + activity */}
      <div className="grid gap-3 xl:grid-cols-12 mb-4">
        <Card className="p-4 xl:col-span-6">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Subscription pipeline
          </div>
          <div className="space-y-2.5">
            {data.subscriptionBreakdown.map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <span className="text-xs w-28 text-muted-foreground">
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STATUS_COLOR[row.status] ?? "bg-primary"} transition-all`}
                    style={{ width: `${(row.count / totalPipeline) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold w-8 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="xl:col-span-6 grid grid-cols-2 gap-2 sm:gap-3">
          <MiniStat label="Docs (30d)" value={String(a.docsCreated30d)} icon={FileText} />
          <MiniStat label="Active users (7d)" value={String(a.activeWorkspaces7d)} icon={Activity} />
          <MiniStat label="Workspaces" value={String(a.totalWorkspaces)} icon={Building2} />
          <MiniStat label="Staff seats" value={String(a.totalStaff)} icon={Users} />
          <MiniStat label="Expenses (30d)" value={String(a.expensesLogged30d)} icon={Wallet} />
          <MiniStat label="Paid invoices (30d)" value={String(a.invoicesPaid30d)} icon={DollarSign} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2 mb-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            User acquisition (12 mo)
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.usersByMonth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#3FA34D" radius={[3, 3, 0, 0]} name="New signups" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Cumulative users
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cumulativeUsers} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="admCumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3FA34D" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3FA34D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#3FA34D" fill="url(#admCumGrad)" strokeWidth={2} name="Total" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top workspaces */}
      <Card className="p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Top workspaces (by invoices)
        </div>
        {data.topWorkspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoice activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Business</th>
                  <th className="py-2 pr-3">Owner email</th>
                  <th className="py-2 pr-3 text-right">Invoices</th>
                  <th className="py-2 text-right">Paid GMV</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topWorkspaces.map((w) => (
                  <tr key={w.userId}>
                    <td className="py-2 pr-3 font-medium">{w.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[220px]">{w.email}</td>
                    <td className="py-2 pr-3 text-right">{w.invoiceCount}</td>
                    <td className="py-2 text-right font-semibold">{fmtMoney(w.paidGmv, "ZAR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent signups */}
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Recent signups
        </div>
        <ul className="divide-y">
          {data.recentSignups.map((u) => (
            <li key={u.userId} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{u.email || "—"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(u.createdAt), "d MMM yyyy, HH:mm")}
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">
                {STATUS_LABEL[u.subStatus] ?? u.subStatus}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}

function Kpi({
  label, value, sub, icon: Icon, accent,
}: { label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean }) {
  return (
    <Card className={`p-3 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`font-display mt-1 leading-none text-xl sm:text-2xl truncate ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</div>}
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="font-display mt-1 leading-none text-xl truncate">{value}</div>
    </Card>
  );
}
