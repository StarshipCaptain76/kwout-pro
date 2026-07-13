import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { clearBrandCookie } from "@/lib/brand-cookie";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { toast } from "sonner";
const kwoutLogo = { url: "/kwout-logo.png" };

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "signup" ? ("signup" as const) : ("signin" as const),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — KWOUT" },
      { name: "description", content: "Sign in or create your KWOUT account. 30 days free, then R100/month." },
      { property: "og:title", content: "Sign in — KWOUT" },
      { property: "og:description", content: "Access your KWOUT accounting and billing workspace." },
      { property: "og:url", content: "https://kwout.co.za/auth" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/auth" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);


  // Force KWOUT default branding on this page — never show a persisted
  // tenant theme flash. Runs before paint.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    for (const v of ["--primary","--primary-foreground","--accent","--accent-foreground","--secondary","--secondary-foreground","--ring"]) {
      root.style.removeProperty(v);
    }
    clearBrandCookie();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const attempt = await supabase.auth.signInWithPassword({ email, password });
      if (attempt.error) throw attempt.error;
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const attempt = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (attempt.error) throw attempt.error;
      if (attempt.data.session) {
        toast.success("Account created");
        navigate({ to: "/" });
      } else {
        toast.success("Check your email to verify your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return; // browser navigating away
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
      setForgot(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  const brand = "KWOUT";

  return (
    <div className="min-h-[100svh] grid place-items-center bg-background text-foreground p-4">
      <Card className="w-full max-w-sm p-6 grid gap-4">
        <div className="flex items-center gap-3">
          <img src={kwoutLogo.url} alt={brand} className="h-10 w-10 rounded object-contain" />
          <div>
            <div className="font-display text-2xl tracking-wide">{brand}</div>
            <div className="text-xs text-muted-foreground">Sign in to sync everywhere</div>
          </div>
        </div>

        {forgot ? (
          <form onSubmit={sendReset} className="grid gap-3">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11">
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              onClick={() => setForgot(false)}
              className="text-xs text-muted-foreground underline text-center"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <Tabs value={tab} onValueChange={(v) => navigate({ to: "/auth", search: { tab: v === "signup" ? "signup" : "signin" }, replace: true })}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="grid gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </div>
                <Button type="submit" disabled={busy} className="h-11">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="text-xs text-muted-foreground underline text-center"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="grid gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                  <p className="text-[11px] text-muted-foreground mt-1">Minimum 8 characters.</p>
                </div>
                <Button type="submit" disabled={busy} className="h-11">
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  We'll send you a verification email.
                </p>
              </form>
            </TabsContent>

            <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </Button>
          </Tabs>
        )}
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.6 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41 34.9 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
