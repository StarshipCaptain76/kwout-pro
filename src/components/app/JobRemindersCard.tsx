import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { notificationPermission, requestNotificationPermission } from "@/lib/reminders";
import { toast } from "sonner";
import { Bell } from "lucide-react";

const LEAD_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120];

export function JobRemindersCard() {
  const { company, setCompany } = useStore();
  const cfg = company.jobReminders ?? { enabled: false, leadMinutes: 30 };
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPerm(notificationPermission());
  }, []);

  const setCfg = (patch: Partial<typeof cfg>) => {
    setCompany({
      ...company,
      jobReminders: { ...cfg, ...patch },
    });
  };

  const requestPerm = async () => {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") toast.success("Notifications enabled");
    else if (p === "denied") toast.error("Notifications blocked in browser settings");
    else if (p === "unsupported") toast.error("This browser does not support notifications");
  };

  return (
    <Card className="p-4 sm:p-6 grid gap-4">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Job reminders</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get a device notification (or in-app toast) before a scheduled job starts.
          </p>
        </div>
        <Switch
          checked={!!cfg.enabled}
          onCheckedChange={(on) => setCfg({ enabled: on })}
          aria-label="Enable job reminders"
        />
      </div>

      {cfg.enabled && (
        <>
          <div>
            <Label className="mb-1 block">Warn me this many minutes before</Label>
            <select
              className="h-11 w-full border rounded-md px-2 bg-background text-sm"
              value={cfg.leadMinutes}
              onChange={(e) => setCfg({ leadMinutes: Number(e.target.value) })}
            >
              {LEAD_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minute{m === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void requestPerm()}>
              Request notification permission
            </Button>
            <span className="text-xs text-muted-foreground">
              Status:{" "}
              {perm === "granted"
                ? "granted"
                : perm === "denied"
                  ? "blocked"
                  : perm === "unsupported"
                    ? "unsupported"
                    : "not asked yet"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Reminders only fire for jobs with both a date and a start time. Each job is notified at most once per day.
          </p>
        </>
      )}
    </Card>
  );
}
