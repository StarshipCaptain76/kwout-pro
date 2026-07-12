import { differenceInCalendarDays, parseISO, isBefore, isWithinInterval, endOfDay, startOfDay } from "date-fns";
import { docTotals, type Doc, type BillingSettings } from "./store";

export interface StatementLine {
  date: string;          // ISO
  docNumber: string;
  description: string;
  debit: number;         // invoice total
  credit: number;        // payment (deposit or full)
  balance: number;       // running
}

export interface AgingBuckets {
  current: number;   // 0-29 days
  d30: number;       // 30-59
  d60: number;       // 60-89
  d90: number;       // 90-119
  d120: number;      // 120+
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  openingBalance: number;
  closingBalance: number;
  totalOutstanding: number;
  lines: StatementLine[];
  aging: AgingBuckets;
  statementNumber: string;
}

// Consider a doc "active" (contributes to A/R) if it's an invoice and not cancelled/archived.
function isActiveInvoice(d: Doc): boolean {
  return d.type === "invoice" && !d.archived && d.status !== "cancelled";
}

function docBalance(d: Doc, vatPct: number): { total: number; paidBefore: (asOf: Date) => number } {
  const t = docTotals(d, vatPct);
  return {
    total: t.total,
    paidBefore: (asOf: Date) => {
      // Full payment
      if (d.status === "paid" && d.paidAt) {
        try {
          if (!isBefore(asOf, parseISO(d.paidAt))) return t.total;
        } catch {
          if (d.status === "paid") return t.total;
        }
      }
      // Deposit-only partial payment (attributed at invoice creation)
      if (d.depositPaid && d.status !== "paid") {
        try {
          if (!isBefore(asOf, parseISO(d.createdAt))) return t.deposit;
        } catch {
          return t.deposit;
        }
      }
      return 0;
    },
  };
}

export function buildStatement(
  customerId: string,
  customerFallback: {
    name: string; email?: string; phone?: string; address?: string;
  },
  periodStart: Date,
  periodEnd: Date,
  allDocs: Doc[],
  billing: BillingSettings,
): CustomerStatement {
  const docs = allDocs.filter(
    (d) => d.customer.id === customerId && isActiveInvoice(d),
  );

  const asOf = endOfDay(periodEnd);
  const startBoundary = startOfDay(periodStart);

  // Opening balance = outstanding at start of period.
  let openingBalance = 0;
  for (const d of docs) {
    const created = parseISO(d.createdAt);
    if (isBefore(created, startBoundary)) {
      const { total, paidBefore } = docBalance(d, billing.vatPct);
      openingBalance += total - paidBefore(startBoundary);
    }
  }

  // Lines: activity within the period.
  const lines: StatementLine[] = [];

  // Invoice creation events in period → debit
  for (const d of docs) {
    const created = parseISO(d.createdAt);
    if (isWithinInterval(created, { start: startBoundary, end: asOf })) {
      const { total } = docBalance(d, billing.vatPct);
      lines.push({
        date: d.createdAt,
        docNumber: d.number,
        description: `Invoice`,
        debit: total,
        credit: 0,
        balance: 0,
      });
    }
    // Deposit paid in period → credit (approx: deposit is recorded at doc creation if depositPaid)
    if (d.depositPaid && d.status !== "paid") {
      const created = parseISO(d.createdAt);
      if (isWithinInterval(created, { start: startBoundary, end: asOf })) {
        const t = docTotals(d, billing.vatPct);
        if (t.deposit > 0) {
          lines.push({
            date: d.createdAt,
            docNumber: d.number,
            description: `Deposit received`,
            debit: 0,
            credit: t.deposit,
            balance: 0,
          });
        }
      }
    }
    // Full payment in period → credit
    if (d.status === "paid" && d.paidAt) {
      try {
        const paid = parseISO(d.paidAt);
        if (isWithinInterval(paid, { start: startBoundary, end: asOf })) {
          const t = docTotals(d, billing.vatPct);
          const alreadyDeposit = d.depositPaid ? t.deposit : 0;
          const credit = t.total - alreadyDeposit;
          if (credit > 0) {
            lines.push({
              date: d.paidAt,
              docNumber: d.number,
              description: `Payment received`,
              debit: 0,
              credit,
              balance: 0,
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date));

  // Running balance
  let running = openingBalance;
  for (const l of lines) {
    running += l.debit - l.credit;
    l.balance = running;
  }
  const closingBalance = running;

  // Aging (as of `asOf`), based on invoice createdAt for unpaid outstanding portion.
  const aging: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 };
  let totalOutstanding = 0;
  for (const d of docs) {
    const { total, paidBefore } = docBalance(d, billing.vatPct);
    const outstanding = Math.max(0, total - paidBefore(asOf));
    if (outstanding <= 0.005) continue;
    totalOutstanding += outstanding;
    const age = differenceInCalendarDays(asOf, parseISO(d.createdAt));
    if (age < 30) aging.current += outstanding;
    else if (age < 60) aging.d30 += outstanding;
    else if (age < 90) aging.d60 += outstanding;
    else if (age < 120) aging.d90 += outstanding;
    else aging.d120 += outstanding;
  }

  // Statement number: STMT-YYYYMM-<shortId>
  const yyyymm = `${periodEnd.getFullYear()}${String(periodEnd.getMonth() + 1).padStart(2, "0")}`;
  const short = customerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const statementNumber = `STMT-${yyyymm}-${short || "CUST"}`;

  // Pull latest customer contact from any of their docs if available.
  const latest = docs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const c = latest?.customer;

  return {
    customerId,
    customerName: c?.name || customerFallback.name,
    customerEmail: c?.email || customerFallback.email,
    customerPhone: c?.phone || customerFallback.phone,
    customerAddress: c?.address || customerFallback.address,
    periodStart: startBoundary,
    periodEnd: asOf,
    asOf,
    openingBalance,
    closingBalance,
    totalOutstanding,
    lines,
    aging,
    statementNumber,
  };
}
