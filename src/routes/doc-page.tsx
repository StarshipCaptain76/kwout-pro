import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { openWhatsApp } from "@/lib/whatsapp";
import { buildShareMessage, shareSubject } from "@/lib/share-message";
import { sendEmailWithPdf } from "@/lib/send-email";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore, newId, docTotals, fmtMoney, BUILTIN_UNITS, type LineItem, type PayMethod } from "@/lib/store";
import { AddItemDialog } from "@/components/app/AddItemDialog";
import { downloadPdf } from "@/lib/pdf";
import { Trash2, Plus, MessageCircle, Mail, Download, Check, ArrowLeft, Truck, Calendar as CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { type ModuleKey } from "@/lib/modules";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CustomerCombobox } from "@/components/app/CustomerCombobox";
import { ContactImportButton } from "@/components/app/ContactImportButton";
import { CatalogPicker } from "@/components/app/CatalogPicker";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { DatePicker } from "@/components/app/DatePicker";
import { TimePicker } from "@/components/app/TimePicker";
import { RouteStopsEditor } from "@/components/app/RouteStopsEditor";
import { Slider } from "@/components/ui/slider";
import { useServerFn } from "@tanstack/react-start";
import { routeDistance } from "@/lib/maps.functions";
import { flushSync } from "@/lib/sync";

