import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAllRows } from "@/lib/pagination";


const ADMIN_EMAILS = new Set(["dawie@polka.co.za", "julius@polka.co.za"]);
const MONTHLY_PRICE_ZAR = 100;
const TRIAL_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export interface AdminOverview {
  generatedAt: string;
  totals: {
    users: number;
    newUsers30d: number;
    payingUsers: number;
    trialActive: number;
    trialExpired: number;
    cancelled: number;
    pastDue: number;
    mrr: number;
    trialConversionPct: number;
  };
  activity: {
    docsCreated30d: number;
    invoicesPaid30d: number;
    gmvPaid30d: number;
    activeWorkspaces7d: number;
    totalWorkspaces: number;
    totalStaff: number;
    expensesLogged30d: number;
  };
  usersByMonth: { month: string; count: number }[];
  cumulativeUsers: { month: string; total: number }[];
  subscriptionBreakdown: { status: string; count: number }[];
  topWorkspaces: {
    userId: string;
    name: string;
    email: string;
    invoiceCount: number;
    paidGmv: number;
  }[];
  recentSignups: {
    userId: string;
    email: string;
    createdAt: string;
    subStatus: string;
  }[];
}

function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emptyMonths(n: number): { month: string; count: number }[] {
  const now = new Date();
  const out: { month: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: isoMonth(d), count: 0 });
  }
  return out;
}

