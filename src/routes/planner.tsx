import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, useCan, type Doc, type PayMethod } from "@/lib/store";
import {
  addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameMonth,
  isToday, isTomorrow, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { useMemo, useState, useRef, useCallback } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  ChevronLeft, ChevronRight, ChevronDown, GripVertical, Check, X, CalendarDays, ExternalLink,
  Link2, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatePicker } from "@/components/app/DatePicker";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { flushSync } from "@/lib/sync";
import { createContext, useContext } from "react";
import { AgendaMap } from "@/components/app/AgendaMap";

const JobActionsCtx = createContext<((d: Doc) => void) | null>(null);
function usePlannerActions() {
  return useContext(JobActionsCtx) ?? (() => {});
}

export const Route = createFileRoute("/planner")({
  component: PlannerPage,
  head: () => ({
    meta: [
      { title: "Planner — KWOUT" },
      { name: "description", content: "Schedule quotes and jobs by day, week or month. Drag-and-drop planner for entrepreneurs and small teams." },
      { property: "og:title", content: "Planner — KWOUT" },
      { property: "og:description", content: "Drag-and-drop calendar for quotes, jobs and invoices." },
      { property: "og:url", content: "https://kwout.co.za/planner" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/planner" }],
  }),
});





// ---------- job category resolver ----------
type JobCategory =
  | "rubble" | "garden" | "furniture" | "waste" | "sand" | "tree" | "labour" | "other";

const CATEGORY_KEYWORDS: Array<[JobCategory, string[]]> = [
  ["rubble", ["rubble", "brick", "concrete", "tiles"]],
  ["garden", ["garden", "grass", "soil"]],
  ["furniture", ["furniture", "appliances", "boxes"]],
  ["waste", ["waste", "rubbish", "removal", "general"]],
  ["sand", ["sand", "rock"]],
  ["tree", ["tree", "wood"]],
  ["labour", ["labour", "packing"]],
];

function jobCategory(doc: Doc): JobCategory {
  const text = doc.items.map((i) => i.description).join(" ").toLowerCase();
  for (const [key, kws] of CATEGORY_KEYWORDS) {
    if (kws.some((k) => text.includes(k))) return key;
  }
  return "other";
}

// Soft tinted backgrounds — readable in light and dark.
const CATEGORY_STYLES: Record<JobCategory, string> = {
  rubble:    "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-amber-200/70 dark:border-amber-800/60",
  garden:    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border-emerald-200/70 dark:border-emerald-800/60",
  furniture: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 border-indigo-200/70 dark:border-indigo-800/60",
  waste:     "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 border-rose-200/70 dark:border-rose-800/60",
  sand:      "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-900 dark:text-yellow-100 border-yellow-200/70 dark:border-yellow-800/60",
  tree:      "bg-lime-50 dark:bg-lime-950/40 text-lime-900 dark:text-lime-100 border-lime-200/70 dark:border-lime-800/60",
  labour:    "bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-100 border-violet-200/70 dark:border-violet-800/60",
  other:     "bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 border-sky-200/70 dark:border-sky-800/60",
};

function PaymentIndicator({ doc }: { doc: Doc }) {
  if (doc.status === "paid") return <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />;
  return <span className="text-[10px] uppercase font-bold px-1 py-0.5 rounded bg-red-500 text-white leading-none">unpaid</span>;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const paidDate = (doc: Doc) => {
  if (doc.status !== "paid" || !doc.paidAt) return undefined;
  return format(new Date(doc.paidAt), "yyyy-MM-dd");
};
// A doc renders on `iso` if it falls within its [scheduledDate, scheduledEndDate]
// span, or (for closed jobs without a scheduled date) on its paidAt day.
function docOccursOn(doc: Doc, iso: string): boolean {
  const start = doc.scheduledDate;
  if (start) {
    const end = doc.scheduledEndDate && doc.scheduledEndDate >= start ? doc.scheduledEndDate : start;
    return iso >= start && iso <= end;
  }
  return paidDate(doc) === iso;
}
function daySpanFor(doc: Doc, iso: string): { idx: number; n: number } | null {
  const start = doc.scheduledDate;
  const end = doc.scheduledEndDate;
  if (!start || !end || end <= start) return null;
  const n = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  if (n <= 1) return null;
  const idx = differenceInCalendarDays(parseISO(iso), parseISO(start)) + 1;
  return { idx, n };
}

type View = "agenda" | "week" | "month";


function PlannerPage() {
  const canView = useCan("planner.view");
  const canEdit = useCan("planner.edit");
  const { docs, upsertDoc, billing } = useStore();
  const [view, setView] = useState<View>("agenda");
  const [weekStart, setWeekStart] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [agendaStart, setAgendaStart] = useState(() => new Date());
  const [showUnsched, setShowUnsched] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [actionDoc, setActionDoc] = useState<Doc | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const openActions = (d: Doc) => { if (!canEdit) return; setActionDoc(d); setMoveMode(false); };

  if (!canView) {
    return (
      <Shell>
        <h1 className="sr-only">Planner</h1>
        <Card className="p-6 max-w-lg mx-auto text-center">
          <div className="font-display text-2xl mb-2">Access restricted</div>
          <p className="text-sm text-muted-foreground">
            Your role doesn't include Planner access. Ask the workspace owner to enable it in Settings → Staff.
          </p>
        </Card>
      </Shell>
    );
  }


  // Show any non-cancelled, non-archived doc — includes fresh drafts / sent quotes.
  const jobs = useMemo(
    () => docs.filter((d) => !d.archived && d.status !== "cancelled"),
    [docs],
  );
  const byDay = (iso: string) =>
    jobs.filter((d) => docOccursOn(d, iso)).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
  // Unscheduled = still needs a date. Exclude paid (historical) and archived.
  const unscheduled = jobs.filter(
    (d) => !d.scheduledDate && d.status !== "paid" && !d.archived,
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!canEdit) return;
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const doc = jobs.find((d) => d.id === id);
    if (!doc) return;
    if (overId === "unscheduled") {
      upsertDoc({ ...doc, scheduledDate: undefined, scheduledEndDate: undefined });
      return;
    }
    // Preserve multi-day span: shift end date by the same delta as start.
    if (doc.scheduledDate && doc.scheduledEndDate && doc.scheduledEndDate > doc.scheduledDate) {
      const delta = differenceInCalendarDays(parseISO(overId), parseISO(doc.scheduledDate));
      const newEnd = format(addDays(parseISO(doc.scheduledEndDate), delta), "yyyy-MM-dd");
      upsertDoc({ ...doc, scheduledDate: overId, scheduledEndDate: newEnd, dayOrder: byDay(overId).length });
    } else {
      upsertDoc({ ...doc, scheduledDate: overId, dayOrder: byDay(overId).length });
    }
  };

  const archiveAllUnscheduled = () => {
    if (!canEdit || unscheduled.length === 0) return;
    if (!window.confirm(`Archive all ${unscheduled.length} unscheduled job${unscheduled.length === 1 ? "" : "s"}?`)) return;
    unscheduled.forEach((d) => upsertDoc({ ...d, archived: true }));
    toast.success(`Archived ${unscheduled.length} job${unscheduled.length === 1 ? "" : "s"}`);
  };


  // Agenda: next 30 days that have jobs, plus today
  const agendaDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 60; i++) days.push(addDays(agendaStart, i));
    return days.filter((d, i) => i === 0 || byDay(format(d, "yyyy-MM-dd")).length > 0);
  }, [jobs, agendaStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let d = monthGridStart; d <= monthGridEnd; d = addDays(d, 1)) monthDays.push(d);

  const closeActions = () => { setActionDoc(null); setMoveMode(false); };
  const markPaid = (m: PayMethod) => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, status: "paid", archived: false, paymentMethod: m, paidAt: new Date().toISOString(), scheduledDate: actionDoc.scheduledDate ?? todayIso() });
    void flushSync();
    toast.success(`Marked paid (${m.toUpperCase()})`);
    closeActions();
  };
  const cancelJob = () => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, status: "cancelled" });
    toast.success("Job cancelled");
    closeActions();
  };
  const moveTo = (iso: string | undefined) => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, scheduledDate: iso, dayOrder: iso ? byDay(iso).length : undefined });
    toast.success(iso ? `Moved to ${iso}` : "Unscheduled");
    closeActions();
  };

  const swipe = useSwipe({
    onLeft: () => {
      if (view === "agenda") setAgendaStart(addDays(agendaStart, 1));
      else if (view === "week") setWeekStart(addDays(weekStart, 7));
      else setMonthAnchor(addMonths(monthAnchor, 1));
    },
    onRight: () => {
      if (view === "agenda") setAgendaStart(addDays(agendaStart, -1));
      else if (view === "week") setWeekStart(addDays(weekStart, -7));
      else setMonthAnchor(addMonths(monthAnchor, -1));
    },
  });

  return (
    <Shell>
     <JobActionsCtx.Provider value={openActions}>
      <h1 className="sr-only">Planner</h1>
      {/* View switcher */}
      <div className="inline-flex rounded-lg border p-0.5 bg-muted mb-3 w-full sm:w-auto">
        {(["agenda", "week", "month"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors",
              view === v ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Navigation */}
      {view !== "agenda" ? (
        <div className="flex items-center gap-2 mb-3">
          <Button size="icon" variant="outline" aria-label="Previous period" className="h-10 w-10" onClick={() =>
            view === "week" ? setWeekStart(addDays(weekStart, -7)) : setMonthAnchor(addMonths(monthAnchor, -1))
          }><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium text-sm flex-1 text-center">
            {view === "week"
              ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM")}`
              : format(monthAnchor, "MMMM yyyy")}
          </div>
          <Button size="icon" variant="outline" aria-label="Next period" className="h-10 w-10" onClick={() =>
            view === "week" ? setWeekStart(addDays(weekStart, 7)) : setMonthAnchor(addMonths(monthAnchor, 1))
          }><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="secondary" className="h-10" onClick={() =>
            view === "week"
              ? setWeekStart(new Date())
              : setMonthAnchor(startOfMonth(new Date()))
          }>Today</Button>
        </div>
      ) : (
        format(agendaStart, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
          <div className="flex items-center gap-2 mb-3">
            <Button size="icon" variant="outline" aria-label="Previous day" className="h-10 w-10" onClick={() => setAgendaStart(addDays(agendaStart, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-medium text-sm flex-1 text-center">from {format(agendaStart, "d MMM")}</div>
            <Button size="icon" variant="outline" aria-label="Next day" className="h-10 w-10" onClick={() => setAgendaStart(addDays(agendaStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="secondary" className="h-10" onClick={() => setAgendaStart(new Date())}>Today</Button>
          </div>
        )
      )}

      {/* Unscheduled pill */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {unscheduled.length > 0 && (
          <div className="mb-3">
            <div className="w-full flex items-stretch rounded-lg border bg-amber-500/10 border-amber-500/30 overflow-hidden">
              <button
                onClick={() => setShowUnsched((v) => !v)}
                className="flex-1 flex items-center justify-between px-3 py-2 text-sm font-medium"
              >
                <span>{unscheduled.length} unscheduled job{unscheduled.length === 1 ? "" : "s"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showUnsched && "rotate-180")} />
              </button>
              {canEdit && (
                <button
                  onClick={archiveAllUnscheduled}
                  className="px-3 flex items-center gap-1.5 text-xs font-medium border-l border-amber-500/30 hover:bg-amber-500/20"
                  title="Archive all unscheduled jobs"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive all
                </button>
              )}
            </div>
            {showUnsched && (
              <DropZone id="unscheduled" className="mt-2">
                <div className="grid gap-2">
                  {unscheduled.map((d) => <JobCard key={d.id} doc={d} iso={undefined} currency={billing.currency} vat={billing.vatPct} />)}
                </div>
              </DropZone>
            )}
          </div>
        )}

        

        <div {...swipe} style={{ touchAction: "pan-y" }}>
        {view === "agenda" && (
          <div className="space-y-4">
            <AgendaMap
              jobs={jobs}
              days={Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))}
            />
            {agendaDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const dayJobs = byDay(iso);
              return <AgendaDay key={iso} date={d} iso={iso} docs={dayJobs} currency={billing.currency} vat={billing.vatPct} />;
            })}
          </div>
        )}

        {view === "week" && (
          <div className="space-y-2 md:grid md:grid-cols-7 md:gap-2 md:space-y-0">
            {weekDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              return (
                <DayCol key={iso} date={d} iso={iso} docs={byDay(iso)} currency={billing.currency} vat={billing.vatPct} />
              );
            })}
          </div>
        )}

        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-muted-foreground mb-1">
              {["M","T","W","T","F","S","S"].map((d, i) => <div key={i} className="text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                return <MonthCell key={iso} date={d} iso={iso} inMonth={isSameMonth(d, monthAnchor)} docs={byDay(iso)} />;
              })}
            </div>
          </div>
        )}
        </div>
      </DndContext>

      <JobActionSheet
        doc={actionDoc}
        onClose={closeActions}
        moveMode={moveMode}
        onEnterMove={() => setMoveMode(true)}
        onMove={moveTo}
        onMarkPaid={markPaid}
        onCancel={cancelJob}
      />
     </JobActionsCtx.Provider>
    </Shell>
  );
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => { onLongPress(); timer.current = null; }, ms);
  }, [onLongPress, ms]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > 64) clear();
  }, []);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); onLongPress(); }, [onLongPress]);
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu,
  };
}

