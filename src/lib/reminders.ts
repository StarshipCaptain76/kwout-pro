import { useStore, type Doc } from "./store";
import { toast } from "sonner";

const FIRED_KEY = "kwout-reminders-fired";
const POLL_MS = 30_000; // check every 30s

type FiredMap = Record<string, string>; // docId -> yyyy-mm-dd of fire

function loadFired(): FiredMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? "{}") as FiredMap;
  } catch {
    return {};
  }
}

function saveFired(m: FiredMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function jobStartMs(doc: Doc): number | null {
  if (!doc.scheduledDate || !doc.scheduledTime) return null;
  // scheduledTime is "HH:mm"
  const [hh, mm] = doc.scheduledTime.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(`${doc.scheduledDate}T00:00:00`);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

async function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/kwout-logo.png", tag: title });
      return;
    } catch {
      /* fall through to toast */
    }
  }
  toast(title, { description: body });
}

function checkOnce() {
  const { docs, company } = useStore.getState();
  const cfg = company.jobReminders;
  if (!cfg?.enabled) return;

  const leadMs = Math.max(1, cfg.leadMinutes ?? 30) * 60_000;
  const now = Date.now();
  const fired = loadFired();
  const today = todayIso();
  let dirty = false;

  for (const doc of docs) {
    if (doc.archived || doc.status === "cancelled" || doc.status === "paid") continue;
    const start = jobStartMs(doc);
    if (start == null) continue;
    // Within lead window and not yet past start by more than 2 min
    const delta = start - now;
    if (delta > leadMs || delta < -2 * 60_000) continue;

    const key = doc.id;
    if (fired[key] === today) continue; // already fired today

    const name = doc.customer.name || doc.number;
    const time = doc.scheduledTime!;
    void notify(
      `Job due soon · ${time}`,
      `${name}${doc.notes ? ` — ${doc.notes.slice(0, 80)}` : ""}`,
    );
    fired[key] = today;
    dirty = true;
  }

  if (dirty) saveFired(fired);
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the reminder poller (idempotent). Call once from the app shell. */
export function startReminders() {
  if (typeof window === "undefined") return;
  if (timer) return;
  // Run once immediately, then on interval
  checkOnce();
  timer = setInterval(checkOnce, POLL_MS);
  // Also re-check when the tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkOnce();
  });
}

export function stopReminders() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
