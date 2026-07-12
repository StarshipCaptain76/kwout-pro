import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Download, MessageCircle, FileText, Trash2 } from "lucide-react";
import {
  listStaffCompensation,
  generatePayslipDraft,
  savePayslip,
  listPayslips,
  deletePayslip,
  markPayslipSent,
  type PayslipDTO,
  type StaffCompensationDTO,
} from "@/lib/payslips.functions";
import { fmtMoney, useStore } from "@/lib/store";
import type { DeductionLine } from "@/lib/payroll";
import { generatePayslipPDF } from "@/lib/payslip-pdf";

interface DraftRow {
  staffId: string;
  staffName: string;
  hours: number;
  manualGross: number;
  gross: number;
  commissionAmount: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdl: number;
  otherDeductions: number;
  net: number;
  breakdown: DeductionLine[];
  loading: boolean;
}

export function PayslipsTab() {
  const qc = useQueryClient();
  const { billing, company } = useStore();
  const currency = billing.currency;

  // Period: default = previous month
  const now = new Date();
  const [monthStr, setMonthStr] = useState(format(subMonths(now, 1), "yyyy-MM"));
  const [sdlApplies, setSdlApplies] = useState(false);

  const [year, month] = monthStr.split("-").map(Number);
  const periodStart = format(startOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");
  const periodLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");

  const staffQ = useQuery({
    queryKey: ["payslips.staff"],
    queryFn: () => listStaffCompensation(),
  });

  const historyQ = useQuery({
    queryKey: ["payslips.history"],
    queryFn: () => listPayslips({ data: {} }),
  });

  const activeStaff = useMemo(
    () => (staffQ.data ?? []).filter((s) => s.active),
    [staffQ.data],
  );

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [openDialog, setOpenDialog] = useState<PayslipDTO | DraftRow | null>(null);

  // Reset drafts when period or staff changes
  useEffect(() => {
    const next: Record<string, DraftRow> = {};
    activeStaff.forEach((s) => {
      next[s.id] = {
        staffId: s.id,
        staffName: s.name,
        hours: drafts[s.id]?.hours ?? 0,
        manualGross: drafts[s.id]?.manualGross ?? 0,
        gross: 0, commissionAmount: 0, paye: 0, uifEmployee: 0,
        uifEmployer: 0, sdl: 0, otherDeductions: 0, net: 0,
        breakdown: [], loading: false,
      };
    });
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, activeStaff.length]);

  const computeOne = async (staffId: string) => {
    const row = drafts[staffId];
    if (!row) return;
    setDrafts((d) => ({ ...d, [staffId]: { ...row, loading: true } }));
    try {
      const res = await generatePayslipDraft({
        data: {
          staffId,
          periodStart,
          periodEnd,
          hours: row.hours || undefined,
          manualGross: row.manualGross || undefined,
          sdlApplies,
        },
      });
      setDrafts((d) => ({
        ...d,
        [staffId]: {
          ...row,
          loading: false,
          gross: res.gross,
          commissionAmount: res.commissionAmount,
          paye: res.paye,
          uifEmployee: res.uifEmployee,
          uifEmployer: res.uifEmployer,
          sdl: res.sdl,
          otherDeductions: res.otherDeductions,
          net: res.net,
          breakdown: res.breakdown,
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
      setDrafts((d) => ({ ...d, [staffId]: { ...row, loading: false } }));
    }
  };

  const computeAll = async () => {
    await Promise.all(activeStaff.map((s) => computeOne(s.id)));
  };

  const saveMut = useMutation({
    mutationFn: async ({ row, status }: { row: DraftRow; status: "draft" | "finalized" }) => {
      return savePayslip({
        data: {
          staffId: row.staffId,
          periodStart, periodEnd, periodLabel,
          hours: row.hours,
          gross: row.gross,
          commissionAmount: row.commissionAmount,
          paye: row.paye,
          uifEmployee: row.uifEmployee,
          uifEmployer: row.uifEmployer,
          sdl: row.sdl,
          otherDeductions: row.otherDeductions,
          deductionsBreakdown: row.breakdown,
          net: row.net,
          status,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payslip saved");
      qc.invalidateQueries({ queryKey: ["payslips.history"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deletePayslip({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["payslips.history"] });
    },
  });

  const staffMap = useMemo(() => {
    const m = new Map<string, StaffCompensationDTO>();
    (staffQ.data ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [staffQ.data]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Pay period (month)</Label>
            <Input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sdl" checked={sdlApplies} onCheckedChange={setSdlApplies} />
            <Label htmlFor="sdl" className="text-xs">Payroll {'>'}R500k p.a. (apply SDL)</Label>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={computeAll} disabled={activeStaff.length === 0}>
              Calculate all
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {periodLabel} · SA statutory rates for 2025/26. Commission is pulled from paid jobs assigned to each staff member in this period.
        </p>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {staffQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading staff…
          </div>
        ) : activeStaff.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No active staff. Add staff in Settings → Staff, then set their compensation.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Staff</th>
                <th className="text-left p-2">Pay type</th>
                <th className="text-right p-2">Hours</th>
                <th className="text-right p-2">Gross</th>
                <th className="text-right p-2">PAYE</th>
                <th className="text-right p-2">UIF</th>
                <th className="text-right p-2">Net</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeStaff.map((s) => {
                const row = drafts[s.id];
                if (!row) return null;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="capitalize">{s.payType}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      {s.payType === "hourly" ? (
                        <Input
                          type="number"
                          className="w-20 h-8 text-right ml-auto"
                          value={row.hours}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [s.id]: { ...row, hours: Number(e.target.value) || 0 },
                            }))
                          }
                        />
                      ) : s.payType === "manual" ? (
                        <Input
                          type="number"
                          placeholder="Gross"
                          className="w-24 h-8 text-right ml-auto"
                          value={row.manualGross}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [s.id]: { ...row, manualGross: Number(e.target.value) || 0 },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmtMoney(row.gross, currency)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtMoney(row.paye, currency)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtMoney(row.uifEmployee, currency)}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{fmtMoney(row.net, currency)}</td>
                    <td className="p-2 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => computeOne(s.id)} disabled={row.loading}>
                        {row.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Calc"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.gross <= 0}
                        onClick={() => setOpenDialog(row)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* History */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Saved payslips</h3>
          <span className="text-xs text-muted-foreground">
            {historyQ.data?.length ?? 0} records
          </span>
        </div>
        {historyQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (historyQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No saved payslips yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-1">Period</th>
                  <th className="text-left p-1">Staff</th>
                  <th className="text-right p-1">Gross</th>
                  <th className="text-right p-1">Net</th>
                  <th className="text-left p-1">Status</th>
                  <th className="text-right p-1"></th>
                </tr>
              </thead>
              <tbody>
                {(historyQ.data ?? []).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-1">{p.periodLabel}</td>
                    <td className="p-1">{p.staffName}</td>
                    <td className="p-1 text-right tabular-nums">{fmtMoney(p.gross, currency)}</td>
                    <td className="p-1 text-right tabular-nums font-medium">{fmtMoney(p.net, currency)}</td>
                    <td className="p-1">
                      <Badge variant={p.status === "finalized" ? "default" : "outline"}>
                        {p.status}
                      </Badge>
                      {p.sentAt && <Badge variant="secondary" className="ml-1">sent</Badge>}
                    </td>
                    <td className="p-1 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setOpenDialog(p)}>
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Delete this payslip?")) delMut.mutate(p.id);
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PayslipViewDialog
        payslip={openDialog}
        periodLabel={periodLabel}
        onClose={() => setOpenDialog(null)}
        onSave={(status) => {
          if (openDialog && "loading" in openDialog) {
            saveMut.mutate({ row: openDialog, status });
          }
        }}
        onMarkSent={(id) => markPayslipSent({ data: { id } }).then(() => {
          toast.success("Marked as sent");
          qc.invalidateQueries({ queryKey: ["payslips.history"] });
        })}
        staffMap={staffMap}
        currency={currency}
        companyName={company?.name ?? ""}
      />
    </div>
  );
}

// ---------- Dialog ----------

interface DialogProps {
  payslip: PayslipDTO | DraftRow | null;
  periodLabel: string;
  onClose: () => void;
  onSave: (status: "draft" | "finalized") => void;
  onMarkSent: (id: string) => Promise<void>;
  staffMap: Map<string, StaffCompensationDTO>;
  currency: string;
  companyName: string;
}

function PayslipViewDialog({ payslip, periodLabel, onClose, onSave, onMarkSent, staffMap, currency, companyName }: DialogProps) {
  if (!payslip) return null;
  const isDraft = "loading" in payslip;
  const staff = staffMap.get(payslip.staffId);
  const label = isDraft ? periodLabel : (payslip as PayslipDTO).periodLabel;

  const handlePDF = () => {
    generatePayslipPDF({
      companyName: companyName || "Company",
      periodLabel: label,
      staffName: isDraft ? (payslip as DraftRow).staffName : (payslip as PayslipDTO).staffName,
      staffEmail: staff?.email ?? "",
      idNumber: staff?.idNumber ?? "",
      gross: payslip.gross,
      commissionAmount: payslip.commissionAmount,
      hours: isDraft ? (payslip as DraftRow).hours : (payslip as PayslipDTO).hours,
      paye: payslip.paye,
      uifEmployee: payslip.uifEmployee,
      uifEmployer: payslip.uifEmployer,
      sdl: payslip.sdl,
      otherDeductions: payslip.otherDeductions,
      breakdown: isDraft ? (payslip as DraftRow).breakdown : (payslip as PayslipDTO).deductionsBreakdown,
      net: payslip.net,
      currency,
    });
  };

  const handleWhatsApp = () => {
    const text = `Payslip — ${label}\nGross: ${fmtMoney(payslip.gross, currency)}\nNet pay: ${fmtMoney(payslip.net, currency)}\n(PDF sent separately)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleEmail = () => {
    if (!staff?.email) { toast.error("No email on file"); return; }
    const subject = `Payslip — ${label}`;
    const body = `Hi ${staff.name},\n\nPlease find attached your payslip for ${label}.\n\nGross: ${fmtMoney(payslip.gross, currency)}\nNet pay: ${fmtMoney(payslip.net, currency)}\n\nRegards`;
    window.location.href = `mailto:${staff.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog open={!!payslip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payslip — {label}</DialogTitle>
        </DialogHeader>

        <div className="text-sm space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Employee</div>
            <div className="font-medium">{isDraft ? (payslip as DraftRow).staffName : (payslip as PayslipDTO).staffName}</div>
            {staff?.email && <div className="text-xs text-muted-foreground">{staff.email}</div>}
            {staff?.idNumber && <div className="text-xs text-muted-foreground">ID: {staff.idNumber}</div>}
          </div>

          <div>
            <div className="text-xs uppercase font-medium mb-1">Earnings</div>
            <div className="flex justify-between">
              <span>Basic {(payslip as DraftRow).hours ? `(${(payslip as DraftRow).hours}h)` : ""}</span>
              <span className="tabular-nums">{fmtMoney(payslip.gross - payslip.commissionAmount, currency)}</span>
            </div>
            {payslip.commissionAmount > 0 && (
              <div className="flex justify-between">
                <span>Commission</span>
                <span className="tabular-nums">{fmtMoney(payslip.commissionAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t mt-1 pt-1">
              <span>Gross pay</span>
              <span className="tabular-nums">{fmtMoney(payslip.gross, currency)}</span>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-medium mb-1">Deductions</div>
            {payslip.paye > 0 && (
              <div className="flex justify-between"><span>PAYE</span><span className="tabular-nums">{fmtMoney(payslip.paye, currency)}</span></div>
            )}
            {payslip.uifEmployee > 0 && (
              <div className="flex justify-between"><span>UIF (employee)</span><span className="tabular-nums">{fmtMoney(payslip.uifEmployee, currency)}</span></div>
            )}
            {payslip.otherDeductions > 0 && (
              <div className="flex justify-between"><span>Other</span><span className="tabular-nums">{fmtMoney(payslip.otherDeductions, currency)}</span></div>
            )}
            <div className="flex justify-between font-medium border-t mt-1 pt-1">
              <span>Total deductions</span>
              <span className="tabular-nums">{fmtMoney(payslip.paye + payslip.uifEmployee + payslip.otherDeductions, currency)}</span>
            </div>
          </div>

          <div className="flex justify-between text-lg font-display bg-muted/30 -mx-6 px-6 py-2">
            <span>Net pay</span>
            <span className="tabular-nums">{fmtMoney(payslip.net, currency)}</span>
          </div>

          {(payslip.uifEmployer > 0 || payslip.sdl > 0) && (
            <div className="text-xs text-muted-foreground">
              Employer contributions — UIF: {fmtMoney(payslip.uifEmployer, currency)}
              {payslip.sdl > 0 && ` · SDL: ${fmtMoney(payslip.sdl, currency)}`}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={handleEmail}>
            <FileText className="h-4 w-4 mr-1" /> Email
          </Button>
          {isDraft ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => { onSave("draft"); onClose(); }}>
                Save draft
              </Button>
              <Button size="sm" onClick={() => { onSave("finalized"); onClose(); }}>
                Finalize
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onMarkSent((payslip as PayslipDTO).id).then(onClose)}>
              Mark sent
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
