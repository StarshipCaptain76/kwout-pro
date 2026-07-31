import { useEffect, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import type { Doc } from "@/lib/store";

// 7 distinct, high-contrast colors for the 7-day window (today = index 0).
const DAY_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#f59e0b", // amber
  "#dc2626", // red
  "#7c3aed", // purple
  "#0891b2", // cyan
  "#db2777", // pink
];

const GOOGLE_CB = "__kwoutAgendaMapInit";
let scriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const g = (window as unknown as { google?: { maps?: unknown } }).google;
  if (g?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps browser key not configured"));
  const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  scriptPromise = new Promise<void>((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[GOOGLE_CB] = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: GOOGLE_CB,
    });
    if (tracking) params.set("channel", tracking);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type PinKind = "pickup" | "dropoff" | "stop";

function pinIcon(color: string, label: string, kind: PinKind) {
  // SVG data-URL marker. Pickup = filled; drop-off = hollow ring; stop = smaller.
  const w = kind === "stop" ? 56 : 88;
  const h = kind === "stop" ? 36 : 44;
  const fill = kind === "pickup" ? color : kind === "stop" ? color : "#ffffff";
  const stroke = color;
  const textColor = kind === "dropoff" ? color : "#ffffff";
  const fontSize = kind === "stop" ? 11 : 13;
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
      <rect x='1' y='1' width='${w - 2}' height='${h - 12}' rx='14' ry='14'
        fill='${fill}' stroke='${stroke}' stroke-width='2'/>
      <polygon points='${w / 2 - 6},${h - 12} ${w / 2 + 6},${h - 12} ${w / 2},${h - 2}'
        fill='${fill}' stroke='${stroke}' stroke-width='2'/>
      <text x='${w / 2}' y='${kind === "stop" ? 16 : 20}' font-family='Inter,Arial,sans-serif' font-size='${fontSize}' font-weight='700'
        text-anchor='middle' fill='${textColor}'>${label}</text>
    </svg>`.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: w, height: h },
    anchor: { x: w / 2, y: h },
  };
}

export function AgendaMap({ jobs, days }: { jobs: Doc[]; days: Date[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<Array<{ setMap: (m: unknown) => void }>>([]);
  const mapInstRef = useRef<unknown>(null);

  const dayColor = useMemo(() => {
    const m = new Map<string, string>();
    days.forEach((d, i) => m.set(format(d, "yyyy-MM-dd"), DAY_COLORS[i % DAY_COLORS.length]));
    return m;
  }, [days]);

  const jobsWithCoords = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.scheduledDate &&
          (j.fromCoords || j.toCoords || (j.stops ?? []).some((s) => s.coords)),
      ),
    [jobs],
  );

  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current) return;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const g = (window as unknown as { google: any }).google;
        if (!mapInstRef.current) {
          mapInstRef.current = new g.maps.Map(mapRef.current, {
            center: { lat: -33.9249, lng: 18.4241 },
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }
        const map = mapInstRef.current as any;

        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];

        const bounds = new g.maps.LatLngBounds();
        const info = new g.maps.InfoWindow();
        overlaysRef.current.push(info as any);

        jobsWithCoords.forEach((j) => {
          const iso = j.scheduledDate!;
          const color = dayColor.get(iso) ?? "#64748b";
          const dLabel = format(parseISO(iso), "EEE d");
          const path: Array<{ lat: number; lng: number }> = [];

          if (j.fromCoords) {
            const pos = { lat: j.fromCoords.lat, lng: j.fromCoords.lng };
            path.push(pos);
            const marker = new g.maps.Marker({
              position: pos,
              map,
              icon: pinIcon(color, dLabel, "pickup"),
              title: `${j.customer.name} — pickup ${dLabel}`,
            });
            marker.addListener("click", () => {
              info.setContent(
                `<div style="font-family:Inter,sans-serif;font-size:13px;max-width:220px">
                  <div style="font-weight:600;margin-bottom:2px">${escapeHtml(j.customer.name)}</div>
                  <div style="color:#64748b;margin-bottom:4px">${escapeHtml(j.number)} · ${escapeHtml(dLabel)}</div>
                  <div style="margin-bottom:6px">${escapeHtml(j.fromAddress ?? "")}</div>
                  <a href="/doc/${encodeURIComponent(j.id)}" style="color:${color};font-weight:600">Open →</a>
                </div>`,
              );
              info.open({ anchor: marker, map });
            });
            overlaysRef.current.push(marker as any);
            bounds.extend(pos);
          }

          (j.stops ?? []).forEach((stop, si) => {
            if (!stop.coords) return;
            const pos = { lat: stop.coords.lat, lng: stop.coords.lng };
            path.push(pos);
            const marker = new g.maps.Marker({
              position: pos,
              map,
              icon: pinIcon(color, `S${si + 1}`, "stop"),
              title: `${j.customer.name} — stop ${si + 1} ${dLabel}`,
            });
            marker.addListener("click", () => {
              info.setContent(
                `<div style="font-family:Inter,sans-serif;font-size:13px;max-width:220px">
                  <div style="font-weight:600;margin-bottom:2px">${escapeHtml(j.customer.name)}</div>
                  <div style="color:#64748b;margin-bottom:4px">${escapeHtml(j.number)} · Stop ${si + 1} · ${escapeHtml(dLabel)}</div>
                  <div style="margin-bottom:6px">${escapeHtml(stop.address ?? "")}</div>
                  <a href="/doc/${encodeURIComponent(j.id)}" style="color:${color};font-weight:600">Open →</a>
                </div>`,
              );
              info.open({ anchor: marker, map });
            });
            overlaysRef.current.push(marker as any);
            bounds.extend(pos);
          });

          if (j.toCoords) {
            const pos = { lat: j.toCoords.lat, lng: j.toCoords.lng };
            path.push(pos);
            const marker = new g.maps.Marker({
              position: pos,
              map,
              icon: pinIcon(color, dLabel, "dropoff"),
              title: `${j.customer.name} — drop-off ${dLabel}`,
            });
            marker.addListener("click", () => {
              info.setContent(
                `<div style="font-family:Inter,sans-serif;font-size:13px;max-width:220px">
                  <div style="font-weight:600;margin-bottom:2px">${escapeHtml(j.customer.name)}</div>
                  <div style="color:#64748b;margin-bottom:4px">${escapeHtml(j.number)} · Drop-off · ${escapeHtml(dLabel)}</div>
                  <div style="margin-bottom:6px">${escapeHtml(j.toAddress ?? "")}</div>
                  <a href="/doc/${encodeURIComponent(j.id)}" style="color:${color};font-weight:600">Open →</a>
                </div>`,
              );
              info.open({ anchor: marker, map });
            });
            overlaysRef.current.push(marker as any);
            bounds.extend(pos);
          }

          if (path.length >= 2) {
            const line = new g.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.85,
              strokeWeight: 3,
              icons: [
                {
                  icon: { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: color },
                  offset: "100%",
                },
              ],
              map,
            });
            overlaysRef.current.push(line as any);
          }
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 60);
          const listener = g.maps.event.addListenerOnce(map, "idle", () => {
            if (map.getZoom() > 14) map.setZoom(14);
          });
          overlaysRef.current.push({ setMap: () => g.maps.event.removeListener(listener) } as any);
        }
      })
      .catch((err) => {
        console.error("[AgendaMap]", err);
      });
    return () => {
      cancelled = true;
    };
  }, [jobsWithCoords, dayColor]);

  return (
    <div className="mb-4">
      <div
        ref={mapRef}
        className="w-full h-[320px] rounded-lg border overflow-hidden bg-muted"
        aria-label="Map of scheduled jobs for the next 7 days"
      />
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {days.map((d, i) => {
          const iso = format(d, "yyyy-MM-dd");
          const count = jobsWithCoords.filter((j) => j.scheduledDate === iso).length;
          const color = DAY_COLORS[i % DAY_COLORS.length];
          return (
            <div
              key={iso}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-background"
            >
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="font-medium">{format(d, "EEE d")}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          );
        })}
      </div>
      {jobsWithCoords.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No scheduled jobs with mapped addresses in the next 7 days. Add pickup/drop-off coordinates on a job to see it here.
        </p>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
