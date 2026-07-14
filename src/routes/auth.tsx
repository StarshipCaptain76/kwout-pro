import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearBrandCookie } from "@/lib/brand-cookie";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureOwnerStaff } from "@/lib/staff.functions";
import {
  sendSignupEmail,
  resendVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/auth-email.functions";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MailCheck, AlertCircle, Eye, EyeOff } from "lucide-react";

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

type SignInProblem =
  | { kind: "invalid" }
  | { kind: "unverified"; email: string }
  | null;

type SignUpProblem =
  | { kind: "weak-password" }
  | { kind: "generic"; message: string }
  | null;

function AuthPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const [pendingVerification, setPendingVerification] = useState<{ email: string } | null>(null);
  const [resetSent, setResetSent] = useState<{ email: string } | null>(null);
  const [signInProblem, setSignInProblem] = useState<SignInProblem>(null);
  const [signUpProblem, setSignUpProblem] = useState<SignUpProblem>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    for (const v of ["--primary","--primary-foreground","--accent","--accent-foreground","--secondary","--secondary-foreground","--ring"]) {
      root.style.removeProperty(v);
    }
    clearBrandCookie();
  }, []);

  const ensureOwner = useServerFn(ensureOwnerStaff);
  const sendSignup = useServerFn(sendSignupEmail);
  const resendVerify = useServerFn(resendVerificationEmail);
  const sendReset = useServerFn(sendPasswordResetEmail);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        try { await ensureOwner(); } catch (e) { console.error(e); }
        navigate({ to: "/" });
      }
    });
  }, [navigate, ensureOwner]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSignInProblem(null);
    try {
      const attempt = await supabase.auth.signInWithPassword({ email, password });
      if (attempt.error) throw attempt.error;
      try { await ensureOwner(); } catch (e) { console.error(e); }
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      const code = (err as { code?: string } | null)?.code ?? "";
      const lower = msg.toLowerCase();
      if (code === "email_not_confirmed" || lower.includes("not confirmed") || lower.includes("email not confirmed")) {
        setSignInProblem({ kind: "unverified", email });
      } else if (
        code === "invalid_credentials" ||
        code === "invalid_grant" ||
        lower.includes("invalid login") ||
        lower.includes("invalid credentials")
      ) {
        setSignInProblem({ kind: "invalid" });
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSignUpProblem(null);
    try {
      await sendSignup({
        data: {
          email,
          password,
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setPendingVerification({ email });
      setResendCooldown(30);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      const lower = msg.toLowerCase();
      if (
        lower.includes("weak") ||
        lower.includes("easy to guess") ||
        lower.includes("pwned") ||
        lower.includes("compromised") ||
        lower.includes("breach")
      ) {
        setSignUpProblem({ kind: "weak-password" });
      } else {
        setSignUpProblem({ kind: "generic", message: msg });
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification(target: string) {
    if (resendCooldown > 0) return;
    setBusy(true);
    try {
      await resendVerify({
        data: {
          email: target,
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      toast.success("Verification email sent");
      setResendCooldown(30);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendReset({
        data: {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      toast.success("Password reset email sent", {
        description: `Check ${email} for a link to choose a new password.`,
      });
      setResetSent({ email });
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

        {pendingVerification ? (
          <div className="grid gap-4 text-center py-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">Verify your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a verification link to{" "}
                <span className="font-medium text-foreground break-all">{pendingVerification.email}</span>.
                Click it to activate your {brand} account.
              </p>
            </div>
            <div className="grid gap-2">
              <Button
                type="button"
                className="h-11"
                disabled={busy || resendCooldown > 0}
                onClick={() => resendVerification(pendingVerification.email)}
              >
                {resendCooldown > 0 ? `Resend email (${resendCooldown}s)` : "Resend email"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={() => {
                  setPendingVerification(null);
                  navigate({ to: "/auth", search: { tab: "signup" }, replace: true });
                }}
              >
                Use a different email
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Check your spam folder if it doesn't arrive within a minute.
            </p>
          </div>
        ) : resetSent ? (
          <div className="grid gap-4 text-center py-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground break-all">{resetSent.email}</span>.
                Click it to choose a new password.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => setResetSent(null)}
            >
              Back to sign in
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Check your spam folder if it doesn't arrive within a minute. The link expires shortly.
            </p>
          </div>
        ) : forgot ? (
          <form onSubmit={submitReset} className="grid gap-3">
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
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setSignInProblem(null);
              setSignUpProblem(null);
              navigate({ to: "/auth", search: { tab: v === "signup" ? "signup" : "signin" }, replace: true });
            }}
          >
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {signInProblem?.kind === "invalid" && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>We couldn't sign you in</AlertTitle>
                  <AlertDescription className="grid gap-2 mt-1">
                    <p className="text-xs">
                      Either the password is wrong or this email isn't registered yet.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSignInProblem(null);
                          navigate({ to: "/auth", search: { tab: "signup" }, replace: true });
                        }}
                      >
                        Create an account
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSignInProblem(null);
                          setPassword("");
                          passwordRef.current?.focus();
                        }}
                      >
                        Try again
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {signInProblem?.kind === "unverified" && (
                <Alert className="mb-3">
                  <MailCheck className="h-4 w-4" />
                  <AlertTitle>Verify your email first</AlertTitle>
                  <AlertDescription className="grid gap-2 mt-1">
                    <p className="text-xs">
                      We sent a verification link to{" "}
                      <span className="font-medium">{signInProblem.email}</span>. Click it, then
                      sign in.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || resendCooldown > 0}
                        onClick={() => resendVerification(signInProblem.email)}
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend email"}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={signIn} className="grid gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input ref={passwordRef} type={showPassword ? "text" : "password"} className="h-11 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
              {signUpProblem?.kind === "weak-password" && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Choose a stronger password</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    This password has appeared in known data breaches, so we can't accept it.
                    Try a longer passphrase (3–4 unique words) or add numbers and symbols that
                    aren't tied to your name or birth year.
                  </AlertDescription>
                </Alert>
              )}
              {signUpProblem?.kind === "generic" && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Couldn't create your account</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {signUpProblem.message}
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={signUp} className="grid gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="h-11" value={email} onChange={(e) => { setEmail(e.target.value); setSignUpProblem(null); }} autoComplete="username" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} className="h-11 pr-10" value={password} onChange={(e) => { setPassword(e.target.value); setSignUpProblem(null); }} autoComplete="new-password" required minLength={8} />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Minimum 8 characters. Avoid common passwords — passphrases work best.
                  </p>
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
