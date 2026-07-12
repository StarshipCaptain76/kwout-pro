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
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      // SEO: Primary title optimized for search (transport / moving / removal operators in SA)
      { title: "On the MOOVE | Quote, Invoice & Job Planner for Transport & Removal Services" },
      { name: "description", content: "Professional billing and operations platform for independent transport, removal and logistics operators in South Africa. Create quotes & invoices, plan jobs with drag-and-drop scheduler, track expenses with receipts, manage customers & catalog. Mobile-first, offline-capable, Supabase powered." },
      { name: "keywords", content: "quote invoice planner, transport quote app, moving company billing software, removal services invoice, logistics planner South Africa, Cape Town transport app, job scheduler for movers, expense tracker with receipts, VAT invoice generator, Rand billing platform" },
      // Open Graph / Social
      { property: "og:title", content: "On the MOOVE | Quote, Invoice & Job Planner for Transport & Removal Services" },
      { property: "og:description", content: "Professional billing and operations platform for independent transport, removal and logistics operators in South Africa. Create quotes & invoices, plan jobs with drag-and-drop scheduler, track expenses with receipts, manage customers & catalog. Mobile-first, offline-capable." },
      { property: "og:type", content: "website" },
      // TODO: Replace the placeholder og:image below with your own branded social image (recommended: upload logo + hero to Supabase Storage or Vercel and use the public URL). Current image is a generic placeholder.
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IpKIwMzVfvhqp9ggxhsuAlf1Cgm2/social-images/social-1783745259345-invoice-app-for-iphone-bnr-4x.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "On the MOOVE | Quote, Invoice & Job Planner for Transport & Removal Services" },
      { name: "twitter:description", content: "Professional billing and operations platform for independent transport, removal and logistics operators in South Africa. Create quotes & invoices, plan jobs with drag-and-drop scheduler, track expenses with receipts." },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IpKIwMzVfvhqp9ggxhsuAlf1Cgm2/social-images/social-1783745259345-invoice-app-for-iphone-bnr-4x.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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