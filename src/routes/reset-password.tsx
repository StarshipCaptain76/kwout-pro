import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash into a session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Sign out the recovery session so the user has to log in with the new password.
      await supabase.auth.signOut();
      toast.success("Password updated", {
        description: "Sign in with your new password to continue.",
      });
      navigate({ to: "/auth", search: { tab: "signin" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100svh] grid place-items-center bg-background text-foreground p-4">
      <Card className="w-full max-w-sm p-6 grid gap-4">
        <div>
          <div className="font-display text-2xl tracking-wide">Set a new password</div>
          <div className="text-xs text-muted-foreground">
            {ready ? "Choose something at least 8 characters." : "Verifying reset link…"}
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div>
            <Label>New password</Label>
            <Input
              type="password"
              className="h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              disabled={!ready}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={busy || !ready} className="h-11">
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
