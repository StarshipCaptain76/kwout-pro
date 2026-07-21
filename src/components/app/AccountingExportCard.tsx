import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import {
  ACCOUNTING_PACKAGES,
  buildExportFiles,
  downloadFiles,
  type AccountingPackage,
  type DataSet,
} from "@/lib/exports/accounting";
import { toast } from "sonner";
import { Download } from "lucide-react";

type Preset = "this_month" | "last_month" | "ytd" | "all" | "custom";

function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }

function rangeFor(preset: Preset): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "this_month") return { from: iso(monthStart(now)), to: iso(monthEnd(now)) };
  if (preset === "last_month") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: iso(monthStart(lm)), to: iso(monthEnd(lm)) };
  }
  if (preset === "ytd") return { from: `${now.getFullYear()}-01-01`, to: iso(now) };
  return {};
}

const SETS: Array<{ key: DataSet; label: string }> = [
  { key: "invoices", label: "Invoices" },
  { key: "quotes", label: "Quotes" },
  { key: "payments", label: "Payments received" },
  { key: "expenses", label: "Expenses" },
  { key: "customers", label: "Customers" },
];

export function AccountingExportCard() {
  const s = useStore();
  const defaultPkg = (s.company.accountingPackage ?? "csv") as AccountingPackage;
  const [pkg, setPkg] = useState<AccountingPackage>(defaultPkg);
  const [preset, setPreset] = useState<Preset>("ytd");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selected, setSelected] = useState<Record<DataSet, boolean>>({
    invoices: true, quotes: false, payments: true, expenses: true, customers: false,
  });

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom || undefined, to: customTo || undefined };
    return rangeFor(preset);
  }, [preset, customFrom, customTo]);

  const setsChosen = SETS.filter((x) => selected[x.key]).map((x) => x.key);

  const savePreferred = () => {
    s.setCompany({ ...s.company, accountingPackage: pkg });
    toast.success("Preferred format saved");
  };

  const runExport = () => {
    if (setsChosen.length === 0) {
      toast.error("Pick at least one data set to export");
      return;
    }
    const files = buildExportFiles({
      docs: s.docs,
      expenses: s.expenses,
      customers: s.customers,
      billing: s.billing,
      from: range.from,
      to: range.to,
      sets: setsChosen,
      pkg,
    });
    downloadFiles(files);
    toast.success(`Exported ${files.length} file${files.length === 1 ? "" : "s"}`);
  };

  return (
    <Card className="p-4 sm:p-6 grid gap-4">
      <div>
        <div className="font-display text-lg">Accounting export</div>
        <p className="text-xs text-muted-foreground">
          Download your data as CSV files your accountant can import into QuickBooks, Sage, or open in Excel.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Preferred format</Label>
          <Select value={pkg} onValueChange={(v) => setPkg(v as AccountingPackage)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCOUNTING_PACKAGES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {ACCOUNTING_PACKAGES.find((p) => p.value === pkg)?.hint}
          </p>
          {pkg !== defaultPkg && (
            <Button size="sm" variant="outline" className="mt-2" onClick={savePreferred}>
              Save as default
            </Button>
          )}
        </div>

        <div>
          <Label>Date range</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>Data sets</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {SETS.map((set) => (
            <label key={set.key} className="flex items-center gap-2 text-sm border rounded-md px-3 h-11">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selected[set.key]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [set.key]: e.target.checked }))}
              />
              {set.label}
            </label>
          ))}
        </div>
      </div>

      <Button onClick={runExport} className="w-fit">
        <Download className="h-4 w-4 mr-1" /> Download export
      </Button>
    </Card>
  );
}
