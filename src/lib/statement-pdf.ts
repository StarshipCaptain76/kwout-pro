import jsPDF from "jspdf";
import { format } from "date-fns";
import type { Company, Banking, BillingSettings } from "./store";
import { fmtMoney, DEFAULT_THEME } from "./store";
import type { CustomerStatement } from "./statements";

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "#000000").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function loadImage(dataUrl: string): Promise<{ data: string; format: string } | null> {
  if (!dataUrl.startsWith("data:")) return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp)/i);
  if (!m) return null;
  return { data: dataUrl, format: m[1].toUpperCase() === "JPG" ? "JPEG" : m[1].toUpperCase() };
}

export async function generateStatementPdf(
  s: CustomerStatement,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 15;
  const theme = company.theme ?? DEFAULT_THEME;
  const PRIMARY = hexToRgb(theme.primary);

  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, W, 4, "F");

  if (company.logo) {
    try {
      const img = await loadImage(company.logo);
      if (img) pdf.addImage(img.data, img.format, M, 8, 30, 26);
    } catch { /* skip */ }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(20, 20, 20);
  pdf.text("STATEMENT", W - M, 20, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`No: ${s.statementNumber}`, W - M, 27, { align: "right" });
  pdf.text(`Date: ${format(s.asOf, "d MMM yyyy")}`, W - M, 32, { align: "right" });
  pdf.text(
    `Period: ${format(s.periodStart, "d MMM yyyy")} – ${format(s.periodEnd, "d MMM yyyy")}`,
    W - M, 37, { align: "right" },
  );

  let y = 48;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(company.name || "", M, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const cLines = [company.tagline, company.address, company.phone, company.email].filter(Boolean) as string[];
  cLines.forEach((l, i) => pdf.text(l, M, y + 5 + i * 4));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("STATEMENT TO", W / 2, y);
  pdf.setFont("helvetica", "normal");
  const custLines = [
    s.customerName,
    s.customerPhone,
    s.customerEmail,
    s.customerAddress,
  ].filter(Boolean) as string[];
  custLines.forEach((l, i) => pdf.text(l, W / 2, y + 5 + i * 4));

  y = 85;

  // Activity table header
  pdf.setFillColor(20, 20, 20);
  pdf.rect(M, y, W - 2 * M, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DATE", M + 2, y + 5.5);
  pdf.text("REF", M + 28, y + 5.5);
  pdf.text("DESCRIPTION", M + 55, y + 5.5);
  pdf.text("DEBIT", W - M - 60, y + 5.5, { align: "right" });
  pdf.text("CREDIT", W - M - 32, y + 5.5, { align: "right" });
  pdf.text("BALANCE", W - M - 2, y + 5.5, { align: "right" });
  y += 8;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "normal");

  // Opening balance row
  pdf.setFont("helvetica", "bold");
  pdf.text(format(s.periodStart, "dd/MM/yy"), M + 2, y + 5);
  pdf.text("—", M + 28, y + 5);
  pdf.text("Opening balance", M + 55, y + 5);
  pdf.text(fmtMoney(s.openingBalance, billing.currency), W - M - 2, y + 5, { align: "right" });
  pdf.setFont("helvetica", "normal");
  y += 7;
  pdf.setDrawColor(230, 230, 230);
  pdf.line(M, y, W - M, y);

  // Lines
  for (const l of s.lines) {
    if (y > H - 90) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(format(new Date(l.date), "dd/MM/yy"), M + 2, y + 5);
    pdf.text(l.docNumber, M + 28, y + 5);
    pdf.text(l.description, M + 55, y + 5);
    if (l.debit) pdf.text(fmtMoney(l.debit, billing.currency), W - M - 60, y + 5, { align: "right" });
    if (l.credit) pdf.text(fmtMoney(l.credit, billing.currency), W - M - 32, y + 5, { align: "right" });
    pdf.text(fmtMoney(l.balance, billing.currency), W - M - 2, y + 5, { align: "right" });
    y += 7;
    pdf.line(M, y, W - M, y);
  }

  // Closing balance
  y += 2;
  pdf.setFillColor(...PRIMARY);
  pdf.rect(M, y, W - 2 * M, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("CLOSING BALANCE", M + 2, y + 5.5);
  pdf.text(fmtMoney(s.closingBalance, billing.currency), W - M - 2, y + 5.5, { align: "right" });
  y += 12;
  pdf.setTextColor(20, 20, 20);

  // Aging table
  if (y > H - 80) { pdf.addPage(); y = 20; }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("AGING SUMMARY", M, y);
  y += 4;

  const colW = (W - 2 * M) / 6;
  const headers = ["Current", "30 days", "60 days", "90 days", "120+ days", "Total"];
  pdf.setFillColor(240, 240, 240);
  pdf.rect(M, y, W - 2 * M, 8, "F");
  pdf.setFontSize(9);
  headers.forEach((h, i) => {
    pdf.text(h, M + colW * i + colW - 2, y + 5.5, { align: "right" });
  });
  y += 8;
  pdf.setFont("helvetica", "normal");
  const vals = [
    s.aging.current, s.aging.d30, s.aging.d60, s.aging.d90, s.aging.d120,
    s.totalOutstanding,
  ];
  vals.forEach((v, i) => {
    pdf.text(fmtMoney(v, billing.currency), M + colW * i + colW - 2, y + 5.5, { align: "right" });
  });
  y += 8;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(M, y, W - M, y);

  // Banking details
  y = Math.max(y + 10, H - 60);
  pdf.setFillColor(245, 245, 245);
  pdf.rect(M, y, W - 2 * M, 40, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BANKING DETAILS", M + 3, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const b = [
    banking.accountName ? `Account Name: ${banking.accountName}` : "",
    banking.bank ? `Bank: ${banking.bank}` : "",
    banking.accountNumber ? `Account Number: ${banking.accountNumber}` : "",
    banking.branchCode ? `Branch Code: ${banking.branchCode}` : "",
    banking.branchName ? `Branch: ${banking.branchName}` : "",
    banking.swiftCode ? `Swift: ${banking.swiftCode}` : "",
  ].filter(Boolean);
  b.forEach((l, i) => pdf.text(l, M + 3 + (i % 2) * 90, y + 13 + Math.floor(i / 2) * 5));

  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 293, W, 4, "F");

  return pdf;
}

export async function downloadStatementPdf(
  s: CustomerStatement,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
) {
  const pdf = await generateStatementPdf(s, company, banking, billing);
  const safeName = s.customerName.replace(/[^a-zA-Z0-9]+/g, "-") || "customer";
  pdf.save(`${s.statementNumber}-${safeName}.pdf`);
}

export async function statementPdfFile(
  s: CustomerStatement,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
): Promise<File> {
  const pdf = await generateStatementPdf(s, company, banking, billing);
  const blob = pdf.output("blob");
  const safeName = s.customerName.replace(/[^a-zA-Z0-9]+/g, "-") || "customer";
  const name = `${s.statementNumber}-${safeName}.pdf`;
  return new File([blob], name, { type: "application/pdf" });
}
