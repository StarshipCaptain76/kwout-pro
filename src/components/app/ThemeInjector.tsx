import { useEffect } from "react";
import { useStore, DEFAULT_THEME } from "@/lib/store";

// Convert #rrggbb to "R G B" (space-separated) for CSS var use with alpha, plus rgb string.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function foregroundFor(hex: string): string {
  return luminance(hex) > 0.55 ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";
}

function toOklchLike(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b})`;
}

export function ThemeInjector() {
  const theme = useStore((s) => s.company.theme) ?? DEFAULT_THEME;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const primary = theme.primary || DEFAULT_THEME.primary;
    const accent = theme.accent || DEFAULT_THEME.accent;

    root.style.setProperty("--primary", toOklchLike(primary));
    root.style.setProperty("--primary-foreground", foregroundFor(primary));
    root.style.setProperty("--secondary", toOklchLike(accent));
    root.style.setProperty("--secondary-foreground", foregroundFor(accent));
    root.style.setProperty("--accent", toOklchLike(primary));
    root.style.setProperty("--accent-foreground", foregroundFor(primary));
    root.style.setProperty("--ring", toOklchLike(primary));
  }, [theme.primary, theme.accent]);

  return null;
}
