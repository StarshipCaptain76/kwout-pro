import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { newId, useCan, useStore, type Customer } from "@/lib/store";
import { pushCustomer } from "@/lib/sync";
import { Pencil, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  component: CustomersPage,
  head: () => ({ meta: [
    { title: "Customers — KWOUT" },
    { name: "description", content: "Add and manage your business customers in KWOUT." },
    { property: "og:title", content: "Customers — KWOUT" },
    { property: "og:description", content: "Manage customer contact details for your quotes and invoices." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
});

function CustomersPage() {
  const customers = useStore((s) => s.customers);
  const canView = useCan("customers.view");
  const canAdd = useCan("customers.add");
  const canEdit = useCan("customers.edit");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const edit = (customer: Customer) => { setError(""); setDraft({ ...customer }); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.name.trim() || saving) return;
    const existing = customers.some((c) => c.id === draft.id);
    if (existing ? !canEdit : !canAdd) return;
    setSaving(true);
    setError("");
    try {
      const customer = { ...draft, name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim() };
      await pushCustomer(customer, true);
      useStore.setState((s) => ({ customers: s.customers.some((c) => c.id === customer.id)
        ? s.customers.map((c) => c.id === customer.id ? customer : c)
        : [...s.customers, customer] }));
      setDraft(null);
      toast.success(existing ? "Customer updated" : "Customer added");
    } catch {
      setError("Customer could not be saved. Please try again.");
    } finally { setSaving(false); }
  };
  const filtered = customers.filter((c) => [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <Shell>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h1 className="font-display text-3xl flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Customers</h1>
      {canAdd && <Button onClick={() => edit({ id: newId(), name: "", phone: "", email: "", address: "" })}><Plus className="h-4 w-4" /> Add customer</Button>}
    </div>
    {!canView ? <p className="text-muted-foreground">You do not have access to the customer list.</p> : <>
      <div className="relative mb-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search customers" placeholder="Search customers" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {filtered.length === 0 ? <p className="py-6 text-center text-muted-foreground">No customers found.</p> : <ul className="divide-y">
        {filtered.map((c) => <li key={c.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><div className="font-semibold break-words">{c.name}</div><div className="text-sm text-muted-foreground break-words">{[c.phone, c.email, c.address].filter(Boolean).join(" · ")}</div></div>
          {canEdit && <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>}
        </li>)}
      </ul>}
    </>}
    <Dialog open={!!draft} onOpenChange={(open) => { if (!open && !saving) setDraft(null); }}>
      <DialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
        <DialogHeader><DialogTitle>{draft && customers.some((c) => c.id === draft.id) ? "Edit customer" : "Add customer"}</DialogTitle><DialogDescription>Customer details</DialogDescription></DialogHeader>
        {draft && <form onSubmit={save} className="space-y-4">
          <div><Label htmlFor="customer-name">Name</Label><Input id="customer-name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><Label htmlFor="customer-phone">Phone</Label><Input id="customer-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
          <div><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
          <div><Label htmlFor="customer-address">Address</Label><Input id="customer-address" value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || !draft.name.trim()} className="w-full">{saving ? "Saving…" : "Save customer"}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </Shell>;
}