import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  ScriptOnce,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useStore } from "../lib/store";
import { ThemeInjector } from "../components/app/ThemeInjector";
import { BRAND_BOOTSTRAP_SCRIPT } from "../lib/brand-cookie";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" },
      { name: "theme-color", content: "#151C63" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      // SEO: Simple accounting & billing for entrepreneurs and small businesses
      { title: "KWOUT — Run your business. Not your paperwork." },
      { name: "description", content: "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 DAYS FREE. Everything included." },
      { name: "keywords", content: "small business accounting, invoicing app, quote and invoice software, expense tracker, customer statements, entrepreneur billing, VAT invoice generator, mobile bookkeeping, freelancer invoicing" },
      // Open Graph / Social
      { property: "og:title", content: "KWOUT — Run your business. Not your paperwork." },
      { property: "og:description", content: "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 DAYS FREE. Everything included." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "KWOUT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KWOUT — Run your business. Not your paperwork." },
      { name: "twitter:description", content: "KWOUT is the simple way for entrepreneurs to send quotes, invoices, statements and payslips. 30 DAYS FREE. Everything included." },
      { name: "google-site-verification", content: "VpenMbi07tDrXktRyV_hwv0Tye7vyWpaUDEoVdSUKbg" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IpKIwMzVfvhqp9ggxhsuAlf1Cgm2/social-images/social-1784099875540-googlebackkwout.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IpKIwMzVfvhqp9ggxhsuAlf1Cgm2/social-images/social-1784099875540-googlebackkwout.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/kwout-logo.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "KWOUT",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Simple, mobile-first accounting and billing app for entrepreneurs and small businesses. Quotes, invoices, expenses, statements and payslips.",
          url: "https://kwout.co.za/",
          offers: {
            "@type": "Offer",
            price: "100",
            priceCurrency: "ZAR",
          },
          publisher: {
            "@type": "Organization",
            name: "KWOUT",
            url: "https://kwout.co.za/",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Applies cached brand colours from the otm_brand cookie before
            React hydrates, so first paint uses the customer's palette. */}
        <ScriptOnce>{BRAND_BOOTSTRAP_SCRIPT}</ScriptOnce>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const density = useStore((s) => s.density);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-density", density ?? "normal");
    }
  }, [density]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInjector />
      <Outlet />
    </QueryClientProvider>
  );
}