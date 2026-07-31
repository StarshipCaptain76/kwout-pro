import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import {
  pushDoc,
  deleteDocRow,
  pushCatalogItem,
  deleteCatalogItemRow,
  pushCustomer,
  pushCompanyProfile,
  pushExpense,
  deleteExpenseRow,
  pushExpenseCategory,
  deleteExpenseCategoryRow,
  renameExpenseCategoryRow,
} from "./sync";
import type { Role, Permissions } from "./permissions";
export type { Role, Permissions } from "./permissions";

export interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Optional custom job title / role label (e.g. "Lead Technician"). Falls back to the role name when empty. */
  title?: string | null;
  permissions: Permissions;
  active: boolean;
}

export type Unit = string; // built-ins: "each" | "hour" | "km" | "job", plus user-defined
export const BUILTIN_UNITS = ["each", "hour", "km", "job"] as const;
export type PayMethod = "cash" | "eft" | "card";
export type DocType = "quote" | "invoice" | "job";
export type DocStatus = "draft" | "sent" | "accepted" | "declined" | "paid" | "cancelled";
/** Derived invoice status used for status frames and /docs filtering. */
export type InvoiceView = "draft" | "unpaid" | "overdue" | "paid";
/** Derived quote status used for status frames and /docs filtering. */
export type QuoteView = "draft" | "awaiting" | "accepted" | "declined";
export type Density = "compact" | "normal" | "comfortable";

export interface Expense {
  id: string;
  createdAt: string;
  date: string; // yyyy-mm-dd
  category: string;
  vendor: string;
  description?: string;
  amount: number;
  vatAmount?: number;
  paymentMethod?: PayMethod;
  notes?: string;
  receiptImage?: string; // data URL
  linkedDocId?: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Fuel",
  "Vehicle",
  "Tools & Materials",
  "Subcontractors",
  "Office",
  "Software",
  "Marketing",
  "Travel",
  "Meals",
  "Other",
];

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  unit: Unit;
}

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  unit: Unit;
  isDistance?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
}

export interface Doc {
  id: string;
  number: string;
  type: DocType;
  status: DocStatus;
  createdAt: string;
  scheduledDate?: string;
  scheduledEndDate?: string;
  dayOrder?: number;
  archived?: boolean;
  customer: Customer;
  items: LineItem[];
  notes?: string;
  depositPct: number;
  depositPaid: boolean;
  paymentMethod?: PayMethod;
  paidAt?: string;
  fromAddress?: string;
  toAddress?: string;
  fromCoords?: { lat: number; lng: number };
  toCoords?: { lat: number; lng: number };
  distanceKm?: number;
  assignedTo?: string; // staff user_id
  moduleData?: Partial<Record<import("./modules").ModuleKey, Record<string, unknown>>>;
}

export interface Theme {
  primary: string; // hex like "#2563eb"
  accent: string; // hex like "#0f172a"
}

export const DEFAULT_BILLING_TERMS =
  "Balances exceeding R1000.00 requires a 50% deposit before work starts. When making any payment please use the Quote/Invoice number as payment reference";

export const DEFAULT_THEME: Theme = {
  primary: "#151C63", // KWOUT navy
  accent: "#4F8C2E", // KWOUT green
};

export interface Company {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  regNo?: string;
  vatNo?: string;
  logo?: string; // data URL
  theme?: Theme;
  businessType?: import("./modules").BusinessType;
  enabledModules?: import("./modules").ModuleKey[];
  /** Default disposal / dump-site address, used by the "Disposal" quick-fill button on job addresses when the Waste module is active. */
  disposalSite?: {
    address: string;
    coords?: { lat: number; lng: number } | null;
  };
  /** Preferred accounting-package format for data exports. */
  accountingPackage?: import("./exports/accounting").AccountingPackage;
}

export interface Banking {
  accountName: string;
  accountNumber: string;
  bank: string;
  branchCode: string;
  branchName: string;
  swiftCode: string;
}

