import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { clearBrandCookie } from "@/lib/brand-cookie";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check } from "lucide-react";
import kwoutLogo from "@/assets/kwout-logo.png.asset.json";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "KWOUT — Run your business. Not your paperwork." },
      {
        name: "description",
        content:
          "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 days free, then R100/month. Everything included.",
      },
      { property: "og:title", content: "KWOUT — Run your business. Not your paperwork." },
      {
        property: "og:description",
        content: "Quotes, invoices, statements, payslips, expenses, reports. R100/month. Try 30 days free.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kwout.co.za/welcome" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KWOUT — Run your business. Not your paperwork." },
      { name: "twitter:description", content: "30 days free. Then R100/month. Everything included." },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/welcome" }],
  }),
});

const INCLUDED = ["Quotes", "Invoices", "Statements", "Payslips", "Expenses", "Reports"];

function WelcomePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");

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

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Welcome to KWOUT — your 30-day trial starts now.");
        navigate({ to: "/" });
      } else {
        toast.success("Check your email to verify and start your free trial.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-[#F5F5F0] text-[#111111]">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={kwoutLogo.url} alt="KWOUT" className="h-9 w-9 rounded object-contain" />
          <span className="font-display text-2xl tracking-wide">KWOUT</span>
        </div>
        <button
          onClick={() => { setMode("signin"); document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); }}
          className="text-sm font-medium underline underline-offset-4 hover:text-primary"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-8 sm:pt-16 pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-start">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-display leading-[0.9] tracking-tight text-[15vw] sm:text-8xl lg:text-[7.5rem] text-primary"
          >
            Run your business.<br />
            <span className="relative inline-block">
              Not your
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.6, ease: "easeInOut" }}
                viewBox="0 0 300 14"
                className="absolute -bottom-2 left-0 w-full h-3 text-[#3FA34D]"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <motion.path d="M4 8 C 70 2, 150 12, 296 4" />
              </motion.svg>
            </span>{" "}
            paperwork.
          </motion.h1>

          <p className="mt-8 text-lg sm:text-xl text-[#111111]/70 max-w-xl">
            Quotes, invoices, statements, payslips — the whole KWOUT stationery, in your pocket.
            <span className="block mt-2 font-medium text-[#111111]">
              30 days free. Then R100/month. Everything included.
            </span>
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {INCLUDED.map((f) => (
              <li key={f} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#3FA34D]" strokeWidth={3} />
                <span className="font-medium">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Auth card */}
        <div id="start" className="relative">
          {/* Playful stamp */}
          <motion.div
            initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
            animate={{ rotate: -12, scale: 1, opacity: 1 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 120 }}
            className="absolute -top-6 -right-2 sm:-right-6 z-10 pointer-events-none"
          >
            <div className="border-4 border-[#3FA34D] text-[#3FA34D] rounded-full w-28 h-28 grid place-items-center text-center font-display tracking-widest text-sm leading-tight opacity-90">
              KWOUT<br />APPROVED
            </div>
          </motion.div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-xl p-6 sm:p-7">
            <div className="mb-4">
              <div className="font-display text-3xl tracking-wide text-primary">
                {mode === "signup" ? "Start free" : "Welcome back"}
              </div>
              <div className="text-xs text-[#111111]/60 mt-1">
                {mode === "signup"
                  ? "No card needed. Set up in under a minute."
                  : "Sign in to your KWOUT account."}
              </div>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "signup" | "signin")}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="signup">Start free</TabsTrigger>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="grid gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                    <p className="text-[11px] text-[#111111]/60 mt-1">At least 8 characters.</p>
                  </div>
                  <Button type="submit" disabled={busy} className="h-11">
                    {busy ? "Creating…" : "Start my 30-day free trial"}
                  </Button>
                </form>
              </TabsContent>

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
                  <Link to="/auth" className="text-[11px] text-[#111111]/60 underline text-center">
                    Forgot password?
                  </Link>
                </form>
              </TabsContent>

              <div className="my-3 flex items-center gap-2 text-[11px] text-[#111111]/50">
                <div className="h-px flex-1 bg-black/10" />
                <span>or</span>
                <div className="h-px flex-1 bg-black/10" />
              </div>

              <Button type="button" variant="outline" className="h-11 w-full bg-white" disabled={busy} onClick={signInWithGoogle}>
                <GoogleIcon />
                <span className="ml-2">Continue with Google</span>
              </Button>
            </Tabs>
          </div>

          <p className="mt-4 text-center text-[11px] text-[#111111]/60">
            R100/month after your trial. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10 mt-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#111111]/60">
          <div className="flex items-center gap-2">
            <img src={kwoutLogo.url} alt="" className="h-5 w-5 rounded object-contain opacity-80" />
            <span className="font-display tracking-wide text-sm text-[#111111]">KWOUT</span>
          </div>
          <div>Made for entrepreneurs. Billed monthly by PayFast. Cancel anytime.</div>
        </div>
      </footer>
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
