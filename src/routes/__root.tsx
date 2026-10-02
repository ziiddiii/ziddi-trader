import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";

const SupportChat = lazy(() =>
  import("@/components/support-chat").then((module) => ({ default: module.SupportChat })),
);
const InstallPromoPopup = lazy(() =>
  import("@/components/install-promo-popup").then((module) => ({ default: module.InstallPromoPopup })),
);
const PromoFlash = lazy(() =>
  import("@/components/promo-flash").then((module) => ({ default: module.PromoFlash })),
);
const AppShell = lazy(() =>
  import("@/components/app-shell").then((module) => ({ default: module.AppShell })),
);

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ZiiDi Trader — Peer-to-peer stock share marketplace" },
      { name: "description", content: "ZiiDi Trader lets you list shares you own, chat directly with buyers, and settle securely." },
      { property: "og:title", content: "ZiiDi Trader — Peer-to-peer stock share marketplace" },
      { property: "og:description", content: "List shares, chat with buyers, and settle securely on ZiiDi Trader." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0E9F6E" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "ZiiDi Trader" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthPage =
    pathname.startsWith("/auth") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify" ||
    pathname === "/redirecting";
  const isAdminPage =
    pathname === "/admin-login" ||
    pathname === "/admin" ||
    pathname === "/admin-panel" ||
    pathname === "/admin-plans";
  const bare =
    pathname.startsWith("/auth") ||
    pathname === "/" ||
    pathname === "/diagnostics" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify" ||
    pathname === "/redirecting" ||
    pathname === "/admin-login" ||
    pathname === "/admin" ||
    pathname === "/admin-panel" ||
    pathname === "/admin-plans";
  const [optionalUiReady, setOptionalUiReady] = useState(false);

  useEffect(() => {
    const reveal = () => setOptionalUiReady(true);
    const timer = window.setTimeout(reveal, 6000);
    window.addEventListener("load", reveal, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", reveal);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {bare ? (
        <main className="min-h-screen bg-background text-foreground">
          <Outlet />
        </main>
      ) : (
        <Suspense fallback={<main className="min-h-screen bg-background" />}>
          <AppShell><Outlet /></AppShell>
        </Suspense>
      )}
      <Toaster position="top-right" richColors />
      {optionalUiReady && (
        <Suspense fallback={null}>
          {!isAuthPage && <SupportChat />}
          {!isAuthPage && !isAdminPage && <PromoFlash />}
          {!isAdminPage && <InstallPromoPopup />}
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

