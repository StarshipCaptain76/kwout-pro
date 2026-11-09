import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/lib/subscription.functions";
import { Sparkles, X } from "lucide-react";

export function TrialBanner() {
  const [authed, setAuthed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchSub = useServerFn(getMySubscription);
  const { data } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => fetchSub(),
    enabled: authed,
    staleTime: 60_000,
  });

  if (!authed || !data || dismissed) return null;
  if (data.status === "active" || data.status === "legacy_free") return null;

  const expired = data.trialExpired || data.status === "past_due" || data.status === "cancelled";
  const showReminder = data.status === "trial" && data.daysLeftInTrial <= 7;
  if (!expired && !showReminder) return null;

  return (
    <div
      className={
        "sticky top-14 sm:top-16 z-30 border-b " +
        (expired
          ? "bg-destructive text-destructive-foreground border-destructive"
          : "bg-secondary text-secondary-foreground border-secondary")
      }
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3 text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">
          {expired ? (
            <>Your free trial ended. Subscribe to keep KWOUT running — R100/month.</>
          ) : (
            <>
              {data.daysLeftInTrial === 0
                ? "Last day of your free trial."
                : `${data.daysLeftInTrial} day${data.daysLeftInTrial === 1 ? "" : "s"} left in your free trial.`}
            </>
          )}
        </span>
        <Link
          to="/settings"
          className="rounded-md bg-primary text-primary-foreground px-3 py-1 font-medium hover:bg-primary/90"
        >
          Subscribe
        </Link>
        {!expired && (
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