function useSwipe({ onLeft, onRight, threshold = 50 }: { onLeft: () => void; onRight: () => void; threshold?: number }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) onLeft(); else onRight();
  };
  return { onTouchStart, onTouchEnd };
}

function JobActionSheet({
  doc, onClose, moveMode, onEnterMove, onMove, onMarkPaid, onCancel,
}: {
  doc: Doc | null;
  onClose: () => void;
  moveMode: boolean;
  onEnterMove: () => void;
  onMove: (iso: string | undefined) => void;
  onMarkPaid: (m: PayMethod) => void;
  onCancel: () => void;
}) {
  const nav = useNavigate();
  return (
    <Sheet open={!!doc} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {doc?.customer.name || "—"}
            <div className="text-xs font-normal text-muted-foreground mt-0.5">
              {doc?.number} · {doc?.scheduledDate ?? "unscheduled"}
            </div>
          </SheetTitle>
        </SheetHeader>
        {!moveMode ? (
          <div className="mt-4 space-y-2">
            {doc?.status !== "paid" && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Record payment</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash","eft","card"] as PayMethod[]).map((m) => (
                    <Button key={m} className="h-11 uppercase" onClick={() => onMarkPaid(m)}>
                      <Check className="h-4 w-4 mr-1.5" /> {m}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Button variant="secondary" className="w-full h-11" onClick={onEnterMove}>
              <CalendarDays className="h-4 w-4 mr-2" /> Move to another day
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={() => { if (doc) nav({ to: "/doc/$id", params: { id: doc.id } }); onClose(); }}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open job
            </Button>
            <Button variant="destructive" className="w-full h-11" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" /> Cancel job
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">Pick a new date</div>
            <DatePicker value={doc?.scheduledDate} onChange={(iso) => onMove(iso)} clearable />
            <Button variant="ghost" className="w-full" onClick={() => onMove(undefined)}>
              Move to unscheduled
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}



function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, d MMM");
}

function AgendaDay({ date, iso, docs, currency, vat }: { date: Date; iso: string; docs: Doc[]; currency: string; vat: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  return (
    <div ref={setNodeRef} className={cn(
      "rounded-lg border transition-colors",
      isOver && "border-primary bg-primary/5",
      today && "border-primary/50",
    )}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <div>
          <div className={cn("font-semibold text-sm", today && "text-primary")}>{dayLabel(date)}</div>
          <div className="text-[10px] text-muted-foreground uppercase">{format(date, "d MMM yyyy")}</div>
        </div>
        <span className="text-xs text-muted-foreground">{docs.length} job{docs.length === 1 ? "" : "s"}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[3rem]">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No jobs</p>
        ) : (
          docs.map((d) => <AgendaJob key={d.id} doc={d} iso={iso} currency={currency} vat={vat} />)
        )}
      </div>
    </div>
  );
}

// ---------- shared 3-line layout ----------
type Variant = "agenda" | "week" | "month";

function JobCardLayout({
  doc, iso, currency, vat, variant, dragProps, dragging,
}: {
  doc: Doc;
  iso?: string;
  currency: string;
  vat: number;
  variant: Variant;
  dragProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const t = docTotals(doc, vat);
  const cat = jobCategory(doc);
  const span = iso ? daySpanFor(doc, iso) : null;
  const isContinuation = !!span && span.idx > 1;
  const address = doc.fromAddress || doc.toAddress || (doc.customer.address ?? "no address");
  const small = variant === "month";

  return (
    <div
      className={cn(
        "rounded border overflow-hidden",
        CATEGORY_STYLES[cat],
        isContinuation && "border-l-2 border-dashed opacity-90",
        dragging && "opacity-50",
        small ? "px-1 py-0.5 text-[10px]" : "px-2 py-1.5 text-xs",
      )}
      {...(dragProps ?? {})}
    >
      <Link to="/doc/$id" params={{ id: doc.id }} className="block min-w-0">
        {/* Line 1 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("font-semibold truncate min-w-0 flex-1", small ? "text-[10px]" : "text-sm")}>
            {doc.customer.name || "—"}
          </span>
          {span && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-black/10 dark:bg-white/10 px-1 text-[9px] font-medium">
              <Link2 className="h-2.5 w-2.5" /> Day {span.idx}/{span.n}
            </span>
          )}
          <span className="shrink-0"><PaymentIndicator doc={doc} /></span>
        </div>
        {/* Line 2 */}
        <div className={cn("truncate opacity-80", small ? "text-[9px]" : "text-[11px]")}>
          {doc.number} · {address}
        </div>
        {/* Line 3 */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className={cn("uppercase font-medium truncate min-w-0 flex-1 tracking-wide", small ? "text-[9px]" : "text-[10px]")}>
            {cat}
          </span>
          {!small && (
            <span className="shrink-0 font-mono font-semibold text-[11px]">{fmtMoney(t.total, currency)}</span>
          )}
        </div>
        {/* Notes for "other" jobs (skip on tiny month cells) */}
        {cat === "other" && !small && doc.notes && (
          <div
            className="mt-1 text-[10px] opacity-75 whitespace-pre-line"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {doc.notes}
          </div>
        )}
      </Link>
    </div>
  );
}

function AgendaJob({ doc, iso, currency, vat }: { doc: Doc; iso: string; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-stretch rounded-lg overflow-hidden", isDragging && "opacity-50")} {...lp}>
      <button {...listeners} {...attributes} className="px-2 flex items-center text-muted-foreground touch-none cursor-grab active:cursor-grabbing bg-muted/40">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <JobCardLayout doc={doc} iso={iso} currency={currency} vat={vat} variant="agenda" />
      </div>
    </div>
  );
}

function DayCol({ date, iso, docs, currency, vat }: { date: Date; iso: string; docs: Doc[]; currency: string; vat: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border overflow-hidden md:min-h-64",
        isOver ? "border-primary bg-primary/5" : "border-border bg-card",
        today && "ring-2 ring-primary",
        isWeekend && !today && "bg-muted/30",
      )}
    >
      <div
        className={cn(
          "flex items-baseline gap-2 px-3 py-2 border-b bg-muted/40 md:flex-col md:items-start md:gap-0 md:bg-transparent md:border-b-0 md:pb-1",
          today && "text-primary",
        )}
      >
        <span className="text-xs uppercase font-semibold tracking-wide">{format(date, "EEE")}</span>
        <span className="font-display text-2xl leading-none md:mt-0.5">{format(date, "d")}</span>
        <span className="text-[10px] uppercase text-muted-foreground md:hidden">{format(date, "MMM")}</span>
        <span className="ml-auto text-[11px] text-muted-foreground md:hidden">
          {docs.length === 0 ? "no jobs" : `${docs.length} job${docs.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="p-2 space-y-1.5 min-h-[3rem]">
        {docs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-1.5 md:py-3">—</p>
        ) : (
          docs.map((d) => <JobCard key={d.id} doc={d} iso={iso} currency={currency} vat={vat} />)
        )}
      </div>
    </div>
  );
}

function MonthCell({ date, iso, inMonth, docs }: { date: Date; iso: string; inMonth: boolean; docs: Doc[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  return (
    <div ref={setNodeRef} className={cn(
      "rounded border min-h-16 sm:min-h-24 p-1 text-xs",
      inMonth ? "bg-card" : "bg-muted/40 opacity-60",
      isOver ? "border-primary bg-primary/5" : "border-border",
      today && "ring-2 ring-primary",
    )}>
      <div className={cn("font-display text-sm sm:text-lg leading-none mb-1", today && "text-primary")}>{format(date, "d")}</div>
      <div className="space-y-0.5">
        {docs.slice(0, 3).map((d) => <MiniJob key={d.id} doc={d} iso={iso} />)}
        {docs.length > 3 && <div className="text-[9px] text-muted-foreground">+{docs.length - 3}</div>}
      </div>
    </div>
  );
}

function MiniJob({ doc, iso }: { doc: Doc; iso: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      {...lp}
      className={cn("cursor-grab", isDragging && "opacity-50")}
    >
      <JobCardLayout doc={doc} iso={iso} currency="" vat={0} variant="month" />
    </div>
  );
}

function JobCard({ doc, iso, currency, vat }: { doc: Doc; iso?: string; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      {...lp}
      className={cn("cursor-grab", isDragging && "opacity-50")}
    >
      <JobCardLayout doc={doc} iso={iso} currency={currency} vat={vat} variant="week" />
    </div>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <Card ref={setNodeRef} className={cn("p-3", isOver && "ring-2 ring-primary", className)}>{children}</Card>;
}
