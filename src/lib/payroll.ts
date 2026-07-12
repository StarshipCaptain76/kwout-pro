// South African PAYE / UIF / SDL calculations (2025/26 tax year).
// All values in ZAR, monthly unless stated otherwise.

export type TaxStatus = "paye" | "provisional" | "exempt";

export interface Bracket {
  upTo: number; // annual income up to (inclusive); Infinity for top bracket
  base: number; // tax on income up to previous bracket top
  rate: number; // marginal rate for income above previous bracket
  above: number; // previous bracket top
}

// SARS 2025/26 individual tax brackets
export const BRACKETS_2025: Bracket[] = [
  { upTo: 237_100, base: 0, rate: 0.18, above: 0 },
  { upTo: 370_500, base: 42_678, rate: 0.26, above: 237_100 },
  { upTo: 512_800, base: 77_362, rate: 0.31, above: 370_500 },
  { upTo: 673_000, base: 121_475, rate: 0.36, above: 512_800 },
  { upTo: 857_900, base: 179_147, rate: 0.39, above: 673_000 },
  { upTo: 1_817_000, base: 251_258, rate: 0.41, above: 857_900 },
  { upTo: Infinity, base: 644_489, rate: 0.45, above: 1_817_000 },
];

// Rebates 2025/26
export const REBATE_PRIMARY = 17_235;
export const REBATE_SECONDARY = 9_444; // age 65+
export const REBATE_TERTIARY = 3_145; // age 75+

// Tax thresholds (below these no PAYE owed)
export const THRESHOLD_UNDER_65 = 95_750;
export const THRESHOLD_65_TO_74 = 148_217;
export const THRESHOLD_75_PLUS = 165_689;

// UIF (Unemployment Insurance Fund) — 1% employee + 1% employer,
// capped on remuneration of R17,712 per month → R177.12 each.
export const UIF_RATE = 0.01;
export const UIF_CEILING_MONTHLY = 17_712;
export const UIF_MAX = UIF_CEILING_MONTHLY * UIF_RATE; // 177.12

// SDL (Skills Development Levy) — 1% of payroll, employer only,
// only applies if annual payroll > R500,000.
export const SDL_RATE = 0.01;

export function annualPAYE(annualGross: number, age = 30): number {
  if (annualGross <= 0) return 0;
  const bracket = BRACKETS_2025.find((b) => annualGross <= b.upTo)!;
  let tax = bracket.base + (annualGross - bracket.above) * bracket.rate;
  tax -= REBATE_PRIMARY;
  if (age >= 65) tax -= REBATE_SECONDARY;
  if (age >= 75) tax -= REBATE_TERTIARY;
  return Math.max(0, tax);
}

/** Monthly PAYE deduction. */
export function calcPAYE(monthlyGross: number, age = 30): number {
  const annual = monthlyGross * 12;
  const threshold =
    age >= 75 ? THRESHOLD_75_PLUS : age >= 65 ? THRESHOLD_65_TO_74 : THRESHOLD_UNDER_65;
  if (annual <= threshold) return 0;
  return round2(annualPAYE(annual, age) / 12);
}

export function calcUIF(monthlyGross: number): { employee: number; employer: number } {
  const capped = Math.min(monthlyGross, UIF_CEILING_MONTHLY);
  const amt = round2(capped * UIF_RATE);
  return { employee: amt, employer: amt };
}

export function calcSDL(monthlyGross: number, sdlApplies: boolean): number {
  if (!sdlApplies) return 0;
  return round2(monthlyGross * SDL_RATE);
}

export interface DeductionLine {
  label: string;
  amount: number;
}

export interface PayrollComputation {
  gross: number;
  commissionAmount: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdl: number;
  otherDeductions: number;
  net: number;
  breakdown: DeductionLine[];
}

export interface PayrollInput {
  monthlyGross: number;
  commissionAmount?: number;
  age?: number;
  taxStatus: TaxStatus;
  sdlApplies: boolean;
  otherDeductions?: DeductionLine[];
}

export function computeDeductions(input: PayrollInput): PayrollComputation {
  const gross = round2(input.monthlyGross);
  const paye = input.taxStatus === "paye" ? calcPAYE(gross, input.age ?? 30) : 0;
  const uif =
    input.taxStatus === "exempt" ? { employee: 0, employer: 0 } : calcUIF(gross);
  const sdl = input.taxStatus === "exempt" ? 0 : calcSDL(gross, input.sdlApplies);
  const other = input.otherDeductions ?? [];
  const otherSum = round2(other.reduce((s, d) => s + (d.amount || 0), 0));

  const breakdown: DeductionLine[] = [];
  if (paye > 0) breakdown.push({ label: "PAYE", amount: paye });
  if (uif.employee > 0) breakdown.push({ label: "UIF (employee)", amount: uif.employee });
  other.forEach((d) => breakdown.push(d));

  const net = round2(gross - paye - uif.employee - otherSum);
  return {
    gross,
    commissionAmount: round2(input.commissionAmount ?? 0),
    paye,
    uifEmployee: uif.employee,
    uifEmployer: uif.employer,
    sdl,
    otherDeductions: otherSum,
    net,
    breakdown,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Age from SA ID number YYMMDD... (assumes 1900 if year > current 2-digit year, else 2000)
export function ageFromSaId(idNumber: string | undefined | null, on = new Date()): number {
  if (!idNumber || idNumber.length < 6) return 30;
  const yy = parseInt(idNumber.slice(0, 2), 10);
  const mm = parseInt(idNumber.slice(2, 4), 10);
  const dd = parseInt(idNumber.slice(4, 6), 10);
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return 30;
  const currentYY = on.getFullYear() % 100;
  const century = yy > currentYY ? 1900 : 2000;
  const dob = new Date(century + yy, mm - 1, dd);
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}
