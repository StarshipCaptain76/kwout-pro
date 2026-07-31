import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/app/AddressAutocomplete";
import { newId, fmtMoney, type RouteStop } from "@/lib/store";
import { Plus, Trash2, ChevronUp, ChevronDown, Route as RouteIcon, Recycle } from "lucide-react";

interface Props {
  fromAddress?: string;
  fromCoords?: { lat: number; lng: number };
  toAddress?: string;
  toCoords?: { lat: number; lng: number };
  stops?: RouteStop[];
  distanceKm?: number;
  /** Per-km rate from billing settings — used only for on-screen trip estimate. */
  ratePerKm?: number;
  currency?: string;
  calcing: boolean;
  disposalSite?: { address: string; coords?: { lat: number; lng: number } | null };
  showDisposal: boolean;
  onFrom: (v: { address: string; coords?: { lat: number; lng: number } }) => void;
  onTo: (v: { address: string; coords?: { lat: number; lng: number } }) => void;
  onStops: (stops: RouteStop[] | undefined) => void;
  onCalc: () => void;
}

export function RouteStopsEditor({
  fromAddress,
  toAddress,
  toCoords,
  stops = [],
  distanceKm,
  ratePerKm = 0,
  currency = "R",
  calcing,
  disposalSite,
  showDisposal,
  onFrom,
  onTo,
  onStops,
  onCalc,
}: Props) {
  const setStops = (next: RouteStop[]) => onStops(next.length ? next : undefined);
  const fromEmpty = !(fromAddress ?? "").trim();

  /** Reorder among stops, or promote first stop → From when From is empty. */
  const move = (i: number, dir: -1 | 1) => {
    if (dir === -1 && i === 0 && fromEmpty) {
      const stop = stops[0];
      if (!stop) return;
      onFrom({ address: stop.address, coords: stop.coords });
      setStops(stops.slice(1));
      return;
    }
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    setStops(next);
  };

  /** Promote To → From when From is empty. */
  const promoteToToFrom = () => {
    if (!fromEmpty || !(toAddress ?? "").trim()) return;
    onFrom({ address: toAddress!, coords: toCoords });
    onTo({ address: "", coords: undefined });
  };

  const tripEstimate =
    distanceKm && ratePerKm > 0
      ? Math.round(distanceKm * ratePerKm * 100) / 100
      : null;

  return (
    <div className="col-span-2 space-y-3">
      <div>
        <Label>From address</Label>
        <AddressAutocomplete
          value={fromAddress ?? ""}
          placeholder="Search address…"
          onChange={onFrom}
        />
        {fromEmpty && (stops.length > 0 || (toAddress ?? "").trim()) && (
          <p className="text-[11px] text-muted-foreground mt-1">
            From is empty — use ↑ on Stop 1 or To to promote an address here.
          </p>
        )}
      </div>

      {stops.map((stop, i) => (
        <div key={stop.id} className="rounded-md border p-2 space-y-1.5 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Stop {i + 1}</Label>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={i === 0 && !fromEmpty}
                aria-label={i === 0 && fromEmpty ? "Promote stop to From" : "Move stop up"}
                title={i === 0 && fromEmpty ? "Promote to From" : "Move up"}
                onClick={() => move(i, -1)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={i >= stops.length - 1}
                aria-label="Move stop down"
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                aria-label="Remove stop"
                onClick={() => setStops(stops.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <AddressAutocomplete
            value={stop.address}
            placeholder="Search stop address…"
            onChange={(v) => {
              setStops(
                stops.map((s, idx) =>
                  idx === i ? { ...s, address: v.address, coords: v.coords } : s,
                ),
              );
            }}
          />
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setStops([...stops, { id: newId(), address: "" }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Add stop
      </Button>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <Label>To address</Label>
          {fromEmpty && (toAddress ?? "").trim() ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Promote To to From"
              title="Promote to From"
              onClick={promoteToToFrom}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <AddressAutocomplete
          value={toAddress ?? ""}
          placeholder="Search address…"
          onChange={onTo}
          extraButton={
            showDisposal && disposalSite?.address ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() =>
                  onTo({
                    address: disposalSite.address,
                    coords: disposalSite.coords ?? undefined,
                  })
                }
              >
                <Recycle className="h-4 w-4 mr-1" /> Disposal
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button type="button" size="sm" variant="secondary" onClick={onCalc} disabled={calcing}>
          <RouteIcon className="h-4 w-4 mr-1" /> {calcing ? "Calculating…" : "Calculate distance"}
        </Button>
        {distanceKm ? (
          <span className="text-muted-foreground">
            {distanceKm} km
            {tripEstimate != null ? (
              <>
                {" · ≈ "}{fmtMoney(tripEstimate, currency)}
                {" at "}{fmtMoney(ratePerKm, currency)}/km
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
