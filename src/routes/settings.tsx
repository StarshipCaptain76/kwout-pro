import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, newId, BUILTIN_UNITS, DEFAULT_THEME, type Unit, type Density } from "@/lib/store";
import { Trash2, Plus, Search, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/store";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { Slider } from "@/components/ui/slider";
import { LogoUploader } from "@/components/app/LogoUploader";
import { ColorPicker } from "@/components/app/ColorPicker";
import { StaffSection } from "@/components/app/StaffSection";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription, createPayfastCheckout, cancelMySubscription } from "@/lib/subscription.functions";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — KWOUT" },
      { name: "description", content: "Manage your KWOUT subscription, company profile, banking, staff, catalog, billing and appearance." },
      { property: "og:title", content: "Settings — KWOUT" },
      { property: "og:description", content: "Company, subscription and workspace settings for KWOUT." },
      { property: "og:url", content: "https://kwout.co.za/settings" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/settings" }],
  }),
});

const CURRENCIES = [
  { code: "R", label: "ZAR (R)" },
  { code: "N$", label: "NAD (N$)" },
  { code: "$", label: "USD ($)" },
  { code: "€", label: "EUR (€)" },
  { code: "£", label: "GBP (£)" },
  { code: "A$", label: "AUD (A$)" },
  { code: "C$", label: "CAD (C$)" },
  { code: "NZ$", label: "NZD (NZ$)" },
];

