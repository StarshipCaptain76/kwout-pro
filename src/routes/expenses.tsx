import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore, newId, fmtMoney, computeVat, type Expense, type PayMethod } from "@/lib/store";
import { ReceiptCapture } from "@/components/app/ReceiptCapture";
import { parseReceipt } from "@/lib/expenses.functions";
import { DatePicker } from "@/components/app/DatePicker";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from "date-fns";

export const Route = createFileRoute("/expenses")({
  component: ExpensesPage,
  head: () => ({
    meta: [
      { title: "Expenses — KWOUT" },
      { name: "description", content: "Track business expenses by month, snap receipts and capture VAT for quick reconciliation." },
      { property: "og:title", content: "Expenses — KWOUT" },
      { property: "og:description", content: "Snap receipts and track expenses month by month." },
      { property: "og:url", content: "https://kwout.co.za/expenses" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/expenses" }],
  }),
});

function ExpensesPage() {
  const { expenses, billing } = useStore();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<Expense | null>(null);

  const monthExpenses = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return expenses
      .filter((e) => {
        const d = parseISO(e.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, month]);

  const total = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const grouped = useMemo(() => {
    const g = new Map<string, Expense[]>();
    monthExpenses.forEach((e) => {
      const arr = g.get(e.date) ?? [];
      arr.push(e);
      g.set(e.date, arr);
    });
    return Array.from(g.entries());
  }, [monthExpenses]);

  const newExpense = () => {
    setEditing({
      id: newId(),
      createdAt: new Date().toISOString(),
      date: format(new Date(), "yyyy-MM-dd"),
      category: "Other",
      vendor: "",
      amount: 0,
      vatAmount: billing.vatPct > 0 ? 0 : undefined,
    });
  };

  return (
    <Shell>
      <h1 className="sr-only">Expenses</h1>
      <div className="flex items-center justify-end mb-3">
        <Button size="sm" onClick={newExpense} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <Card className="p-3 mb-3 flex items-center gap-2">
        <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="font-display text-xl tracking-wider">{format(month, "MMMM yyyy")}</div>
          <div className="text-xs text-muted-foreground">
            {monthExpenses.length} items · {fmtMoney(total, billing.currency)}
          </div>
        </div>
        <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </Card>

      {grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No expenses this month. Tap + to snap a slip.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-1">
                {format(parseISO(date), "EEE d MMM")}
              </div>
              <Card className="divide-y">
                {items.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEditing(e)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50"
                  >
                    {e.receiptImage ? (
                      <img
                        src={e.receiptImage}
                        alt=""
                        className="h-12 w-12 rounded object-cover border shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                        —
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{e.vendor || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] mr-1">
                          {e.category}
                        </span>
                        {e.description}
                      </div>
                    </div>
                    <div className="font-semibold shrink-0">{fmtMoney(e.amount, billing.currency)}</div>
                  </button>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add button (mobile) */}
      <button
        onClick={newExpense}
        aria-label="Add expense"
        className="sm:hidden fixed right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-7 w-7" />
      </button>

      <ExpenseSheet expense={editing} onClose={() => setEditing(null)} />
    </Shell>
  );
}

function ExpenseSheet({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { upsertExpense, deleteExpense, expenseCategories, billing } = useStore();
  const [draft, setDraft] = useState<Expense | null>(expense);
  const [vatManual, setVatManual] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Reset draft when a different expense is opened
  if (expense && (!draft || draft.id !== expense.id)) {
    setDraft(expense);
    setVatManual(false);
  }
  if (!expense || !draft) return null;

  const includesVat = draft.vatAmount !== undefined;

  const set = (patch: Partial<Expense>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      // Auto-recompute VAT when amount changes and user hasn't manually edited it
      if ("amount" in patch && next.vatAmount !== undefined && !vatManual) {
        next.vatAmount = computeVat(next.amount || 0, billing.vatPct);
      }
      return next;
    });

  const toggleIncludesVat = (on: boolean) => {
    setVatManual(false);
    if (on) {
      set({ vatAmount: computeVat(draft.amount || 0, billing.vatPct) });
    } else {
      set({ vatAmount: undefined });
    }
  };

  const handleCapture = async (dataUrl: string) => {
    set({ receiptImage: dataUrl });
    setParsing(true);
    try {
      const r = await parseReceipt({ data: { imageDataUrl: dataUrl, categories: expenseCategories } });
      const amount = r.total ?? draft.amount;
      let vatAmount = draft.vatAmount;
      if (r.vat != null) {
        vatAmount = r.vat;
        setVatManual(true);
      } else if (billing.vatPct > 0 && amount) {
        vatAmount = computeVat(amount, billing.vatPct);
        setVatManual(false);
      }
      set({
        date: r.date || draft.date,
        vendor: r.vendor || draft.vendor,
        amount,
        vatAmount,
        category: r.category || draft.category,
        description: r.description || draft.description,
        paymentMethod: (r.paymentMethod as PayMethod | null) ?? draft.paymentMethod,
      });
      toast.success("Slip read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read slip");
    } finally {
      setParsing(false);
    }
  };

  const save = () => {
    if (!draft.vendor && !draft.amount) {
      toast.error("Add a vendor or amount");
      return;
    }
    upsertExpense(draft);
    toast.success("Saved");
    onClose();
  };

  return (
    <Sheet open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-wide">EXPENSE</SheetTitle>
        </SheetHeader>

        <div className="grid gap-3 mt-3 pb-[env(safe-area-inset-bottom)]">
          {draft.receiptImage ? (
            <div className="relative">
              <img
                src={draft.receiptImage}
                alt="Receipt"
                className="w-full max-h-64 object-contain rounded border bg-muted"
              />
              <button
                type="button"
                onClick={() => set({ receiptImage: undefined })}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
              {parsing && (
                <div className="absolute inset-0 rounded bg-black/50 text-white flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <div className="text-sm">Reading slip…</div>
                </div>
              )}
            </div>
          ) : (
            <ReceiptCapture onCapture={handleCapture} disabled={parsing} />
          )}

          {parsing && !draft.receiptImage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading slip…
            </div>
          )}

          {draft.receiptImage && !parsing && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI-filled — check fields below
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <DatePicker value={draft.date} onChange={(iso) => set({ date: iso })} />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <InlineTumbler
                value={draft.amount || 0}
                onChange={(v) => set({ amount: v })}
                step={10}
                fineStep={1}
                min={0}
                label="Amount"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="h-11 w-full border rounded-md px-2 bg-background"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Vendor</Label>
            <Input
              className="h-11"
              value={draft.vendor}
              onChange={(e) => set({ vendor: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              className="h-11"
              value={draft.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          {billing.vatPct > 0 && (
            <div className="rounded-md border p-2.5 bg-muted/30">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includesVat}
                  onChange={(e) => toggleIncludesVat(e.target.checked)}
                />
                <span className="text-sm font-medium">Includes VAT ({billing.vatPct}%)</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {includesVat ? "VAT-inclusive" : "Zero-rated / exempt"}
                </span>
              </label>
              {includesVat && (
                <div className="mt-2">
                  <Label className="text-xs">VAT amount</Label>
                  <InlineTumbler
                    value={draft.vatAmount ?? 0}
                    onChange={(v) => {
                      setVatManual(true);
                      set({ vatAmount: v });
                    }}
                    step={1}
                    min={0}
                    label="VAT amount"
                  />
                  {!vatManual && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Auto-calculated from total. Tap to override.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Paid with</Label>
            <select
              className="h-11 w-full border rounded-md px-2 bg-background"
              value={draft.paymentMethod ?? ""}
              onChange={(e) =>
                set({ paymentMethod: (e.target.value || undefined) as PayMethod | undefined })
              }
            >
              <option value="">—</option>
              <option value="cash">Cash</option>
              <option value="eft">EFT</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                deleteExpense(draft.id);
                toast.success("Deleted");
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={parsing}>
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}