import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchAllRows } from "@/lib/pagination";

import {
  computeDeductions,
  ageFromSaId,
  type TaxStatus,
  type DeductionLine,
} from "./payroll";

// ------------- Types -------------

export type PayType = "salary" | "hourly" | "commission" | "manual";
export type PayslipStatus = "draft" | "finalized";

export interface PayslipDTO {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  hours: number;
  gross: number;
  commissionAmount: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdl: number;
  otherDeductions: number;
  deductionsBreakdown: DeductionLine[];
  net: number;
  status: PayslipStatus;
  finalizedAt: string | null;
  sentAt: string | null;
}

export interface StaffCompensationDTO {
  id: string;
  name: string;
  email: string;
  payType: PayType;
  baseSalary: number;
  hourlyRate: number;
  commissionPct: number;
  idNumber: string | null;
  taxStatus: TaxStatus;
  active: boolean;
}

// ------------- Helpers -------------

// Confirms the caller owns at least one workspace (i.e. has a staff_members row
// where they are their own workspace_owner_id). Tolerant of users who are also
// staff of other workspaces — those add extra rows we must not choke on.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOwner(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("staff_members")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_owner_id", userId)
    .eq("active", true)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Only the workspace owner can access payslips.");
  }
}

// ------------- Server functions -------------

export const listStaffCompensation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffCompensationDTO[]> => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data, error } = await supabase
      .from("staff_members")
      .select(
        "id, name, email, pay_type, base_salary, hourly_rate, commission_pct, id_number, tax_status, active",
      )
      .eq("workspace_owner_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "",
      email: (r.email as string) ?? "",
      payType: ((r.pay_type as PayType) ?? "salary"),
      baseSalary: Number(r.base_salary ?? 0),
      hourlyRate: Number(r.hourly_rate ?? 0),
      commissionPct: Number(r.commission_pct ?? 0),
      idNumber: (r.id_number as string | null) ?? null,
      taxStatus: ((r.tax_status as TaxStatus) ?? "paye"),
      active: !!r.active,
    }));
  });

export const updateStaffCompensation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        payType: z.enum(["salary", "hourly", "commission", "manual"]).optional(),
        baseSalary: z.number().min(0).optional(),
        hourlyRate: z.number().min(0).optional(),
        commissionPct: z.number().min(0).max(100).optional(),
        idNumber: z.string().max(20).nullable().optional(),
        taxStatus: z.enum(["paye", "provisional", "exempt"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const patch: Record<string, unknown> = {};
    if (data.payType !== undefined) patch.pay_type = data.payType;
    if (data.baseSalary !== undefined) patch.base_salary = data.baseSalary;
    if (data.hourlyRate !== undefined) patch.hourly_rate = data.hourlyRate;
    if (data.commissionPct !== undefined) patch.commission_pct = data.commissionPct;
    if (data.idNumber !== undefined) patch.id_number = data.idNumber;
    if (data.taxStatus !== undefined) patch.tax_status = data.taxStatus;
    const { error } = await supabase
      .from("staff_members")
      .update(patch as never)
      .eq("id", data.id)
      .eq("workspace_owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// Draft — computes gross + deductions without saving.
export const generatePayslipDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        staffId: z.string().uuid(),
        periodStart: z.string(),
        periodEnd: z.string(),
        hours: z.number().min(0).optional(),
        manualGross: z.number().min(0).optional(),
        sdlApplies: z.boolean().optional(),
        otherDeductions: z
          .array(z.object({ label: z.string(), amount: z.number() }))
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);

    // Load staff
    const { data: staff, error: sErr } = await supabase
      .from("staff_members")
      .select(
        "id, user_id, name, email, pay_type, base_salary, hourly_rate, commission_pct, id_number, tax_status",
      )
      .eq("id", data.staffId)
      .eq("workspace_owner_id", userId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!staff) throw new Error("Staff not found");

    const payType = ((staff.pay_type as PayType) ?? "salary");
    const hourly = Number(staff.hourly_rate ?? 0);
    const salary = Number(staff.base_salary ?? 0);
    const commissionPct = Number(staff.commission_pct ?? 0);
    const idNumber = (staff.id_number as string | null) ?? null;
    const taxStatus = ((staff.tax_status as TaxStatus) ?? "paye");
    const staffUserId = staff.user_id as string;

    let gross = 0;
    let commissionAmount = 0;

    if (payType === "salary") {
      gross = salary;
    } else if (payType === "hourly") {
      gross = hourly * (data.hours ?? 0);
    } else if (payType === "manual") {
      gross = data.manualGross ?? 0;
    }

    // Commission: sum of paid docs assigned to this staff in the period.
    if (payType === "commission" || (payType !== "manual" && commissionPct > 0)) {
      const docs = await fetchAllRows<{ subtotal: number | null }>(() =>
        supabase
          .from("docs")
          .select("subtotal, paid_at, assigned_to")
          .eq("owner_user_id", userId)
          .eq("assigned_to", staffUserId)
          .eq("status", "paid")
          .gte("paid_at", data.periodStart)
          .lte("paid_at", data.periodEnd + "T23:59:59"),
      );
      const revenue = docs.reduce((s, d) => s + Number(d.subtotal ?? 0), 0);

      commissionAmount = Math.round(revenue * (commissionPct / 100) * 100) / 100;
      if (payType === "commission") gross = commissionAmount;
      else gross += commissionAmount;
    }

    const age = ageFromSaId(idNumber);
    const comp = computeDeductions({
      monthlyGross: gross,
      commissionAmount,
      age,
      taxStatus,
      sdlApplies: data.sdlApplies ?? false,
      otherDeductions: data.otherDeductions ?? [],
    });

    return {
      staffId: staff.id as string,
      staffName: (staff.name as string) ?? "",
      staffEmail: (staff.email as string) ?? "",
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      hours: data.hours ?? 0,
      ...comp,
    };
  });

