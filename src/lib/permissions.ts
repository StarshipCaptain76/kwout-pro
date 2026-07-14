// Role presets + per-user override tick-boxes.
// A permission of `undefined` in the overrides means "use preset".

export type Role = "owner" | "manager" | "staff";

export type Action =
  // Jobs
  | "jobs.viewAll"
  | "jobs.create"
  | "jobs.edit"
  | "jobs.markPaid"
  | "jobs.delete"
  // Expenses
  | "expenses.addOwn"
  | "expenses.viewAll"
  | "expenses.editAny"
  // Customers
  | "customers.view"
  | "customers.add"
  | "customers.edit"
  // Catalog
  | "catalog.view"
  | "catalog.edit"
  // Reports
  | "reports.viewOwn"
  | "reports.viewAll"
  // Planner
  | "planner.view"
  | "planner.edit"
  // Payslips (owner-only feature)
  | "payslips.view"
  | "payslips.manage"
  // Settings — sub-sections. Owners always have all; managers/staff off by default.
  // Owner can tick individual sections to grant.
  | "settings.view"          // any settings access at all (derived, but kept as a preset)
  | "settings.company"
  | "settings.banking"
  | "settings.billing"
  | "settings.appearance"
  | "settings.catalog"
  | "settings.expenses"
  | "settings.staff"         // owner only
  | "settings.subscription"; // owner only



export type Permissions = Partial<Record<Action, boolean>>;

export const ACTION_GROUPS: Array<{
  title: string;
  actions: Array<{ key: Action; label: string }>;
}> = [
  {
    title: "Jobs",
    actions: [
      { key: "jobs.viewAll", label: "View all jobs (not just assigned)" },
      { key: "jobs.create", label: "Create quotes/invoices" },
      { key: "jobs.edit", label: "Edit jobs" },
      { key: "jobs.markPaid", label: "Mark paid / change status" },
      { key: "jobs.delete", label: "Delete jobs" },
    ],
  },
  {
    title: "Expenses",
    actions: [
      { key: "expenses.addOwn", label: "Log expenses" },
      { key: "expenses.viewAll", label: "View all expenses" },
      { key: "expenses.editAny", label: "Edit anyone's expense" },
    ],
  },
  {
    title: "Customers",
    actions: [
      { key: "customers.view", label: "View customer list" },
      { key: "customers.add", label: "Add customers" },
      { key: "customers.edit", label: "Edit customers" },
    ],
  },
  {
    title: "Catalog",
    actions: [
      { key: "catalog.view", label: "View services / catalog" },
      { key: "catalog.edit", label: "Edit services / catalog" },
    ],
  },
  {
    title: "Reports",
    actions: [
      { key: "reports.viewOwn", label: "View own numbers" },
      { key: "reports.viewAll", label: "View all staff numbers" },
    ],
  },
  {
    title: "Planner",
    actions: [
      { key: "planner.view", label: "View planner" },
      { key: "planner.edit", label: "Edit schedule" },
    ],
  },
  {
    title: "Settings sections",
    actions: [
      { key: "settings.company", label: "Company profile" },
      { key: "settings.banking", label: "Banking details" },
      { key: "settings.billing", label: "Billing / VAT / numbering" },
      { key: "settings.appearance", label: "Appearance / theme" },
      { key: "settings.catalog", label: "Catalog editor" },
      { key: "settings.expenses", label: "Expense categories" },
    ],
  },
];


// Preset defaults per role.
const PRESETS: Record<Role, Permissions> = {
  owner: {
    "jobs.viewAll": true, "jobs.create": true, "jobs.edit": true, "jobs.markPaid": true, "jobs.delete": true,
    "expenses.addOwn": true, "expenses.viewAll": true, "expenses.editAny": true,
    "customers.view": true, "customers.add": true, "customers.edit": true,
    "catalog.view": true, "catalog.edit": true,
    "reports.viewOwn": true, "reports.viewAll": true,
    "planner.view": true, "planner.edit": true,
    "payslips.view": true, "payslips.manage": true,
    "settings.view": true,
    "settings.staff": true, "settings.subscription": true,
    "settings.company": true, "settings.banking": true, "settings.billing": true,
    "settings.appearance": true, "settings.catalog": true, "settings.expenses": true,
  },
  manager: {
    "jobs.viewAll": true, "jobs.create": true, "jobs.edit": true, "jobs.markPaid": true, "jobs.delete": false,
    "expenses.addOwn": true, "expenses.viewAll": true, "expenses.editAny": true,
    "customers.view": true, "customers.add": true, "customers.edit": true,
    "catalog.view": true, "catalog.edit": true,
    "reports.viewOwn": true, "reports.viewAll": true,
    "planner.view": true, "planner.edit": true,
    "payslips.view": false, "payslips.manage": false,
    "settings.view": false,
    "settings.staff": false, "settings.subscription": false,
    "settings.company": false, "settings.banking": false, "settings.billing": false,
    "settings.appearance": false, "settings.catalog": false, "settings.expenses": false,
  },
  staff: {
    "jobs.viewAll": false, "jobs.create": false, "jobs.edit": false, "jobs.markPaid": false, "jobs.delete": false,
    "expenses.addOwn": true, "expenses.viewAll": false, "expenses.editAny": false,
    "customers.view": true, "customers.add": false, "customers.edit": false,
    "catalog.view": true, "catalog.edit": false,
    "reports.viewOwn": true, "reports.viewAll": false,
    "planner.view": true, "planner.edit": false,
    "payslips.view": false, "payslips.manage": false,
    "settings.view": false,
    "settings.staff": false, "settings.subscription": false,
    "settings.company": false, "settings.banking": false, "settings.billing": false,
    "settings.appearance": false, "settings.catalog": false, "settings.expenses": false,
  },
};

// Derived: does the effective permission set grant *any* settings sub-section?
const SETTINGS_SUBS: Action[] = [
  "settings.company", "settings.banking", "settings.billing",
  "settings.appearance", "settings.catalog", "settings.expenses",
  "settings.staff", "settings.subscription",
];
function anySettingsGranted(effective: Permissions): boolean {
  return SETTINGS_SUBS.some((k) => !!effective[k]);
}


export function presetFor(role: Role): Permissions {
  return { ...PRESETS[role] };
}

export function effective(role: Role, overrides?: Permissions | null): Permissions {
  return { ...PRESETS[role], ...(overrides ?? {}) };
}

export function can(role: Role | null | undefined, overrides: Permissions | null | undefined, action: Action): boolean {
  if (!role) return true; // no staff record yet ⇒ treat as owner of own workspace
  const eff = effective(role, overrides);
  // settings.view is derived from any sub-section being granted (or the role being owner).
  if (action === "settings.view") return role === "owner" || anySettingsGranted(eff);
  return !!eff[action];
}

