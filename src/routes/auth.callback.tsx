import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({ meta: [
    { title: "Verify your account — KWOUT" },
    { name: "description", content: "Complete verification and sign in to KWOUT." },
    { property: "og:title", content: "Verify your account — KWOUT" },
    { property: "og:description", content: "Complete verification and sign in to KWOUT." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        toast.success("Email verified");
        navigate({ to: "/" });
      } else {
        // Wait briefly for the hash-based session to hydrate.
        setTimeout(check, 400);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[100svh] grid place-items-center bg-background text-foreground">
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </div>
  );
}
