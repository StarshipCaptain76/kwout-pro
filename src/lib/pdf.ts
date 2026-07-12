import jsPDF from "jspdf";
import type { Doc, Company, Banking, BillingSettings } from "./store";
import { docTotals, fmtMoney, DEFAULT_THEME } from "./store";

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "#000000").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function dataUrlToBase64Png(dataUrl: string): Promise<{ data: string; format: string } | null> {
  if (!dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp)/i);
  if (!match) return null; // svg not supported by jsPDF addImage
  return { data: dataUrl, format: match[1].toUpperCase() === "JPG" ? "JPEG" : match[1].toUpperCase() };
}

export async function generatePdf(
  doc: Doc,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  const theme = company.theme ?? DEFAULT_THEME;
  const PRIMARY: [number, number, number] = hexToRgb(theme.primary);

  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, W, 4, "F");

  if (company.logo) {
    try {
      const img = await dataUrlToBase64Png(company.logo);
      if (img) pdf.addImage(img.data, img.format, M, 8, 30, 26);
    } catch {
      // skip
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(20, 20, 20);
  pdf.text(doc.type === "quote" ? "QUOTE" : "TAX INVOICE", W - M, 20, { align: "right" });
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`No: ${doc.number}`, W - M, 27, { align: "right" });
  pdf.text(`Date: ${new Date(doc.createdAt).toLocaleDateString()}`, W - M, 32, { align: "right" });

  let y = 42;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(company.name || "", M, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const cLines = [company.tagline, company.address, company.phone, company.email].filter(Boolean) as string[];
  cLines.forEach((l, i) => pdf.text(l, M, y + 5 + i * 4));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("BILL TO", W / 2, y);
  pdf.setFont("helvetica", "normal");
  const custLines = [doc.customer.name, doc.customer.phone, doc.customer.email, doc.customer.address].filter(Boolean) as string[];
  custLines.forEach((l, i) => pdf.text(l, W / 2, y + 5 + i * 4));

  y = 78;
  pdf.setFillColor(20, 20, 20);
  pdf.rect(M, y, W - 2 * M, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DESCRIPTION", M + 2, y + 5.5);
  pdf.text("QTY", W - M - 55, y + 5.5, { align: "right" });
  pdf.text("PRICE", W - M - 30, y + 5.5, { align: "right" });
  pdf.text("TOTAL", W - M - 2, y + 5.5, { align: "right" });
  y += 8;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "normal");

  for (const item of doc.items) {
    const lineTotal = item.qty * item.price;
    const descLines = pdf.splitTextToSize(item.description, W - 2 * M - 65);
    const rowH = Math.max(6, descLines.length * 4 + 2);
    pdf.text(descLines, M + 2, y + 4);
    pdf.text(`${item.qty} ${item.unit}`, W - M - 55, y + 4, { align: "right" });
    pdf.text(fmtMoney(item.price, billing.currency), W - M - 30, y + 4, { align: "right" });
    pdf.text(fmtMoney(lineTotal, billing.currency), W - M - 2, y + 4, { align: "right" });
    y += rowH;
    pdf.setDrawColor(230, 230, 230);
    pdf.line(M, y, W - M, y);
  }

  const t = docTotals(doc, billing.vatPct);
  y += 4;
  const rx = W - M - 60;
  const drawTot = (label: string, val: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, rx, y);
    pdf.text(val, W - M - 2, y, { align: "right" });
    y += 5;
  };
  drawTot("Subtotal", fmtMoney(t.subtotal, billing.currency));
  if (billing.vatPct > 0) drawTot(`VAT (${billing.vatPct}%)`, fmtMoney(t.vat, billing.currency));
  pdf.setFillColor(...PRIMARY);
  pdf.rect(rx - 2, y - 3.5, W - M - rx + 4, 7, "F");
  pdf.setTextColor(255, 255, 255);
  drawTot("TOTAL", fmtMoney(t.total, billing.currency), true);
  pdf.setTextColor(20, 20, 20);
  y += 2;
  drawTot(`Deposit (${doc.depositPct}%)`, fmtMoney(t.deposit, billing.currency));
  drawTot("Balance Due", fmtMoney(t.balance, billing.currency), true);

  if (doc.type === "quote") {
    const validUntil = new Date(doc.createdAt);
    validUntil.setDate(validUntil.getDate() + 7);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(
      `This quote is valid for 7 days from the date of issue (valid until ${validUntil.toLocaleDateString()}).`,
      M,
      y + 4,
    );
    pdf.setTextColor(20, 20, 20);
    y += 6;
  }

  y = Math.max(y + 10, 235);
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

  if (doc.notes) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.text(doc.notes, M, y + 46);
  }

  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 293, W, 4, "F");

  // Elegant, unobtrusive watermark
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(160, 160, 160);
  pdf.text("powered by KWOUT.CO.ZA", W / 2, 290, { align: "center" });
  pdf.setTextColor(20, 20, 20);

  return pdf;
}

export async function downloadPdf(doc: Doc, company: Company, banking: Banking, billing: BillingSettings) {
  const pdf = await generatePdf(doc, company, banking, billing);
  pdf.save(`${doc.number}-${doc.customer.name || "customer"}.pdf`);
}

export async function pdfBlobUrl(doc: Doc, company: Company, banking: Banking, billing: BillingSettings) {
  const pdf = await generatePdf(doc, company, banking, billing);
  const blob = pdf.output("blob");
  return URL.createObjectURL(blob);
}

export async function pdfFile(doc: Doc, company: Company, banking: Banking, billing: BillingSettings): Promise<File> {
  const pdf = await generatePdf(doc, company, banking, billing);
  const blob = pdf.output("blob");
  const name = `${doc.number}-${doc.customer.name || "customer"}.pdf`;
  return new File([blob], name, { type: "application/pdf" });
}