export function DocPage() {
  const { id } = useParams({ from: "/doc/$id" });
  const nav = useNavigate();
  const { docs, company, banking, billing, catalog, customers, staff, upsertDoc, deleteDoc, upsertCatalog, nextDocNumber } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const enabledModules = new Set<ModuleKey>(company.enabledModules ?? []);
  const showLocation = enabledModules.has("location") || enabledModules.has("waste");
  const doc = docs.find((d) => d.id === id);
  const distanceFn = useServerFn(routeDistance);
  const [calcing, setCalcing] = useState(false);

  const allCustomers = useMemo(
    () => customers.filter((c) => c.name?.trim()).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  if (!doc) {
    return (
      <Shell>
        <p>Document not found. <Link to="/" className="text-primary underline">Go back</Link></p>
      </Shell>
    );
  }

  const isJob = doc.type === "job";
  const t = docTotals(doc, billing.vatPct);
  const update = (patch: Partial<typeof doc>) => upsertDoc({ ...doc, ...patch });
  const updateCust = (patch: Partial<typeof doc.customer>) =>
    upsertDoc({ ...doc, customer: { ...doc.customer, ...patch } });
  const updateItem = (i: number, patch: Partial<LineItem>) => {
    const items = doc.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    upsertDoc({ ...doc, items });
  };
  const addItem = (it: Partial<LineItem>) =>
    upsertDoc({ ...doc, items: [...doc.items, { id: newId(), description: "", qty: 1, price: 0, unit: "each", ...it }] });
  const removeItem = (i: number) => upsertDoc({ ...doc, items: doc.items.filter((_, idx) => idx !== i) });

  const addKm = (km = 10) =>
    addItem({ description: "Transport (per km)", price: billing.ratePerKm, unit: "km", qty: km, isDistance: true });

  const calcDistance = async () => {
    if (!doc.fromAddress || !doc.toAddress) return toast.error("Set both addresses first");
    setCalcing(true);
    try {
      const stopPoints = (doc.stops ?? [])
        .filter((s) => s.address?.trim())
        .map((s) => ({ address: s.address, ...(s.coords ?? {}) }));
      const r = await distanceFn({
        data: {
          from: { address: doc.fromAddress, ...(doc.fromCoords ?? {}) },
          to: { address: doc.toAddress, ...(doc.toCoords ?? {}) },
          stops: stopPoints.length ? stopPoints : undefined,
        },
      });
      if (!r.km) return toast.error("No route found");
      const existingIdx = doc.items.findIndex((i) => i.isDistance);
      if (existingIdx >= 0) {
        updateItem(existingIdx, { qty: r.km, price: billing.ratePerKm, description: `Transport (${r.km} km)` });
      } else {
        addItem({ description: `Transport (${r.km} km)`, price: billing.ratePerKm, unit: "km", qty: r.km, isDistance: true });
      }
      const latest = useStore.getState().docs.find((d) => d.id === doc.id) ?? doc;
      upsertDoc({ ...latest, distanceKm: r.km });
      toast.success(`Distance: ${r.km} km`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Route failed");
    } finally {
      setCalcing(false);
    }
  };

  const send = async (channel: "wa" | "email") => {
    if (!doc.customer.name) return toast.error("Add customer name first");
    const msg = buildShareMessage(doc, company, banking, billing);
    if (channel === "wa") {
      if (!doc.customer.phone) return toast.error("Add customer phone");
      const ok = openWhatsApp(doc.customer.phone, msg);
      if (!ok) return toast.error("Invalid phone number");
    } else {
      if (!doc.customer.email) return toast.error("Add customer email");
      try {
        await sendEmailWithPdf(doc, company, banking, billing, msg, shareSubject(doc, company));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Email failed");
        return;
      }
    }
    if (doc.status === "draft") update({ status: "sent" });
  };

  const convert = () => {
    const invNum = nextDocNumber("invoice");
    upsertDoc({
      ...doc,
      type: "invoice",
      number: invNum,
      status: "accepted",
      archived: false,
      scheduledDate: doc.scheduledDate ?? new Date().toISOString().slice(0, 10),
    });
    void flushSync();
    toast.success(`Converted to invoice ${invNum}`);
  };

  const markPaid = (m: PayMethod) => {
    update({
      status: "paid",
      archived: false,
      paymentMethod: m,
      paidAt: new Date().toISOString(),
      scheduledDate: doc.scheduledDate ?? new Date().toISOString().slice(0, 10),
    });
    toast.success(`Marked paid (${m.toUpperCase()})`);
  };

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => nav({ to: "/" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-display text-4xl tracking-wide">{doc.type.toUpperCase()} {doc.number}</h1>
        <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-muted">{doc.status}</span>
      </div>

      <div className={cn("grid gap-4", isJob ? "" : "lg:grid-cols-[1fr_320px]")}>
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Customer</h2>
            <div>
              <Label>Name</Label>
              <div className="flex gap-2">
                <CustomerCombobox
                  value={doc.customer.name}
                  customers={allCustomers}
                  onType={(name) => updateCust({ name })}
                  onPick={(c) => upsertDoc({ ...doc, customer: { ...c } })}
                />
                <ContactImportButton onImport={(c) => updateCust(c)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Phone{isJob ? " (optional)" : ""}</Label>
                <Input value={doc.customer.phone} onChange={(e) => updateCust({ phone: e.target.value })} placeholder="0821234567" />
              </div>
              <div>
                <Label>Email{isJob ? " (optional)" : ""}</Label>
                <Input value={doc.customer.email} onChange={(e) => updateCust({ email: e.target.value })} />
              </div>
            </div>
          </Card>

          {showLocation && !isJob && (
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Route</h2>
              <div className="grid gap-3">
                <RouteStopsEditor
                  fromAddress={doc.fromAddress}
                  toAddress={doc.toAddress}
                  stops={doc.stops}
                  distanceKm={doc.distanceKm}
                  calcing={calcing}
                  disposalSite={company.disposalSite}
                  showDisposal={enabledModules.has("waste")}
                  onFrom={(v) => update({ fromAddress: v.address, fromCoords: v.coords })}
                  onTo={(v) => update({ toAddress: v.address, toCoords: v.coords })}
                  onStops={(stops) => update({ stops })}
                  onCalc={calcDistance}
                />
              </div>
            </Card>
          )}

          {!isJob && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Line items</h2>
                <div className="flex gap-2">
                  <CatalogPicker
                    catalog={catalog}
                    currency={billing.currency}
                    onPick={(c) => addItem({ description: c.name, price: c.price, unit: c.unit, qty: 1 })}
                  />
                  <Button variant="outline" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New Item
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addKm()}>
                    <Truck className="h-4 w-4 mr-1" /> KM
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {doc.items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
                {doc.items.map((it, i) => (
                  <div key={it.id} className="space-y-1.5 border rounded-md p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={it.description}
                        placeholder={it.isDistance ? "Transport (km)" : "Description"}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="flex-1"
                      />
                      <Button size="icon" variant="ghost" aria-label="Remove item" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InlineTumbler
                        value={it.qty}
                        onChange={(v) => updateItem(i, { qty: Math.max(0, v) })}
                        step={1}
                        min={0}
                        label={`Qty (${it.unit})`}
                      />
                      <InlineTumbler
                        value={it.price}
                        onChange={(v) => updateItem(i, { price: Math.max(0, v) })}
                        step={10}
                        fineStep={1}
                        min={0}
                        prefix={`${billing.currency} `}
                        label="Price"
                      />
                    </div>
                    <div className="text-right text-xs text-muted-foreground font-mono">
                      = {fmtMoney(it.qty * it.price, billing.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" /> Scheduled date
            </Label>
            <DatePicker value={doc.scheduledDate} onChange={(iso) => update({ scheduledDate: iso })} clearable />
            <div>
              <Label className="text-xs mb-1 block">Start time (optional)</Label>
              <TimePicker value={doc.scheduledTime} onChange={(t) => update({ scheduledTime: t })} />
            </div>
          </Card>

          <Card className="p-4">
            <Label>{isJob ? "What needs to be done" : "Notes"}</Label>
            <Textarea
              className="mt-2"
              value={doc.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={isJob ? "Describe the work…" : "Thanks, delivery info, etc."}
            />
          </Card>

          {isJob && staff.length > 0 && (
            <Card className="p-4">
              <Label>Assigned to</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={doc.assignedTo ?? ""}
                onChange={(e) => update({ assignedTo: e.target.value || undefined })}
              >
                <option value="">Unassigned</option>
                {staff.filter((m) => m.active).map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                ))}
              </select>
            </Card>
          )}
        </div>

        {!isJob && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Totals</h2>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(t.subtotal, billing.currency)}</span></div>
                {billing.vatPct > 0 && (
                  <div className="flex justify-between"><span>VAT {billing.vatPct}%</span><span>{fmtMoney(t.vat, billing.currency)}</span></div>
                )}
                <div className="flex justify-between items-center pt-1 border-t font-bold">
                  <span>Total</span>
                  <span className="font-display text-2xl text-primary">{fmtMoney(t.total, billing.currency)}</span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Deposit</Label>
                  <span className="font-display text-lg tabular-nums">{doc.depositPct}%</span>
                </div>
                <Slider
                  value={[doc.depositPct]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => update({ depositPct: v })}
                  className="py-3"
                />
                <div className="flex justify-between text-sm">
                  <span>Deposit</span>
                  <span className="font-semibold">{fmtMoney(t.deposit, billing.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance</span>
                  <span className="font-semibold">{fmtMoney(t.balance, billing.currency)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => send("wa")}>
                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
              </Button>
              <Button variant="outline" className="w-full" onClick={() => send("email")}>
                <Mail className="h-4 w-4 mr-2" /> Email
              </Button>
              <Button variant="outline" className="w-full" onClick={() => downloadPdf(doc, company, banking, billing)}>
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
              {doc.type === "quote" && (
                <Button className="w-full" onClick={convert}>
                  <Check className="h-4 w-4 mr-2" /> Accept → Invoice
                </Button>
              )}
              {doc.type === "invoice" && doc.status !== "paid" && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full">Mark paid</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Payment method</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                      {(["cash", "eft", "card"] as PayMethod[]).map((m) => (
                        <Button key={m} onClick={() => markPaid(m)} className="uppercase">{m}</Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => { deleteDoc(doc.id); nav({ to: "/" }); }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </Card>
          </div>
        )}
      </div>

      {!isJob && (
        <AddItemDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          currency={billing.currency}
          defaultUnit={billing.primaryUnit ?? "each"}
          units={Array.from(new Set([...(BUILTIN_UNITS as readonly string[]), ...(billing.customUnits ?? [])]))}
          onSubmit={(it, { saveToCatalog }) => {
            const desc = it.description ? `${it.name} — ${it.description}` : it.name;
            addItem({ description: desc, qty: it.qty, price: it.price, unit: it.unit });
            const dup = catalog.some((c) => c.name.trim().toLowerCase() === it.name.toLowerCase());
            if (saveToCatalog && !dup) {
              upsertCatalog({ id: newId(), name: it.name, price: it.price, unit: it.unit });
              toast.success("Item added to quote and saved to catalog");
            } else {
              toast.success("Item added to quote");
            }
          }}
        />
      )}
    </Shell>
  );
}
