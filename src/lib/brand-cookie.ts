// Small brand cache in a cookie so first paint (before Zustand hydration
// and before the cloud fetch of company_profile) already shows the
// customer's name, logo and colours instead of the built-in defaults.
//
// Also written into an inline pre-hydration script in the root head so
// the CSS variables are applied before React mounts.

const COOKIE = "otm_brand";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface BrandCache {
  n?: string;      // company name
  l?: string;      // logo URL or data URL (only if small — see writeBrandCookie)
  p?: string;      // primary rgb "r g b" ready for CSS vars
  pf?: string;     // primary foreground
  a?: string;      // accent / secondary rgb "r g b"
  af?: string;     // accent foreground
}

// --- colour helpers (mirror ThemeInjector) ---
function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function fgFor(hex: string) {
  return luminance(hex) > 0.55 ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";
}
function toRgb(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b})`;
}

export function buildBrandCache(input: {
  name?: string;
  logo?: string;
  primary?: string;
  accent?: string;
}): BrandCache {
  const b: BrandCache = {};
  if (input.name) b.n = input.name;
  // Only inline logos that fit comfortably in a cookie — otherwise skip
  // the logo (name + colours still get us branded first paint).
  if (input.logo && input.logo.length < 1500) b.l = input.logo;
  if (input.primary) {
    b.p = toRgb(input.primary);
    b.pf = fgFor(input.primary);
  }
  if (input.accent) {
    b.a = toRgb(input.accent);
    b.af = fgFor(input.accent);
  }
  return b;
}

export function readBrandCookie(): BrandCache | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]+)"));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as BrandCache;
  } catch {
    return null;
  }
}

export function writeBrandCookie(b: BrandCache) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(b));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearBrandCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

// Inline script body that runs before React hydrates. Reads the cookie
// and applies brand CSS vars to <html>, so the first painted frame uses
// the customer's colours instead of the default blue/slate.
export const BRAND_BOOTSTRAP_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )otm_brand=([^;]+)/);if(!m)return;
var b=JSON.parse(decodeURIComponent(m[1]));var s=document.documentElement.style;
if(b.p){s.setProperty('--primary',b.p);s.setProperty('--accent',b.p);s.setProperty('--ring',b.p);}
if(b.pf){s.setProperty('--primary-foreground',b.pf);s.setProperty('--accent-foreground',b.pf);}
if(b.a){s.setProperty('--secondary',b.a);}
if(b.af){s.setProperty('--secondary-foreground',b.af);}
}catch(e){}})();`;
