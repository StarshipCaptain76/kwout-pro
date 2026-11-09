export type PdfShareResult = "shared" | "cancelled" | "fallback";

/** Must be called directly from the click with an already-generated file. */
export async function sharePdf(file: File, title: string, text: string): Promise<PdfShareResult> {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return "fallback";
  try {
    if (!navigator.canShare({ files: [file] })) return "fallback";
    await navigator.share({ files: [file], title, text });
    return "shared";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    return "fallback";
  }
}

export function downloadPdfFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openEmailDraft(to: string, subject: string, message: string) {
  window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}