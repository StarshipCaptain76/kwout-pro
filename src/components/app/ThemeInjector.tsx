import { useEffect } from "react";
import { useStore, DEFAULT_THEME } from "@/lib/store";
import { buildBrandCache, writeBrandCookie, readBrandCookie } from "@/lib/brand-cookie";

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
function toRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b})`;
}

export function ThemeInjector() {
  const company = useStore((s) => s.company);
  const theme = company.theme ?? DEFAULT_THEME;

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Skip pre-auth routes: they must always show KWOUT default branding,
    // never the persisted tenant theme.
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/auth") || path === "/reset-password") return;
    const root = document.documentElement;
    const primary = theme.primary || DEFAULT_THEME.primary;
    const accent = theme.accent || DEFAULT_THEME.accent;

    const pRgb = toRgb(primary);
    const pFg = foregroundFor(primary);
    const aRgb = toRgb(accent);
    const aFg = foregroundFor(accent);

    // Skip redundant repaint if the pre-hydration script already applied
    // matching values from the cookie.
    if (root.style.getPropertyValue("--primary") !== pRgb) {
      root.style.setProperty("--primary", pRgb);
      root.style.setProperty("--primary-foreground", pFg);
      root.style.setProperty("--accent", pRgb);
      root.style.setProperty("--accent-foreground", pFg);
      root.style.setProperty("--ring", pRgb);
    }
    if (root.style.getPropertyValue("--secondary") !== aRgb) {
      root.style.setProperty("--secondary", aRgb);
      root.style.setProperty("--secondary-foreground", aFg);
    }

    // Update the brand cookie so the next load / device paints branded.
    const cache = buildBrandCache({
      name: company.name,
      logo: company.logo,
      primary,
      accent,
    });
    const prev = readBrandCookie();
    if (
      !prev ||
      prev.n !== cache.n ||
      prev.l !== cache.l ||
      prev.p !== cache.p ||
      prev.a !== cache.a
    ) {
      writeBrandCookie(cache);
    }
  }, [theme.primary, theme.accent, company.name, company.logo]);

  return null;
}
