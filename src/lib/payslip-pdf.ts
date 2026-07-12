import jsPDF from "jspdf";
import type { DeductionLine } from "./payroll";

export interface PayslipPDFInput {
  companyName: string;
  periodLabel: string;
  staffName: string;
  staffEmail: string;
  idNumber: string;
  gross: number;
  commissionAmount: number;
  hours: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdl: number;
  otherDeductions: number;
  breakdown: DeductionLine[];
  net: number;
  currency: string;
}

function fmt(n: number, cur: string): string {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

export function generatePayslipPDF(input: PayslipPDFInput): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(input.companyName || "Payslip", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y += 20;
  doc.text(`Payslip · ${input.periodLabel}`, 40, y);

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Employee", 40, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  doc.text(input.staffName || "", 40, y);
  if (input.staffEmail) { y += 12; doc.text(input.staffEmail, 40, y); }
  if (input.idNumber) { y += 12; doc.text(`ID: ${input.idNumber}`, 40, y); }

  // Earnings section
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.text("Earnings", 40, y);
  doc.line(40, y + 3, W - 40, y + 3);
  doc.setFont("helvetica", "normal");
  y += 18;

  const basic = input.gross - input.commissionAmount;
  const basicLabel = input.hours > 0 ? `Basic (${input.hours}h)` : "Basic";
  doc.text(basicLabel, 40, y);
  doc.text(fmt(basic, input.currency), W - 40, y, { align: "right" });

  if (input.commissionAmount > 0) {
    y += 14;
    doc.text("Commission", 40, y);
    doc.text(fmt(input.commissionAmount, input.currency), W - 40, y, { align: "right" });
  }

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text("Gross pay", 40, y);
  doc.text(fmt(input.gross, input.currency), W - 40, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Deductions
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.text("Deductions", 40, y);
  doc.line(40, y + 3, W - 40, y + 3);
  doc.setFont("helvetica", "normal");
  y += 18;

  const lines: Array<[string, number]> = [];
  if (input.paye > 0) lines.push(["PAYE", input.paye]);
  if (input.uifEmployee > 0) lines.push(["UIF (employee)", input.uifEmployee]);
  input.breakdown
    .filter((l) => l.label !== "PAYE" && l.label !== "UIF (employee)")
    .forEach((l) => lines.push([l.label, l.amount]));
  if (lines.length === 0) lines.push(["None", 0]);

  lines.forEach(([label, amt]) => {
    doc.text(label, 40, y);
    doc.text(fmt(amt, input.currency), W - 40, y, { align: "right" });
    y += 14;
  });

  const totalDed = input.paye + input.uifEmployee + input.otherDeductions;
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Total deductions", 40, y);
  doc.text(fmt(totalDed, input.currency), W - 40, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Net
  y += 34;
  doc.setFillColor(240, 240, 240);
  doc.rect(30, y - 14, W - 60, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Net pay", 40, y + 4);
  doc.text(fmt(input.net, input.currency), W - 40, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Employer contributions footer
  if (input.uifEmployer > 0 || input.sdl > 0) {
    y += 40;
    doc.setTextColor(120);
    let footer = `Employer contributions — UIF: ${fmt(input.uifEmployer, input.currency)}`;
    if (input.sdl > 0) footer += ` · SDL: ${fmt(input.sdl, input.currency)}`;
    doc.text(footer, 40, y);
    doc.setTextColor(0);
  }

  const filename = `payslip-${input.staffName.replace(/\s+/g, "-").toLowerCase()}-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
