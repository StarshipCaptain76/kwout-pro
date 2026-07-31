import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WheelSelect } from "./WheelSelect";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i).padStart(2, "0"),
  label: String(i).padStart(2, "0"),
}));

const MINUTES = Array.from({ length: 12 }, (_, i) => {
  const m = i * 5;
  return { value: String(m).padStart(2, "0"), label: String(m).padStart(2, "0") };
});

function nowHhMm(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  // snap minute to nearest 5
  const m = String(Math.round(d.getMinutes() / 5) * 5 % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function parse(v?: string): { h: string; m: string } {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) {
    const n = nowHhMm();
    return { h: n.slice(0, 2), m: n.slice(3, 5) };
  }
  // snap minutes to 5-min grid
  const rawM = Number(v.slice(3, 5));
  const snapped = String(Math.round(rawM / 5) * 5 % 60).padStart(2, "0");
  return { h: v.slice(0, 2), m: snapped };
}

/**
 * Optional start-time picker. Value is "HH:mm" or undefined.
 * Never uses a free-text input — only wheels.
 */
export function TimePicker({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => parse(value), [value]);
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.m);

  useEffect(() => {
    if (open) {
      const p = parse(value);
      setHour(p.h);
      setMinute(p.m);
    }
  }, [open, value]);

  const display = value ?? "—";

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 w-full flex items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted/40 transition-colors"
      >
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn("tabular-nums", !value && "text-muted-foreground")}>
          {value ? display : "Set start time (optional)"}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Start time</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-center text-muted-foreground mb-1 uppercase tracking-wider">Hour</div>
              <WheelSelect options={HOURS} value={hour} onChange={setHour} label="Hour" />
            </div>
            <div>
              <div className="text-xs text-center text-muted-foreground mb-1 uppercase tracking-wider">Minute</div>
              <WheelSelect options={MINUTES} value={minute} onChange={setMinute} label="Minute" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 pb-[env(safe-area-inset-bottom)]">
            <Button
              variant="outline"
              onClick={() => {
                const n = nowHhMm();
                setHour(n.slice(0, 2));
                setMinute(n.slice(3, 5));
              }}
            >
              Now
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                onChange(`${hour}:${minute}`);
                setOpen(false);
              }}
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
