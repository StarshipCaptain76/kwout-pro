import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ITEM_H = 40;

/**
 * Vertical snap-scroll wheel. Fires onChange when the centered value changes.
 * Optional haptic tick via navigator.vibrate.
 */
export function WheelSelect({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const ticking = useRef(false);

  // Scroll to current value on mount / external change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTop = target;
    }
    last.current = value;
  }, [value, options]);

  const onScroll = () => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      const next = options[clamped]?.value;
      if (next != null && next !== last.current) {
        last.current = next;
        onChange(next);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(8);
          } catch {
            /* ignore */
          }
        }
      }
    });
  };

  return (
    <div className={cn("relative", className)} aria-label={label}>
      {/* Fade masks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 z-10 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 z-10 bg-gradient-to-t from-background to-transparent" />
      {/* Center highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 z-[5] border-y border-primary/30 bg-primary/5 rounded-sm"
        aria-hidden
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-[120px] overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-none"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {/* top spacer so first item can center */}
        <div style={{ height: ITEM_H } } aria-hidden />
        {options.map((o) => (
          <div
            key={o.value}
            className={cn(
              "h-10 flex items-center justify-center snap-center text-lg tabular-nums transition-opacity",
              o.value === value ? "font-semibold opacity-100" : "opacity-40",
            )}
            style={{ scrollSnapAlign: "center" }}
          >
            {o.label}
          </div>
        ))}
        {/* bottom spacer */}
        <div style={{ height: ITEM_H }} aria-hidden />
      </div>
    </div>
  );
}