export interface BillingSettings {
  ratePerKm: number;
  baseCallout: number;
  defaultDepositPct: number;
  vatPct: number;
  chargesVat?: boolean;
  vatNumber?: string;
  quotePrefix: string;
  invoicePrefix: string;
  jobPrefix?: string;
  nextQuoteNo: number;
  nextInvoiceNo: number;
  nextJobNo?: number;
  currency: string;
  terms?: string;
  primaryUnit?: Unit;
  customUnits?: string[];
  /** Days after createdAt before an unpaid invoice is considered overdue. Default 30. */
  invoiceDueDays?: number;
}

interface State {
  company: Company;
  banking: Banking;
  billing: BillingSettings;
  catalog: CatalogItem[];
  customers: Customer[];
  docs: Doc[];
  expenses: Expense[];
  expenseCategories: string[];
  density: Density;
  staff: StaffMember[];
  currentUserId: string | null;
  currentStaff: StaffMember | null;
  currentWorkspaceOwnerId: string | null;
  onboardingDismissed: boolean;
  setOnboardingDismissed: (v: boolean) => void;
  setStaffList: (s: StaffMember[]) => void;
  setCurrentUser: (userId: string | null, currentStaff: StaffMember | null) => void;
  setCurrentWorkspaceOwnerId: (id: string | null) => void;
  upsertDoc: (d: Doc) => void;
  deleteDoc: (id: string) => void;
  upsertCatalog: (c: CatalogItem) => void;
  deleteCatalog: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  setCompany: (c: Company) => void;
  setBanking: (b: Banking) => void;
  setBilling: (b: BillingSettings) => void;
  nextDocNumber: (t: DocType) => string;
  upsertExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addExpenseCategory: (name: string) => void;
  renameExpenseCategory: (oldName: string, newName: string) => void;
  deleteExpenseCategory: (name: string) => void;
  setDensity: (d: Density) => void;
  importHistorical: (p: {
    expenses: Expense[];
    docs: Doc[];
    newExpenseCategories: string[];
    newCatalogItems: CatalogItem[];
    maxInvoiceNo: number;
  }) => { expenses: number; docs: number };
  clearHistorical: () => { expenses: number; docs: number };
  resetToDefaults: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// ============ per-user persistence key ============
// The persisted store is namespaced by the currently signed-in user id.
// This prevents one user's local data leaking into another account when
// they sign in on the same device.
const PERSIST_PREFIX = "app-store::";
const LEGACY_KEY = "app-store-v1";
let currentPersistKey = "anon";

function fullKey() {
  return `${PERSIST_PREFIX}${currentPersistKey}`;
}

// One-time: migrate the legacy shared key to the anon slot so any local
// edits made before this change aren't lost. Never migrate into a signed-in
// slot.
if (typeof window !== "undefined") {
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy && !window.localStorage.getItem(`${PERSIST_PREFIX}anon`)) {
      window.localStorage.setItem(`${PERSIST_PREFIX}anon`, legacy);
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore storage errors
  }
}

const perUserStorage: StateStorage = {
  getItem: (_name) => {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(fullKey()); } catch { return null; }
  },
  setItem: (_name, value) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(fullKey(), value); } catch { /* noop */ }
  },
  removeItem: (_name) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(fullKey()); } catch { /* noop */ }
  },
};

export function setPersistKey(userId: string | null) {
  const next = userId ?? "anon";
  if (next === currentPersistKey) return;
  currentPersistKey = next;
  // Rehydrate from the new slot so the in-memory store reflects that user.
  void useStore.persist.rehydrate();
}

export function clearAnonPersist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(`${PERSIST_PREFIX}anon`); } catch { /* noop */ }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      company: {
        name: "KWOUT",
        tagline: "",
        address: "",
        phone: "",
        email: "",
        logo: "/kwout-logo.png",
        theme: DEFAULT_THEME,
      },
      banking: {
        accountName: "",
        accountNumber: "",
        bank: "",
        branchCode: "",
        branchName: "",
        swiftCode: "",
      },
      billing: {
        ratePerKm: 0,
        baseCallout: 0,
        defaultDepositPct: 50,
        vatPct: 0,
        chargesVat: false,
        vatNumber: "",
        quotePrefix: "Q",
        invoicePrefix: "INV",
        jobPrefix: "J",
        nextQuoteNo: 1001,
        nextInvoiceNo: 1001,
        nextJobNo: 1001,
        currency: "R",
        terms: DEFAULT_BILLING_TERMS,
        primaryUnit: "km",
        customUnits: [],
      },
      catalog: [],
      customers: [],
      docs: [],
      expenses: [],
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      density: "normal" as Density,
      staff: [],
      currentUserId: null,
      currentStaff: null,
      currentWorkspaceOwnerId: null,
      onboardingDismissed: false,
      setOnboardingDismissed: (v) => set({ onboardingDismissed: v }),
      setStaffList: (s) => set({ staff: s }),
      setCurrentUser: (userId, currentStaff) => set({ currentUserId: userId, currentStaff }),
      setCurrentWorkspaceOwnerId: (id) => set({ currentWorkspaceOwnerId: id }),
      upsertDoc: (d) =>
        {
          set((s) => ({
          docs: s.docs.some((x) => x.id === d.id)
            ? s.docs.map((x) => (x.id === d.id ? d : x))
            : [d, ...s.docs],
          customers: d.customer.name
            ? s.customers.some((c) => c.id === d.customer.id)
              ? s.customers.map((c) => (c.id === d.customer.id ? d.customer : c))
              : [...s.customers, d.customer]
            : s.customers,
          }));
          pushDoc(d);
          if (d.customer.name) pushCustomer(d.customer);
        },
      deleteDoc: (id) => {
        set((s) => ({ docs: s.docs.filter((d) => d.id !== id) }));
        deleteDocRow(id);
      },
      upsertCatalog: (c) => {
        set((s) => ({
          catalog: s.catalog.some((x) => x.id === c.id)
            ? s.catalog.map((x) => (x.id === c.id ? c : x))
            : [...s.catalog, c],
        }));
        pushCatalogItem(c);
      },
      deleteCatalog: (id) => {
        set((s) => ({ catalog: s.catalog.filter((c) => c.id !== id) }));
        deleteCatalogItemRow(id);
      },
      upsertCustomer: (c) => {
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id)
            ? s.customers.map((x) => (x.id === c.id ? c : x))
            : [...s.customers, c],
        }));
        pushCustomer(c);
      },
      setCompany: (c) => {
        set({ company: c });
        pushCompanyProfile();
      },
      setBanking: (b) => {
        set({ banking: b });
        pushCompanyProfile();
      },
      setBilling: (b) => {
        set({ billing: b });
        pushCompanyProfile();
      },
      nextDocNumber: (t) => {
        const { billing: b } = get();
        if (t === "quote") {
          const n = b.nextQuoteNo;
          set({ billing: { ...b, nextQuoteNo: n + 1 } });
          pushCompanyProfile();
          return `${b.quotePrefix}-${n}`;
        }
        if (t === "job") {
          const n = b.nextJobNo ?? 1001;
          set({ billing: { ...b, nextJobNo: n + 1 } });
          pushCompanyProfile();
          return `${b.jobPrefix ?? "J"}-${n}`;
        }
        const n = b.nextInvoiceNo;
        set({ billing: { ...b, nextInvoiceNo: n + 1 } });
        pushCompanyProfile();
        return `${b.invoicePrefix}-${n}`;
      },
      upsertExpense: (e) => {
        set((s) => ({
          expenses: s.expenses.some((x) => x.id === e.id)
            ? s.expenses.map((x) => (x.id === e.id ? e : x))
            : [e, ...s.expenses],
        }));
        pushExpense(e);
      },
      deleteExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
        deleteExpenseRow(id);
      },
      addExpenseCategory: (name) => {
        set((s) => {
          const n = name.trim();
          if (!n || s.expenseCategories.some((c) => c.toLowerCase() === n.toLowerCase())) return {} as Partial<State>;
          return { expenseCategories: [...s.expenseCategories, n] };
        });
        const n = name.trim();
        if (n) pushExpenseCategory(n);
      },
      renameExpenseCategory: (oldName, newName) => {
        set((s) => {
          const n = newName.trim();
          if (!n) return {} as Partial<State>;
          return {
            expenseCategories: s.expenseCategories.map((c) => (c === oldName ? n : c)),
            expenses: s.expenses.map((e) => (e.category === oldName ? { ...e, category: n } : e)),
          };
        });
        const n = newName.trim();
        if (n) {
          void renameExpenseCategoryRow(oldName, n);
          get().expenses.forEach((e) => {
            if (e.category === n) pushExpense(e);
          });
        }
      },
      deleteExpenseCategory: (name) => {
        set((s) => ({
          expenseCategories: s.expenseCategories.filter((c) => c !== name),
          expenses: s.expenses.map((e) => (e.category === name ? { ...e, category: "Other" } : e)),
        }));
        deleteExpenseCategoryRow(name);
        get().expenses.forEach((e) => {
          if (e.category === "Other") pushExpense(e);
        });
      },
      setDensity: (d) => {
        set({ density: d });
        pushCompanyProfile();
      },
      importHistorical: (p) => {
        const s = get();
        const existingExp = new Set(s.expenses.map((e) => e.id));
        const existingDoc = new Set(s.docs.map((d) => d.id));
        // Categories mutate ONLY on explicit user action — imports must never
        // silently create new categories. Map unknown categories to "Other".
        const knownCats = new Set(s.expenseCategories.map((c) => c.toLowerCase()));
        const normalisedExp = p.expenses
          .filter((e) => !existingExp.has(e.id))
          .map((e) =>
            e.category && knownCats.has(e.category.toLowerCase()) ? e : { ...e, category: "Other" },
          );
        const newExp = normalisedExp;
        const newDocs = p.docs.filter((d) => !existingDoc.has(d.id));
        const catalogNames = new Set(s.catalog.map((c) => c.name.toLowerCase()));
        const addedCatalog = p.newCatalogItems.filter(
          (c) => !catalogNames.has(c.name.toLowerCase()),
        );
        set({
          expenses: [...newExp, ...s.expenses],
          docs: [...newDocs, ...s.docs],
          catalog: [...s.catalog, ...addedCatalog],
          billing: {
            ...s.billing,
            nextInvoiceNo: Math.max(s.billing.nextInvoiceNo, p.maxInvoiceNo + 1),
          },
        });
        newExp.forEach(pushExpense);
        newDocs.forEach(pushDoc);
        addedCatalog.forEach(pushCatalogItem);
        pushCompanyProfile();
        return { expenses: newExp.length, docs: newDocs.length };
      },
      clearHistorical: () => {
        const s = get();
        const expBefore = s.expenses.length;
        const docBefore = s.docs.length;
        const isImported = (id: string) => id.startsWith("hist-") || id.startsWith("bank-");
        const removedExp = s.expenses.filter((e) => isImported(e.id));
        const removedDocs = s.docs.filter((d) => isImported(d.id));
        const removedCat = s.catalog.filter((c) => c.id.startsWith("hist-cat-"));
        const expenses = s.expenses.filter((e) => !isImported(e.id));
        const docs = s.docs.filter((d) => !isImported(d.id));
        const catalog = s.catalog.filter((c) => !c.id.startsWith("hist-cat-"));
        set({ expenses, docs, catalog });
        removedExp.forEach((e) => deleteExpenseRow(e.id));
        removedDocs.forEach((d) => deleteDocRow(d.id));
        removedCat.forEach((c) => deleteCatalogItemRow(c.id));
        return { expenses: expBefore - expenses.length, docs: docBefore - docs.length };
      },
      resetToDefaults: () => {
        set({
          company: {
            name: "KWOUT",
            tagline: "",
            address: "",
            phone: "",
            email: "",
            logo: "/kwout-logo.png",
            theme: DEFAULT_THEME,
          },
          banking: {
            accountName: "",
            accountNumber: "",
            bank: "",
            branchCode: "",
            branchName: "",
            swiftCode: "",
          },
          billing: {
            ratePerKm: 0,
            baseCallout: 0,
            defaultDepositPct: 50,
            vatPct: 0,
            chargesVat: false,
            vatNumber: "",
            quotePrefix: "Q",
            invoicePrefix: "INV",
            jobPrefix: "J",
            nextQuoteNo: 1001,
            nextInvoiceNo: 1001,
            nextJobNo: 1001,
            currency: "R",
            terms: DEFAULT_BILLING_TERMS,
            primaryUnit: "km",
            customUnits: [],
          },
          catalog: [],
          customers: [],
          docs: [],
          expenses: [],
          expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
          density: "normal" as Density,
          staff: [],
          currentUserId: null,
          currentStaff: null,
          currentWorkspaceOwnerId: null,
        });
      },
    }),
    {
      name: "app-store", // ignored; perUserStorage handles the real key
      storage: createJSONStorage(() => perUserStorage),
      version: 8,
      partialize: (s) => {
        // Never persist per-session identity or staff list to localStorage.
        const { staff: _s, currentUserId: _u, currentStaff: _c, currentWorkspaceOwnerId: _w, ...rest } = s;
        void _s; void _u; void _c; void _w;
        return rest as unknown as State;
      },
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as State;
        if (!s) return s;
        if (version < 3) {
          if (s.company && !s.company.theme) s.company.theme = DEFAULT_THEME;
          if (s.billing && !s.billing.primaryUnit) s.billing.primaryUnit = "km";
          if (s.billing && !s.billing.customUnits) s.billing.customUnits = [];
        }
        if (version < 4) {
          const priorDefaults = new Set(["#2563eb", "#0f172a", "#151c63"]);
          const p = s.company?.theme?.primary?.toLowerCase();
          if (s.company && (!p || priorDefaults.has(p))) {
            s.company.theme = DEFAULT_THEME;
          }
        }
        if (version < 5) {
          if (s.company && !s.company.businessType) s.company.businessType = "other";
          if (s.company && !s.company.enabledModules) s.company.enabledModules = [];
        }
        if (version < 6) {
          if (s.billing && s.billing.terms === undefined) s.billing.terms = DEFAULT_BILLING_TERMS;
        }
        if (version < 7) {
          if (s.onboardingDismissed === undefined) s.onboardingDismissed = false;
        }
        if (version < 8) {
          if (s.billing) {
            if (s.billing.jobPrefix === undefined) s.billing.jobPrefix = "J";
            if (s.billing.nextJobNo === undefined) s.billing.nextJobNo = 1001;
          }
        }
        return s;
      },
    },

  ),
);

export const newId = uid;

export function effectiveVatPct(b: Pick<BillingSettings, "chargesVat" | "vatPct">) {
  return b.chargesVat ? Math.min(b.vatPct || 0, 15) : 0;
}

export function docTotals(d: Doc, vatPct: number) {
  const subtotal = d.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + vat;
  const deposit = total * (d.depositPct / 100);
  const balance = total - (d.depositPaid ? deposit : 0);
  return { subtotal, vat, total, deposit, balance };
}

// VAT portion of a VAT-inclusive amount at the given rate (percent).
// e.g. computeVat(115, 15) === 15
export function computeVat(amountInclusive: number, vatPct: number) {
  if (!amountInclusive || !vatPct || vatPct <= 0) return 0;
  const net = amountInclusive / (1 + vatPct / 100);
  return Math.round((amountInclusive - net) * 100) / 100;
}

export function fmtMoney(n: number, cur = "$") {
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Derive display status for an invoice, applying the overdue rule. */
export function invoiceView(d: Doc, dueDays: number = 30, now: Date = new Date()): InvoiceView {
  if (d.type !== "invoice") return "draft";
  if (d.status === "paid") return "paid";
  if (d.status === "draft") return "draft";
  // sent / accepted / (legacy declined never applies to invoices) → unpaid or overdue
  const created = d.createdAt ? new Date(d.createdAt) : null;
  if (created && dueDays > 0) {
    const ageDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > dueDays) return "overdue";
  }
  return "unpaid";
}

/** Derive display status for a quote. */
export function quoteView(d: Doc): QuoteView {
  if (d.type !== "quote") return "draft";
  if (d.status === "draft") return "draft";
  if (d.status === "accepted") return "accepted";
  if (d.status === "declined") return "declined";
  return "awaiting"; // sent
}

import { can as canRaw, type Action } from "./permissions";

// Reactive: re-renders when currentStaff changes.
export function useCan(action: Action): boolean {
  const cs = useStore((s) => s.currentStaff);
  return canRaw(cs?.role ?? null, cs?.permissions, action);
}
export function useIsOwner(): boolean {
  const cs = useStore((s) => s.currentStaff);
  return !cs || cs.role === "owner";
}

