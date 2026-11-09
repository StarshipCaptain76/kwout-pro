import { supabase } from "@/integrations/supabase/client";
import {
  useStore,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_THEME,
  setPersistKey,
  type Doc,
  type Customer,
  type CatalogItem,
  type Expense,
  type Company,
  type Banking,
  type BillingSettings,
  type Density,
  type StaffMember,
} from "./store";
import { resolveWorkspace, listStaff, setActiveWorkspace } from "./staff.functions";
import { buildBrandCache, writeBrandCookie, clearBrandCookie } from "./brand-cookie";

type Status = "idle" | "loading" | "syncing" | "synced" | "error";
type Listener = (s: { status: Status; authed: boolean; error?: string }) => void;

const state: {
  status: Status;
  userId: string | null;
  workspaceOwnerId: string | null;
  error?: string;
  loading: boolean;
  pending: number;
} = {
  status: "idle",
  userId: null,
  workspaceOwnerId: null,
  loading: false,
  pending: 0,
};
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) =>
    l({ status: state.status, authed: !!state.userId, error: state.error }),
  );
}
export function subscribeSync(l: Listener) {
  listeners.add(l);
  l({ status: state.status, authed: !!state.userId, error: state.error });
  return () => listeners.delete(l);
}

export function isAuthed() {
  return !!state.userId;
}

let suppressPush = false;

function runningTask(): Status {
  if (state.loading) return "loading";
  if (state.pending > 0) return "syncing";
  return "synced";
}

async function withPush<T>(fn: () => Promise<T>, throwOnError = false): Promise<T | void> {
  if (suppressPush || !state.userId) return;
  state.pending += 1;
  state.status = "syncing";
  emit();
  try {
    const out = await fn();
    state.error = undefined;
    return out;
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
    console.error("[sync push]", e);
    emit();
    if (throwOnError) throw e;
  } finally {
    state.pending -= 1;
    if (state.status !== "error") state.status = runningTask();
    emit();
  }
}

export function pushCompanyProfile() {
  const s = useStore.getState();
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("company_profile").upsert({
      owner_user_id: uid,
      company: s.company as unknown as never,
      banking: s.banking as unknown as never,
      billing: s.billing as unknown as never,
      density: s.density,
      business_type: s.company.businessType ?? null,
      enabled_modules: (s.company.enabledModules ?? []) as unknown as never,
      accounting_package: s.company.accountingPackage ?? "csv",
    } as never);
    if (error) throw error;
  });
}

export function pushCatalogItem(c: CatalogItem) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("catalog_items").upsert({
      id: c.id,
      owner_user_id: uid,
      name: c.name,
      price: c.price,
      unit: c.unit,
    });
    if (error) throw error;
  });
}

export function deleteCatalogItemRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushCustomer(c: Customer, throwOnError = false) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) {
    if (throwOnError) return Promise.reject(new Error("Your business is still loading. Please try again shortly."));
    return;
  }
  return withPush(async () => {
    const { error } = await supabase.from("customers").upsert({
      id: c.id,
      owner_user_id: uid,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address ?? null,
      tax_number: c.taxNumber ?? null,
    });
    if (error) throw error;
  }, throwOnError);
}

export function deleteCustomerRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushDoc(d: Doc) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("docs").upsert({
      id: d.id,
      owner_user_id: uid,
      number: d.number,
      type: d.type,
      status: d.status,
      created_at: d.createdAt,
      scheduled_date: d.scheduledDate ?? null,
      scheduled_time: d.scheduledTime ?? null,
      scheduled_end_date: d.scheduledEndDate ?? null,
      day_order: d.dayOrder ?? null,
      archived: !!d.archived,
      customer: d.customer as unknown as never,
      items: d.items as unknown as never,
      notes: d.notes ?? null,
      deposit_pct: d.depositPct,
      deposit_paid: !!d.depositPaid,
      payment_method: d.paymentMethod ?? null,
      paid_at: d.paidAt ?? null,
      from_address: d.fromAddress ?? null,
      to_address: d.toAddress ?? null,
      from_coords: (d.fromCoords ?? null) as unknown as never,
      to_coords: (d.toCoords ?? null) as unknown as never,
      stops: (d.stops ?? []) as unknown as never,
      distance_km: d.distanceKm ?? null,
      assigned_to: d.assignedTo ?? null,
      module_data: (d.moduleData ?? null) as unknown as never,
    } as never);
    if (error) throw error;
  });
}

