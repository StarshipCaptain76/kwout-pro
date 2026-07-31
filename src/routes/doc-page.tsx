import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";

/** Temporary stub — full DocPage with RouteStopsEditor lands next. */
export function DocPage() {
  const { id } = useParams({ from: "/doc/$id" });
  const nav = useNavigate();
  const doc = useStore((s) => s.docs.find((d) => d.id === id));

  if (!doc) {
    return (
      <Shell>
        <p>Document not found. <Link to="/" className="text-primary underline">Go back</Link></p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => nav({ to: "/" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-display text-4xl tracking-wide">{doc.type.toUpperCase()} {doc.number}</h1>
      </div>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-2">
          Editor temporarily simplified while Phase 7 finishes deploying. Customer: <strong>{doc.customer.name || "—"}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Route stops UI, multi-stop distance, and full editor return in the next push.
        </p>
      </Card>
    </Shell>
  );
}
