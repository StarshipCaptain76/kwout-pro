const CHECKOUT_ORIGINS = new Set([
  "https://kwout.co.za",
  "https://www.kwout.co.za",
  "https://kwout-pro.lovable.app",
  "https://id-preview--0aab91b2-f339-4b47-bbf6-c950818b9459.lovable.app",
]);

/** Exact application origins only; never trust a caller-supplied destination. */
export function validatePaymentOrigin(input: string, allowLocalDevelopment = false): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Invalid payment return address"); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid payment return address");
  }
  if (CHECKOUT_ORIGINS.has(url.origin)) return url.origin;
  if (allowLocalDevelopment && url.origin === "http://localhost:8080") return url.origin;
  throw new Error("Payment return address is not an approved KWOUT address");
}