export function deleteDocRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("docs").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushExpense(e: Expense) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("expenses").upsert({
      id: e.id,
      owner_user_id: uid,
      date: e.date,
      category: e.category,
      vendor: e.vendor,
      description: e.description ?? null,
      amount: e.amount,
      vat_amount: e.vatAmount ?? null,
      payment_method: e.paymentMethod ?? null,
      notes: e.notes ?? null,
      receipt_image: e.receiptImage ?? null,
      linked_doc_id: e.linkedDocId ?? null,
      created_at: e.createdAt,
    });
    if (error) throw error;
  });
}

export function deleteExpenseRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushExpenseCategory(name: string) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase
      .from("expense_categories")
      .upsert({ owner_user_id: uid, name }, { onConflict: "owner_user_id,name" });
    if (error) throw error;
  });
}

export function deleteExpenseCategoryRow(name: string) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("owner_user_id", uid)
      .eq("name", name);
    if (error) throw error;
  });
}

export async function renameExpenseCategoryRow(oldName: string, newName: string) {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;
  await withPush(async () => {
    const { error: insErr } = await supabase
      .from("expense_categories")
      .upsert({ owner_user_id: uid, name: newName }, { onConflict: "owner_user_id,name" });
    if (insErr) throw insErr;
    const { error: delErr } = await supabase
      .from("expense_categories")
      .delete()
      .eq("owner_user_id", uid)
      .eq("name", oldName);
    if (delErr) throw delErr;
  });
}

export function pushMany(docs: Doc[], expenses: Expense[], catalog: CatalogItem[], categories: string[]) {
  docs.forEach(pushDoc);
  expenses.forEach(pushExpense);
  catalog.forEach(pushCatalogItem);
  categories.forEach(pushExpenseCategory);
}

async function waitForRehydrate() {
  const p = useStore.persist;
  if (!p) return;
  if (p.hasHydrated?.()) return;
  await new Promise<void>((resolve) => {
    const unsub = p.onFinishHydration?.(() => {
      unsub?.();
      resolve();
    });
    if (!unsub) resolve();
  });
}

