import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Briefcase, TrendingUp, Flame, X, CheckCircle2, Loader2 } from "lucide-react";
import { MiniGraph } from "@/components/mini-graph";
import { TickerLogo } from "@/components/ticker-logo";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — ZiiDi Trader" },
      { name: "description", content: "Track your ZiiDi Trader share holdings and sell at the right market moment for the best profits." },
      { property: "og:title", content: "Portfolio — ZiiDi Trader" },
      { property: "og:description", content: "Monitor your holdings and sell shares on ZiiDi Trader." },
      { property: "og:url", content: "/portfolio" },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
  }),
  component: PortfolioPage,
});

type Holding = {
  id: string;
  ticker: string;
  company_name: string | null;
  quantity: number;
  avg_price: number;
};

function PortfolioPage() {
  const { user, loading } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selling, setSelling] = useState<Holding | null>(null);
  const [surge, setSurge] = useState<Holding | null>(null);
  const surgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeFired = useRef(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setHoldings((data ?? []) as Holding[]);
  };

  useEffect(() => {
    if (loading) return;
    load();
    if (!user) return;
    const ch = supabase
      .channel(`holdings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "holdings", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const biggest = useMemo(
    () =>
      holdings.length
        ? [...holdings].sort((a, b) => b.quantity * Number(b.avg_price) - a.quantity * Number(a.avg_price))[0]
        : null,
    [holdings],
  );

  /**
   * Invisible 10-second market timer. It starts silently the moment the user
   * holds shares (persisted per-user so navigating away doesn't restart it)
   * and fires a single "market has risen — sell now" alert when it elapses.
   */
  useEffect(() => {
    if (!user) return;
    const key = `ziidi_surge_${user.id}`;
    if (!holdings.length) {
      localStorage.removeItem(key);
      surgeFired.current = false;
      if (surgeTimer.current) clearTimeout(surgeTimer.current);
      surgeTimer.current = null;
      return;
    }
    if (surgeFired.current || surgeTimer.current) return;

    const SELL_FLASH_DELAY = 10 * 1000;
    const stored = Number(localStorage.getItem(key) ?? 0);
    const startedAt = stored > 0 ? stored : Date.now();
    if (stored <= 0) localStorage.setItem(key, String(startedAt));

    const delay = Math.max(0, SELL_FLASH_DELAY - (Date.now() - startedAt));
    surgeTimer.current = setTimeout(() => {
      surgeFired.current = true;
      surgeTimer.current = null;
      const target = holdings.length
        ? [...holdings].sort((a, b) => b.quantity * Number(b.avg_price) - a.quantity * Number(a.avg_price))[0]
        : null;
      if (!target) return;
      setSurge(target);
      toast.success(`${target.ticker} market has risen — sell now to lock in your profit.`);
    }, delay);

    return () => {
      if (surgeTimer.current) clearTimeout(surgeTimer.current);
      surgeTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, holdings.length]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="p-8 text-center text-muted-foreground">Sign in to view your portfolio.</div>
    );

  const totalValue = holdings.reduce((s, h) => s + h.quantity * Number(h.avg_price), 0);
  const estMarketValue = totalValue * 1.035; // simulated live market uptick
  const profit = estMarketValue - totalValue;

  return (
    <main className="mx-auto max-w-5xl py-6 md:py-10">
      <section className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-card to-background p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Briefcase className="h-3 w-3 text-primary" /> Your holdings
        </div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">Portfolio</h1>
        <p className="mt-2 text-muted-foreground">
          Shares released to you land here. Sell them to convert back to available balance instantly.
        </p>
        <div className="mt-4 text-lg font-mono">
          Cost basis total: <span className="font-semibold text-blue-600 dark:text-blue-400">KES {totalValue.toFixed(2)}</span>
        </div>
        {holdings.length > 0 && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Est. market value: </span>
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">KES {estMarketValue.toFixed(2)}</span>
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              +KES {profit.toFixed(2)} unrealised
            </span>
          </div>
        )}
      </section>

      {holdings.length > 0 && (
        <div className="mb-6">
          <MiniGraph variant="up" label="Portfolio — sell signal" />
          <p className="mt-2 text-xs text-muted-foreground">
            Market is trending up. Sell now to lock in profit — proceeds land in your available balance for withdrawal.
          </p>
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No shares yet. Buy from the Trade market — released shares appear here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {holdings.map((h) => (
            <div key={h.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-3">
                  <TickerLogo ticker={h.ticker} size={40} />
                  <div>
                    <div className="font-mono text-lg font-semibold">{h.ticker}</div>
                    {h.company_name && (
                      <div className="text-xs text-muted-foreground">{h.company_name}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg">{h.quantity}</div>
                  <div className="text-xs text-muted-foreground">shares</div>
                </div>
              </div>
              <div className="mt-3">
                <MiniGraph variant="up" label="Live" seed={h.ticker.length} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
                <span>Avg cost</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">KES {Number(h.avg_price).toFixed(2)}</span>
              </div>
              <button
                onClick={() => setSelling(h)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <TrendingUp className="h-4 w-4" /> Sell shares
              </button>
            </div>
          ))}
        </div>
      )}

      {selling && (
        <SellDialog
          holding={selling}
          onClose={() => setSelling(null)}
          onSold={() => {
            setSelling(null);
            setSurge(null);
            if (user) localStorage.removeItem(`ziidi_surge_${user.id}`);
            surgeFired.current = false;
            load();
          }}
        />
      )}

      {surge && !selling && (
        <SurgeAlert
          holding={surge}
          onClose={() => setSurge(null)}
          onSell={() => {
            setSelling(surge);
            setSurge(null);
          }}
        />
      )}
    </main>
  );
}

function SurgeAlert({
  holding,
  onClose,
  onSell,
}: {
  holding: Holding;
  onClose: () => void;
  onSell: () => void;
}) {
  const basis = holding.quantity * Number(holding.avg_price);
  const gainPct = basis >= 100000 ? 100 : basis >= 50000 ? 70 : basis >= 20000 ? 35 : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm animate-scale-in rounded-2xl border-2 border-emerald-400 bg-card p-6 shadow-2xl">
        <span className="absolute inset-0 animate-ping rounded-2xl ring-4 ring-emerald-400/40" aria-hidden="true" />
        <div className="relative flex items-start justify-between">
          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Flame className="h-3.5 w-3.5" /> Market surge alert
          </span>
          <button onClick={onClose} aria-label="Dismiss alert" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="relative mt-3 text-lg font-semibold">{holding.ticker} has risen sharply</h3>
        <p className="relative mt-1 text-sm text-muted-foreground">
          The NSE market for {holding.company_name ?? holding.ticker} has spiked. Sell your {holding.quantity} shares
          now to lock in the {gainPct > 0 ? `+${gainPct}%` : "current"} market gain before it corrects.
        </p>
        <div className="relative mt-4">
          <MiniGraph variant="up" label="Live surge" seed={holding.ticker.length + 3} />
        </div>
        <div className="relative mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-accent">
            Later
          </button>
          <button
            onClick={onSell}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <TrendingUp className="h-4 w-4" /> Sell now
          </button>
        </div>
      </div>
    </div>
  );
}

function SellDialog({
  holding,
  onClose,
  onSold,
}: {
  holding: Holding;
  onClose: () => void;
  onSold: () => void;
}) {
  const [qty, setQty] = useState(holding.quantity);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [step, setStep] = useState(0);


  const avg = Number(holding.avg_price);
  const costBasis = qty * avg;
  const { multiplier, tierLabel } =
    costBasis >= 100000
      ? { multiplier: 2.0, tierLabel: "+100% (KES 100,000+)" }
      : costBasis >= 50000
        ? { multiplier: 1.7, tierLabel: "+70% (KES 50,000 – 100,000)" }
        : costBasis >= 20000
          ? { multiplier: 1.35, tierLabel: "+35% (KES 20,000 – 50,000)" }
          : { multiplier: 1.0, tierLabel: "At cost (below KES 20,000)" };
  const sellPrice = avg * multiplier;
  const proceedsPreview = qty * sellPrice;

  const submit = async () => {
    if (qty <= 0 || qty > holding.quantity) {
      toast.error("Invalid quantity");
      return;
    }
    setBusy(true);
    setSettling(true);
    setStep(0);
    const startedAt = Date.now();
    const SETTLE_MS = 5000;
    const stepTimers = [
      setTimeout(() => setStep(1), 1300),
      setTimeout(() => setStep(2), 2700),
      setTimeout(() => setStep(3), 4000),
    ];
    const { data, error } = await supabase.rpc("sell_from_holdings", {
      _ticker: holding.ticker,
      _quantity: qty,
      _price: sellPrice,
    });
    if (error) {
      stepTimers.forEach(clearTimeout);
      setBusy(false);
      setSettling(false);
      toast.error(error.message);
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, SETTLE_MS - (Date.now() - startedAt))));
    stepTimers.forEach(clearTimeout);
    setStep(4);
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    setSettling(false);

    const proceeds = Number(data ?? proceedsPreview);
    toast.success(`Sold ${qty} × ${holding.ticker} — KES ${proceeds.toFixed(2)} credited to your balance.`);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { notify } = await import("@/lib/notify");
        await notify(
          uid,
          "sale",
          `Shares sold — ${holding.ticker}`,
          `You sold ${qty} × ${holding.ticker} at ${tierLabel}. KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been credited to your available balance and is ready for withdrawal.`,
          {
            reference: holding.id.slice(0, 8).toUpperCase(),
            details: [
              { label: "Stock", value: holding.ticker },
              { label: "Quantity sold", value: `${qty} shares` },
              { label: "Buy price", value: `KES ${avg.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Sell price", value: `KES ${sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Market tier", value: tierLabel },
              { label: "Proceeds credited", value: `KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Date", value: new Date().toLocaleString() },
            ],
          },
        );
      }
    } catch {}
    onSold();
  };

  if (settling) {
    return <SellingOverlay ticker={holding.ticker} qty={qty} proceeds={proceedsPreview} step={step} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Sell {holding.ticker}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sell up to {holding.quantity} shares. Proceeds are credited to your available balance instantly.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <input
              type="number"
              min={1}
              max={holding.quantity}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value || "0", 10))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg cost</span>
              <span className="font-mono">KES {avg.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Cost basis</span>
              <span className="font-mono">KES {costBasis.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Market tier</span>
              <span className="font-semibold text-emerald-700">{tierLabel}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Sell price / share</span>
              <span className="font-mono font-semibold">KES {sellPrice.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2">
              <span className="font-semibold">You receive</span>
              <span className="font-mono font-semibold text-emerald-700">KES {proceedsPreview.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sell price is auto-set by ZiiDi market tiers: KES 20k–50k basis sells at +35%, 50k–100k at +70%, 100k+ at +100%.
          </p>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Selling…" : "Sell now"}
          </button>
        </div>
      </div>
    </div>
  );
}
function SellingOverlay({
  ticker,
  qty,
  proceeds,
  step,
}: {
  ticker: string;
  qty: number;
  proceeds: number;
  step: number;
}) {
  const TOTAL_MS = 5000;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.min(TOTAL_MS, Date.now() - startedAt)), 80);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000));
  const done = step >= 4 || pct >= 100;

  const steps = [
    "Confirming your holding on the NSE book",
    `Matching ${qty} × ${ticker} at the live market tier`,
    "Settling the sale",
    "Crediting proceeds to your available balance",
  ];

  const R = 42;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <div className="relative grid h-28 w-28 place-items-center">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
              <circle cx="50" cy="50" r={R} className="fill-none stroke-muted" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r={R}
                className="fill-none stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
              />
            </svg>
            <span className="absolute grid place-items-center">
              {done ? (
                <CheckCircle2 className="h-9 w-9 text-primary" />
              ) : (
                <span className="font-mono text-2xl font-semibold tabular-nums">{secondsLeft}s</span>
              )}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {done ? "Sale complete!" : "Processing your sale…"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {done
              ? `KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })} credited to your available balance.`
              : `Selling ${qty} × ${ticker}. Please keep this window open.`}
          </p>
        </div>
        <div className="mt-5 space-y-2 px-6 pb-6">
          {steps.map((label, i) => {
            const state = done || step > i ? "done" : step === i ? "active" : "idle";
            return (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  state === "idle"
                    ? "border-border text-muted-foreground opacity-60"
                    : state === "active"
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border text-foreground"
                }`}
              >
                {state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Loader2 className={`h-4 w-4 shrink-0 ${state === "active" ? "animate-spin text-primary" : ""}`} />
                )}
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
