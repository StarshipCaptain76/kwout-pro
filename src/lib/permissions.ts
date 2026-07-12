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
  // Settings — always owner only, kept here for a single source of truth
  | "settings.staff"
  | "settings.company";

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
    "settings.staff": true, "settings.company": true,
  },
  manager: {
    "jobs.viewAll": true, "jobs.create": true, "jobs.edit": true, "jobs.markPaid": true, "jobs.delete": false,
    "expenses.addOwn": true, "expenses.viewAll": true, "expenses.editAny": true,
    "customers.view": true, "customers.add": true, "customers.edit": true,
    "catalog.view": true, "catalog.edit": true,
    "reports.viewOwn": true, "reports.viewAll": true,
    "planner.view": true, "planner.edit": true,
    "settings.staff": false, "settings.company": false,
  },
  staff: {
    "jobs.viewAll": false, "jobs.create": false, "jobs.edit": false, "jobs.markPaid": false, "jobs.delete": false,
    "expenses.addOwn": true, "expenses.viewAll": false, "expenses.editAny": false,
    "customers.view": true, "customers.add": false, "customers.edit": false,
    "catalog.view": true, "catalog.edit": false,
    "reports.viewOwn": true, "reports.viewAll": false,
    "planner.view": true, "planner.edit": false,
    "settings.staff": false, "settings.company": false,
  },
};

export function presetFor(role: Role): Permissions {
  return { ...PRESETS[role] };
}

export function effective(role: Role, overrides?: Permissions | null): Permissions {
  return { ...PRESETS[role], ...(overrides ?? {}) };
}

export function can(role: Role | null | undefined, overrides: Permissions | null | undefined, action: Action): boolean {
  if (!role) return true; // no staff record yet ⇒ treat as owner of own workspace
  return !!effective(role, overrides)[action];
}