async function loadAll() {
  const uid = state.workspaceOwnerId ?? state.userId;
  if (!uid) return;

  await waitForRehydrate();

  state.loading = true;
  state.status = "loading";
  emit();

  try {
    const PAGE = 1000;
    const fetchAll = async <T>(
      builder: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
    ): Promise<T[]> => {
      const rows: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await builder().range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        rows.push(...chunk);
        if (chunk.length < PAGE) break;
      }
      return rows;
    };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [profileRes, catData, custData, docsData, expData, catCatData] = await Promise.all([
      supabase.from("company_profile").select("*").eq("owner_user_id", uid).maybeSingle(),
      fetchAll<any>(() => supabase.from("catalog_items").select("*").eq("owner_user_id", uid) as any),
      fetchAll<any>(() => supabase.from("customers").select("*").eq("owner_user_id", uid) as any),
      fetchAll<any>(() => supabase.from("docs").select("*").eq("owner_user_id", uid) as any),
      fetchAll<any>(() => supabase.from("expenses").select("*").eq("owner_user_id", uid) as any),
      fetchAll<any>(() => supabase.from("expense_categories").select("*").eq("owner_user_id", uid) as any),
    ]);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (profileRes.error) throw profileRes.error;
    const catRes = { data: catData };
    const custRes = { data: custData };
    const docsRes = { data: docsData };
    const expRes = { data: expData };
    const catCatRes = { data: catCatData };

    const prev = useStore.getState();
    const profileRow = profileRes.data;

    const remoteCatalog: CatalogItem[] = (catRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      unit: r.unit as CatalogItem["unit"],
    }));
    {
      const seen = new Set<string>();
      const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      for (let i = remoteCatalog.length - 1; i >= 0; i--) {
        const k = norm(remoteCatalog[i].name);
        if (seen.has(k)) remoteCatalog.splice(i, 1); else seen.add(k);
      }
    }
    const remoteCustomers: Customer[] = (custRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      address: r.address ?? undefined,
      taxNumber: r.tax_number ?? undefined,
    }));
    const remoteDocs: Doc[] = (docsRes.data ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      type: r.type as Doc["type"],
      status: r.status as Doc["status"],
      createdAt: r.created_at,
      scheduledDate: r.scheduled_date ?? undefined,
      scheduledTime: (r as { scheduled_time?: string | null }).scheduled_time ?? undefined,
      scheduledEndDate: r.scheduled_end_date ?? undefined,
      dayOrder: r.day_order ?? undefined,
      archived: r.archived,
      customer: r.customer as unknown as Customer,
      items: (r.items as unknown as Doc["items"]) ?? [],
      notes: r.notes ?? undefined,
      depositPct: Number(r.deposit_pct),
      depositPaid: r.deposit_paid,
      paymentMethod: (r.payment_method as Doc["paymentMethod"]) ?? undefined,
      paidAt: r.paid_at ?? undefined,
      fromAddress: r.from_address ?? undefined,
      toAddress: r.to_address ?? undefined,
      fromCoords: (r.from_coords as Doc["fromCoords"]) ?? undefined,
      toCoords: (r.to_coords as Doc["toCoords"]) ?? undefined,
      stops: Array.isArray((r as { stops?: unknown }).stops)
        ? ((r as { stops: Doc["stops"] }).stops ?? [])
        : undefined,
      distanceKm: r.distance_km != null ? Number(r.distance_km) : undefined,
      assignedTo: (r as { assigned_to?: string | null }).assigned_to ?? undefined,
      moduleData: ((r as { module_data?: unknown }).module_data ?? undefined) as Doc["moduleData"],
    }));
    const remoteExpenses: Expense[] = (expRes.data ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      date: r.date,
      category: r.category,
      vendor: r.vendor,
      description: r.description ?? undefined,
      amount: Number(r.amount),
      vatAmount: r.vat_amount != null ? Number(r.vat_amount) : undefined,
      paymentMethod: (r.payment_method as Expense["paymentMethod"]) ?? undefined,
      notes: r.notes ?? undefined,
      receiptImage: r.receipt_image ?? undefined,
      linkedDocId: r.linked_doc_id ?? undefined,
    }));
    const remoteCategoryNames = (catCatRes.data ?? []).map((r) => r.name);

    const expenseCategories = remoteCategoryNames.length
      ? remoteCategoryNames
      : DEFAULT_EXPENSE_CATEGORIES;

    const company = (profileRow?.company as Company | null) && Object.keys(profileRow!.company as object).length
      ? (profileRow!.company as unknown as Company)
      : prev.company;
    const rowBt = (profileRow as { business_type?: string | null } | null)?.business_type;
    const rowMods = (profileRow as { enabled_modules?: string[] | null } | null)?.enabled_modules;
    if (rowBt) company.businessType = rowBt as Company["businessType"];
    if (rowMods) company.enabledModules = rowMods as Company["enabledModules"];
    const rowPkg = (profileRow as { accounting_package?: string | null } | null)?.accounting_package;
    if (rowPkg) company.accountingPackage = rowPkg as Company["accountingPackage"];
    if (!company.jobReminders) company.jobReminders = { enabled: false, leadMinutes: 30 };
    const banking = (profileRow?.banking as Banking | null) && Object.keys(profileRow!.banking as object).length
      ? (profileRow!.banking as unknown as Banking)
      : prev.banking;
    const billing = (profileRow?.billing as BillingSettings | null) && Object.keys(profileRow!.billing as object).length
      ? (profileRow!.billing as unknown as BillingSettings)
      : prev.billing;
    const density = (profileRow?.density as Density | undefined) ?? prev.density;

    suppressPush = true;
    try {
      useStore.setState({
        company,
        banking,
        billing,
        density,
        catalog: remoteCatalog,
        customers: remoteCustomers,
        docs: remoteDocs,
        expenses: remoteExpenses,
        expenseCategories,
      });
    } finally {
      suppressPush = false;
    }

    const theme = company.theme ?? DEFAULT_THEME;
    writeBrandCookie(
      buildBrandCache({
        name: company.name,
        logo: company.logo,
        primary: theme.primary,
        accent: theme.accent,
      }),
    );

    if (!profileRes.data) pushCompanyProfile();
    if (!(catCatRes.data ?? []).length) {
      DEFAULT_EXPENSE_CATEGORIES.forEach(pushExpenseCategory);
    }

  } finally {
    state.loading = false;
    state.status = runningTask();
    emit();
  }
}