export const savePayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        staffId: z.string().uuid(),
        periodStart: z.string(),
        periodEnd: z.string(),
        periodLabel: z.string(),
        hours: z.number(),
        gross: z.number(),
        commissionAmount: z.number(),
        paye: z.number(),
        uifEmployee: z.number(),
        uifEmployer: z.number(),
        sdl: z.number(),
        otherDeductions: z.number(),
        deductionsBreakdown: z.array(z.object({ label: z.string(), amount: z.number() })),
        net: z.number(),
        status: z.enum(["draft", "finalized"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const row = {
      workspace_owner_id: userId,
      staff_id: data.staffId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      period_label: data.periodLabel,
      hours: data.hours,
      gross: data.gross,
      commission_amount: data.commissionAmount,
      paye: data.paye,
      uif_employee: data.uifEmployee,
      uif_employer: data.uifEmployer,
      sdl: data.sdl,
      other_deductions: data.otherDeductions,
      deductions_breakdown: data.deductionsBreakdown,
      net: data.net,
      status: data.status,
      finalized_at: data.status === "finalized" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("payslips")
        .update(row as never)
        .eq("id", data.id)
        .eq("workspace_owner_id", userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("payslips")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (inserted as { id: string }).id };
  });

export const listPayslips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PayslipDTO[]> => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    let q = supabase
      .from("payslips")
      .select(
        "id, staff_id, period_start, period_end, period_label, hours, gross, commission_amount, paye, uif_employee, uif_employer, sdl, other_deductions, deductions_breakdown, net, status, finalized_at, sent_at, staff_members!inner(name, email)",
      )
      .eq("workspace_owner_id", userId)
      .order("period_start", { ascending: false });
    if (data.from) q = q.gte("period_start", data.from);
    if (data.to) q = q.lte("period_end", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((r) => {
      const rec = r as unknown as {
        id: string; staff_id: string; period_start: string; period_end: string;
        period_label: string; hours: number; gross: number; commission_amount: number;
        paye: number; uif_employee: number; uif_employer: number; sdl: number;
        other_deductions: number; deductions_breakdown: DeductionLine[]; net: number;
        status: PayslipStatus; finalized_at: string | null; sent_at: string | null;
        staff_members: { name: string; email: string } | null;
      };
      return {
        id: rec.id,
        staffId: rec.staff_id,
        staffName: rec.staff_members?.name ?? "",
        staffEmail: rec.staff_members?.email ?? "",
        periodStart: rec.period_start,
        periodEnd: rec.period_end,
        periodLabel: rec.period_label,
        hours: Number(rec.hours ?? 0),
        gross: Number(rec.gross ?? 0),
        commissionAmount: Number(rec.commission_amount ?? 0),
        paye: Number(rec.paye ?? 0),
        uifEmployee: Number(rec.uif_employee ?? 0),
        uifEmployer: Number(rec.uif_employer ?? 0),
        sdl: Number(rec.sdl ?? 0),
        otherDeductions: Number(rec.other_deductions ?? 0),
        deductionsBreakdown: (rec.deductions_breakdown ?? []) as DeductionLine[],
        net: Number(rec.net ?? 0),
        status: rec.status,
        finalizedAt: rec.finalized_at,
        sentAt: rec.sent_at,
      };
    });
  });

export const deletePayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("payslips")
      .delete()
      .eq("id", data.id)
      .eq("workspace_owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const markPayslipSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("payslips")
      .update({ sent_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("workspace_owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });
