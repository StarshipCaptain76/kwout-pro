import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  permissions: Permissions;
  active: boolean;
}

export type Unit = string; // built-ins: "each" | "hour" | "km" | "job", plus user-defined
export const BUILTIN_UNITS = ["each", "hour", "km", "job"] as const;
export type PayMethod = "cash" | "eft" | "card";
export type DocType = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "paid" | "cancelled";
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
}

export interface Theme {
  primary: string; // hex like "#2563eb"
  accent: string; // hex like "#0f172a"
}

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
  nextQuoteNo: number;
  nextInvoiceNo: number;
  currency: string;
  primaryUnit?: Unit;
  customUnits?: string[];
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
  setStaffList: (s: StaffMember[]) => void;
  setCurrentUser: (userId: string | null, currentStaff: StaffMember | null) => void;
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
}

const uid = () => Math.random().toString(36).slice(2, 10);

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
        nextQuoteNo: 1001,
        nextInvoiceNo: 1001,
        currency: "R",
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
      setStaffList: (s) => set({ staff: s }),
      setCurrentUser: (userId, currentStaff) => set({ currentUserId: userId, currentStaff }),
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
        const newExp = p.expenses.filter((e) => !existingExp.has(e.id));
        const newDocs = p.docs.filter((d) => !existingDoc.has(d.id));
        const catNames = new Set(s.expenseCategories);
        for (const c of p.newExpenseCategories) catNames.add(c);
        const catalogNames = new Set(s.catalog.map((c) => c.name.toLowerCase()));
        const addedCatalog = p.newCatalogItems.filter(
          (c) => !catalogNames.has(c.name.toLowerCase()),
        );
        set({
          expenses: [...newExp, ...s.expenses],
          docs: [...newDocs, ...s.docs],
          expenseCategories: Array.from(catNames),
          catalog: [...s.catalog, ...addedCatalog],
          billing: {
            ...s.billing,
            nextInvoiceNo: Math.max(s.billing.nextInvoiceNo, p.maxInvoiceNo + 1),
          },
        });
        newExp.forEach(pushExpense);
        newDocs.forEach(pushDoc);
        p.newExpenseCategories.forEach(pushExpenseCategory);
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
    }),
    {
      name: "app-store-v1",
      version: 4,
      partialize: (s) => {
        // Never persist per-session identity or staff list to localStorage.
        const { staff: _s, currentUserId: _u, currentStaff: _c, ...rest } = s;
        void _s; void _u; void _c;
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
          // Reset any previous built-in default theme to the current KWOUT
          // defaults. User-customised themes are left alone.
          const priorDefaults = new Set(["#2563eb", "#0f172a", "#151c63"]);
          const p = s.company?.theme?.primary?.toLowerCase();
          if (s.company && (!p || priorDefaults.has(p))) {
            s.company.theme = DEFAULT_THEME;
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

