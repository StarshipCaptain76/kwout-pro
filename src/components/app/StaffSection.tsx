import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useStore, useIsOwner, type StaffMember } from "@/lib/store";
import { ACTION_GROUPS, presetFor, type Action, type Permissions, type Role } from "@/lib/permissions";
import {
  createStaffAccount, updateStaffMember, deleteStaffMember, resetStaffPassword, listStaff,
  type StaffMemberDTO,
} from "@/lib/staff.functions";
import { listStaffCompensation, updateStaffCompensation, type PayType } from "@/lib/payslips.functions";
import type { TaxStatus } from "@/lib/payroll";
import { Plus, Trash2, KeyRound, Copy, Users } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Field staff",
};

function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function StaffSection() {
  const isOwner = useIsOwner();
  const staff = useStore((s) => s.staff);
  const setStaffList = useStore((s) => s.setStaffList);
  const fetchStaff = useServerFn(listStaff);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ email: string; password: string } | null>(null);
  const [canResetById, setCanResetById] = useState<Record<string, boolean>>({});

  const refreshStaffList = useCallback(async () => {
    const list: StaffMemberDTO[] = await fetchStaff();
    setStaffList(
      list.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        email: r.email,
        role: r.role,
        permissions: r.permissions ?? {},
        active: r.active,
      })),
    );
    const map: Record<string, boolean> = {};
    for (const r of list) map[r.id] = r.canResetPassword;
    setCanResetById(map);
  }, [fetchStaff, setStaffList]);

  useEffect(() => {
    void refreshStaffList().catch((e) => {
      console.error("[StaffSection] refresh failed", e);
      toast.error(e instanceof Error ? e.message : "Could not load staff");
    });
  }, [refreshStaffList]);

  if (!isOwner) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Only the workspace owner can manage staff.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h2 className="font-semibold">Staff members</h2>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add staff
        </Button>
      </div>

      <Card className="p-2 divide-y">
        {staff.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No staff yet. Add your first team member.
          </div>
        )}
        {staff.map((m) => (
          <button
            key={m.id}
            onClick={() => setEditing(m)}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-muted/50 rounded"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-display flex items-center justify-center">
              {(m.name || m.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.name || "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{m.email}</div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-secondary text-secondary-foreground">
              {ROLE_LABEL[m.role]}
            </span>
            {!m.active && <span className="text-[10px] text-red-600 ml-2">disabled</span>}
          </button>
        ))}
      </Card>

      <CreateStaffSheet
        open={creating}
        onClose={() => setCreating(false)}
        onRefresh={refreshStaffList}
        onCreated={(email, password) => setJustCreated({ email, password })}
      />

      <EditStaffSheet member={editing} onClose={() => setEditing(null)} onRefresh={refreshStaffList} />

      {justCreated && (
        <CredentialsDialog creds={justCreated} onClose={() => setJustCreated(null)} />
      )}
    </div>
  );
}

