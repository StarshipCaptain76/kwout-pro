import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { createDocument } from "@/lib/create-document";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Check, ChevronRight, Building2, User, Wallet, Landmark, Users, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  to: string;
  search?: Record<string, string>;
}

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { company, banking, billing, catalog, customers, docs, onboardingDismissed, setOnboardingDismissed } = useStore();

  const tasks = useMemo<Task[]>(() => {
    const hasBillingBasics =
      !!billing.currency &&
      ((billing.ratePerKm ?? 0) > 0 || (billing.baseCallout ?? 0) > 0 || catalog.length > 0);
    return [
      {
        key: "account",
        label: "Account created",
        Icon: User,
        done: true,
        to: "/settings",
        search: { tab: "subscription" },
      },
      {
        key: "type",
        label: "Choose your business type",
        Icon: Building2,
        done: !!company.businessType && company.businessType !== "other",
        to: "/settings",
        search: { tab: "company" },
      },
      {
        key: "company",
        label: "Add company details",
        Icon: Building2,
        done: !!company.name?.trim() && (!!company.email?.trim() || !!company.phone?.trim()),
        to: "/settings",
        search: { tab: "company" },
      },
      {
        key: "billing",
        label: "Set up billing",
        Icon: Wallet,
        done: hasBillingBasics,
        to: "/settings",
        search: { tab: "billing" },
      },
      {
        key: "banking",
        label: "Add banking details",
        Icon: Landmark,
        done: !!banking.accountNumber?.trim(),
        to: "/settings",
        search: { tab: "banking" },
      },
      {
        key: "customer",
        label: "Add your first customer",
        Icon: Users,
        done: customers.length > 0,
        to: "/customers",
      },
      {
        key: "doc",
        label: "Create your first quote or invoice",
        Icon: FileText,
        done: docs.length > 0,
        to: "/docs",
      },
    ];
  }, [company, banking, billing, catalog, customers, docs]);

  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;

  if (onboardingDismissed) return null;
  if (doneCount >= total) return null;

  const pct = (doneCount / total) * 100;
  const circumference = 2 * Math.PI * 22; // r=22
  const dash = (pct / 100) * circumference;

  return (
    <Card className="p-0 overflow-hidden mb-4">
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        <div className="relative h-14 w-14 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="22"
              fill="none"
              stroke="hsl(142 71% 45%)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {doneCount} / {total}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Get up and running</div>
          <p className="text-sm text-foreground/80">Complete these tasks to get the most out of KWOUT.</p>
        </div>
        <button
          type="button"
          onClick={() => setOnboardingDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
          aria-label="Dismiss getting-started checklist"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="divide-y">
        {tasks.map((t) => (
          <li key={t.key}>
            {t.key === "doc" && !t.done ? <Button
              variant="ghost"
              className="w-full h-auto rounded-none justify-start gap-3 px-4 py-3 font-normal"
              onClick={() => { const id = createDocument("quote"); void navigate({ to: "/doc/$id", params: { id } }); }}
            >
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0 bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></span>
              <span className="text-sm flex-1 text-left whitespace-normal">{t.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button> : <Link
              to={t.to}
              search={t.search}
              className={cn(
                "flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors",
                t.done && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0",
                  t.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {t.done ? <Check className="h-4 w-4" /> : <t.Icon className="h-4 w-4" />}
              </span>
              <span className={cn("text-sm flex-1", t.done && "line-through decoration-muted-foreground/40")}>
                {t.label}
              </span>
              {t.done ? (
                <X className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </Link>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