function SettingsPage() {
  const s = useStore();
  return (
    <Shell>
      <h1 className="sr-only">Settings</h1>
      <Tabs defaultValue="subscription">
        <TabsList className="mb-4 w-full grid grid-cols-8">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          <SubscriptionSection />
        </TabsContent>

        <TabsContent value="staff">
          <StaffSection />
        </TabsContent>

        <TabsContent value="company">
          <div className="grid gap-4 max-w-2xl">
            <Card className="p-4 sm:p-6 grid gap-4">
              <div>
                <Label className="mb-2 block">Logo</Label>
                <LogoUploader
                  value={s.company.logo}
                  onChange={(v) => s.setCompany({ ...s.company, logo: v })}
                />
              </div>
              {(["name", "tagline", "address", "phone", "email"] as const).map((k) => (
                <div key={k}>
                  <Label className="capitalize">{k}</Label>
                  <Input
                    className="h-11"
                    value={s.company[k] ?? ""}
                    onChange={(e) => s.setCompany({ ...s.company, [k]: e.target.value })}
                  />
                </div>
              ))}
              <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="banking">
          <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl">
            {(["accountName", "accountNumber", "bank", "branchCode", "branchName", "swiftCode"] as const).map((k) => (
              <div key={k}>
                <Label>{k}</Label>
                <Input className="h-11" value={s.banking[k]} onChange={(e) => s.setBanking({ ...s.banking, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogEditor />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpenseCategoriesEditor />
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid gap-4 max-w-2xl">
            <Card className="p-4 sm:p-6 grid gap-3">
              <div>
                <Label>Currency</Label>
                <select
                  className="h-11 w-full border rounded-md px-2 bg-background text-sm"
                  value={s.billing.currency}
                  onChange={(e) => s.setBilling({ ...s.billing, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              <PrimaryUnitEditor />

              <TumblerField
                label={`Rate per ${s.billing.primaryUnit || "unit"}`}
                v={s.billing.ratePerKm}
                on={(v) => s.setBilling({ ...s.billing, ratePerKm: v })}
                step={1}
                fineStep={0.5}
                prefix={`${s.billing.currency} `}
              />
              <TumblerField label="Base callout fee" v={s.billing.baseCallout} on={(v) => s.setBilling({ ...s.billing, baseCallout: v })} step={50} fineStep={10} prefix={`${s.billing.currency} `} />
              <PctSlider label="Default deposit" v={s.billing.defaultDepositPct} on={(v) => s.setBilling({ ...s.billing, defaultDepositPct: v })} />
              <div className="border rounded-md p-3 grid gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!s.billing.chargesVat}
                    onChange={(e) => {
                      const on = e.target.checked;
                      s.setBilling({
                        ...s.billing,
                        chargesVat: on,
                        vatPct: on ? Math.min(s.billing.vatPct || 15, 15) || 15 : 0,
                      });
                    }}
                  />
                  My business charges VAT
                </label>
                {s.billing.chargesVat && (
                  <>
                    <PctSlider
                      label="VAT rate (max 15%)"
                      v={Math.min(s.billing.vatPct || 15, 15)}
                      on={(v) => s.setBilling({ ...s.billing, vatPct: Math.min(v, 15) })}
                      max={15}
                    />
                    <div>
                      <Label>VAT number</Label>
                      <Input
                        className="h-11"
                        value={s.billing.vatNumber ?? ""}
                        placeholder="e.g. 4123456789"
                        onChange={(e) => s.setBilling({ ...s.billing, vatNumber: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Shown on quotes &amp; invoices. VAT is added automatically to line totals and to expenses.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quote prefix</Label><Input className="h-11" value={s.billing.quotePrefix} onChange={(e) => s.setBilling({ ...s.billing, quotePrefix: e.target.value })} /></div>
                <div><Label>Invoice prefix</Label><Input className="h-11" value={s.billing.invoicePrefix} onChange={(e) => s.setBilling({ ...s.billing, invoicePrefix: e.target.value })} /></div>
                <TumblerField label="Next quote #" v={s.billing.nextQuoteNo} on={(v) => s.setBilling({ ...s.billing, nextQuoteNo: v })} step={1} />
                <TumblerField label="Next invoice #" v={s.billing.nextInvoiceNo} on={(v) => s.setBilling({ ...s.billing, nextInvoiceNo: v })} step={1} />
              </div>
              <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceEditor />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function SubscriptionSection() {
  const fetchSub = useServerFn(getMySubscription);
  const checkout = useServerFn(createPayfastCheckout);
  const cancel = useServerFn(cancelMySubscription);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => fetchSub(),
  });
  const [busy, setBusy] = useState(false);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      const { url } = await checkout({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!confirm("Cancel your KWOUT subscription? You'll lose access at the end of the current period.")) return;
    setBusy(true);
    try {
      await cancel();
      toast.success("Subscription cancelled");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  const status = data?.status ?? "trial";
  const badgeClass =
    status === "active"
      ? "bg-secondary text-secondary-foreground"
      : status === "past_due"
        ? "bg-destructive text-destructive-foreground"
        : status === "cancelled"
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary";
  const badgeLabel =
    status === "active"
      ? "Active"
      : status === "past_due"
        ? "Past due"
        : status === "cancelled"
          ? "Cancelled"
          : `Trial · ${data?.daysLeftInTrial ?? 30} day${data?.daysLeftInTrial === 1 ? "" : "s"} left`;

  return (
    <div className="grid gap-4 max-w-2xl">
      <Card className="p-4 sm:p-6 grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-3xl tracking-wide">KWOUT</div>
            <div className="text-sm text-muted-foreground">R100 / month · Everything included</div>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", badgeClass)}>{badgeLabel}</span>
        </div>

        <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
          {["Quotes", "Invoices", "Statements", "Payslips", "Expenses", "Reports"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-secondary" strokeWidth={3} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : status === "active" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {data?.currentPeriodEnd ? `Next billing: ${new Date(data.currentPeriodEnd).toLocaleDateString()}` : ""}
            </span>
            <Button variant="outline" onClick={onCancel} disabled={busy} className="ml-auto">
              Cancel subscription
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onSubscribe} disabled={busy} className="h-11 px-6">
              {busy ? "Opening PayFast…" : "Subscribe — R100 / month"}
            </Button>
            <span className="text-xs text-muted-foreground">Billed monthly by PayFast. Cancel anytime.</span>
          </div>
        )}
      </Card>
    </div>
  );
}


function PrimaryUnitEditor() {
  const { billing, setBilling } = useStore();
  const [newUnit, setNewUnit] = useState("");
  const units = [...BUILTIN_UNITS, ...(billing.customUnits ?? [])];

  const addCustom = () => {
    const n = newUnit.trim();
    if (!n) return;
    if (units.includes(n)) {
      toast.error("Unit already exists");
      return;
    }
    setBilling({ ...billing, customUnits: [...(billing.customUnits ?? []), n] });
    setNewUnit("");
  };

  const removeCustom = (u: string) => {
    setBilling({
      ...billing,
      customUnits: (billing.customUnits ?? []).filter((x) => x !== u),
      primaryUnit: billing.primaryUnit === u ? "km" : billing.primaryUnit,
    });
  };

  return (
    <div className="grid gap-2">
      <div>
        <Label>Primary billing unit</Label>
        <select
          className="h-11 w-full border rounded-md px-2 bg-background text-sm"
          value={billing.primaryUnit || "km"}
          onChange={(e) => setBilling({ ...billing, primaryUnit: e.target.value as Unit })}
        >
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">
          Default unit used for your primary rate. You can still override the unit on each line item.
        </p>
      </div>

      <div>
        <Label className="text-xs">Custom units</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="e.g. site visit, delivery, bag…"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            className="h-10"
          />
          <Button type="button" onClick={addCustom} variant="outline" className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {(billing.customUnits ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(billing.customUnits ?? []).map((u) => (
              <span key={u} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted">
                {u}
                <button
                  type="button"
                  onClick={() => removeCustom(u)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${u}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppearanceEditor() {
  const { density, setDensity, company, setCompany } = useStore();
  const theme = company.theme ?? DEFAULT_THEME;
  const opts: { v: Density; label: string; desc: string }[] = [
    { v: "compact", label: "Compact", desc: "Maximum info on screen" },
    { v: "normal", label: "Normal", desc: "Balanced default" },
    { v: "comfortable", label: "Comfortable", desc: "Larger text, easier to tap" },
  ];
  return (
    <div className="grid gap-4 max-w-2xl">
      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="font-semibold text-lg mb-1">Brand colors</div>
          <p className="text-xs text-muted-foreground">
            Pick two colors that will theme buttons, headers and PDF accents.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <ColorPicker
            label="Primary"
            value={theme.primary}
            onChange={(v) => setCompany({ ...company, theme: { ...theme, primary: v } })}
          />
          <ColorPicker
            label="Accent (header)"
            value={theme.accent}
            onChange={(v) => setCompany({ ...company, theme: { ...theme, accent: v } })}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompany({ ...company, theme: DEFAULT_THEME })}
          >
            Reset to defaults
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <Label className="mb-2 block">Display density</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Adjusts font size and spacing across the whole app.
        </p>
        <div className="grid gap-2">
          {opts.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setDensity(o.v)}
              className={
                "text-left border rounded-md p-3 transition-colors " +
                (density === o.v
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-muted/50")
              }
            >
              <div className="font-semibold">{o.label}</div>
              <div className="text-xs text-muted-foreground">{o.desc}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ExpenseCategoriesEditor() {
  const { expenseCategories, addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } = useStore();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const sorted = useMemo(
    () => [...expenseCategories].sort((a, b) => a.localeCompare(b)),
    [expenseCategories],
  );

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    addExpenseCategory(n);
    setNewName("");
  };

  return (
    <Card className="p-4 sm:p-6 max-w-2xl">
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="New category…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="h-11"
        />
        <Button onClick={add} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <ul className="divide-y rounded-md border">
        {sorted.map((c) => {
          const isEdit = editing === c;
          return (
            <li key={c} className="flex items-center gap-2 px-3 py-2 bg-card">
              {isEdit ? (
                <>
                  <Input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameExpenseCategory(c, editVal);
                        setEditing(null);
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-10"
                  />
                  <Button size="icon" variant="ghost" onClick={() => { renameExpenseCategory(c, editVal); setEditing(null); }}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 text-left font-medium"
                    onClick={() => { setEditing(c); setEditVal(c); }}
                  >
                    {c}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteExpenseCategory(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TumblerField({
  label, v, on, step, fineStep, prefix,
}: { label: string; v: number; on: (n: number) => void; step: number; fineStep?: number; prefix?: string }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <InlineTumbler value={v} onChange={on} step={step} fineStep={fineStep} min={0} prefix={prefix} label={label} />
    </div>
  );
}

function PctSlider({ label, v, on, max = 100 }: { label: string; v: number; on: (n: number) => void; max?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        <span className="font-display text-lg tabular-nums">{v}%</span>
      </div>
      <Slider value={[Math.min(v, max)]} min={0} max={max} step={1} onValueChange={([n]) => on(n)} className="py-2" />
    </div>
  );
}

function CatalogEditor() {
  const { catalog, billing, upsertCatalog, deleteCatalog } = useStore();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const allUnits = [...BUILTIN_UNITS, ...(billing.customUnits ?? [])];

  const sorted = useMemo(
    () =>
      [...catalog]
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase().trim()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, q],
  );

  const addNew = () => {
    const id = newId();
    upsertCatalog({ id, name: "New item", price: 0, unit: billing.primaryUnit || "each" });
    setOpenId(id);
    setQ("");
  };

  return (
    <Card className="p-4 sm:p-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search catalog…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={addNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add item
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {catalog.length === 0 ? "No items yet. Add your first service or product." : "No matches."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sorted.map((c) => {
            const open = openId === c.id;
            return (
              <li key={c.id} className="bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtMoney(c.price, billing.currency)} <span className="opacity-60">/ {c.unit}</span>
                    </div>
                  </div>
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t bg-muted/20">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => upsertCatalog({ ...c, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Price ({billing.currency})</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={c.price}
                          onChange={(e) => upsertCatalog({ ...c, price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <select
                          className="h-10 w-full border rounded-md px-2 bg-background text-sm"
                          value={c.unit}
                          onChange={(e) => upsertCatalog({ ...c, unit: e.target.value as Unit })}
                        >
                          {allUnits.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        deleteCatalog(c.id);
                        setOpenId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