async function requireAdmin(email: string | undefined) {
  if (!email || !ADMIN_EMAILS.has(email.toLowerCase())) {
    throw new Error("Forbidden: admin only");
  }
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const callerEmail = (context.claims.email as string | undefined) ?? "";
    await requireAdmin(callerEmail);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * MS_PER_DAY).toISOString();
    const since7 = new Date(now.getTime() - 7 * MS_PER_DAY).toISOString();

    // --- Users from auth ---
    // Admin API: paginate all users (KWOUT scale — hundreds/low thousands).
    const allUsers: { id: string; email: string; created_at: string }[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        allUsers.push({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
        });
      }
      if (data.users.length < 200) break;
    }

    const newUsers30d = allUsers.filter((u) => u.created_at >= since30).length;

    // --- Subscriptions ---
    const subs = await fetchAllRows<{
      user_id: string;
      status: string | null;
      trial_started_at: string | null;
      current_period_end: string | null;
      created_at: string;
    }>(() =>
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, status, trial_started_at, current_period_end, created_at"),
    );


    const subByUser = new Map<string, (typeof subs)[number]>();
    for (const s of subs) subByUser.set(s.user_id, s);

    const nowMs = now.getTime();
    let payingUsers = 0;
    let trialActive = 0;
    let trialExpired = 0;
    let cancelled = 0;
    let pastDue = 0;
    for (const s of subs) {
      const status = s.status ?? "trial";
      if (status === "active") payingUsers++;
      else if (status === "cancelled") cancelled++;
      else if (status === "past_due") pastDue++;
      else if (status === "trial") {
        const start = s.trial_started_at ? new Date(s.trial_started_at).getTime() : nowMs;
        const daysElapsed = Math.floor((nowMs - start) / MS_PER_DAY);
        if (daysElapsed >= TRIAL_DAYS) trialExpired++;
        else trialActive++;
      }
    }
    const noSub = Math.max(0, allUsers.length - subs.length);
    const trialConvBase = payingUsers + trialExpired;
    const trialConversionPct = trialConvBase > 0 ? Math.round((payingUsers / trialConvBase) * 100) : 0;
    const mrr = payingUsers * MONTHLY_PRICE_ZAR;

    // --- Users by month (last 12) ---
    const usersByMonth = emptyMonths(12);
    const monthIndex = new Map(usersByMonth.map((m, i) => [m.month, i]));
    for (const u of allUsers) {
      const key = isoMonth(new Date(u.created_at));
      const idx = monthIndex.get(key);
      if (idx !== undefined) usersByMonth[idx].count++;
    }
    // Cumulative across ALL history, but returned aligned to last 12 months
    const sortedUsers = [...allUsers].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let priorTotal = 0;
    const firstMonthKey = usersByMonth[0].month;
    for (const u of sortedUsers) {
      if (isoMonth(new Date(u.created_at)) < firstMonthKey) priorTotal++;
    }
    const cumulativeUsers: { month: string; total: number }[] = [];
    let running = priorTotal;
    for (const m of usersByMonth) {
      running += m.count;
      cumulativeUsers.push({ month: m.month, total: running });
    }

    // --- Docs (30d activity + GMV + per-user aggregates) ---
    const docs = await fetchAllRows<{
      owner_user_id: string | null;
      type: string;
      status: string;
      items: unknown;
      paid_at: string | null;
      created_at: string;
    }>(() =>
      supabaseAdmin
        .from("docs")
        .select("owner_user_id, type, status, items, paid_at, created_at"),
    );

    let docsCreated30d = 0;
    let invoicesPaid30d = 0;
    let gmvPaid30d = 0;
    const active7dUsers = new Set<string>();
    const perUser = new Map<string, { invoiceCount: number; paidGmv: number }>();

    const totalOf = (items: unknown): number => {
      if (!Array.isArray(items)) return 0;
      let s = 0;
      for (const it of items as Array<{ qty?: number; price?: number; unitPrice?: number }>) {
        const qty = Number(it.qty ?? 1) || 0;
        const price = Number(it.price ?? it.unitPrice ?? 0) || 0;
        s += qty * price;
      }
      return s;
    };

    for (const d of docs) {
      if (d.created_at >= since30) docsCreated30d++;
      if (d.created_at >= since7 && d.owner_user_id) active7dUsers.add(d.owner_user_id);
      if (d.type === "invoice") {
        const uid = d.owner_user_id ?? "";
        const bucket = perUser.get(uid) ?? { invoiceCount: 0, paidGmv: 0 };
        bucket.invoiceCount++;
        if (d.status === "paid") {
          const amt = totalOf(d.items);
          bucket.paidGmv += amt;
          if ((d.paid_at ?? d.created_at) >= since30) {
            invoicesPaid30d++;
            gmvPaid30d += amt;
          }
        }
        perUser.set(uid, bucket);
      }
    }

    // --- Expenses (30d + 7d activity) ---
    const expensesRaw = await fetchAllRows<{
      owner_user_id: string | null;
      created_at: string;
    }>(() => supabaseAdmin.from("expenses").select("owner_user_id, created_at"));
    let expensesLogged30d = 0;
    for (const e of expensesRaw) {
      if (e.created_at >= since30) expensesLogged30d++;
      if (e.created_at >= since7 && e.owner_user_id) active7dUsers.add(e.owner_user_id);
    }

    // --- Workspaces / company profile for names ---
    const workspacesRaw = await fetchAllRows<{ owner_user_id: string | null }>(() =>
      supabaseAdmin.from("workspaces").select("owner_user_id"),
    );
    const totalWorkspaces = workspacesRaw.length;

    const companyRaw = await fetchAllRows<{
      owner_user_id: string | null;
      company: unknown;
    }>(() => supabaseAdmin.from("company_profile").select("owner_user_id, company"));

    const nameByUser = new Map<string, string>();
    for (const c of companyRaw ?? []) {
      const co = (c.company as { name?: string } | null) ?? null;
      const nm = co?.name;
      if (nm && c.owner_user_id) nameByUser.set(c.owner_user_id, nm);
    }


    // --- Staff ---
    const { count: staffCount } = await supabaseAdmin
      .from("staff_members")
      .select("*", { count: "exact", head: true });

    // --- Top workspaces by invoice count ---
    const emailByUser = new Map(allUsers.map((u) => [u.id, u.email]));
    const topWorkspaces = [...perUser.entries()]
      .map(([userId, agg]) => ({
        userId,
        name: nameByUser.get(userId) || "—",
        email: emailByUser.get(userId) || "—",
        invoiceCount: agg.invoiceCount,
        paidGmv: Math.round(agg.paidGmv),
      }))
      .sort((a, b) => b.invoiceCount - a.invoiceCount || b.paidGmv - a.paidGmv)
      .slice(0, 10);

    // --- Recent signups (15) ---
    const recentSignups = [...allUsers]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 15)
      .map((u) => {
        const s = subByUser.get(u.id);
        let subStatus = "none";
        if (s) {
          if (s.status === "trial") {
            const start = s.trial_started_at ? new Date(s.trial_started_at).getTime() : nowMs;
            const daysElapsed = Math.floor((nowMs - start) / MS_PER_DAY);
            subStatus = daysElapsed >= TRIAL_DAYS ? "trial_expired" : "trial";
          } else {
            subStatus = s.status ?? "trial";
          }
        }
        return {
          userId: u.id,
          email: u.email,
          createdAt: u.created_at,
          subStatus,
        };
      });

    return {
      generatedAt: now.toISOString(),
      totals: {
        users: allUsers.length,
        newUsers30d,
        payingUsers,
        trialActive,
        trialExpired,
        cancelled,
        pastDue,
        mrr,
        trialConversionPct,
      },
      activity: {
        docsCreated30d,
        invoicesPaid30d,
        gmvPaid30d: Math.round(gmvPaid30d),
        activeWorkspaces7d: active7dUsers.size,
        totalWorkspaces,
        totalStaff: staffCount ?? 0,
        expensesLogged30d,
      },
      usersByMonth,
      cumulativeUsers,
      subscriptionBreakdown: [
        { status: "active", count: payingUsers },
        { status: "trial", count: trialActive },
        { status: "trial_expired", count: trialExpired },
        { status: "past_due", count: pastDue },
        { status: "cancelled", count: cancelled },
        { status: "no_sub", count: noSub },
      ].filter((s) => s.count > 0),
      topWorkspaces,
      recentSignups,
    };
  });