function CreateStaffSheet({
  open, onClose, onRefresh, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCreated: (email: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => randomPassword());
  const [role, setRole] = useState<Role>("staff");
  const [busy, setBusy] = useState(false);
  const createStaff = useServerFn(createStaffAccount);

  const reset = () => {
    setName(""); setEmail(""); setPassword(randomPassword()); setRole("staff");
  };

  const save = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Fill in name, email and password"); return;
    }
    setBusy(true);
    try {
      await createStaff({
        data: { name: name.trim(), email: email.trim().toLowerCase(), password, role, permissions: presetFor(role) },
      });
      await onRefresh();
      onCreated(email.trim().toLowerCase(), password);
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create staff");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">ADD STAFF</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 mt-3 pb-[env(safe-area-inset-bottom)]">
          <div>
            <Label>Name</Label>
            <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="h-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <Label>Temporary password</Label>
            <div className="flex gap-2">
              <Input className="h-11 font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>New</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Share with the staff member — they can change it after logging in.</p>
          </div>
          <div>
            <Label>Role</Label>
            <select className="h-11 w-full border rounded-md px-2 bg-background" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">Field staff — assigned jobs only</option>
              <option value="manager">Manager — all except staff and settings</option>
              <option value="owner">Owner — full access</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy ? "Creating…" : "Create account"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditStaffSheet({
  member, onClose, onRefresh,
}: {
  member: StaffMember | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<StaffMember | null>(member);
  const [busy, setBusy] = useState(false);
  const [newPass, setNewPass] = useState("");
  const updateStaff = useServerFn(updateStaffMember);
  const deleteStaff = useServerFn(deleteStaffMember);
  const resetPassword = useServerFn(resetStaffPassword);

  if (member && (!draft || draft.id !== member.id)) {
    setDraft(member);
    setNewPass("");
  }
  if (!member || !draft) return null;

  const effective = { ...presetFor(draft.role), ...draft.permissions };

  const setPerm = (key: Action, checked: boolean) => {
    const preset = presetFor(draft.role);
    const next: Permissions = { ...(draft.permissions ?? {}) };
    if (preset[key] === checked) delete next[key]; // matches preset → drop override
    else next[key] = checked;
    setDraft({ ...draft, permissions: next });
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateStaff({
        data: {
          id: draft.id,
          name: draft.name,
          role: draft.role,
          permissions: draft.permissions,
          active: draft.active,
        },
      });
      await onRefresh();
      toast.success("Saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${draft.name || draft.email}? Their login will be removed.`)) return;
    setBusy(true);
    try {
      await deleteStaff({ data: { id: draft.id } });
      await onRefresh();
      toast.success("Removed");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const doResetPass = async () => {
    if (!newPass || newPass.length < 6) return toast.error("Password needs at least 6 characters");
    setBusy(true);
    try {
      await resetPassword({ data: { id: draft.id, newPassword: newPass } });
      toast.success("Password updated — share it with your staff");
      setNewPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{draft.name || draft.email}</SheetTitle>
        </SheetHeader>

        <div className="grid gap-4 mt-3 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Name</Label>
              <Input className="h-11" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="h-11 w-full border rounded-md px-2 bg-background"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role, permissions: {} })}
              >
                <option value="staff">Field staff</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Active (can sign in)
          </label>

          <div>
            <div className="text-sm font-semibold mb-2">Permissions</div>
            <p className="text-xs text-muted-foreground mb-2">Tick to grant. Defaults come from the role; changes override the preset.</p>
            <div className="grid gap-3">
              {ACTION_GROUPS.map((g) => (
                <div key={g.title} className="border rounded-md p-2.5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{g.title}</div>
                  <div className="grid gap-1.5">
                    {g.actions.map((a) => (
                      <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!effective[a.key]}
                          onChange={(e) => setPerm(a.key, e.target.checked)}
                        />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CompensationSection staffId={draft.id} />


          <div className="border rounded-md p-3">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1"><KeyRound className="h-4 w-4" /> Reset password</div>
            <div className="flex gap-2">
              <Input className="h-11 font-mono" placeholder="new password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setNewPass(randomPassword())}>Gen</Button>
              <Button onClick={doResetPass} disabled={busy}>Set</Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: { email: string; password: string }; onClose: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`);
      toast.success("Copied");
    } catch { toast.error("Copy failed"); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-2">Account created</div>
        <p className="text-sm text-muted-foreground mb-3">Share these credentials once — they won't be shown again.</p>
        <div className="space-y-2 text-sm font-mono bg-muted/50 rounded-md p-3">
          <div><span className="text-muted-foreground">Email:</span> {creds.email}</div>
          <div><span className="text-muted-foreground">Password:</span> {creds.password}</div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" onClick={copy} className="flex-1"><Copy className="h-4 w-4 mr-1" /> Copy</Button>
          <Button onClick={onClose} className="flex-1">Done</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Compensation (payroll) ----------

function CompensationSection({ staffId }: { staffId: string }) {
  const [payType, setPayType] = useState<PayType>("salary");
  const [baseSalary, setBaseSalary] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [idNumber, setIdNumber] = useState("");
  const [taxStatus, setTaxStatus] = useState<TaxStatus>("paye");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fetchCompensation = useServerFn(listStaffCompensation);
  const saveCompensation = useServerFn(updateStaffCompensation);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchCompensation()
      .then((list) => {
        if (cancel) return;
        const s = list.find((x) => x.id === staffId);
        if (s) {
          setPayType(s.payType);
          setBaseSalary(s.baseSalary);
          setHourlyRate(s.hourlyRate);
          setCommissionPct(s.commissionPct);
          setIdNumber(s.idNumber ?? "");
          setTaxStatus(s.taxStatus);
        }
      })
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [fetchCompensation, staffId]);

  const save = async () => {
    setSaving(true);
    try {
      await saveCompensation({
        data: {
          id: staffId, payType, baseSalary, hourlyRate, commissionPct,
          idNumber: idNumber || null, taxStatus,
        },
      });
      toast.success("Compensation saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-sm font-semibold mb-2">Compensation (payroll)</div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Pay type</Label>
              <select
                className="h-10 w-full border rounded-md px-2 bg-background text-sm"
                value={payType}
                onChange={(e) => setPayType(e.target.value as PayType)}
              >
                <option value="salary">Fixed monthly salary</option>
                <option value="hourly">Hourly</option>
                <option value="commission">Commission only</option>
                <option value="manual">Manual per period</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Tax status</Label>
              <select
                className="h-10 w-full border rounded-md px-2 bg-background text-sm"
                value={taxStatus}
                onChange={(e) => setTaxStatus(e.target.value as TaxStatus)}
              >
                <option value="paye">PAYE (deduct tax)</option>
                <option value="provisional">Provisional (no PAYE)</option>
                <option value="exempt">Exempt (no PAYE/UIF)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Monthly salary</Label>
              <Input type="number" className="h-10" value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Hourly rate</Label>
              <Input type="number" className="h-10" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Commission %</Label>
              <Input type="number" className="h-10" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">SA ID number (for payslip)</Label>
            <Input className="h-10" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={13} />
          </div>
          <Button size="sm" variant="outline" onClick={save} disabled={saving} className="self-start">
            {saving ? "Saving…" : "Save compensation"}
          </Button>
        </div>
      )}
    </div>
  );
}

