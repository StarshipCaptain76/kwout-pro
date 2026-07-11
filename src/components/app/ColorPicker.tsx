import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  "#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1",
  "#0f172a", "#334155", "#475569", "#78716c", "#1f2937",
];

export function ColorPicker({ label, value, onChange, presets = DEFAULT_PRESETS }: Props) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 rounded border cursor-pointer bg-transparent"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 font-mono uppercase"
          maxLength={7}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={
              "h-7 w-7 rounded border transition-transform hover:scale-110 " +
              (value.toLowerCase() === p.toLowerCase() ? "ring-2 ring-offset-2 ring-primary" : "")
            }
            style={{ backgroundColor: p }}
            aria-label={`Preset ${p}`}
            title={p}
          />
        ))}
      </div>
    </div>
  );
}
