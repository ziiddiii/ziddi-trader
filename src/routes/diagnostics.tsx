import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  XCircle,
  AlertTriangle,
} from "lucide-react";

type Status = "pending" | "ok" | "slow" | "fail";

type CheckResult = {
  id: string;
  label: string;
  group: string;
  status: Status;
  ms?: number;
  detail?: string;
  bytes?: number;
};

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

const SLOW_MS = 2500;
const TIMEOUT_MS = 12000;

type CheckDef = {
  id: string;
  label: string;
  group: string;
  run: () => Promise<{ detail?: string; bytes?: number }>;
};

async function timedFetch(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, ...init });
    const buf = await res.arrayBuffer();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return { detail: `HTTP ${res.status}`, bytes: buf.byteLength };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted") || message.includes("abort")) {
      throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s — likely blocked or throttled`);
    }
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      throw new Error("Network/DNS failure — host unreachable on this connection");
    }
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

function buildChecks(): CheckDef[] {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const checks: CheckDef[] = [
    { id: "html", label: "App HTML document", group: "App origin", run: () => timedFetch(`${origin}/?diag=${Date.now()}`) },
    { id: "manifest", label: "PWA manifest", group: "App origin", run: () => timedFetch(`${origin}/manifest.webmanifest`) },
    { id: "favicon", label: "Favicon (favicon.png)", group: "Assets", run: () => timedFetch(`${origin}/favicon.png`) },
    { id: "icon192", label: "App icon 192px", group: "Assets", run: () => timedFetch(`${origin}/icon-192.png`) },
    { id: "icon512", label: "App icon 512px", group: "Assets", run: () => timedFetch(`${origin}/icon-512.png`) },
    { id: "font-sora", label: "Font: Sora (self-hosted)", group: "Assets", run: () => timedFetch(`${origin}/fonts/sora-latin.woff2`) },
    { id: "font-manrope", label: "Font: Manrope (self-hosted)", group: "Assets", run: () => timedFetch(`${origin}/fonts/manrope-latin.woff2`) },
  ];

  if (SUPABASE_URL) {
    const host = new URL(SUPABASE_URL).host;
    checks.push(
      {
        id: "sb-auth",
        label: `Backend auth service (${host})`,
        group: "Backend",
        run: () => timedFetch(`${SUPABASE_URL}/auth/v1/health`, { headers: SUPABASE_KEY ? { apikey: SUPABASE_KEY } : undefined }),
      },
      {
        id: "sb-rest",
        label: "Backend database (REST read)",
        group: "Backend",
        run: () =>
          timedFetch(`${SUPABASE_URL}/rest/v1/promo_flashes?select=id&limit=1`, {
            headers: SUPABASE_KEY ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } : undefined,
          }),
      },
      {
        id: "sb-storage",
        label: "Backend storage (stock logos)",
        group: "Backend",
        run: () =>
          timedFetch(`${SUPABASE_URL}/storage/v1/object/list/stock-logos`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
            },
            body: JSON.stringify({ prefix: "", limit: 1 }),
          }),
      },
      {
        id: "sb-ws",
        label: "Realtime websocket (live updates)",
        group: "Backend",
        run: () =>
          new Promise((resolve, reject) => {
            const wsUrl = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${SUPABASE_KEY ?? ""}&vsn=1.0.0`;
            let settled = false;
            let socket: WebSocket;
            const timer = setTimeout(() => {
              if (settled) return;
              settled = true;
              try {
                socket?.close();
              } catch {}
              reject(new Error("Websocket never opened — carrier may block WS upgrades"));
            }, TIMEOUT_MS);
            try {
              socket = new WebSocket(wsUrl);
            } catch {
              clearTimeout(timer);
              reject(new Error("Websocket could not be created"));
              return;
            }
            socket.onopen = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              socket.close();
              resolve({ detail: "Websocket opened" });
            };
            socket.onerror = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              reject(new Error("Websocket error — blocked or unreachable"));
            };
          }),
      },
    );
  }

  return checks;
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function useConnectionInfo() {
  const [info, setInfo] = useState<Record<string, string>>({});
  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    };
    const c = nav.connection;
    setInfo({
      Online: navigator.onLine ? "yes" : "no",
      "Network type": c?.effectiveType ?? "unknown",
      Downlink: c?.downlink !== undefined ? `${c.downlink} Mbps` : "unknown",
      "Round trip": c?.rtt !== undefined ? `${c.rtt} ms` : "unknown",
      "Data saver": c?.saveData ? "on" : "off",
    });
  }, []);
  return info;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "pending") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (status === "slow") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function DiagnosticsPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [thirdParty, setThirdParty] = useState<{ name: string; ms: number; bytes: number }[]>([]);
  const [copied, setCopied] = useState(false);
  const connection = useConnectionInfo();

  const runAll = useCallback(async () => {
    const checks = buildChecks();
    setRunning(true);
    setResults(checks.map((c) => ({ id: c.id, label: c.label, group: c.group, status: "pending" as Status })));

    await Promise.all(
      checks.map(async (check) => {
        const started = performance.now();
        try {
          const out = await check.run();
          const ms = Math.round(performance.now() - started);
          setResults((prev) =>
            prev.map((r) =>
              r.id === check.id
                ? { ...r, status: ms > SLOW_MS ? "slow" : "ok", ms, detail: out.detail, bytes: out.bytes }
                : r,
            ),
          );
        } catch (err) {
          const ms = Math.round(performance.now() - started);
          setResults((prev) =>
            prev.map((r) =>
              r.id === check.id
                ? { ...r, status: "fail", ms, detail: err instanceof Error ? err.message : String(err) }
                : r,
            ),
          );
        }
      }),
    );
    setRunning(false);
  }, []);

  useEffect(() => {
    runAll();
  }, [runAll]);

  useEffect(() => {
    const origin = window.location.origin;
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const external = entries
      .filter((e) => !e.name.startsWith(origin) && !e.name.startsWith("data:") && !e.name.startsWith("blob:"))
      .map((e) => ({ name: e.name, ms: Math.round(e.duration), bytes: e.transferSize ?? 0 }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12);
    setThirdParty(external);
  }, []);

  const failures = results.filter((r) => r.status === "fail");
  const slow = results.filter((r) => r.status === "slow");
  const groups = Array.from(new Set(results.map((r) => r.group)));

  const report = [
    `ZiiDi Trader loading diagnostics — ${new Date().toISOString()}`,
    `URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
    `UA: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
    ...Object.entries(connection).map(([k, v]) => `${k}: ${v}`),
    "",
    ...results.map(
      (r) =>
        `[${r.status.toUpperCase()}] ${r.label} — ${r.ms ?? "-"}ms ${formatBytes(r.bytes)} ${r.detail ?? ""}`.trim(),
    ),
    "",
    "Third-party requests observed:",
    ...(thirdParty.length ? thirdParty.map((t) => `${t.ms}ms ${formatBytes(t.bytes)} ${t.name}`) : ["none"]),
  ].join("\n");

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-primary" /> Loading diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run this page on the connection that fails (e.g. Safaricom mobile data) to see exactly which request or
            asset is blocking the app.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAll}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Re-run
          </button>
          <button
            onClick={copyReport}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy report"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-semibold text-foreground">Connection</div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {Object.entries(connection).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {!running && (failures.length > 0 || slow.length > 0) && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${
            failures.length
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-foreground"
          }`}
        >
          <div className="font-semibold">
            {failures.length ? `${failures.length} blocker(s) found` : `${slow.length} slow request(s)`}
          </div>
          <ul className="mt-1 list-disc pl-5">
            {[...failures, ...slow].map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.label}</span> — {r.detail ?? "slow"}{" "}
                {r.ms !== undefined && `(${r.ms}ms)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!running && failures.length === 0 && slow.length === 0 && results.length > 0 && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          All checks passed on this connection — nothing is being blocked here.
        </div>
      )}

      {groups.map((group) => (
        <section key={group} className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {results
              .filter((r) => r.group === group)
              .map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0">
                    <StatusIcon status={r.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{r.label}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.status === "pending" ? "Checking…" : r.detail}
                      {r.bytes !== undefined && ` · ${formatBytes(r.bytes)}`}
                    </div>
                  </div>
                  {r.ms !== undefined && (
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        r.status === "fail"
                          ? "text-destructive"
                          : r.status === "slow"
                            ? "text-amber-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.ms} ms
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Third-party requests on this page load
        </h2>
        <div className="mt-2 rounded-lg border border-border bg-card p-4 text-xs">
          {thirdParty.length === 0 ? (
            <p className="text-muted-foreground">
              None — the app loaded entirely from your own domain and backend. Good sign for restricted networks.
            </p>
          ) : (
            <ul className="space-y-1">
              {thirdParty.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-foreground">{t.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t.ms} ms {formatBytes(t.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Tip: a DNS_PROBE_FINISHED_NXDOMAIN screen means the carrier's DNS could not resolve the domain — that happens
        before this page can load, so open it on the working network and compare the numbers, or try the
        project's *.lovable.app address on mobile data.
      </p>
    </div>
  );
}

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Loading diagnostics — ZiiDi Trader" },
      {
        name: "description",
        content:
          "Run connectivity checks on assets, fonts and backend services to pinpoint what blocks ZiiDi Trader on mobile data.",
      },
      { property: "og:title", content: "Loading diagnostics — ZiiDi Trader" },
      {
        property: "og:description",
        content: "Pinpoint failing requests and assets that block ZiiDi Trader on restricted mobile networks.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiagnosticsPage,
});