async function resolveAndLoad() {
  if (!state.userId) return;
  try {
    const info = await resolveWorkspace();
    state.workspaceOwnerId = info.workspaceOwnerId;
    useStore.getState().setCurrentWorkspaceOwnerId(info.workspaceOwnerId);
    const me: StaffMember | null = info.me
      ? {
          id: info.me.id,
          userId: info.me.userId,
          name: info.me.name,
          email: info.me.email,
          role: info.me.role,
          permissions: info.me.permissions ?? {},
          active: info.me.active,
        }
      : null;
    useStore.getState().setCurrentUser(state.userId, me);
  } catch (e) {
    console.error("[sync resolveWorkspace]", e);
    state.workspaceOwnerId = state.userId;
    useStore.getState().setCurrentWorkspaceOwnerId(state.userId);
    useStore.getState().setCurrentUser(state.userId, null);
  }

  await loadAll();

  try {
    const list = await listStaff();
    useStore.getState().setStaffList(
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
  } catch (e) {
    console.error("[sync listStaff]", e);
  }
}

export async function refreshStaff() {
  try {
    const list = await listStaff();
    useStore.getState().setStaffList(
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
  } catch (e) {
    console.error("[sync refreshStaff]", e);
  }
}

export async function switchWorkspace(workspaceOwnerId: string) {
  if (!state.userId) return;
  await setActiveWorkspace({ data: { workspaceOwnerId } });
  suppressPush = true;
  try {
    useStore.getState().resetToDefaults();
  } finally {
    suppressPush = false;
  }
  state.workspaceOwnerId = null;
  await resolveAndLoad();
}

let started = false;
export async function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const newUid = session?.user.id ?? null;
    if (newUid === state.userId) return;
    state.userId = newUid;
    if (!newUid) {
      state.workspaceOwnerId = null;
      useStore.getState().resetToDefaults();
      useStore.getState().setCurrentUser(null, null);
      useStore.getState().setCurrentWorkspaceOwnerId(null);
      useStore.getState().setStaffList([]);
      clearBrandCookie();
      setPersistKey(null);
    } else {
      useStore.getState().resetToDefaults();
      setPersistKey(newUid);
    }
    emit();
    if (newUid) void resolveAndLoad();
  });

  const { data: userRes } = await supabase.auth.getUser();
  state.userId = userRes.user?.id ?? null;
  if (state.userId) setPersistKey(state.userId);
  emit();
  if (state.userId) await resolveAndLoad();
}

export function getShareLink(): string | null {
  return null;
}
export function flushSync(): Promise<void> {
  return Promise.resolve();
}
