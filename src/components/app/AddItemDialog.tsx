import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface AddItemPayload {
  name: string;
  description: string;
  qty: number;
  price: number;
  unit: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currency: string;
  defaultUnit: string;
  units: string[];
  onSubmit: (item: AddItemPayload, opts: { saveToCatalog: boolean }) => void;
}

export function AddItemDialog({ open, onOpenChange, currency, defaultUnit, units, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<string>("1");
  const [price, setPrice] = useState<string>("0");
  const [unit, setUnit] = useState<string>(defaultUnit);
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setQty("1");
      setPrice("0");
      setUnit(defaultUnit);
      setSaveToCatalog(true);
      setErr(null);
    }
  }, [open, defaultUnit]);

  const submit = () => {
    const n = name.trim();
    if (!n) { setErr("Name is required"); return; }
    const q = Number(qty); const p = Number(price);
    if (!isFinite(q) || q < 0) { setErr("Quantity must be 0 or more"); return; }
    if (!isFinite(p) || p < 0) { setErr("Price must be 0 or more"); return; }
    onSubmit(
      { name: n, description: description.trim(), qty: q, price: p, unit },
      { saveToCatalog },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add line item</DialogTitle>
          <DialogDescription>Add a new item to this document. Optionally save it to your catalog for reuse.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ai-name">Item / service *</Label>
            <Input id="ai-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site inspection" />
          </div>
          <div>
            <Label htmlFor="ai-desc">Description (optional)</Label>
            <Textarea id="ai-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Extra detail shown on the document" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="ai-qty">Qty</Label>
              <Input id="ai-qty" type="number" inputMode="decimal" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ai-price">Price ({currency})</Label>
              <Input id="ai-price" type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={saveToCatalog} onCheckedChange={(v) => setSaveToCatalog(v === true)} />
            <span>Also save to Catalog for reuse</span>
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add to document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
