import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, BarChart3, Settings,
  Cloud, CloudOff, Plus, FileText, Receipt, Wallet, LogIn, LogOut, User, Building2, ChevronDown, Check,
} from "lucide-react";
import { initSync, subscribeSync, switchWorkspace } from "@/lib/sync";
import { useStore, newId, useCan, type Doc } from "@/lib/store";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listMyWorkspaces, type WorkspaceDTO } from "@/lib/staff.functions";
import { toast } from "sonner";
import { readBrandCookie } from "@/lib/brand-cookie";
import { TrialBanner } from "@/components/app/TrialBanner";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { ShieldCheck } from "lucide-react";


const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, perm: null },
  { to: "/planner", label: "Planner", icon: Calendar, perm: "planner.view" as const },
  { to: "/expenses", label: "Expenses", icon: Wallet, perm: "expenses.addOwn" as const },
  { to: "/results", label: "Results", icon: BarChart3, perm: "reports.viewOwn" as const },
  { to: "/settings", label: "Settings", icon: Settings, perm: "settings.view" as const },
] as const;


function useVisibleNav() {
  const canPlanner = useCan("planner.view");
  const canExpenses = useCan("expenses.addOwn");
  const canResults = useCan("reports.viewOwn");
  const canSettings = useCan("settings.view");
  const allowed: Record<string, boolean> = {
    "/": true,
    "/planner": canPlanner,
    "/expenses": canExpenses,
    "/results": canResults,
    "/settings": canSettings,
  };
  return NAV_ITEMS.filter((n) => allowed[n.to]);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const company = useStore((s) => s.company);
  const visibleNav = useVisibleNav();

  // Read the cookie only after hydration to avoid SSR/client mismatch.
  const [cookieBrand, setCookieBrand] = useState<{ name?: string; logo?: string } | null>(null);
  useEffect(() => {
    const b = readBrandCookie();
    if (b) setCookieBrand({ name: b.n, logo: b.l });
  }, []);


  const name = company.name || cookieBrand?.name || "";
  const logo = company.logo || cookieBrand?.logo || "";
  const knowBrand = Boolean(name);

  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <header
        className="sticky top-0 z-40 bg-secondary text-secondary-foreground border-b-4 border-primary"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 flex items-center gap-3 h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2 min-w-0" aria-label={name || "Home"}>
            {logo ? (
              <img src={logo} alt={name} className="h-8 sm:h-10 w-auto rounded" />
            ) : knowBrand ? (
              <div className="h-8 sm:h-10 w-8 sm:w-10 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-sm sm:text-base">
                {name.slice(0, 1).toUpperCase()}
              </div>
            ) : (
              <div className="h-8 sm:h-10 w-8 sm:w-10 rounded bg-white/10 animate-pulse" aria-hidden />
            )}
            {knowBrand ? (
              <span className="font-display text-xl sm:text-2xl tracking-wide truncate">{name}</span>
            ) : (
              <span className="h-5 sm:h-6 w-28 sm:w-36 rounded bg-white/10 animate-pulse" aria-hidden />
            )}
          </Link>
          <nav className="hidden md:flex gap-1 ml-auto items-center">
            {visibleNav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={cn(
                    "px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
            <AdminNavLink path={path} />
          </nav>

          <div className="ml-auto md:ml-0 flex items-center gap-1">
            <WorkspaceSwitcher />
            <SyncBadge />
          </div>
          <AuthButton />
        </div>
      </header>
      <TrialBanner />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}

function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [newOpen, setNewOpen] = useState(false);
  const nav = useNavigate();
  const { billing, upsertDoc, nextDocNumber } = useStore();

  const create = (type: "quote" | "invoice") => {
    const id = newId();
    const d: Doc = {
      id,
      number: nextDocNumber(type),
      type,
      status: "draft",
      createdAt: new Date().toISOString(),
      customer: { id: newId(), name: "", phone: "", email: "" },
      items: [],
      depositPct: billing.defaultDepositPct,
      depositPaid: false,
    };
    upsertDoc(d);
    setNewOpen(false);
    nav({ to: "/doc/$id", params: { id } });
  };

  const canPlanner = useCan("planner.view");
  const canExpenses = useCan("expenses.addOwn");
  const canSettings = useCan("settings.view");
  const canCreateJob = useCan("jobs.create");

  type Tab =
    | { to: string; label: string; icon: typeof LayoutDashboard }
    | { fab: true };
  const tabs: Tab[] = [
    { to: "/", label: "Home", icon: LayoutDashboard },
    ...(canPlanner ? [{ to: "/planner", label: "Planner", icon: Calendar } as Tab] : []),
    ...(canCreateJob ? [{ fab: true } as Tab] : []),
    ...(canExpenses ? [{ to: "/expenses", label: "Expenses", icon: Wallet } as Tab] : []),
    ...(canSettings ? [{ to: "/settings", label: "Settings", icon: Settings } as Tab] : []),
  ];
  const colsClass =
    tabs.length >= 5 ? "grid-cols-5"
    : tabs.length === 4 ? "grid-cols-4"
    : tabs.length === 3 ? "grid-cols-3"
    : "grid-cols-2";


  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-secondary text-secondary-foreground border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className={cn("grid h-16 max-w-md mx-auto", colsClass)}>

          {tabs.map((t, i) => {
            if ("fab" in t) {
              return (
                <li key="fab" className="relative">
                  <button
                    onClick={() => setNewOpen(true)}
                    aria-label="Create new"
                    className="absolute left-1/2 -translate-x-1/2 -top-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Plus className="h-7 w-7" />
                  </button>
                </li>
              );
            }
            const active = t.to === "/" ? path === "/" : path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-secondary-foreground/70",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-3xl tracking-wide">CREATE NEW</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 mt-4 pb-[env(safe-area-inset-bottom)]">
            <Button size="lg" className="h-16 text-lg justify-start" onClick={() => create("quote")}>
              <FileText className="h-6 w-6 mr-3" />
              <div className="text-left">
                <div className="font-bold">New Quote</div>
                <div className="text-xs opacity-80 font-normal">Send an estimate</div>
              </div>
            </Button>
            <Button size="lg" variant="secondary" className="h-16 text-lg justify-start" onClick={() => create("invoice")}>
              <Receipt className="h-6 w-6 mr-3" />
              <div className="text-left">
                <div className="font-bold">New Invoice</div>
                <div className="text-xs opacity-80 font-normal">Bill a customer directly</div>
              </div>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SyncBadge() {
  const [s, setS] = useState<{ status: string; authed: boolean; error?: string }>({
    status: "idle",
    authed: false,
  });
  useEffect(() => {
    initSync();
    const unsub = subscribeSync(setS);
    return () => {
      unsub();
    };
  }, []);
  const Icon = s.status === "error" ? CloudOff : Cloud;
  const statusClass =
    s.status === "synced"
      ? "bg-green-500/20 text-green-500"
      : s.status === "error"
        ? "bg-destructive/20 text-destructive"
        : s.status === "loading" || s.status === "syncing"
          ? "bg-amber-500/20 text-amber-500"
          : "bg-white/10";
  const label = s.error
    ? s.error
    : s.status === "loading"
      ? "Loading…"
      : s.status === "syncing"
        ? "Saving…"
        : s.authed
          ? "Synced"
          : "Sign in to sync";
  return (
    <span
      title={label}
      className={cn(
        "px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium",
        statusClass,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}


function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!email) {
    return (
      <Link
        to="/auth"
        className="ml-1 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20"
        title="Sign in"
      >
        <LogIn className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <button
      onClick={async () => {
        const { useStore, clearAnonPersist } = await import("@/lib/store");
        await supabase.auth.signOut();
        useStore.getState().resetToDefaults();
        clearAnonPersist();
        toast.success("Signed out");
        navigate({ to: "/auth", replace: true });
      }}
      title={`Signed in as ${email} — click to sign out`}
      className="ml-1 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20"
    >
      <User className="h-3.5 w-3.5" />
      <span className="max-w-[140px] truncate">{email}</span>
      <LogOut className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}

function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([]);
  const [authed, setAuthed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const workspaceOwnerId = useStore((s) => s.currentWorkspaceOwnerId);
  const fetchWorkspaces = useServerFn(listMyWorkspaces);

  useEffect(() => {
    let cancel = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancel) return;
      const signedIn = !!data.user;
      setAuthed(signedIn);
      if (!signedIn) return;
      fetchWorkspaces()
        .then((list) => { if (!cancel) setWorkspaces(list); })
        .catch((e) => console.error("[WorkspaceSwitcher]", e));
    });
    return () => { cancel = true; };
  }, [fetchWorkspaces, workspaceOwnerId]);

  if (!authed || workspaces.length < 2) return null;

  const current =
    workspaces.find((w) => w.workspaceOwnerId === workspaceOwnerId) ?? workspaces[0];

  const pick = async (owner: string) => {
    if (owner === current.workspaceOwnerId || switching) return;
    setSwitching(true);
    try {
      await switchWorkspace(owner);
      toast.success("Switched workspace");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch workspace");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 max-w-[180px]"
        title="Switch workspace"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{current.businessName}</span>
        <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => {
          const isCurrent = w.workspaceOwnerId === current.workspaceOwnerId;
          return (
            <DropdownMenuItem
              key={w.workspaceOwnerId}
              onSelect={() => void pick(w.workspaceOwnerId)}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{w.businessName}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {w.isOwner ? "Owner" : w.role}
                </div>
              </div>
              {isCurrent && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminNavLink({ path }: { path: string }) {
  const { isAdmin } = useAdminAccess();
  if (!isAdmin) return null;
  const active = path.startsWith("/admin");
  return (
    <Link
      to="/admin"
      className={cn(
        "px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-white/10",
      )}
      title="Platform admin"
    >
      <ShieldCheck className="h-4 w-4" />
      <span>Admin</span>
    </Link>
  );
}

