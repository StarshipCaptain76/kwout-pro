/** Escape spreadsheet cells, including formula triggers hidden behind whitespace. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Keep finite numeric values numeric, including negative accounting amounts.
  const numeric = typeof value === "number" && Number.isFinite(value)
    || /^-?\d+(?:\.\d+)?$/.test(text);
  if (!numeric && /^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text = "'" + text;
  if (/^[\t\r\n]/.test(text)) text = "'" + text;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}