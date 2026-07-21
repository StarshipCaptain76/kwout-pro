import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export type PillTone = "amber" | "blue" | "red" | "green";

const TONE: Record<PillTone, string> = {
  amber: "bg-amber-500 text-white",
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  green: "bg-emerald-600 text-white",
};

export interface StatusRow {
  key: string;
  label: string;
  count: number;
  tone: PillTone;
  /** Search params applied when navigating to /docs. */
  search: Record<string, string>;
}

export function StatusFrame({ title, rows }: { title: string; rows: StatusRow[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          {title}
        </h3>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              to="/docs"
              search={r.search}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm uppercase tracking-wider text-foreground/80">
                {r.label}
              </span>
              <span
                className={`inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-semibold ${TONE[r.tone]}`}
              >
                {r.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
